import type { DataQuality, KpiBasis, Outage, Period, ScopeRef } from "@/domain";
import type { Methodology, ReliabilityParameters } from "../core/methodology.ts";
import type { CalculatedKpi, CalculationContext, InputValue, UnfinalizedKpi, Warning } from "../core/result.ts";
import type { AttributionClass, ClassifiedExposure } from "./exposure.ts";
import { RELIABILITY_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { finalizeKpi, ratio } from "../core/result.ts";
import { MS_PER_MINUTE, periodBounds } from "../core/time.ts";
import { ATTRIBUTION_CLASSES, classifyExposures } from "./exposure.ts";

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

   ATTRIBUTION. The counted totals are also split by who the
   interruption is attributed to (network, upstream supply, load
   management, other; see exposure.ts). The split uses the same
   counted exposures as the indices, so the parts always sum to the
   total. Nothing is apportioned.
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
  /**
   * The counted exposures by attribution class. In each class,
   * customerMinutes are those counted for SAIDI and
   * customerInterruptions those counted for SAIFI.
   */
  attribution: Record<AttributionClass, ComponentTotals>;
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

/** One attribution class's contribution to SAIDI and SAIFI; the classes sum to the totals. */
export interface AttributedIndices {
  customerMinutes: number;
  customerInterruptions: number;
  /** This class's share of the counted customer-minutes; null when there are none. */
  shareOfCustomerMinutes: number | null;
  /** In the methodology's duration unit; null when the customers served are not known. */
  saidi: number | null;
  saifi: number | null;
}

export interface ReliabilityResult {
  components: ReliabilityComponents;
  attribution: Record<AttributionClass, AttributedIndices>;
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
    attribution: {
      network: emptyTotals(),
      upstream_supply: emptyTotals(),
      load_management: emptyTotals(),
      other: emptyTotals(),
    },
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

    const customers = exposure.customersAffected as number;
    const attributed = components.attribution[exposure.attribution];
    if (exposure.countsForSaidi || exposure.countsForSaifi) attributed.exposures += 1;
    if (exposure.countsForSaidi) {
      add(components.counted.saidi, exposure);
      attributed.customerMinutes += customers * exposure.minutesInPeriod;
    }
    if (exposure.countsForSaifi) {
      // SAIFI counts interruptions; its minutes are not used.
      components.counted.saifi.exposures += 1;
      components.counted.saifi.customerInterruptions += customers;
      attributed.customerInterruptions += customers;
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
  const derivedCounts = counted.filter((e) => e.customerCountBasis === "topology_derived").length;
  if (derivedCounts > 0) {
    warnings.push({
      code: "CUSTOMER_COUNTS_TOPOLOGY_DERIVED",
      message:
        `${derivedCounts} exposure(s) take their customer count from the network model rather than a count made ` +
        "at the time. The counts are derived, not estimated, and reflect the topology they were read from.",
    });
  }
  const basis: KpiBasis = {
    interruptionClasses: ATTRIBUTION_CLASSES,
    plannedInterruptions: parameters.include.planned ? "included" : "excluded",
  };
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
    basis,
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
  const saidi: UnfinalizedKpi = {
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
  const saifi: UnfinalizedKpi = {
    ...base,
    metric: "saifi",
    unit: "interruptions_per_customer",
    status: saifiOutcome.status,
    value: saifiOutcome.value,
    missingInputs: saifiOutcome.missingInputs,
    warnings: [...warnings, ...saifiOutcome.warnings],
  };

  const caidiOutcome = ratio("SAIDI", saidi.value, "SAIFI", saifi.value);
  const caidi: UnfinalizedKpi = {
    ...base,
    metric: "caidi",
    unit: parameters.durationUnit,
    status: saidi.status !== "ok" ? saidi.status : saifi.status !== "ok" ? saifi.status : caidiOutcome.status,
    value: caidiOutcome.value,
    missingInputs: [...saidi.missingInputs, ...saifi.missingInputs],
    warnings: [...warnings, ...caidiOutcome.warnings],
  };

  const usableServed = served !== null && served > 0;
  const attributed = (name: AttributionClass): AttributedIndices => {
    const totals = components.attribution[name];
    return {
      customerMinutes: totals.customerMinutes,
      customerInterruptions: totals.customerInterruptions,
      shareOfCustomerMinutes:
        components.counted.saidi.customerMinutes > 0
          ? totals.customerMinutes / components.counted.saidi.customerMinutes
          : null,
      saidi: usableServed ? (totals.customerMinutes / (served as number)) * durationFactor : null,
      saifi: usableServed ? totals.customerInterruptions / (served as number) : null,
    };
  };

  const bounds = periodBounds(period);
  const periodMinutes = bounds === null ? null : (bounds.endMs - bounds.startMs) / MS_PER_MINUTE;
  const asaiOutcome = ratio(
    "customer-minutes",
    components.counted.saidi.customerMinutes,
    "customer-minutes demanded",
    served === null || periodMinutes === null ? null : served * periodMinutes,
  );
  const asai: UnfinalizedKpi = {
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
    const invalid = (kpi: UnfinalizedKpi): CalculatedKpi =>
      finalizeKpi({
        ...kpi,
        status: "insufficient_data",
        value: null,
        missingInputs: [...new Set([...kpi.missingInputs, "valid period"])],
        warnings: [
          ...kpi.warnings,
          { code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." },
        ],
      });
    const unknown = { saidi: null, saifi: null };
    return {
      components,
      attribution: {
        network: { ...attributed("network"), ...unknown },
        upstream_supply: { ...attributed("upstream_supply"), ...unknown },
        load_management: { ...attributed("load_management"), ...unknown },
        other: { ...attributed("other"), ...unknown },
      },
      saidi: invalid(saidi),
      saifi: invalid(saifi),
      caidi: invalid(caidi),
      asai: invalid(asai),
    };
  }
  return {
    components,
    attribution: {
      network: attributed("network"),
      upstream_supply: attributed("upstream_supply"),
      load_management: attributed("load_management"),
      other: attributed("other"),
    },
    saidi: finalizeKpi(saidi),
    saifi: finalizeKpi(saifi),
    caidi: finalizeKpi(caidi),
    asai: finalizeKpi(asai),
  };
}

/* ==========================================================
   INDICES ON A STATED BASIS
========================================================== */

/**
 * SAIDI and SAIFI counting only the given attribution classes, e.g. only
 * "network" for a figure that leaves out load shedding and upstream
 * supply. Each is the sum of those classes' parts of the total, so no
 * exposure is counted that the total does not count. The KPIs state the
 * classes in their `basis`, which is what lets them be compared with a
 * reported figure on the same basis.
 */
export function reliabilityOnBasis(
  result: ReliabilityResult,
  classes: readonly AttributionClass[],
): { saidi: CalculatedKpi; saifi: CalculatedKpi } {
  const selected = ATTRIBUTION_CLASSES.filter((name) => classes.includes(name));
  const parts = selected.map((name) => result.attribution[name]);
  const sum = (pick: (part: AttributedIndices) => number | null): number | null =>
    parts.some((part) => pick(part) === null) ? null : parts.reduce((total, part) => total + (pick(part) as number), 0);
  const basis: KpiBasis = { ...result.saidi.basis, interruptionClasses: selected };
  const narrowed = (kpi: CalculatedKpi, value: number | null, input: "customerMinutes" | "customerInterruptions"): CalculatedKpi => ({
    ...kpi,
    basis,
    value: kpi.value === null ? null : value,
    inputs: {
      ...kpi.inputs,
      [input]: { ...kpi.inputs[input], value: parts.reduce((total, part) => total + part[input], 0) },
    },
  });
  return {
    saidi: narrowed(result.saidi, sum((part) => part.saidi), "customerMinutes"),
    saifi: narrowed(result.saifi, sum((part) => part.saifi), "customerInterruptions"),
  };
}
