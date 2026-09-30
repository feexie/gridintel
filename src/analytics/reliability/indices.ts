import type { DataQuality, Outage, Period, ScopeRef } from "@/domain";
import type { Methodology, ReliabilityParameters } from "../core/methodology.ts";
import type { CalculatedKpi, CalculationContext, InputValue, Warning } from "../core/result.ts";
import type { ClassifiedExposure } from "./exposure.ts";
import { RELIABILITY_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { ratio } from "../core/result.ts";
import { MS_PER_MINUTE, periodBounds } from "../core/time.ts";
import { classifyExposures } from "./exposure.ts";

/* ==========================================================
   ANALYTICS — RELIABILITY INDICES

     SAIDI = Σ (customers × minutes in period) ÷ customers served
     SAIFI = Σ customers interrupted ÷ customers served
     CAIDI = SAIDI ÷ SAIFI
     ASAI  = 1 − Σ customer-minutes ÷ (customers served × period minutes)

   Only exposures the methodology includes are counted. Which
   classes count (planned, upstream, load shedding, major events)
   is set by the methodology; the breakdown below keeps every class
   visible, so any treatment can be reproduced from the same events.

   The caller supplies the outages for the scope and the number of
   customers served; neither is inferred here.
========================================================== */

export interface ComponentTotals {
  exposures: number;
  customerInterruptions: number;
  customerMinutes: number;
}

export interface ReliabilityComponents {
  period: Period;
  exposures: ClassifiedExposure[];
  /** Exposures counted by the methodology. */
  counted: {
    saidi: ComponentTotals;
    saifi: ComponentTotals;
  };
  /** Every usable sustained exposure, grouped by class, before methodology filters. */
  breakdown: {
    byPlanned: Record<"planned" | "unplanned" | "unknown", ComponentTotals>;
    byCause: Partial<Record<string, ComponentTotals>>;
    byResponsibleParty: Partial<Record<string, ComponentTotals>>;
    majorEvent: Record<"major_event" | "normal", ComponentTotals>;
  };
  momentary: ComponentTotals;
  /** Exposures whose data (times, customer count) is missing or invalid. */
  excludedForData: number;
  /** Valid exposures that belong to other periods; not a data problem. */
  outsidePeriod: number;
}

export interface ReliabilityResult {
  components: ReliabilityComponents;
  saidi: CalculatedKpi;
  saifi: CalculatedKpi;
  caidi: CalculatedKpi;
  asai: CalculatedKpi;
}

function emptyTotals(): ComponentTotals {
  return { exposures: 0, customerInterruptions: 0, customerMinutes: 0 };
}

function add(totals: ComponentTotals, exposure: ClassifiedExposure): void {
  const customers = exposure.customersAffected as number;
  totals.exposures += 1;
  totals.customerInterruptions += customers;
  totals.customerMinutes += customers * exposure.minutesInPeriod;
}

export function reliabilityComponents(params: {
  outages: readonly Outage[];
  period: Period;
  methodology: Methodology<ReliabilityParameters>;
}): ReliabilityComponents {
  const exposures = classifyExposures(params);
  const components: ReliabilityComponents = {
    period: params.period,
    exposures,
    counted: { saidi: emptyTotals(), saifi: emptyTotals() },
    breakdown: {
      byPlanned: { planned: emptyTotals(), unplanned: emptyTotals(), unknown: emptyTotals() },
      byCause: {},
      byResponsibleParty: {},
      majorEvent: { major_event: emptyTotals(), normal: emptyTotals() },
    },
    momentary: emptyTotals(),
    excludedForData: 0,
    outsidePeriod: 0,
  };

  for (const exposure of exposures) {
    if (exposure.dataExclusion === "OUTSIDE_PERIOD") {
      components.outsidePeriod += 1;
      continue;
    }
    if (exposure.dataExclusion !== null) {
      components.excludedForData += 1;
      continue;
    }
    if (exposure.durationClass === "momentary") {
      add(components.momentary, exposure);
      continue;
    }
    const breakdown = components.breakdown;
    add(breakdown.byPlanned[exposure.planned === null ? "unknown" : exposure.planned ? "planned" : "unplanned"], exposure);
    add((breakdown.byCause[exposure.cause] ??= emptyTotals()), exposure);
    add((breakdown.byResponsibleParty[exposure.responsibleParty] ??= emptyTotals()), exposure);
    add(breakdown.majorEvent[exposure.majorEvent ? "major_event" : "normal"], exposure);

    if (exposure.countsForSaidi) add(components.counted.saidi, exposure);
    if (exposure.countsForSaifi) {
      // SAIFI counts interruptions; its minutes are not used.
      const customers = exposure.customersAffected as number;
      components.counted.saifi.exposures += 1;
      components.counted.saifi.customerInterruptions += customers;
    }
  }
  return components;
}

export function calculateReliability(params: {
  scope: ScopeRef;
  period: Period;
  outages: readonly Outage[];
  customersServed: InputValue;
  methodology?: Methodology<ReliabilityParameters>;
  context: CalculationContext;
}): ReliabilityResult {
  const { scope, period, customersServed, context } = params;
  const methodology = params.methodology ?? RELIABILITY_REFERENCE;
  const parameters = methodology.parameters;
  const components = reliabilityComponents({ outages: params.outages, period, methodology });

  const warnings: Warning[] = [];
  if (components.excludedForData > 0) {
    warnings.push({
      code: "EXPOSURES_EXCLUDED",
      message:
        `${components.excludedForData} exposure(s) were excluded because the interruption time, restoration ` +
        "time or customer count was missing or invalid.",
    });
  }

  const counted = components.exposures.filter((e) => e.countsForSaidi || e.countsForSaifi);
  const quality = worstQuality([
    customersServed.quality,
    ...counted.map((exposure) => exposure.quality),
  ]) as DataQuality;

  const inputs: Record<string, InputValue> = {
    customersServed,
    customerMinutes: {
      value: components.counted.saidi.customerMinutes,
      unit: "minutes",
      origin: "calculated",
      quality,
      ref: "outage exposures",
    },
    customerInterruptions: {
      value: components.counted.saifi.customerInterruptions,
      unit: "count",
      origin: "calculated",
      quality,
      ref: "outage exposures",
    },
  };

  const base = {
    kind: "calculated" as const,
    scope,
    period,
    asOf: null,
    methodology: methodologyRef(methodology),
    inputs,
    coverage: null,
    quality,
    computedAt: context.computedAt,
  };

  const durationFactor = parameters.durationUnit === "hours" ? 1 / 60 : 1;
  const served = customersServed.value;

  const saidiOutcome = ratio(
    "customer-minutes",
    components.counted.saidi.customerMinutes,
    "customers served",
    served,
  );
  const saidi: CalculatedKpi = {
    ...base,
    metric: "saidi",
    unit: parameters.durationUnit,
    status: saidiOutcome.status,
    value: saidiOutcome.value === null ? null : saidiOutcome.value * durationFactor,
    missingInputs: saidiOutcome.missingInputs,
    warnings: [...warnings, ...saidiOutcome.warnings],
  };

  const saifiOutcome = ratio(
    "customer interruptions",
    components.counted.saifi.customerInterruptions,
    "customers served",
    served,
  );
  const saifi: CalculatedKpi = {
    ...base,
    metric: "saifi",
    unit: "interruptions_per_customer",
    status: saifiOutcome.status,
    value: saifiOutcome.value,
    missingInputs: saifiOutcome.missingInputs,
    warnings: [...warnings, ...saifiOutcome.warnings],
  };

  const caidiOutcome = ratio("SAIDI", saidi.value, "SAIFI", saifi.value);
  const caidi: CalculatedKpi = {
    ...base,
    metric: "caidi",
    unit: parameters.durationUnit,
    status: saidi.status !== "ok" ? saidi.status : saifi.status !== "ok" ? saifi.status : caidiOutcome.status,
    value: caidiOutcome.value,
    missingInputs: [...saidi.missingInputs, ...saifi.missingInputs],
    warnings: [...warnings, ...caidiOutcome.warnings],
  };

  const bounds = periodBounds(period);
  const periodMinutes = bounds === null ? null : (bounds.endMs - bounds.startMs) / MS_PER_MINUTE;
  const asaiOutcome = ratio(
    "customer-minutes",
    components.counted.saidi.customerMinutes,
    "customer-minutes demanded",
    served === null || periodMinutes === null ? null : served * periodMinutes,
  );
  const asai: CalculatedKpi = {
    ...base,
    metric: "asai",
    unit: "fraction",
    status: asaiOutcome.status,
    value: asaiOutcome.value === null ? null : 1 - asaiOutcome.value,
    missingInputs: [...asaiOutcome.missingInputs, ...(periodMinutes === null ? ["valid period"] : [])],
    warnings: [...warnings, ...asaiOutcome.warnings],
  };

  if (bounds === null) {
    // Without a valid period nothing can be attributed to it; an empty count is not a real zero.
    const invalid = (kpi: CalculatedKpi): CalculatedKpi => ({
      ...kpi,
      status: "insufficient_data",
      value: null,
      missingInputs: [...new Set([...kpi.missingInputs, "valid period"])],
      warnings: [
        ...kpi.warnings,
        { code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." },
      ],
    });
    return { components, saidi: invalid(saidi), saifi: invalid(saifi), caidi: invalid(caidi), asai: invalid(asai) };
  }
  return { components, saidi, saifi, caidi, asai };
}
