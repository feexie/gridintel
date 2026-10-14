import type { AssetsWorkspaceView } from "../assets/views.ts";
import type { EventsWorkspaceView } from "../events/views.ts";
import type { ExecutiveView } from "../executive/views.ts";
import type { AttentionItemView, UtilityOverviewView, WorkspaceLinkView } from "../overview/views.ts";
import type { ReliabilityWorkspaceView } from "../reliability/views.ts";
import { AGREEMENT_TOLERANCE, byLargestDifference, rowDiffers } from "../operations/comparison.ts";
import { mergeSourcing, registryCount } from "../operations/metric.ts";

/* ==========================================================
   SERVICES — UTILITY OVERVIEW

   "What needs attention here?" for the Utility sector, in a few
   lines. It is put together from four read models that already
   exist (Executive, Events / Alarms, Assets, Reliability) and adds
   no figure: every number is the MetricView of the screen the line
   leads to.

   THE LINES, IN THIS FIXED ORDER. No scoring and no weighting.

   1. in_progress      every interruption the outage log holds as
                       in progress at the as-of time;
   2. asset_risk       every transformer loaded above its rating,
                       in the Executive read model's order;
   3. revenue          the feeder first in the Executive read
                       model's ranking by revenue not realised;
   4. report_differs   the reported reliability figure that differs
                       most from the calculation on its own basis,
                       measured against the reported figure, when
                       any differs by more than the tolerance;
   5. standing_alarms  one line when a source alarm is standing;
   6. assets_listed    one line when the Assets workspace lists any
                       asset for attention.

   Lines 4 and 5 state how long a list on another screen is. A count
   of that kind is a fact about the records, like the counts the
   Events / Alarms screen gives per place; it is not a KPI.
========================================================== */

export const UTILITY_WORKSPACE_LINKS: WorkspaceLinkView[] = [
  { workspace: "utility.executive", label: "Executive", question: "What is happening across the portfolio, and where should I look first?" },
  { workspace: "utility.operations", label: "Operations", question: "What does the network look like, level by level, from region to service point?" },
  { workspace: "utility.reliability", label: "Reliability", question: "Which feeders fail their customers, why, and is it ours to fix?" },
  { workspace: "utility.revenue", label: "Revenue", question: "Where is revenue not realised, who is not paying, and is the loss commercial or collection?" },
  { workspace: "utility.assets", label: "Assets", question: "Which assets require attention?" },
  { workspace: "utility.events", label: "Events / Alarms", question: "What is wrong now, where, and who is affected?" },
];

const RULES = {
  in_progress: "Every interruption the outage log holds as in progress at the as-of time. The count of customers is the outage record's own.",
  asset_risk: "Every transformer whose loading exceeded its rating at a reading in the period, highest peak first. Not ranked by money.",
  revenue: "The feeder with the largest estimated revenue not realised in the period. A monthly estimate, not an amount owed.",
  report_differs: `A reliability figure a report states, on the same basis as the calculation from the outage log and more than ${AGREEMENT_TOLERANCE * 100}% of its own value away from it. Only the largest difference is listed here, measured against the reported figure itself; the Reliability workspace sets every reported figure beside its calculation.`,
  standing_alarms: "Listed when at least one alarm recorded by a source system is standing at the as-of time. The alarms are the source's, not GridIntel's.",
  assets_listed: "Listed when the Assets workspace lists any asset: one with a standing source alarm, a derived condition, or interruptions that began at it.",
};

