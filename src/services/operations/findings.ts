import type { AttentionItemView } from "../overview/views.ts";
import type { NetworkLevelView } from "./views.ts";
import { byLargestDifference, rowDiffers } from "./comparison.ts";
import { registryCount } from "./metric.ts";

/* ==========================================================
   SERVICES — WHAT NEEDS ATTENTION AT A NETWORK LEVEL

   The first thing a region, substation, feeder or transformer
   screen shows: what stands out at this level, in the design
   system's one way of showing a finding. Every figure is the
   level's own MetricView, taken unchanged from the blocks below it
   on the same screen, and each line leads to the section of the
   screen that holds it.

   THE RULES, IN THIS FIXED ORDER. No scoring and no weighting.

   1. over_rating       the level's own loading went above its rating;
   2. still_open        an interruption is still open, so the
                        reliability figures are provisional;
   3. report_differs    a reported figure differs from the calculation
                        on its own basis by more than the tolerance;
                        the largest, measured against the reported
                        figure itself, is shown;
   4. rule_finding      a report states an attribution rule other than
                        the reference rule, and it moves the figure;
   5. below_band        supply fell below the service-band minimum on
                        at least one day;
   6. alarms_standing   a source alarm stands at the as-of time;
   7. conditions_hold   a condition GridIntel derived holds at the
                        as-of time.
========================================================== */

const RULES = {
  over_rating: "Listed when the level's own loading went above 100% of its rating at an hourly reading in the period.",
  still_open: "Listed when an interruption at this level is still open at the end of the period: the reliability figures are counted to the period's end and are not final.",
  report_differs:
    "Listed when a figure a report states, on the same basis as the calculation, is more than 1% of its own value away from it. The largest difference, measured against the reported figure itself, is shown; the others are in the sections below.",
  rule_finding: "Listed when a report states an attribution rule other than the GridIntel reference rule, and that rule changes the figure in this period.",
  below_band: "Listed when the hours of supply fell below the service-band minimum on at least one day. The day-by-day test is a GridIntel reference calculation, not a regulatory determination.",
  alarms_standing: "Listed when an alarm recorded by a source system is standing at the as-of time. The alarms are the source's, not GridIntel's.",
  conditions_hold: "Listed when a condition GridIntel derived from telemetry holds at the as-of time. A condition is not an alarm.",
};

