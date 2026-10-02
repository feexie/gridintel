import type { DataQuality, IsoTimestamp, MethodologyRef, Period, ScopeRef } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import type { CalculationContext, EstimatedInput, InputValue, MonetaryInput, ResultStatus, Warning } from "../core/result.ts";
import { REFERENCE_DISCLAIMER, methodologyRef } from "../core/methodology.ts";
import { convertUnit, dimensionOf } from "../core/units.ts";

/* ==========================================================
   ANALYTICS — REVENUE GAP

   An estimate of revenue not realised in a period, in two parts
   that are always kept apart:

   COMMERCIAL GAP. Unbilled energy valued at the average rate
   actually billed to low-voltage customers where the loss occurs:

     at a transformer:  unbilled energy × the transformer's LV rate
     above it:          Σ the gaps of the sections below
                        + the section's own residual × its LV rate

   where a section's residual is its unbilled energy less the
   unbilled energy of the sections below it (the loss between its
   boundary and theirs), and its LV rate is the revenue billed to
   customers supplied through its transformers ÷ the energy billed
   to them. A customer supplied at medium voltage is never part of
   the rate, so one large account cannot distort it.

   Valuing each loss at the rate of the place it occurs matters: a
   portfolio rate would price a low-tariff feeder's losses at a
   high-tariff feeder's rate.

   COLLECTION GAP. Revenue billed − revenue collected, on the basis
   the revenue inputs are on (cash, in practice). It is negative in
   a period of arrears recovery.

   NEVER NETTED. A negative part is shown as negative and is not
   set against the other part. Revenue not realised is the sum of
   the parts that are positive.

   This is an estimate of revenue not realised in the period. It is
   not an amount owed by anyone, and it does not say why energy went
   unbilled. Technical loss is not in it: that energy could not have
   been sold. It is for the period given and is not annualised.
========================================================== */

export interface RevenueGapParameters {
  /** Energy below this, in kWh, is treated as no residual at all (rounding between loss studies). */
  residualToleranceKwh: number;
}

export const REVENUE_GAP_REFERENCE: Methodology<RevenueGapParameters> = {
  id: "gridintel.revenue_gap.reference",
  version: "0.1.0",
  name: "GridIntel reference revenue gap",
  description:
    "Commercial gap: unbilled energy valued at the low-voltage average billed rate of the section where it " +
    "occurs, summed from transformers upward. Collection gap: revenue billed less revenue collected. The two " +
    "are never netted.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: `${REFERENCE_DISCLAIMER} An estimate of revenue not realised in the period; not an amount owed, and not annualised.`,
  parameters: { residualToleranceKwh: 0.5 },
};

/** A section and the sections below it. A node with no children is valued whole at its own LV rate. */
export interface RevenueGapNode {
  scope: ScopeRef;
  /** The section's unbilled energy (delivered − billed). */
  unbilled: InputValue;
  /** For a node with no children: what was billed to its low-voltage, non-MD customers. */
  lowVoltage?: {
    energyBilled: InputValue;
    revenueBilled: MonetaryInput;
    /** Low-voltage accounts left out of the rate because their demand class is not recorded. */
    unknownDemandClassExcluded?: number;
  };
  children: readonly RevenueGapNode[];
}

/** One valued piece of the commercial gap. */
export interface RevenueGapPart {
  scope: ScopeRef;
  /** "section": the whole unbilled energy of a lowest-level section; "residual": the loss between a section's boundary and the sections below. */
  kind: "section" | "residual";
  energyKwh: number | null;
  /** The LV average billed rate applied, per kWh; null when it could not be formed. */
  ratePerKwh: number | null;
  amount: number | null;
}

export interface RevenueGap {
  kind: "revenue_gap";
  scope: ScopeRef;
  period: Period;
  currency: string | null;
  status: ResultStatus;
  commercial: {
    status: ResultStatus;
    /** null unless every part could be valued. May be negative when more energy was billed than delivered. */
    amount: number | null;
    unbilledKwh: number | null;
    parts: RevenueGapPart[];
  };
  collection: {
    status: ResultStatus;
    /** revenue billed − revenue collected. Negative in a period of arrears recovery. */
    amount: number | null;
    basis: "cash" | "accrual" | null;
  };
  /** The sum of the parts that are positive. A negative part counts as nothing; it is never netted. */
  notRealised: number | null;
  /** The parts that are negative, if any. */
  negativeParts: ("commercial" | "collection")[];
  /**
   * Accounts left out of every rate because their demand class is not
   * recorded. They are not assumed to be non-MD; with any, the rates rest on
   * fewer accounts than the sections serve.
   */
  unknownDemandClassExcluded: number;
  estimatedInputs: EstimatedInput[];
  missingInputs: string[];
  warnings: Warning[];
  methodology: MethodologyRef;
  computedAt: IsoTimestamp;
}

