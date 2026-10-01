import type { Fraction, IsoTimestamp, MethodologyRef, Outage, Period, ScopeRef, ServiceBand } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import type { CalcStatus, CalculationContext, InputValue, Warning } from "../core/result.ts";
import { REFERENCE_DISCLAIMER, RELIABILITY_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { MS_PER_MINUTE, periodBounds } from "../core/time.ts";
import { classifyExposures } from "./exposure.ts";

/* ==========================================================
   ANALYTICS — HOURS OF SUPPLY AND SERVICE-BAND COMPLIANCE

   Hours of supply on a day is the customer-weighted average:

     24 − Σ (customers × minutes interrupted that day) ÷ customers served ÷ 60

   Every interruption with usable times and a customer count is
   included, whatever its cause and however short: a customer
   without supply is without supply, whoever is responsible.

   Days are consecutive 24-hour windows from the start of the
   period, so the period must start at local midnight and cover
   whole days.

   The band minimums are NERC's Service-Based Tariff definitions.
   The day-by-day test against them is a GridIntel reference
   calculation, not a regulatory determination: the regulator
   assesses compliance under its own procedure.
========================================================== */

export interface SupplyHoursParameters {
  /** Minimum average hours of supply per day each band commits to. */
  bandMinimumHours: Record<ServiceBand, number>;
}

export const SUPPLY_HOURS_REFERENCE: Methodology<SupplyHoursParameters> = {
  id: "gridintel.supply_hours.reference",
  version: "0.1.0",
  name: "GridIntel reference hours of supply",
  description:
    "Customer-weighted hours of supply per day from outage exposures, compared with the minimum hours of " +
    "the feeder's NERC service band.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: `${REFERENCE_DISCLAIMER} Band minimums are NERC Service-Based Tariff definitions.`,
  parameters: { bandMinimumHours: { A: 20, B: 16, C: 12, D: 8, E: 4 } },
};

const DAY_MINUTES = 24 * 60;

export interface SupplyDay {
  start: IsoTimestamp;
  hoursOfSupply: number;
  /** null when no band applies. */
  compliant: boolean | null;
}

export interface SupplyHoursResult {
  kind: "supply_hours";
  scope: ScopeRef;
  period: Period;
  status: CalcStatus;
  band: ServiceBand | null;
  minimumHours: number | null;
  days: SupplyDay[];
  /** Average over the period; null unless status is "ok". */
  averageHours: number | null;
  compliantOnAverage: boolean | null;
  daysCompliant: number | null;
  daysNonCompliant: number | null;
  /** The share of days that met the minimum. */
  complianceRate: Fraction | null;
  customersServed: InputValue;
  /** Exposures left out because their times or customer count are missing; supply may be overstated. */
  exposuresExcludedForData: number;
  missingInputs: string[];
  warnings: Warning[];
  methodology: MethodologyRef;
  computedAt: IsoTimestamp;
}

export function calculateSupplyHours(params: {
  scope: ScopeRef;
  period: Period;
  /** The outages attributable to the scope. */
  outages: readonly Outage[];
  customersServed: InputValue;
  /** The service band to test against; null when the scope has none. */
  band: ServiceBand | null;
  methodology?: Methodology<SupplyHoursParameters>;
  context: CalculationContext;
}): SupplyHoursResult {
  const { scope, period, outages, customersServed, band, context } = params;
  const methodology = params.methodology ?? SUPPLY_HOURS_REFERENCE;
  const minimumHours = band === null ? null : methodology.parameters.bandMinimumHours[band];
  const warnings: Warning[] = [];
  const base = {
    kind: "supply_hours" as const,
    scope,
    period,
    band,
    minimumHours,
    customersServed,
    methodology: methodologyRef(methodology),
    computedAt: context.computedAt,
  };
  const unavailable = (status: CalcStatus, missingInputs: string[], excluded = 0): SupplyHoursResult => ({
    ...base,
    status,
    days: [],
    averageHours: null,
    compliantOnAverage: null,
    daysCompliant: null,
    daysNonCompliant: null,
    complianceRate: null,
    exposuresExcludedForData: excluded,
    missingInputs,
    warnings,
  });

  const bounds = periodBounds(period);
  if (bounds === null) {
    warnings.push({ code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." });
    return unavailable("insufficient_data", ["valid period"]);
  }
  const periodMinutes = (bounds.endMs - bounds.startMs) / MS_PER_MINUTE;
  if (periodMinutes % DAY_MINUTES !== 0) {
    warnings.push({ code: "PERIOD_NOT_WHOLE_DAYS", message: "Hours of supply per day need a period of whole days." });
    return unavailable("not_computable", []);
  }

  // Classified once over the whole period to count the exposures that cannot be used at all.
  const excluded = classifyExposures({ outages, period, methodology: RELIABILITY_REFERENCE }).filter(
    (exposure) => exposure.dataExclusion !== null && exposure.dataExclusion !== "OUTSIDE_PERIOD",
  ).length;
  if (excluded > 0) {
    warnings.push({
      code: "EXPOSURES_EXCLUDED",
      message:
        `${excluded} exposure(s) have no usable times or customer count and were left out, so hours of supply ` +
        "may be overstated.",
    });
  }

  const served = customersServed.value;
  if (served === null) return unavailable("insufficient_data", ["customers served"], excluded);
  if (served === 0) {
    warnings.push({ code: "ZERO_DENOMINATOR", message: "No customers are served under the scope." });
    return unavailable("not_computable", [], excluded);
  }

  const days: SupplyDay[] = [];
  for (let startMs = bounds.startMs; startMs < bounds.endMs; startMs += DAY_MINUTES * MS_PER_MINUTE) {
    const day: Period = {
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + DAY_MINUTES * MS_PER_MINUTE).toISOString(),
    };
    const customerMinutes = classifyExposures({ outages, period: day, methodology: RELIABILITY_REFERENCE })
      .filter((exposure) => exposure.dataExclusion === null)
      .reduce((sum, exposure) => sum + (exposure.customersAffected as number) * exposure.minutesInPeriod, 0);
    const hoursOfSupply = 24 - customerMinutes / served / 60;
    days.push({ start: day.start, hoursOfSupply, compliant: minimumHours === null ? null : hoursOfSupply >= minimumHours });
  }

  const averageHours = days.reduce((sum, day) => sum + day.hoursOfSupply, 0) / days.length;
  const daysCompliant = minimumHours === null ? null : days.filter((day) => day.compliant).length;
  return {
    ...base,
    status: "ok",
    days,
    averageHours,
    compliantOnAverage: minimumHours === null ? null : averageHours >= minimumHours,
    daysCompliant,
    daysNonCompliant: daysCompliant === null ? null : days.length - daysCompliant,
    complianceRate: daysCompliant === null ? null : daysCompliant / days.length,
    exposuresExcludedForData: excluded,
    missingInputs: [],
    warnings,
  };
}