export function levelFindings(view: Omit<NetworkLevelView, "findings">): AttentionItemView[] {
  const items: AttentionItemView[] = [];
  const name = view.header.title;
  const { loading, reliability, alarms } = view;

  if (loading?.overloaded === true) {
    items.push({
      id: "over_rating",
      rule: "over_rating",
      tone: "alert",
      kind: "Asset risk",
      statement: `${name} was loaded above its rating in the period.`,
      figure: loading.peak,
      figureSigned: false,
      figureNote: loading.hoursOverRating === null ? "peak loading" : `peak · ${loading.hoursOverRating} of ${loading.hoursObserved ?? "—"} hourly readings over rating`,
      more: [loading.asOf],
      comparisons: [],
      ruleText: RULES.over_rating,
      target: { type: "section", id: "loading" },
      targetLabel: "See the loading",
    });
  }

  if (reliability.provisional) {
    items.push({
      id: "still_open",
      rule: "still_open",
      tone: "alert",
      kind: "Interruption still open",
      statement: reliability.provisional,
      figure: null,
      figureSigned: false,
      figureNote: null,
      more: [],
      comparisons: [],
      ruleText: RULES.still_open,
      target: { type: "section", id: "reliability" },
      targetLabel: "See reliability",
    });
  }

  const reported = [...(view.losses?.reported ?? []).map((row) => ({ row, section: "losses" })), ...reliability.reported.map((row) => ({ row, section: "reliability" }))];
  const differing = reported.filter(({ row }) => rowDiffers(row));
  const [largest] = [...differing].sort((a, b) => byLargestDifference(a.row, b.row));
  if (largest !== undefined) {
    items.push({
      id: `report_differs:${largest.row.statedFor ?? ""}:${largest.row.label}`,
      rule: "report_differs",
      tone: "alert",
      kind: "Report differs from the records",
      statement: `${differing.length} of the ${reported.length} reported figures differ from the calculation on their own basis. Furthest: ${largest.row.label}${largest.row.statedFor ? ` for ${largest.row.statedFor}` : ""}.`,
      figure: null,
      figureSigned: false,
      figureNote: null,
      more: [],
      comparisons: [largest.row],
      ruleText: RULES.report_differs,
      target: { type: "section", id: largest.section },
      targetLabel: "See reported against calculated",
    });
  }

  for (const found of reliability.ruleFindings) {
    if (found.difference.value === null || found.difference.value === 0) continue;
    items.push({
      id: `rule_finding:${found.statedFor.id}:${found.figure}`,
      rule: "rule_finding",
      tone: "watch",
      kind: "Report's attribution rule",
      statement: `${found.statedFor.name}, reported ${found.figure}: ${found.statement.charAt(0).toLowerCase()}${found.statement.slice(1)}.`,
      figure: found.difference,
      figureSigned: true,
      figureNote: `${found.figure} under the reference rule`,
      more: [found.onReportedRule, found.onReferenceRule],
      comparisons: [],
      ruleText: RULES.rule_finding,
      target: { type: "section", id: "reliability" },
      targetLabel: "See reliability",
    });
  }

  const supply = reliability.supply;
  if (supply.band !== null && (supply.daysNonCompliant ?? 0) > 0) {
    items.push({
      id: "below_band",
      rule: "below_band",
      tone: "watch",
      kind: "Below the service band",
      statement: `Supply fell below the Band ${supply.band} minimum of ${supply.minimumHours} h on ${supply.daysNonCompliant} of ${supply.days.length} days.`,
      figure: supply.averageHours,
      figureSigned: false,
      figureNote: supply.compliantOnAverage === null ? "average" : supply.compliantOnAverage ? "average, which meets the minimum" : "average, which is below the minimum",
      more: [],
      comparisons: [],
      ruleText: RULES.below_band,
      target: { type: "section", id: "reliability" },
      targetLabel: "See the days",
    });
  }

  const standing = alarms.recorded.active;
  if (standing.length > 0) {
    items.push({
      id: "alarms_standing",
      rule: "alarms_standing",
      tone: "watch",
      kind: "Source alarms standing",
      statement: `Most severe: ${standing[0].message.replace(/\.$/, "")} (${standing[0].subject.label}).`,
      figure: registryCount("Source alarms standing", standing.length, "As recorded by the source system at the as-of time."),
      figureSigned: false,
      figureNote: standing.length === 1 ? "source alarm standing" : "source alarms standing",
      more: [],
      comparisons: [],
      ruleText: RULES.alarms_standing,
      target: { type: "section", id: "alarms" },
      targetLabel: "See the alarms",
    });
  }

  const holding = alarms.derived.conditions.filter((condition) => condition.activeNow === true);
  if (holding.length > 0) {
    items.push({
      id: "conditions_hold",
      rule: "conditions_hold",
      tone: "note",
      kind: "Derived conditions that hold",
      statement: `${holding.map((condition) => `${condition.ruleName} on ${condition.subject.label}`).join("; ")}.`,
      figure: registryCount("Derived conditions that hold", holding.length),
      figureSigned: false,
      figureNote: holding.length === 1 ? "condition holds" : "conditions hold",
      more: [],
      comparisons: [],
      ruleText: RULES.conditions_hold,
      target: { type: "section", id: "alarms" },
      targetLabel: "See the conditions",
    });
  }

  return items;
}

/** A level's view with what needs attention at it. */
export function withFindings(view: Omit<NetworkLevelView, "findings">): NetworkLevelView {
  return { ...view, findings: levelFindings(view) };
}
