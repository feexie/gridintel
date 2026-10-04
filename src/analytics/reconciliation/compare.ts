import type { InterruptionClass, KpiBasis, KpiKey, KpiUnit, Period, ReportedKpi, ScopeRef, UnresolvedRef } from "@/domain";
import type { CalculatedKpi } from "../core/result.ts";
import { qualityRank } from "../core/quality.ts";
import { isComputed } from "../core/result.ts";
import { toEpochMs } from "../core/time.ts";
import { convertUnit, dimensionOf } from "../core/units.ts";

/* ==========================================================
   ANALYTICS — REPORTED vs CALCULATED KPI RECONCILIATION

   Puts a ReportedKpi next to a CalculatedKpi and explains the
   difference. Both are returned untouched: the reported value is
   never overwritten, and nothing here changes either record.

   Variance is expressed in the REPORTED unit:
   - absolute variance = calculated − reported; for ratios it is in
     percentage points;
   - relative variance = (calculated − reported) ÷ |reported|, as a
     fraction, and only when the reported value is not 0.

   Every reason the two figures may not be like-for-like is listed.
   `comparable` is false if any blocking reason applies; the
   variance is still shown when the units allow it.

   BASIS. Two figures with the same name can count different things:
   SAIDI with or without load shedding, collection on a cash or an
   accrual basis. Each metric has basis dimensions that matter for it
   (`basisDimensions`). A reported figure is like for like with a
   calculated one only when every such dimension is STATED on both
   and EQUAL. A basis that is not stated is never assumed to match.
   When the bases differ or are not stated the comparison is not
   comparable and no variance is given: a difference between figures
   that count different things means nothing.

   `compareOnBasis` picks, from several calculated figures for the
   same metric (e.g. total SAIDI and network-only SAIDI), the one on
   the reported figure's basis.

   ATTRIBUTION RULE. A reliability basis says which classes of
   interruption a figure counts. It may also say HOW an interruption
   was put in a class: which origin points the figure treats as
   upstream (`upstreamOrigins`). That matters only for a figure that
   counts some of the classes an interruption can be moved between
   (network, upstream supply, other) and not all of them.
   - Stated on both sides and equal: like for like.
   - Stated on both sides and different: not comparable, no variance.
     The caller is expected to supply a calculation on the reported
     rule, so this is the fallback and not the usual outcome.
   - Not stated by the reported figure: the comparison is still made,
     because the classes counted are the same, but it carries a note
     that the variance may reflect a difference in classification.
     The rule is not assumed to match, and it is not assumed to differ.
========================================================== */

export interface ComparabilityIssue {
  code:
    | "CALCULATION_NOT_OK"
    | "METRIC_MISMATCH"
    | "UNIT_DIMENSION_MISMATCH"
    | "SCOPE_UNRESOLVED"
    | "SCOPE_MISMATCH"
    | "PERIOD_UNSPECIFIED"
    | "PERIOD_MISMATCH"
    | "AS_OF_MISMATCH"
    | "BASIS_UNSPECIFIED"
    | "BASIS_MISMATCH"
    | "ATTRIBUTION_RULE_UNSPECIFIED"
    | "ATTRIBUTION_RULE_MISMATCH"
    | "METHODOLOGY_UNSPECIFIED"
    | "METHODOLOGY_NOT_VERIFIED"
    | "INPUTS_FROM_REPORTED"
    | "CALCULATION_QUALITY_LIMITED";
  message: string;
  /** Blocking issues make the comparison not like-for-like. */
  blocking: boolean;
}

export interface KpiComparison {
  kind: "kpi_comparison";
  metric: KpiKey;
  scope: ScopeRef | UnresolvedRef;
  period: Period | null;
  /** The reported record, exactly as supplied. */
  reported: ReportedKpi;
  /** The calculated record, exactly as supplied. */
  calculated: CalculatedKpi;
  /** The calculated value converted into the reported unit; null if not possible. */
  calculatedInReportedUnit: number | null;
  variance: {
    absolute: number | null;
    absoluteUnit: KpiUnit | "percentage_points";
    /** A fraction, e.g. 0.25 = 25% above the reported value. */
    relative: number | null;
  };
  comparable: boolean;
  /**
   * True when every basis dimension that matters for the metric is stated on both sides and
   * equal. An attribution rule the reported figure does not state leaves this true: the
   * figures count the same classes, and the comparison carries a note instead.
   */
  sameBasis: boolean;
  issues: ComparabilityIssue[];
}

type BasisDimension = keyof KpiBasis;

const RELIABILITY_BASIS: BasisDimension[] = ["interruptionClasses", "plannedInterruptions"];

