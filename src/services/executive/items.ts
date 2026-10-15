import type { AttentionFindingView, AttentionItemView, AttentionTone } from "../overview/views.ts";
import type { AttentionGroup, AttentionSubject, Finding } from "./attention.ts";

/* ==========================================================
   SERVICES — "WHERE TO LOOK FIRST" AS FINDINGS

   The Executive's subjects, each laid out in the design system's
   one way of showing a finding (AttentionItemView), so that the
   Executive reads like the Overviews. Nothing is chosen, ranked or
   cut here: the subjects come in the read model's order, and each
   keeps every rule it triggered, each with its own figure.

   The figure shown first is a subject's money figure in the money
   ranking (what it is ranked by), and otherwise the figure of its
   first finding; the other findings follow it.
========================================================== */

const GROUP: Record<AttentionGroup, { tone: AttentionTone; kind: string; rule: string }> = {
  asset_risk: {
    tone: "alert",
    kind: "Asset risk",
    rule: "Equipment loaded above its rating: its own group, shown first, highest peak first, and never ranked by money.",
  },
  money: {
    tone: "watch",
    kind: "Revenue not realised",
    rule: "Feeders ranked by estimated revenue not realised in the period, largest first. A monthly estimate, not an amount owed.",
  },
  other: {
    tone: "note",
    kind: "Other finding",
    rule: "A subject with a finding and no money figure to rank by, in the order of the rules.",
  },
};

function noteOf(finding: Finding): string | null {
  const words = [finding.suffix ?? null, finding.detail === null ? null : `${finding.detail.value} ${finding.detail.label}`].filter((word) => word !== null);
  return words.length === 0 ? null : words.join(" · ");
}

function findingView(finding: Finding): AttentionFindingView {
  return {
    title: finding.title,
    figure: finding.metric,
    signed: finding.signed === true,
    note: noteOf(finding),
    context: finding.context === null ? null : { figure: finding.context.metric, note: finding.context.note },
  };
}

/** One subject as one finding. `moneyTotal` is how many feeders the money ranking holds, listed or not. */
export function lookFirstItem(entry: AttentionSubject, moneyTotal: number): AttentionItemView {
  const group = GROUP[entry.group];
  const byMoney = entry.group === "money" && entry.money !== null;
  const [first, ...rest] = entry.findings;
  // Only equipment at risk leads with a figure of its own; a ranked feeder leads with its money, and any
  // other subject lists every rule it met, each with its figure and what that figure is part of.
  const lead = entry.group === "asset_risk" && first !== undefined ? first : null;
  return {
    id: `${entry.group}:${entry.subject.id}`,
    rule: entry.group,
    tone: group.tone,
    kind: group.kind,
    statement: byMoney
      ? `${entry.subject.name}: ${entry.rank} of ${moneyTotal} feeders by revenue not realised.`
      : lead !== null
        ? `${entry.subject.name}: ${lead.title.charAt(0).toLowerCase()}${lead.title.slice(1)}.`
        : `${entry.subject.name}: ${entry.findings.length === 1 ? "one rule" : `${entry.findings.length} rules`} met.`,
    figure: byMoney ? entry.money : (lead?.metric ?? null),
    figureSigned: lead?.signed === true,
    figureNote: byMoney ? "revenue not realised, monthly estimate" : lead === null ? null : noteOf(lead),
    more: [],
    findings: (lead === null ? entry.findings : rest).map(findingView),
    comparisons: [],
    ruleText: `${group.rule} Rules this subject met: ${entry.findings.map((finding) => finding.title).join("; ") || "none besides its rank"}.`,
    target: { type: "level", kind: entry.subject.kind, id: entry.subject.id },
    targetLabel: `Open ${entry.subject.name}`,
  };
}