interface Valued {
  parts: RevenueGapPart[];
  /** Energy and revenue billed to low-voltage customers under the node; null when not known. */
  lvEnergyKwh: number | null;
  lvRevenue: number | null;
  currency: string | null;
  qualities: DataQuality[];
  missing: string[];
  unknownDemandClass: number;
}

function kwh(input: InputValue): number | null {
  if (input.value === null || dimensionOf(input.unit) !== "energy") return null;
  return convertUnit(input.value, input.unit, "kWh");
}

function label(scope: ScopeRef): string {
  return `${scope.kind} ${scope.id}`;
}

function valueNode(node: RevenueGapNode, parameters: RevenueGapParameters, warnings: Warning[]): Valued {
  const unbilled = kwh(node.unbilled);
  const qualities: DataQuality[] = [node.unbilled.quality];
  const missing: string[] = unbilled === null ? [`unbilled energy of ${label(node.scope)}`] : [];

  const part = (kind: RevenueGapPart["kind"], energy: number | null, lvEnergy: number | null, lvRevenue: number | null): RevenueGapPart => {
    const negligible = energy !== null && Math.abs(energy) < parameters.residualToleranceKwh;
    const rate = lvEnergy !== null && lvRevenue !== null && lvEnergy > 0 ? lvRevenue / lvEnergy : null;
    if (energy !== null && !negligible && rate === null) {
      missing.push(`low-voltage billed rate for ${label(node.scope)}`);
      warnings.push({
        code: "NO_LOW_VOLTAGE_RATE",
        message: `No energy was billed to low-voltage customers under ${label(node.scope)}, so its unbilled energy cannot be valued.`,
        ref: node.scope.id,
      });
    }
    return {
      scope: node.scope,
      kind,
      energyKwh: energy,
      ratePerKwh: rate,
      amount: energy === null ? null : negligible ? 0 : rate === null ? null : energy * rate,
    };
  };

  if (node.children.length === 0) {
    const lvEnergy = node.lowVoltage ? kwh(node.lowVoltage.energyBilled) : null;
    const lvRevenue = node.lowVoltage?.revenueBilled.value ?? null;
    if (node.lowVoltage) qualities.push(node.lowVoltage.energyBilled.quality);
    return {
      parts: [part("section", unbilled, lvEnergy, lvRevenue)],
      lvEnergyKwh: lvEnergy,
      lvRevenue,
      currency: node.lowVoltage?.revenueBilled.currency ?? null,
      qualities,
      missing,
      unknownDemandClass: node.lowVoltage?.unknownDemandClassExcluded ?? 0,
    };
  }

  const children = node.children.map((child) => valueNode(child, parameters, warnings));
  const sumOrNull = (values: (number | null)[]) => (values.some((v) => v === null) ? null : values.reduce<number>((t, v) => t + (v as number), 0));
  const lvEnergy = sumOrNull(children.map((child) => child.lvEnergyKwh));
  const lvRevenue = sumOrNull(children.map((child) => child.lvRevenue));
  const below = sumOrNull(node.children.map((child) => kwh(child.unbilled)));
  const residual = unbilled === null || below === null ? null : unbilled - below;
  const currencies = [...new Set(children.map((child) => child.currency).filter((c): c is string => c !== null))];
  if (currencies.length > 1) {
    warnings.push({ code: "CURRENCY_MISMATCH", message: `Sections under ${label(node.scope)} are billed in different currencies.`, ref: node.scope.id });
  }
  return {
    parts: [...children.flatMap((child) => child.parts), part("residual", residual, currencies.length > 1 ? null : lvEnergy, lvRevenue)],
    lvEnergyKwh: lvEnergy,
    lvRevenue,
    currency: currencies.length === 1 ? currencies[0] : null,
    qualities: [...qualities, ...children.flatMap((child) => child.qualities)],
    missing: [...missing, ...children.flatMap((child) => child.missing)],
    unknownDemandClass: children.reduce((total, child) => total + child.unknownDemandClass, 0),
  };
}