/** The basis dimensions that change a metric's value. Metrics not listed have none. */
export function basisDimensions(metric: KpiKey): BasisDimension[] {
  switch (metric) {
    case "saidi":
    case "saifi":
    case "caidi":
    case "asai":
    case "availability":
      return RELIABILITY_BASIS;
    case "collection_efficiency":
      return ["collection"];
    case "atcc":
      return ["lossBasis", "collection"];
    case "technical_loss":
    case "commercial_loss":
    case "billing_efficiency":
      return ["lossBasis"];
    default:
      return [];
  }
}

const DIMENSION_NAME: Record<BasisDimension, string> = {
  interruptionClasses: "which interruptions are counted",
  plannedInterruptions: "whether planned interruptions are counted",
  upstreamOrigins: "which origin points are treated as upstream",
  collection: "the collection basis (cash or accrual)",
  lossBasis: "what energy the loss is a fraction of",
};

function basisValue(value: KpiBasis[BasisDimension]): string | null {
  if (value === undefined) return null;
  return typeof value === "string" ? value : [...value].sort().join("+");
}

/** The classes an interruption can be moved between by the attribution rule; load shedding is always its own. */
const CLASSIFIED: readonly InterruptionClass[] = ["network", "upstream_supply", "other"];

/**
 * Whether the attribution rule changes a figure on this basis: only when
 * it counts some, but not all, of the classes the rule moves interruptions
 * between. A total that counts every class is the same under any rule.
 */
export function attributionRuleMatters(metric: KpiKey, basis: KpiBasis | null): boolean {
  if (basisDimensions(metric) !== RELIABILITY_BASIS) return false;
  const classes = basis?.interruptionClasses;
  if (classes === undefined) return false;
  const counted = CLASSIFIED.filter((name) => classes.includes(name)).length;
  return counted > 0 && counted < CLASSIFIED.length;
}

function originWords(value: string): string {
  return value === "" ? "nothing" : value.replaceAll("_", " ").replaceAll("+", ", ");
}

/** Every reason the two bases are not the same, for the dimensions that matter to the metric. */
export function basisIssues(metric: KpiKey, reported: KpiBasis | null, calculated: KpiBasis): ComparabilityIssue[] {
  const issues: ComparabilityIssue[] = [];
  for (const dimension of basisDimensions(metric)) {
    const stated = reported === null ? null : basisValue(reported[dimension]);
    const computed = basisValue(calculated[dimension]);
    if (stated === null) {
      issues.push({
        code: "BASIS_UNSPECIFIED",
        message: `The reported figure does not state ${DIMENSION_NAME[dimension]}.`,
        blocking: true,
      });
    } else if (computed === null) {
      issues.push({
        code: "BASIS_UNSPECIFIED",
        message: `The calculated figure does not state ${DIMENSION_NAME[dimension]}.`,
        blocking: true,
      });
    } else if (stated !== computed) {
      issues.push({
        code: "BASIS_MISMATCH",
        message: `Different basis for ${DIMENSION_NAME[dimension]}: reported "${stated.replaceAll("_", " ")}", calculated "${computed.replaceAll("_", " ")}".`,
        blocking: true,
      });
    }
  }

  if (attributionRuleMatters(metric, reported)) {
    const stated = basisValue(reported?.upstreamOrigins);
    const computed = basisValue(calculated.upstreamOrigins);
    if (stated === null) {
      issues.push({
        code: "ATTRIBUTION_RULE_UNSPECIFIED",
        message:
          "The reported figure does not state how it put interruptions into classes (which origin points it treats as upstream). " +
          "The variance may reflect a difference in classification rather than in what happened.",
        blocking: false,
      });
    } else if (computed === null) {
      issues.push({
        code: "BASIS_UNSPECIFIED",
        message: "The calculated figure does not state its attribution rule.",
        blocking: true,
      });
    } else if (stated !== computed) {
      issues.push({
        code: "ATTRIBUTION_RULE_MISMATCH",
        message: `Different attribution rule: the reported figure treats ${originWords(stated)} as upstream, the calculation treats ${originWords(computed)} as upstream.`,
        blocking: true,
      });
    }
  }
  return issues;
}

/**
 * Compares a reported figure with the calculated figure that is on its
 * basis. With none on its basis, it is compared with the first candidate
 * and the result says the two are not comparable, and why.
 */
export function compareOnBasis(reported: ReportedKpi, candidates: readonly CalculatedKpi[]): KpiComparison {
  const match = candidates.find(
    (candidate) =>
      candidate.metric === reported.metric && basisIssues(reported.metric, reported.basis, candidate.basis).every((issue) => !issue.blocking),
  );
  return compareKpi(reported, match ?? candidates[0]);
}

function sameScope(reported: ScopeRef | UnresolvedRef, calculated: ScopeRef): boolean {
  return "id" in reported && reported.kind === calculated.kind && reported.id === calculated.id;
}

