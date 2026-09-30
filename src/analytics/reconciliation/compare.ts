import type { KpiKey, KpiUnit, Period, ReportedKpi, ScopeRef, UnresolvedRef } from "@/domain";
import type { CalculatedKpi } from "../core/result.ts";
import { qualityRank } from "../core/quality.ts";
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
  issues: ComparabilityIssue[];
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

  if (calculated.status !== "ok") {
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
  if (calculatedInReportedUnit !== null) {
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
    issues,
  };
}
