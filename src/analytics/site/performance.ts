import type { BillingRecord, IntervalEnergy, Outage, Payment, Period, TelemetryPoint } from "@/domain";
import type { Methodology, SiteParameters } from "../core/methodology.ts";
import type { CalculatedKpi } from "../core/result.ts";
import type { SiteAvailability } from "./availability.ts";
import type { SiteCommercial } from "./commercial.ts";
import type { SiteTechnical } from "./energy.ts";
import type { SiteIndex } from "./registry.ts";
import { computeSiteAvailability } from "./availability.ts";
import { computeSiteCommercial } from "./commercial.ts";
import { computeSiteTechnical } from "./energy.ts";
import { kpiQuantity } from "./quantity.ts";
import { siteCustomers } from "./registry.ts";

/* ==========================================================
   ANALYTICS — SITE PERFORMANCE

   Everything calculated for one site and one period: the energy
   balance, PV, storage and generator performance, availability, and
   the commercial figures. Each part is computed by its own module;
   this only puts them together, so that energy delivered and the
   connection count are the same figure wherever they are used.
========================================================== */

export interface SitePerformance extends SiteTechnical {
  kind: "site_performance";
  siteId: string;
  period: Period;
  availability: SiteAvailability;
  commercial: SiteCommercial;
}

export function computeSitePerformance(params: {
  index: SiteIndex;
  siteId: string;
  period: Period;
  intervals: readonly IntervalEnergy[];
  telemetry: readonly TelemetryPoint[];
  outages: readonly Outage[];
  outagesAvailable: boolean;
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  billingAvailable: boolean;
  currency: string;
  /** True when the registry holds every asset and account of the site. */
  registryComplete: boolean;
  methodology?: Methodology<SiteParameters>;
  computedAt: string;
}): SitePerformance {
  const { index, siteId, period, methodology, computedAt } = params;
  const technical = computeSiteTechnical({ index, siteId, period, intervals: params.intervals, telemetry: params.telemetry, assetsComplete: params.registryComplete, methodology, computedAt });
  const active = siteCustomers(index, siteId).filter((customer) => customer.accountStatus === "active").length;
  return {
    kind: "site_performance",
    siteId,
    period,
    ...technical,
    availability: computeSiteAvailability({
      siteId,
      period,
      outages: params.outages,
      recordsAvailable: params.outagesAvailable,
      // With an incomplete register the number of connections is not known, so nothing is weighted by it.
      connections: params.registryComplete ? active : null,
      methodology,
      computedAt,
    }),
    commercial: computeSiteCommercial({
      index,
      siteId,
      period,
      recordsAvailable: params.billingAvailable,
      billingRecords: params.billingRecords,
      payments: params.payments,
      currency: params.currency,
      energyDelivered: kpiQuantity(technical.energy.energyDelivered),
      methodology,
      computedAt,
    }),
  };
}

/**
 * The figures of a site that a report may state, for setting a reported figure beside the
 * calculated one on its own basis. Where a figure exists on more than one basis every one is
 * listed, and `compareOnBasis` picks.
 */
export function comparableSiteKpis(performance: SitePerformance): CalculatedKpi[] {
  const { energy, pv, generator, availability, commercial } = performance;
  return [
    energy.energyGenerated,
    energy.pvGeneration,
    energy.generatorGeneration,
    energy.energySentOut,
    energy.energyDelivered,
    energy.renewableFraction,
    energy.generatorShare,
    energy.distributionLoss,
    energy.siteLoss,
    ...(pv === null ? [] : [pv.specificYield, pv.performanceRatio]),
    ...(generator === null ? [] : [generator.runtime, generator.fuelUsed]),
    availability.all.availability,
    availability.unplannedOnly.availability,
    availability.all.hoursOfSupply,
    availability.unplannedOnly.hoursOfSupply,
    commercial.connections,
    commercial.connectionsAll,
    commercial.energySold,
    commercial.revenueBilled,
    commercial.revenueCollected,
    commercial.collectionEfficiency,
    commercial.energySoldPerConnection,
  ];
}