/** Same instant, however the timestamps are written ("…00Z" vs "…00.000Z" vs "+01:00"). */
function sameInstant(x: string, y: string): boolean {
  const xMs = toEpochMs(x);
  const yMs = toEpochMs(y);
  return xMs !== null && yMs !== null ? xMs === yMs : x === y;
}

function samePeriod(a: Period, b: Period): boolean {
  return sameInstant(a.start, b.start) && sameInstant(a.end, b.end);
}

export function compareKpi(reported: ReportedKpi, calculated: CalculatedKpi): KpiComparison {
  const issues: ComparabilityIssue[] = [];

  if (!isComputed(calculated.status)) {
    issues.push({
      code: "CALCULATION_NOT_OK",
      message: `The calculation's status is ${calculated.status}; there is no calculated value to compare.`,
      blocking: true,
    });
  }
  if (reported.metric !== calculated.metric) {
    issues.push({
      code: "METRIC_MISMATCH",
      message: `Reported ${reported.metric} is being compared with calculated ${calculated.metric}.`,
      blocking: true,
    });
  }

  let calculatedInReportedUnit: number | null = null;
  if (dimensionOf(reported.unit) !== dimensionOf(calculated.unit)) {
    issues.push({
      code: "UNIT_DIMENSION_MISMATCH",
      message: `Reported unit ${reported.unit} and calculated unit ${calculated.unit} measure different things.`,
      blocking: true,
    });
  } else if (calculated.value !== null) {
    calculatedInReportedUnit = convertUnit(calculated.value, calculated.unit, reported.unit);
  }

  if (!("id" in reported.scope)) {
    issues.push({
      code: "SCOPE_UNRESOLVED",
      message: `The reported scope "${reported.scope.label}" is not matched to a registry record.`,
      blocking: true,
    });
  } else if (!sameScope(reported.scope, calculated.scope)) {
    issues.push({ code: "SCOPE_MISMATCH", message: "Reported and calculated scopes differ.", blocking: true });
  }

  if (calculated.period !== null) {
    if (reported.period === null) {
      issues.push({ code: "PERIOD_UNSPECIFIED", message: "The reported figure does not state its period.", blocking: true });
    } else if (!samePeriod(reported.period, calculated.period)) {
      issues.push({ code: "PERIOD_MISMATCH", message: "Reported and calculated periods differ.", blocking: true });
    }
  } else if (calculated.asOf !== null && (reported.asOf === null || !sameInstant(reported.asOf, calculated.asOf))) {
    issues.push({
      code: "AS_OF_MISMATCH",
      message: `The reported figure is as of ${reported.asOf ?? "an unstated time"}; the calculation is as of ${calculated.asOf}.`,
      blocking: true,
    });
  }

  const basis = reported.metric === calculated.metric ? basisIssues(reported.metric, reported.basis, calculated.basis) : [];
  issues.push(...basis);
  const sameBasis = reported.metric === calculated.metric && basis.every((issue) => !issue.blocking);

  if (reported.methodology === null) {
    issues.push({
      code: "METHODOLOGY_UNSPECIFIED",
      message: "The reported figure does not state its methodology.",
      blocking: true,
    });
  } else {
    issues.push({
      code: "METHODOLOGY_NOT_VERIFIED",
      message:
        `The reported methodology ("${reported.methodology.name}") has not been verified as equivalent to ` +
        `${calculated.methodology.id}@${calculated.methodology.version}.`,
      blocking: false,
    });
  }

  if (Object.values(calculated.inputs).some((input) => input.origin === "reported")) {
    issues.push({
      code: "INPUTS_FROM_REPORTED",
      message: "The calculated value rests partly on reported inputs rather than observations.",
      blocking: false,
    });
  }
  if (calculated.quality !== null && qualityRank(calculated.quality) > qualityRank("measured")) {
    issues.push({
      code: "CALCULATION_QUALITY_LIMITED",
      message: `The calculated value's quality is ${calculated.quality}.`,
      blocking: false,
    });
  }

  const isRatio = dimensionOf(reported.unit) === "ratio";
  let absolute: number | null = null;
  let relative: number | null = null;
  // A difference between figures on different bases means nothing, so none is given.
  if (calculatedInReportedUnit !== null && sameBasis) {
    const difference = calculatedInReportedUnit - reported.value;
    absolute = isRatio ? (convertUnit(difference, reported.unit, "percent") as number) : difference;
    relative = reported.value === 0 ? null : difference / Math.abs(reported.value);
  }

  return {
    kind: "kpi_comparison",
    metric: reported.metric,
    scope: reported.scope,
    period: reported.period,
    reported,
    calculated,
    calculatedInReportedUnit,
    variance: {
      absolute,
      absoluteUnit: isRatio ? "percentage_points" : reported.unit,
      relative,
    },
    comparable: !issues.some((issue) => issue.blocking),
    sameBasis,
    issues,
  };
}
