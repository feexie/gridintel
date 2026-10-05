import type { InterruptionOrigin, KpiKey, KpiUnit } from "@/domain";
import type { CalculatedKpi } from "../core/result.ts";
import { convertUnit } from "../core/units.ts";
import { attributionRuleMatters } from "./compare.ts";

/* ==========================================================
   ANALYTICS — WHAT AN ATTRIBUTION RULE CHANGES

   A reported reliability figure may state its attribution rule: the
   origin points it treats as upstream. When that rule is not the
   reference methodology's, the calculation set beside the reported
   figure is made on the reported rule, so the two are like for like.

   That comparison alone would hide what the rule does. A utility
   that books faults on its own sub-transmission lines as upstream
   reports a small network figure, and a calculation on the same rule
   agrees with it. The difference the rule makes is therefore stated
   as a finding of its own:

     difference = figure on the reference rule − figure on the reported rule

   over the same interruptions, the same classes counted and the same
   customers served. Only the rule differs, so the difference is the
   rule's effect and nothing else. It is positive when the reported
   rule moves interruptions out of the classes the figure counts.

   No finding exists when the two rules are the same, when either
   figure does not state its rule, or when the figure counts every
   class an interruption can be moved between (a total is the same
   under any rule).
========================================================== */

export interface AttributionRuleDifference {
  metric: KpiKey;
  /** Origin points the reported rule treats as upstream and the reference rule does not. */
  upstreamOnlyOnReportedRule: InterruptionOrigin[];
  /** Origin points the reference rule treats as upstream and the reported rule does not. */
  upstreamOnlyOnReferenceRule: InterruptionOrigin[];
  onReportedRule: CalculatedKpi;
  onReferenceRule: CalculatedKpi;
  /** Reference − reported rule, in `unit`; null when either figure has no value. */
  difference: number | null;
  /** The unit of the reference figure. */
  unit: KpiUnit;
}

const ORIGIN_ORDER: readonly InterruptionOrigin[] = [
  "grid",
  "transmission_station",
  "subtransmission_line",
  "mv_feeder",
  "distribution_transformer",
  "lv_network",
];

/** Those of `a` not in `b`, always from the grid down, however they were listed. */
function only(a: readonly InterruptionOrigin[], b: readonly InterruptionOrigin[]): InterruptionOrigin[] {
  return ORIGIN_ORDER.filter((origin) => a.includes(origin) && !b.includes(origin));
}

function sameSet(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((value, i) => value === y[i]);
}

/**
 * What the reported attribution rule changes, as the difference between the
 * same figure calculated on the reference rule and on the reported rule.
 * Null when there is no such finding (see above). The two figures must be
 * the same metric, for the same classes; otherwise their difference would
 * not be the rule's effect, and none is given.
 */
export function attributionRuleDifference(onReportedRule: CalculatedKpi, onReferenceRule: CalculatedKpi): AttributionRuleDifference | null {
  const reported = onReportedRule.basis.upstreamOrigins;
  const reference = onReferenceRule.basis.upstreamOrigins;
  if (reported === undefined || reference === undefined) return null;
  if (onReportedRule.metric !== onReferenceRule.metric) return null;
  if (!attributionRuleMatters(onReferenceRule.metric, onReferenceRule.basis)) return null;
  if (!sameSet(onReportedRule.basis.interruptionClasses, onReferenceRule.basis.interruptionClasses)) return null;
  if (onReportedRule.basis.plannedInterruptions !== onReferenceRule.basis.plannedInterruptions) return null;

  const upstreamOnlyOnReportedRule = only(reported, reference);
  const upstreamOnlyOnReferenceRule = only(reference, reported);
  if (upstreamOnlyOnReportedRule.length === 0 && upstreamOnlyOnReferenceRule.length === 0) return null;

  const unit = onReferenceRule.unit;
  const other = onReportedRule.value === null ? null : convertUnit(onReportedRule.value, onReportedRule.unit, unit);
  return {
    metric: onReferenceRule.metric,
    upstreamOnlyOnReportedRule,
    upstreamOnlyOnReferenceRule,
    onReportedRule,
    onReferenceRule,
    difference: onReferenceRule.value === null || other === null ? null : onReferenceRule.value - other,
    unit,
  };
}