export function utilityOverviewView(input: { executive: ExecutiveView; events: EventsWorkspaceView; assets: AssetsWorkspaceView; reliability: ReliabilityWorkspaceView }): UtilityOverviewView {
  const { executive, events, assets, reliability } = input;
  const attention: AttentionItemView[] = [];

  for (const row of events.now.interruptions.inProgress) {
    attention.push({
      id: `in_progress:${row.outageId}`,
      rule: "in_progress",
      tone: "alert",
      kind: "In progress now",
      statement: `${row.cause} at ${row.beganAt.label}, ${row.affectedWords} still without supply.`,
      figure: row.customers,
      figureSigned: false,
      figureNote: "customers affected, as the outage record gives it",
      more: [],
      comparisons: [],
      ruleText: RULES.in_progress,
      target: { type: "workspace", workspace: "utility.events" },
      targetLabel: "Open Events / Alarms",
    });
  }

  for (const entry of executive.assetRisk) {
    const [first, ...rest] = entry.findings;
    if (first === undefined) continue;
    attention.push({
      id: `asset_risk:${entry.subject.id}`,
      rule: "asset_risk",
      tone: "alert",
      kind: "Asset risk",
      statement: `${entry.subject.name}: ${first.title.toLowerCase()}.`,
      figure: first.metric,
      figureSigned: false,
      figureNote: first.detail === null ? null : `${first.detail.value} ${first.detail.label}`,
      more: rest.map((finding) => finding.metric),
      comparisons: [],
      ruleText: RULES.asset_risk,
      target: { type: "level", kind: entry.subject.kind, id: entry.subject.id },
      targetLabel: `Open ${entry.subject.name}`,
    });
  }

  const [topFeeder] = executive.whereToLook.money;
  if (topFeeder?.money) {
    attention.push({
      id: `revenue:${topFeeder.subject.id}`,
      rule: "revenue",
      tone: "watch",
      kind: "Revenue not realised",
      statement: `${topFeeder.subject.name} has the largest revenue not realised of ${executive.whereToLook.moneyTotal} feeders.`,
      figure: topFeeder.money,
      figureSigned: false,
      figureNote: "monthly estimate",
      more: topFeeder.findings.map((finding) => finding.metric),
      comparisons: [],
      ruleText: RULES.revenue,
      target: { type: "workspace", workspace: "utility.revenue" },
      targetLabel: "Open Revenue",
    });
  }

  const differing = reliability.comparisons.filter(rowDiffers);
  const [largest] = [...differing].sort(byLargestDifference);
  if (largest !== undefined) {
    const where = largest.statedFor ?? reliability.organization ?? "The portfolio";
    attention.push({
      id: `report_differs:${where}:${largest.label}`,
      rule: "report_differs",
      tone: "alert",
      kind: "Report differs from the records",
      statement: `${where}: the ${largest.label} its report states is furthest from the outage log. ${differing.length} of the ${reliability.comparisons.length} reliability figures reported differ.`,
      figure: null,
      figureSigned: false,
      figureNote: null,
      more: [],
      comparisons: [largest],
      ruleText: RULES.report_differs,
      target: { type: "workspace", workspace: "utility.reliability" },
      targetLabel: "Open Reliability",
    });
  }

  const standing = events.now.alarms;
  if (standing.length > 0) {
    const [first] = standing;
    attention.push({
      id: "standing_alarms",
      rule: "standing_alarms",
      tone: "watch",
      kind: "Source alarms standing",
      statement: `Most severe: ${first.alarm.message} (${first.alarm.subject.label}).`,
      figure: registryCount("Source alarms standing", standing.length, "As recorded by the source system at the as-of time."),
      figureSigned: false,
      figureNote: standing.length === 1 ? "source alarm standing" : "source alarms standing",
      more: [],
      comparisons: [],
      ruleText: RULES.standing_alarms,
      target: { type: "workspace", workspace: "utility.events" },
      targetLabel: "Open Events / Alarms",
    });
  }

  if (assets.attention.length > 0) {
    attention.push({
      id: "assets_listed",
      rule: "assets_listed",
      tone: "note",
      kind: "Assets listed for attention",
      statement: `Of ${assets.assetsChecked} in-service assets checked: those with a standing source alarm, a derived condition, or interruptions that began at them.`,
      figure: registryCount("Assets listed for attention", assets.attention.length),
      figureSigned: false,
      figureNote: assets.attention.length === 1 ? "asset listed" : "assets listed",
      more: [],
      comparisons: [],
      ruleText: `${RULES.assets_listed} ${assets.attentionRule}`,
      target: { type: "workspace", workspace: "utility.assets" },
      targetLabel: "Open Assets",
    });
  }

  const losses = executive.losses;
  const log = events.now.interruptions.completeness;
  return {
    sector: "utility",
    title: "Utility Intelligence",
    organization: executive.organization,
    attention,
    attentionNote:
      log !== "complete"
        ? "The outage log is not complete, so an interruption that is not listed may still be in progress."
        : attention.length === 0
          ? "None of the six rules lists anything for this period."
          : null,
    headline: [...(losses === null ? [] : [losses.atcc, losses.collectionEfficiency]), executive.revenueGap.notRealised],
    lossSplit:
      losses === null
        ? null
        : {
            total: losses.atcc,
            parts: [
              { key: "technical", metric: losses.parts.technical },
              { key: "commercial", metric: losses.parts.commercial },
              { key: "collection", metric: losses.parts.collection },
            ],
            scopeNote: losses.scopeNote,
          },
    lossSplitNote: losses === null ? executive.lossesNote : null,
    workspaces: UTILITY_WORKSPACE_LINKS,
    sourcing: [events.sourcing, assets.sourcing, executive.revenueGap.sourcing, reliability.sourcing].reduce(mergeSourcing),
  };
}