export function calculateRevenueGap(params: {
  period: Period;
  /** The scope's section tree, down to the level at which unbilled energy is valued. */
  tree: RevenueGapNode;
  /** Revenue for the whole scope, medium-voltage customers included. */
  revenueBilled: MonetaryInput;
  revenueCollected: MonetaryInput;
  collectionBasis?: "cash" | "accrual";
  methodology?: Methodology<RevenueGapParameters>;
  context: CalculationContext;
}): RevenueGap {
  const { period, tree, revenueBilled, revenueCollected, context } = params;
  const methodology = params.methodology ?? REVENUE_GAP_REFERENCE;
  const warnings: Warning[] = [];

  const valued = valueNode(tree, methodology.parameters, warnings);
  const commercialAmount = valued.parts.some((part) => part.amount === null)
    ? null
    : valued.parts.reduce((total, part) => total + (part.amount as number), 0);
  const estimated = valued.qualities.some((quality) => quality === "estimated" || quality === "substituted");
  const commercialStatus: ResultStatus =
    commercialAmount === null ? "insufficient_data" : estimated ? "calculated_with_estimates" : "ok";

  const sameMoney = revenueBilled.currency === revenueCollected.currency && revenueBilled.scale === revenueCollected.scale;
  const collectionMissing = [
    ...(revenueBilled.value === null ? ["revenue billed"] : []),
    ...(revenueCollected.value === null ? ["revenue collected"] : []),
  ];
  let collectionAmount: number | null = null;
  let collectionStatus: ResultStatus = "insufficient_data";
  if (collectionMissing.length === 0) {
    if (!sameMoney) {
      collectionStatus = "not_computable";
      warnings.push({ code: "CURRENCY_OR_SCALE_MISMATCH", message: "Revenue billed and collected are in different currencies or scales." });
    } else {
      collectionAmount = ((revenueBilled.value as number) - (revenueCollected.value as number)) * revenueBilled.scale;
      collectionStatus = "ok";
    }
  }

  const currency = revenueBilled.value !== null ? revenueBilled.currency : valued.currency;
  if (commercialAmount !== null && valued.currency !== null && currency !== null && valued.currency !== currency) {
    warnings.push({ code: "CURRENCY_MISMATCH", message: "The commercial and collection parts are in different currencies." });
  }

  const negativeParts: RevenueGap["negativeParts"] = [];
  if (commercialAmount !== null && commercialAmount < 0) {
    negativeParts.push("commercial");
    warnings.push({
      code: "BILLED_EXCEEDS_DELIVERED",
      message: "More energy was billed than delivered, so the commercial gap is negative. It is shown as it is and not set against the collection gap.",
    });
  }
  if (collectionAmount !== null && collectionAmount < 0) {
    negativeParts.push("collection");
    warnings.push({
      code: "COLLECTION_EXCEEDS_BILLED",
      message: "More was collected than billed in the period, e.g. arrears recovery, so the collection gap is negative. It is shown as it is and not set against the commercial gap.",
    });
  }

  if (valued.unknownDemandClass > 0) {
    warnings.push({
      code: "DEMAND_CLASS_UNKNOWN",
      message: `${valued.unknownDemandClass} account(s) with unknown demand class excluded from the rate.`,
    });
  }

  const bothKnown = commercialAmount !== null && collectionAmount !== null;
  const status: ResultStatus =
    collectionStatus === "not_computable"
      ? "not_computable"
      : !bothKnown
        ? "insufficient_data"
        : commercialStatus === "calculated_with_estimates"
          ? "calculated_with_estimates"
          : "ok";

  return {
    kind: "revenue_gap",
    scope: tree.scope,
    period,
    currency,
    status,
    commercial: { status: commercialStatus, amount: commercialAmount, unbilledKwh: kwh(tree.unbilled), parts: valued.parts },
    collection: { status: collectionStatus, amount: collectionAmount, basis: params.collectionBasis ?? null },
    notRealised: bothKnown ? Math.max(commercialAmount as number, 0) + Math.max(collectionAmount as number, 0) : null,
    negativeParts,
    unknownDemandClassExcluded: valued.unknownDemandClass,
    estimatedInputs: estimated
      ? [{ name: "unbilled energy", quality: "estimated", share: tree.unbilled.estimatedShare ?? null }]
      : [],
    missingInputs: [...new Set([...valued.missing, ...collectionMissing])],
    warnings,
    methodology: methodologyRef(methodology),
    computedAt: context.computedAt,
  };
}
