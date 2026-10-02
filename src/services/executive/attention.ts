import type { LevelKind, MetricView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — WHERE TO LOOK FIRST

   A list of facts produced by fixed rules over service results.
   There is no scoring model, no weighting and no generated text.
   Each finding names the rule that produced it and carries its
   figure with that figure's own status, origin and method. A figure
   with no value never produces a finding.

   THREE GROUPS, IN THIS ORDER

   1. ASSET RISK. Equipment at risk of failure is not a money
      question and is never ranked by money. Every transformer
      loaded above its rating is listed here, highest peak first.

   2. REVENUE, RANKED BY MONEY. Feeders, ranked by their estimated
      revenue not realised, largest first. Only feeders are ranked,
      because their figures do not overlap: a transformer's
      commercial gap is already part of its feeder's total and must
      not compete with it.

   3. OTHER. Subjects with a finding but no money figure to rank
      by, in the fixed order of the rules.

   EACH SUBJECT APPEARS ONCE, in the first group it qualifies for,
   with every rule it triggered listed under it.
========================================================== */

export interface FeederSignals {
  id: string;
  name: string;
  /** Estimated revenue not realised in the period. */
  revenueNotRealised: MetricView;
  atcc: MetricView;
  collectionEfficiency: MetricView;
  networkSaidi: MetricView;
  supply: { band: string | null; minimumHours: number | null; averageHours: MetricView; daysBelowMinimum: number | null };
}

export interface TransformerSignals {
  id: string;
  name: string;
  feederName: string;
  /** Peak loading in the period; null when it could not be calculated. */
  peakLoading: MetricView | null;
  hoursOverRating: number | null;
  commercialLoss: MetricView;
  /** The transformer's commercial gap, which is part of its feeder's revenue not realised. */
  commercialGap: MetricView;
}

export interface Finding {
  /** The fixed rule that produced this finding. */
  rule: string;
  title: string;
  metric: MetricView;
  /** A second number that belongs with the first, e.g. hours over rating. */
  detail: { label: string; value: number } | null;
  /** A related figure shown for context and never ranked by. */
  context: { metric: MetricView; note: string } | null;
}

export type AttentionGroup = "asset_risk" | "money" | "other";

export interface AttentionSubject {
  /** Position within its list: asset risk is numbered on its own; money and other share one sequence. */
  rank: number;
  group: AttentionGroup;
  subject: { kind: LevelKind; id: string; name: string };
  /** The money figure the subject is ranked by; set only in the money group. */
  money: MetricView | null;
  findings: Finding[];
}

export interface Attention {
  assetRisk: AttentionSubject[];
  /** Money-ranked feeders first, then the subjects with no money figure. */
  ranked: AttentionSubject[];
}

export const ATTENTION_METHOD =
  "How this list is made. Findings come from fixed rules: (1) a transformer loaded above its rating; (2) the feeder with the largest " +
  "revenue not realised; (3) the feeder with the highest ATC&C; (4) a feeder that fell below its service-band minimum on at least one " +
  "day; (5) the feeder with the lowest collection efficiency; (6) the transformer with the highest commercial loss; (7) the feeder " +
  "with the highest network-attributable SAIDI. Asset risk is its own group, shown first and never ranked by money: transformers " +
  "over rating, highest peak first. Feeders are then ranked by estimated revenue not realised, largest first. Only feeders are " +
  "ranked by money, because a transformer's commercial gap is already part of its feeder's total. Subjects with no money figure " +
  "follow in rule order. Each subject appears once, with every rule it triggered. Money figures are monthly estimates of revenue " +
  "not realised, not amounts owed. Figures with no value produce no finding. No weighting, no AI.";

const RULES = {
  overRating: "Transformer loaded above its rating",
  largestGap: "Feeder with the largest revenue not realised",
  highestAtcc: "Feeder with the highest ATC&C",
  belowBand: "Feeder below its service-band minimum on at least one day",
  lowestCollection: "Feeder with the lowest collection efficiency",
  highestCommercial: "Transformer with the highest commercial loss",
  highestNetworkSaidi: "Feeder with the highest network-attributable SAIDI",
} as const;

const RULE_ORDER: readonly string[] = Object.values(RULES);

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The entry with the highest (or lowest) value; entries without a value are left out. Ties go to the lower id. */
function extreme<T extends { id: string }>(entries: readonly T[], pick: (entry: T) => MetricView, direction: "highest" | "lowest"): T | null {
  let best: T | null = null;
  for (const entry of [...entries].sort(byId)) {
    const value = pick(entry).value;
    if (value === null) continue;
    const bestValue = best === null ? null : (pick(best).value as number);
    if (bestValue === null || (direction === "highest" ? value > bestValue : value < bestValue)) best = entry;
  }
  return best;
}

function positive(metric: MetricView | null): number | null {
  return metric !== null && metric.value !== null && metric.value > 0 ? metric.value : null;
}

export function attention(feeders: readonly FeederSignals[], transformers: readonly TransformerSignals[]): Attention {
  const findings = new Map<string, { subject: AttentionSubject["subject"]; findings: Finding[] }>();
  const add = (kind: LevelKind, source: { id: string; name: string }, finding: Finding) => {
    const key = `${kind}:${source.id}`;
    const entry = findings.get(key) ?? { subject: { kind, id: source.id, name: source.name }, findings: [] };
    entry.findings.push(finding);
    findings.set(key, entry);
  };

  // Rule 1: transformers over rating.
  for (const dt of transformers) {
    if (dt.peakLoading === null || dt.peakLoading.value === null || (dt.hoursOverRating ?? 0) <= 0) continue;
    add("distribution_transformer", dt, {
      rule: RULES.overRating,
      title: "Loaded above its rating",
      metric: dt.peakLoading,
      detail: { label: "hours over rating", value: dt.hoursOverRating as number },
      context: null,
    });
  }

  // Rule 2: the feeder with the largest revenue not realised.
  const largestGap = extreme(feeders.filter((feeder) => positive(feeder.revenueNotRealised) !== null), (feeder) => feeder.revenueNotRealised, "highest");
  if (largestGap) {
    add("feeder", largestGap, { rule: RULES.largestGap, title: "Largest revenue not realised among feeders", metric: largestGap.revenueNotRealised, detail: null, context: null });
  }

  // Rule 3: the feeder with the highest ATC&C.
  const worstAtcc = extreme(feeders, (feeder) => feeder.atcc, "highest");
  if (worstAtcc) {
    add("feeder", worstAtcc, { rule: RULES.highestAtcc, title: "Highest ATC&C among feeders", metric: worstAtcc.atcc, detail: null, context: null });
  }

  // Rule 4: feeders below their service-band minimum on at least one day.
  for (const feeder of [...feeders].sort(byId)) {
    if ((feeder.supply.daysBelowMinimum ?? 0) <= 0 || feeder.supply.averageHours.value === null) continue;
    add("feeder", feeder, {
      rule: RULES.belowBand,
      title: `Below its Band ${feeder.supply.band} minimum of ${feeder.supply.minimumHours} h`,
      metric: feeder.supply.averageHours,
      detail: { label: "days below minimum", value: feeder.supply.daysBelowMinimum as number },
      context: null,
    });
  }

  // Rule 5: the feeder with the lowest collection efficiency.
  const worstCollection = extreme(feeders, (feeder) => feeder.collectionEfficiency, "lowest");
  if (worstCollection) {
    add("feeder", worstCollection, {
      rule: RULES.lowestCollection,
      title: "Lowest collection efficiency among feeders (cash basis)",
      metric: worstCollection.collectionEfficiency,
      detail: null,
      context: null,
    });
  }

  // Rule 6: the transformer with the highest commercial loss. Its gap is context, never a rank.
  const worstCommercial = extreme(transformers, (dt) => dt.commercialLoss, "highest");
  if (worstCommercial) {
    add("distribution_transformer", worstCommercial, {
      rule: RULES.highestCommercial,
      title: "Highest commercial loss among transformers",
      metric: worstCommercial.commercialLoss,
      detail: null,
      context:
        worstCommercial.commercialGap.value === null
          ? null
          : {
              metric: worstCommercial.commercialGap,
              note: `part of ${worstCommercial.feederName}'s revenue not realised; not ranked separately`,
            },
    });
  }

  // Rule 7: the feeder with the highest network-attributable SAIDI.
  const worstNetwork = extreme(feeders, (feeder) => feeder.networkSaidi, "highest");
  if (worstNetwork) {
    add("feeder", worstNetwork, {
      rule: RULES.highestNetworkSaidi,
      title: "Highest network-attributable SAIDI among feeders",
      metric: worstNetwork.networkSaidi,
      detail: null,
      context: null,
    });
  }

  const firstRule = (entry: { findings: Finding[] }) => Math.min(...entry.findings.map((finding) => RULE_ORDER.indexOf(finding.rule)));
  const money = new Map(feeders.map((feeder) => [`feeder:${feeder.id}`, feeder.revenueNotRealised]));
  const peak = (entry: { findings: Finding[] }) => entry.findings.find((finding) => finding.rule === RULES.overRating)?.metric.value ?? 0;

  const assetRisk: Omit<AttentionSubject, "rank">[] = [];
  const ranked: Omit<AttentionSubject, "rank">[] = [];
  const other: Omit<AttentionSubject, "rank">[] = [];
  for (const [key, entry] of findings) {
    const figure = money.get(key) ?? null;
    if (entry.findings.some((finding) => finding.rule === RULES.overRating)) {
      assetRisk.push({ group: "asset_risk", subject: entry.subject, money: null, findings: entry.findings });
    } else if (positive(figure) !== null) {
      ranked.push({ group: "money", subject: entry.subject, money: figure, findings: entry.findings });
    } else {
      other.push({ group: "other", subject: entry.subject, money: null, findings: entry.findings });
    }
  }

  assetRisk.sort((a, b) => peak(b) - peak(a) || byId(a.subject, b.subject));
  ranked.sort((a, b) => (b.money?.value as number) - (a.money?.value as number) || byId(a.subject, b.subject));
  other.sort((a, b) => firstRule(a) - firstRule(b) || byId(a.subject, b.subject));

  return {
    assetRisk: assetRisk.map((item, i) => ({ ...item, rank: i + 1 })),
    ranked: [...ranked, ...other].map((item, i) => ({ ...item, rank: i + 1 })),
  };
}
