import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { sizeSolar, solarMakesKwh, solarServesKwh } from "../solar.ts";
import type { DemandCase, DemandResult } from "./demand.ts";

export type { DemandCase };

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: SIZING THE SYSTEM
   (gridintel.planning.minigrid-sizing 0.1.0; MG-PLAN.md 3.2 (2))

   PV kWp and battery kWh for a design day, with the shared rule in
   analytics/planning/solar.ts (the same as EMOB-A's): the day share
   direct from PV, the night share through the battery at its
   round-trip efficiency; kWp = PV energy ÷ (sun hours × PR); battery
   kWh = night energy ÷ depth of discharge.

   The design day is the highest diversified P90 of years 1 to 5, or
   a named year and case. The no-diversity upper bound is never used.

   Utilisation, by year and case: the energy the demand needs from PV
   ÷ what the PV makes on an average day. Where year 1's P50
   utilisation is below the threshold the result is flagged
   oversized, with the year and what holds year 1 down.

   On a rainy-season day PV makes less; the result gives what it
   makes as a share of what the design day needs, the share of the
   design day it serves (the day share first, then the battery), and
   the shortfall in kWh.
========================================================== */

export interface BatteryChemistry {
  name: string;
  depthOfDischarge: number;
  roundTripEfficiency: number;
}

export interface SizingParameters {
  performanceRatio: number;
  /** Share of the day's energy used after dark. Assumption: the reference data has no hourly figures. */
  nightShare: number;
  chemistry: BatteryChemistry;
  /** Year-1 P50 utilisation below this flags the system oversized. Assumption. */
  oversizedThreshold: number;
}

export const LEAD_ACID: BatteryChemistry = { name: "Lead-acid", depthOfDischarge: 0.5, roundTripEfficiency: 0.85 };
export const LITHIUM_IRON_PHOSPHATE: BatteryChemistry = { name: "Lithium iron phosphate", depthOfDischarge: 0.9, roundTripEfficiency: 0.9 };

export const MINIGRID_SIZING_REFERENCE: Methodology<SizingParameters> = {
  id: "gridintel.planning.minigrid-sizing",
  version: "0.1.0",
  name: "GridIntel reference PV and battery sizing for a planned mini-grid",
  description:
    "PV kWp and battery kWh for the design day (the highest diversified P90 of years 1 to 5), utilisation by year and case on an average day, the rainy-season shortfall, and an oversized flag on year-1 P50 utilisation.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { performanceRatio: 0.8, nightShare: 0.6, chemistry: LEAD_ACID, oversizedThreshold: 0.6 },
};

export interface SunHours {
  average: number;
  rainySeason: number;
}

export interface SizingResult {
  designDay: { year: number; case: DemandCase; kwh: number };
  pvKwp: number;
  batteryKwh: number;
  /** kWh PV makes on an average day. */
  pvEnergyAverageKwh: number;
  /** kWh the design day needs PV to make (the day share, plus the night share ÷ round-trip efficiency). */
  pvEnergyNeededKwh: number;
  rainySeason: {
    pvEnergyKwh: number;
    /** What PV makes ÷ what the design day needs from it. */
    pvEnergyShare: number;
    /** kWh of the design day served from PV. */
    servedKwh: number;
    servedShare: number;
    shortfallKwh: number;
  };
  utilisation: { year: number; p50: number | null; p90: number | null }[];
  oversized: { year: number; utilisation: number; threshold: number; reason: string } | null;
  chemistry: string;
  method: { id: string; version: string };
}

/** The design day: the highest diversified P90 of years 1 to 5 unless a year and case are named; null when no year has one. */
export function designDay(demand: DemandResult, named?: { year: number; case: DemandCase }): { year: number; case: DemandCase; kwh: number } | null {
  if (named) {
    const kwh = demand.years.find((one) => one.year === named.year)?.[named.case] ?? null;
    return kwh === null ? null : { ...named, kwh };
  }
  let best: { year: number; case: DemandCase; kwh: number } | null = null;
  for (const one of demand.years) if (one.p90 !== null && (best === null || one.p90 > best.kwh)) best = { year: one.year, case: "p90", kwh: one.p90 };
  return best;
}

export function sizeSystem(demand: DemandResult, sun: SunHours, parameters: SizingParameters = MINIGRID_SIZING_REFERENCE.parameters, named?: { year: number; case: DemandCase }): SizingResult | null {
  const design = designDay(demand, named);
  if (design === null) return null;
  const { performanceRatio: pr, chemistry } = parameters;
  const daytimeShare = 1 - parameters.nightShare;
  const sizing = (kwh: number) =>
    sizeSolar({ energyKwhPerDay: kwh, daytimeShare, withStorage: true, peakSunHours: sun.average, performanceRatio: pr, depthOfDischarge: chemistry.depthOfDischarge, roundTripEfficiency: chemistry.roundTripEfficiency });
  const system = sizing(design.kwh);
  const average = solarMakesKwh(system.pvKwp, sun.average, pr);
  const rainy = solarMakesKwh(system.pvKwp, sun.rainySeason, pr);
  const served = solarServesKwh(rainy, system.daytimeKwh, system.throughStorageKwh, chemistry.roundTripEfficiency);
  const use = (kwh: number | null) => (kwh === null ? null : sizing(kwh).pvMakesKwh / average);
  const utilisation = demand.years.map((one) => ({ year: one.year, p50: use(one.p50), p90: use(one.p90) }));

  const first = demand.years[0];
  const firstUse = utilisation[0]?.p50 ?? null;
  const oversized =
    firstUse !== null && firstUse < parameters.oversizedThreshold
      ? {
          year: 1,
          utilisation: firstUse,
          threshold: parameters.oversizedThreshold,
          reason: `Year 1 at P50 uses ${percent(firstUse)} of what the PV makes on an average day, below ${percent(parameters.oversizedThreshold)}: year 1's demand is ${percent((first.p50 ?? 0) / design.kwh)} of the design day (year ${design.year}), held down by the connection ramp (${percent(first.ramp ?? 0)} of accounts) and the buying share (${percent(first.buyingShare ?? 0)}).`,
        }
      : null;

  return {
    designDay: design,
    pvKwp: system.pvKwp,
    batteryKwh: system.storageKwh ?? 0,
    pvEnergyAverageKwh: average,
    pvEnergyNeededKwh: system.pvMakesKwh,
    rainySeason: { pvEnergyKwh: rainy, pvEnergyShare: rainy / system.pvMakesKwh, servedKwh: served, servedShare: served / design.kwh, shortfallKwh: design.kwh - served },
    utilisation,
    oversized,
    chemistry: chemistry.name,
    method: { id: MINIGRID_SIZING_REFERENCE.id, version: MINIGRID_SIZING_REFERENCE.version },
  };
}

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
