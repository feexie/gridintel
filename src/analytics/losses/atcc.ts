import type { KpiBasis, KpiKey, Period, ScopeRef } from "@/domain";
import type { AtccParameters, Methodology } from "../core/methodology.ts";
import type { CalculatedKpi, CalculationContext, EstimatedInput, InputValue, MonetaryInput, ResultStatus, UnfinalizedKpi, Warning } from "../core/result.ts";
import type { EnergyAccount, EnergyFigure } from "../energy/account.ts";
import { ATCC_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { finalizeKpi, isComputed, ratio, reportedInputWarnings } from "../core/result.ts";
import { convertUnit, dimensionOf } from "../core/units.ts";
import { calculateCollectionEfficiency, missingMoney } from "./collection.ts";

/* ==========================================================
   ANALYTICS — LOSSES AND ATC&C

   Under the GridIntel reference methodology (draft, not a
   regulatory formula):

     billing efficiency     BE = energy billed ÷ energy input
     collection efficiency  CE = revenue collected ÷ revenue billed
     ATC&C                     = 1 − BE × CE
     technical loss            = technical loss ÷ energy input
     commercial loss           = unbilled energy ÷ energy input

   Commercial loss is a RESIDUAL: what is left of the energy input
   after technical loss and billed energy are taken away. It is not
   measured, and it inherits the uncertainty of both: when technical
   loss comes from a study, commercial loss is only as good as that
   study.

   The energy input is net of transfers out (see the energy
   account). Commercial loss is only available when technical loss
   is known; otherwise only the total loss is available.

   All results are fractions (0–1). A calculated ATC&C is never
   merged with a reported one; use reconciliation to compare them.
========================================================== */

export interface AtccInputs {
  energyInput: InputValue;
  energyBilled: InputValue;
  revenueBilled: MonetaryInput;
  revenueCollected: MonetaryInput;
  /** How the revenue inputs relate collection to billing; see KpiBasis. */
  collectionBasis?: "cash" | "accrual";
}

function figureAsInput(figure: EnergyFigure, ref: string): InputValue {
  return {
    value: figure.status === "ok" ? figure.value : null,
    unit: "kWh",
    origin: "calculated",
    quality: figure.quality ?? "missing",
    ...(figure.estimatedShare === undefined ? {} : { estimatedShare: figure.estimatedShare }),
    ref,
  };
}

/** Takes the ATC&C inputs from an energy account. */
export function atccInputsFromAccount(account: EnergyAccount): AtccInputs {
  return {
    energyInput: figureAsInput(account.energyInput, "energy_account.energyInput"),
    energyBilled:
      account.energyBilled.status === "ok"
        ? figureAsInput(account.energyBilled, "energy_account.energyBilled")
        : { value: null, unit: "kWh", origin: "calculated", quality: "missing", ref: "energy_account.energyBilled" },
    revenueBilled: account.revenueBilled ?? missingMoney("unknown", 1, "revenue billed"),
    revenueCollected: account.revenueCollected ?? missingMoney("unknown", 1, "revenue collected"),
  };
}

function inKwh(name: string, input: InputValue, warnings: Warning[]): number | null | "mismatch" {
  if (input.value === null) return null;
  if (dimensionOf(input.unit) !== "energy") {
    warnings.push({ code: "UNIT_MISMATCH", message: `"${name}" is in ${input.unit}, not an energy unit.`, ref: name });
    return "mismatch";
  }
  return convertUnit(input.value, input.unit, "kWh");
}

function kpi(
  metric: KpiKey,
  scope: ScopeRef,
  period: Period | null,
  methodology: Methodology<AtccParameters>,
  inputs: Record<string, InputValue>,
  context: CalculationContext,
  basis: KpiBasis = { lossBasis: methodology.parameters.lossBasis },
): Omit<UnfinalizedKpi, "status" | "value" | "missingInputs" | "warnings"> {
  return {
    basis,
    kind: "calculated",
    metric,
    scope,
    period,
    asOf: null,
    unit: "fraction",
    methodology: methodologyRef(methodology),
    inputs,
    coverage: null,
    quality: worstQuality(Object.values(inputs).map((input) => input.quality)),
    computedAt: context.computedAt,
  };
}

export function calculateBillingEfficiency(params: {
  scope: ScopeRef;
  period: Period | null;
  energyInput: InputValue;
  energyBilled: InputValue;
  methodology?: Methodology<AtccParameters>;
  context: CalculationContext;
}): CalculatedKpi {
  const methodology = params.methodology ?? ATCC_REFERENCE;
  const inputs = { energyInput: params.energyInput, energyBilled: params.energyBilled };
  const base = kpi("billing_efficiency", params.scope, params.period, methodology, inputs, params.context);
  const warnings: Warning[] = [];
  const input = inKwh("energy input", params.energyInput, warnings);
  const billed = inKwh("energy billed", params.energyBilled, warnings);
  if (input === "mismatch" || billed === "mismatch") {
    return finalizeKpi({ ...base, status: "not_computable", value: null, missingInputs: [], warnings });
  }
  const outcome = ratio("energy billed", billed, "energy input", input);
  warnings.push(...outcome.warnings, ...reportedInputWarnings(inputs));
  if (outcome.status === "ok" && (outcome.value as number) > 1) {
    warnings.push({
      code: "BILLED_EXCEEDS_INPUT",
      message: "Energy billed exceeds energy input; check period alignment of billing and metering.",
    });
  }
  return finalizeKpi({ ...base, status: outcome.status, value: outcome.value, missingInputs: outcome.missingInputs, warnings });
}

export interface AtccResult {
  atcc: CalculatedKpi;
  billingEfficiency: CalculatedKpi;
  collectionEfficiency: CalculatedKpi;
}

export function calculateAtcc(params: {
  scope: ScopeRef;
  period: Period | null;
  inputs: AtccInputs;
  methodology?: Methodology<AtccParameters>;
  context: CalculationContext;
}): AtccResult {
  const { scope, period, inputs, context } = params;
  const methodology = params.methodology ?? ATCC_REFERENCE;

  const billingEfficiency = calculateBillingEfficiency({
    scope,
    period,
    energyInput: inputs.energyInput,
    energyBilled: inputs.energyBilled,
    methodology,
    context,
  });
  const collectionEfficiency = calculateCollectionEfficiency({
    scope,
    period,
    revenueBilled: inputs.revenueBilled,
    revenueCollected: inputs.revenueCollected,
    collectionBasis: inputs.collectionBasis,
    methodology,
    context,
  });

  const allInputs: Record<string, InputValue> = {
    energyInput: inputs.energyInput,
    energyBilled: inputs.energyBilled,
    revenueBilled: inputs.revenueBilled,
    revenueCollected: inputs.revenueCollected,
  };
  const base = kpi("atcc", scope, period, methodology, allInputs, context, {
    lossBasis: methodology.parameters.lossBasis,
    ...(inputs.collectionBasis === undefined ? {} : { collection: inputs.collectionBasis }),
  });
  // Reported inputs are flagged once, across all four inputs.
  const warnings = [
    ...billingEfficiency.warnings.filter((w) => w.code !== "INPUTS_FROM_REPORTED"),
    ...collectionEfficiency.warnings.filter((w) => w.code !== "INPUTS_FROM_REPORTED"),
    ...reportedInputWarnings(allInputs),
  ];

  let atcc: UnfinalizedKpi;
  if (isComputed(billingEfficiency.status) && isComputed(collectionEfficiency.status)) {
    atcc = {
      ...base,
      status: "ok",
      value: 1 - (billingEfficiency.value as number) * (collectionEfficiency.value as number),
      missingInputs: [],
      warnings,
    };
  } else {
    const notComputable =
      billingEfficiency.status === "not_computable" || collectionEfficiency.status === "not_computable";
    atcc = {
      ...base,
      status: notComputable ? "not_computable" : "insufficient_data",
      value: null,
      missingInputs: [...billingEfficiency.missingInputs, ...collectionEfficiency.missingInputs],
      warnings,
    };
  }
  return { atcc: finalizeKpi(atcc), billingEfficiency, collectionEfficiency };
}

export interface LossSplit {
  technicalLoss: CalculatedKpi;
  commercialLoss: CalculatedKpi;
}

/** Technical and commercial (unbilled) loss as fractions of energy input. */
export function calculateLossSplit(params: {
  account: EnergyAccount;
  methodology?: Methodology<AtccParameters>;
  context: CalculationContext;
}): LossSplit {
  const { account, context } = params;
  const methodology = params.methodology ?? ATCC_REFERENCE;
  const energyInput = figureAsInput(account.energyInput, "energy_account.energyInput");

  const technical = figureAsInput(account.technicalLoss, "energy_account.technicalLoss");
  const technicalInputs = { energyInput, technicalLoss: technical };
  const technicalOutcome = ratio("technical loss", technical.value, "energy input", energyInput.value);
  const technicalLoss = finalizeKpi({
    ...kpi("technical_loss", account.scope, account.period, methodology, technicalInputs, context),
    status: technicalOutcome.status,
    value: technicalOutcome.value,
    missingInputs: technicalOutcome.missingInputs,
    warnings: technicalOutcome.warnings,
  });

  const unbilled = figureAsInput(account.unbilled, "energy_account.unbilled");
  // The inputs listed are the ones the residual is made from, so that an estimate in any of
  // them shows on the result.
  const commercialInputs = {
    energyInput,
    technicalLoss: technical,
    energyBilled: figureAsInput(account.energyBilled, "energy_account.energyBilled"),
  };
  const commercialOutcome = ratio("unbilled energy", unbilled.value, "energy input", energyInput.value);
  const commercialWarnings = [...commercialOutcome.warnings];
  if (account.technicalLoss.status !== "ok") {
    commercialWarnings.push({
      code: "SPLIT_UNAVAILABLE",
      message:
        "Technical loss is not available, so total loss cannot be split into technical and commercial loss.",
    });
  }
  const commercialLoss = finalizeKpi({
    ...kpi("commercial_loss", account.scope, account.period, methodology, commercialInputs, context),
    status: commercialOutcome.status,
    value: commercialOutcome.value,
    missingInputs: commercialOutcome.missingInputs,
    warnings: commercialWarnings,
    derivation: {
      kind: "residual",
      note: "Energy input − technical loss − energy billed. Not measured; it carries the uncertainty of the technical-loss figure and of any estimated billing.",
    },
  });

  return { technicalLoss, commercialLoss };
}

/* ==========================================================
   ATC&C DECOMPOSITION
========================================================== */

/**
 * ATC&C split into three additive parts, each a fraction of energy input:
 *
 *   technical  = technical loss ÷ energy input
 *   commercial = unbilled energy ÷ energy input
 *   collection = billing efficiency × (1 − collection efficiency)
 *
 * technical + commercial = 1 − billing efficiency, so the three parts
 * sum to ATC&C = 1 − BE × CE. The collection part is the share of energy
 * input that was billed but not paid for.
 */
export interface AtccDecomposition {
  status: ResultStatus;
  /** The estimated inputs behind any of the parts. */
  estimatedInputs: EstimatedInput[];
  technical: number | null;
  commercial: number | null;
  collection: number | null;
  atcc: number | null;
  missingInputs: string[];
}

export function decomposeAtcc(atcc: AtccResult, split: LossSplit): AtccDecomposition {
  const parts = [atcc.atcc, atcc.billingEfficiency, atcc.collectionEfficiency, split.technicalLoss, split.commercialLoss];
  const collection =
    atcc.billingEfficiency.value === null || atcc.collectionEfficiency.value === null
      ? null
      : atcc.billingEfficiency.value * (1 - atcc.collectionEfficiency.value);
  const estimated = new Map<string, EstimatedInput>();
  for (const part of parts) for (const input of part.estimatedInputs) estimated.set(input.name, input);
  const estimatedInputs = [...estimated.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const allComputed = parts.every((part) => isComputed(part.status));
  return {
    status: parts.some((part) => part.status === "not_computable")
      ? "not_computable"
      : !allComputed
        ? "insufficient_data"
        : estimatedInputs.length > 0
          ? "calculated_with_estimates"
          : "ok",
    estimatedInputs,
    technical: split.technicalLoss.value,
    commercial: split.commercialLoss.value,
    collection,
    atcc: atcc.atcc.value,
    missingInputs: [...new Set(parts.flatMap((part) => part.missingInputs))],
  };
}
