import type { Period, ScopeRef } from "@/domain";
import type { AtccParameters, Methodology } from "../core/methodology.ts";
import type { CalculatedKpi, CalculationContext, InputValue, MonetaryInput, Warning } from "../core/result.ts";
import { ATCC_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { finalizeKpi, ratio, reportedInputWarnings } from "../core/result.ts";

/* ==========================================================
   ANALYTICS — COLLECTION EFFICIENCY

   Collection efficiency = revenue collected ÷ revenue billed.

   Revenue is combined only when currency and scale match; there is
   no conversion between currencies or scales. Aggregation across
   scopes is always Σ collected ÷ Σ billed. Percentages are never
   averaged.
========================================================== */

/** A monetary input that has no value. */
export function missingMoney(currency: string, scale: number, ref?: string): MonetaryInput {
  return { value: null, unit: "currency", currency, scale, origin: "calculated", quality: "missing", ref };
}

function currencyMismatch(a: MonetaryInput, b: MonetaryInput): Warning | null {
  if (a.currency === b.currency && a.scale === b.scale) return null;
  return {
    code: "CURRENCY_OR_SCALE_MISMATCH",
    message: `Cannot combine ${a.currency} ×${a.scale} with ${b.currency} ×${b.scale}.`,
  };
}

export function calculateCollectionEfficiency(params: {
  scope: ScopeRef;
  period: Period | null;
  revenueBilled: MonetaryInput;
  revenueCollected: MonetaryInput;
  methodology?: Methodology<AtccParameters>;
  context: CalculationContext;
}): CalculatedKpi {
  const { scope, period, revenueBilled, revenueCollected, context } = params;
  const methodology = params.methodology ?? ATCC_REFERENCE;
  const inputs: Record<string, InputValue> = { revenueBilled, revenueCollected };
  const base = {
    kind: "calculated" as const,
    metric: "collection_efficiency" as const,
    scope,
    period,
    asOf: null,
    unit: "fraction" as const,
    methodology: methodologyRef(methodology),
    inputs,
    coverage: null,
    quality: worstQuality([revenueBilled.quality, revenueCollected.quality]),
    computedAt: context.computedAt,
  };

  const bothPresent = revenueBilled.value !== null && revenueCollected.value !== null;
  const mismatch = bothPresent ? currencyMismatch(revenueBilled, revenueCollected) : null;
  if (mismatch) {
    return finalizeKpi({ ...base, status: "not_computable", value: null, missingInputs: [], warnings: [mismatch] });
  }

  const outcome = ratio("revenue collected", revenueCollected.value, "revenue billed", revenueBilled.value);
  const warnings = [...outcome.warnings, ...reportedInputWarnings(inputs)];
  if (outcome.status === "ok" && (outcome.value as number) > 1) {
    warnings.push({
      code: "COLLECTION_EXCEEDS_BILLED",
      message: "More was collected than billed in the period, e.g. arrears recovery.",
    });
  }
  return finalizeKpi({ ...base, status: outcome.status, value: outcome.value, missingInputs: outcome.missingInputs, warnings });
}

export interface CollectionPart {
  /** e.g. a region id; used to name missing inputs. */
  label: string;
  revenueBilled: MonetaryInput;
  revenueCollected: MonetaryInput;
}

/**
 * Collection efficiency across several parts, weighted by revenue:
 * Σ collected ÷ Σ billed. If any part's revenue is missing, the total
 * is insufficient_data and the missing parts are named; the remaining
 * parts are not used to produce a partial figure.
 */
export function aggregateCollectionEfficiency(params: {
  scope: ScopeRef;
  period: Period | null;
  parts: readonly CollectionPart[];
  methodology?: Methodology<AtccParameters>;
  context: CalculationContext;
}): CalculatedKpi {
  const { scope, period, parts, context } = params;
  const methodology = params.methodology ?? ATCC_REFERENCE;

  const inputs: Record<string, InputValue> = {};
  for (const part of parts) {
    inputs[`${part.label}.revenueBilled`] = part.revenueBilled;
    inputs[`${part.label}.revenueCollected`] = part.revenueCollected;
  }
  const base = {
    kind: "calculated" as const,
    metric: "collection_efficiency" as const,
    scope,
    period,
    asOf: null,
    unit: "fraction" as const,
    methodology: methodologyRef(methodology),
    inputs,
    coverage: null,
    quality: worstQuality(Object.values(inputs).map((input) => input.quality)),
    computedAt: context.computedAt,
  };

  if (parts.length === 0) {
    return finalizeKpi({ ...base, status: "insufficient_data", value: null, missingInputs: ["at least one part"], warnings: [] });
  }

  const present = parts
    .flatMap((part) => [part.revenueBilled, part.revenueCollected].map((money) => ({ part, money })))
    .filter(({ money }) => money.value !== null);
  for (const { part, money } of present) {
    const mismatch = currencyMismatch(present[0].money, money);
    if (mismatch) {
      return finalizeKpi({
        ...base,
        status: "not_computable",
        value: null,
        missingInputs: [],
        warnings: [{ ...mismatch, ref: part.label }],
      });
    }
  }

  const missingInputs: string[] = [];
  let billed = 0;
  let collected = 0;
  for (const part of parts) {
    if (part.revenueBilled.value === null) missingInputs.push(`${part.label}: revenue billed`);
    else billed += part.revenueBilled.value;
    if (part.revenueCollected.value === null) missingInputs.push(`${part.label}: revenue collected`);
    else collected += part.revenueCollected.value;
  }
  if (missingInputs.length > 0) {
    return finalizeKpi({ ...base, status: "insufficient_data", value: null, missingInputs, warnings: reportedInputWarnings(inputs) });
  }

  const outcome = ratio("total revenue collected", collected, "total revenue billed", billed);
  return finalizeKpi({
    ...base,
    status: outcome.status,
    value: outcome.value,
    missingInputs: outcome.missingInputs,
    warnings: [...outcome.warnings, ...reportedInputWarnings(inputs)],
  });
}
