import type {
  DataQuality,
  Fraction,
  IsoTimestamp,
  KpiKey,
  KpiUnit,
  MethodologyRef,
  Period,
  ScopeRef,
} from "@/domain";

/* ==========================================================
   ANALYTICS — SHARED RESULT TYPES

   Every calculated value says how it was obtained. Three outcomes
   are kept distinct and never collapsed into one another:
   - "ok": the value was computed. A computed 0 is a real zero.
   - "insufficient_data": an input needed for the calculation is
     missing. The value is null, and `missingInputs` names what is
     missing. Missing data never becomes 0.
   - "not_computable": the inputs exist but the calculation is
     undefined for them, e.g. a zero denominator or incompatible
     units or currencies.
========================================================== */

export type CalcStatus = "ok" | "insufficient_data" | "not_computable";

/**
 * The status of a finished result. It adds one outcome to CalcStatus:
 * - "calculated_with_estimates": the value was computed and every input
 *   it needs is present, but at least one input was estimated rather
 *   than measured. `estimatedInputs` names them and, where known, the
 *   share of each that was estimated.
 *
 * "insufficient_data" stays reserved for inputs that are genuinely
 * missing. An estimate is not missing data, and it is not a measurement.
 */
export type ResultStatus = CalcStatus | "calculated_with_estimates";

/** True when the result has a value: "ok" or "calculated_with_estimates". */
export function isComputed(status: ResultStatus): boolean {
  return status === "ok" || status === "calculated_with_estimates";
}

/** An input that was estimated or substituted rather than measured. */
export interface EstimatedInput {
  name: string;
  quality: DataQuality;
  /** The share of the input's value that was estimated (1 = all of it); null when not known. */
  share: Fraction | null;
  ref?: string;
}

export interface Warning {
  code: string;
  message: string;
  /** The record, meter or input the warning is about, if any. */
  ref?: string;
}

/** Where a value used as a calculation input came from. */
export type ValueOrigin = "observed" | "reported" | "calculated";

/**
 * A number supplied to a calculation, tagged with its unit, origin and
 * quality. `value: null` means the input is not available.
 */
export interface InputValue {
  value: number | null;
  unit: KpiUnit;
  origin: ValueOrigin;
  quality: DataQuality;
  /**
   * For an input of quality "estimated" or "substituted": the share of its
   * value that was estimated (1 = all of it). null or absent when not known.
   */
  estimatedShare?: Fraction | null;
  /** Where the value came from, e.g. a ReportedKpi id or a calculation. */
  ref?: string;
}

/**
 * A monetary input as published: an amount in `currency`, multiplied
 * by `scale` (1 for units, 1_000_000 for millions). Amounts are only
 * combined or compared when both currency and scale match.
 */
export interface MonetaryInput extends InputValue {
  unit: "currency";
  currency: string;
  scale: number;
}

/**
 * A KPI computed by GridIntel under a named methodology. It is always
 * kept apart from a `ReportedKpi`; the two are compared, never merged.
 */
export interface CalculatedKpi {
  kind: "calculated";
  metric: KpiKey;
  scope: ScopeRef;
  /** The period a rate covers; null for point-in-time values. */
  period: Period | null;
  /** The moment a point-in-time value describes; null for period values. */
  asOf: IsoTimestamp | null;
  status: ResultStatus;
  /** null unless the result is computed ("ok" or "calculated_with_estimates"). */
  value: number | null;
  unit: KpiUnit;
  methodology: MethodologyRef;
  /** Every input used, with its origin and quality. */
  inputs: Record<string, InputValue>;
  missingInputs: string[];
  /** The inputs that were estimated; empty unless status is "calculated_with_estimates". */
  estimatedInputs: EstimatedInput[];
  /** Set when the value is what is left after subtracting other figures, so it inherits their uncertainty. */
  derivation?: { kind: "residual"; note: string };
  /** Coverage of the underlying observations, where that applies. */
  coverage: Fraction | null;
  /** Worst quality among the inputs; null when nothing could be assessed. */
  quality: DataQuality | null;
  warnings: Warning[];
  /** Supplied by the caller; analytics never read the clock. */
  computedAt: IsoTimestamp;
}

/** Options every calculation takes. */
export interface CalculationContext {
  computedAt: IsoTimestamp;
}

/* ==========================================================
   HELPERS
========================================================== */

export interface RatioOutcome {
  status: CalcStatus;
  value: number | null;
  missingInputs: string[];
  warnings: Warning[];
}

/**
 * numerator ÷ denominator, keeping missing inputs and a zero
 * denominator apart. A zero numerator gives a real 0.
 */
export function ratio(
  numeratorName: string,
  numerator: number | null,
  denominatorName: string,
  denominator: number | null,
): RatioOutcome {
  const missingInputs: string[] = [];
  if (numerator === null) missingInputs.push(numeratorName);
  if (denominator === null) missingInputs.push(denominatorName);
  if (missingInputs.length > 0) {
    return { status: "insufficient_data", value: null, missingInputs, warnings: [] };
  }
  if (denominator === 0) {
    return {
      status: "not_computable",
      value: null,
      missingInputs: [],
      warnings: [
        {
          code: "ZERO_DENOMINATOR",
          message: `${denominatorName} is 0, so the ratio is undefined.`,
          ref: denominatorName,
        },
      ],
    };
  }
  return {
    status: "ok",
    value: (numerator as number) / (denominator as number),
    missingInputs: [],
    warnings: [],
  };
}

function isEstimate(quality: DataQuality): boolean {
  return quality === "estimated" || quality === "substituted";
}

/** The inputs that were estimated or substituted, in name order. */
export function estimatedInputsOf(inputs: Record<string, InputValue>): EstimatedInput[] {
  return Object.keys(inputs)
    .filter((name) => inputs[name].value !== null && isEstimate(inputs[name].quality))
    .sort()
    .map((name) => ({
      name,
      quality: inputs[name].quality,
      share: inputs[name].estimatedShare ?? null,
      ...(inputs[name].ref === undefined ? {} : { ref: inputs[name].ref }),
    }));
}

/** The status of a finished value: "ok" becomes "calculated_with_estimates" when anything behind it was estimated. */
export function resultStatus(status: CalcStatus, quality: DataQuality | null): ResultStatus {
  return status === "ok" && quality !== null && isEstimate(quality) ? "calculated_with_estimates" : status;
}

/** A KPI before its final status is settled. */
export type UnfinalizedKpi = Omit<CalculatedKpi, "status" | "estimatedInputs"> & { status: CalcStatus };

/**
 * Settles a KPI's final status: a computed KPI with any estimated input
 * is "calculated_with_estimates" and lists those inputs.
 */
export function finalizeKpi(kpi: UnfinalizedKpi): CalculatedKpi {
  const estimatedInputs = kpi.status === "ok" ? estimatedInputsOf(kpi.inputs) : [];
  return {
    ...kpi,
    status: estimatedInputs.length > 0 ? "calculated_with_estimates" : kpi.status,
    estimatedInputs,
  };
}

/** Warns when any input is a reported figure rather than an observation. */
export function reportedInputWarnings(inputs: Record<string, InputValue>): Warning[] {
  const reported = Object.keys(inputs)
    .filter((name) => inputs[name].origin === "reported")
    .sort();
  if (reported.length === 0) return [];
  return [
    {
      code: "INPUTS_FROM_REPORTED",
      message: `Calculated from reported figures, not observations: ${reported.join(", ")}.`,
    },
  ];
}
