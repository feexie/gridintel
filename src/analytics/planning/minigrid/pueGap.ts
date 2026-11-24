import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { sizeSolar } from "../solar.ts";
import type { DemandCase, SizingParameters, SizingResult } from "./sizing.ts";
import { MINIGRID_SIZING_REFERENCE } from "./sizing.ts";
import type { DemandResult } from "./demand.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: THE PRODUCTIVE-USE GAP
   (gridintel.planning.minigrid-pue-gap 0.1.0; MG-PLAN.md 3.2 (5))

   The daytime productive load needed to bring a year's utilisation
   to a target: target × what the PV makes on an average day − the
   energy the demand already needs from PV. The productive load is
   taken as daytime, direct from PV, with no battery (an assumption).

   Equipment examples are for illustration only and are never the
   community's demand.
========================================================== */

export interface PueParameters {
  /** Utilisation to reach. Assumption. */
  targetUtilisation: number;
}

export const MINIGRID_PUE_GAP_REFERENCE: Methodology<PueParameters> = {
  id: "gridintel.planning.minigrid-pue-gap",
  version: "0.1.0",
  name: "GridIntel reference productive-use gap for a planned mini-grid",
  description: "The daytime productive kWh a day that brings a year's utilisation to a target, taken direct from PV with no battery.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { targetUtilisation: 0.7 },
};

export interface PueEquipment {
  name: string;
  kw: number;
  hoursPerDay: number;
}

/** Illustration only: assumed ratings and hours, never the community's demand. */
export const PUE_EXAMPLES: readonly PueEquipment[] = [
  { name: "Grain mill", kw: 7.5, hoursPerDay: 3 },
  { name: "Freezer", kw: 0.3, hoursPerDay: 10 },
  { name: "Welding set", kw: 5, hoursPerDay: 2 },
  { name: "Irrigation pump", kw: 1.5, hoursPerDay: 5 },
];

export interface PueGapResult {
  year: number;
  case: DemandCase;
  target: number;
  /** Utilisation before any productive load; null when the year has no demand figure. */
  utilisation: number | null;
  /** kWh a day of daytime productive load; 0 when the year is already at or above the target; null without a figure. */
  productiveKwhPerDay: number | null;
  /** Each example's kWh a day and how many of it would fill the gap. Illustration only. */
  examples: { name: string; kwhPerDay: number; units: number | null }[];
  method: { id: string; version: string };
}

export function pueGap(
  demand: DemandResult,
  sizing: SizingResult,
  at: { year: number; case: DemandCase } = { year: 1, case: "p50" },
  parameters: PueParameters = MINIGRID_PUE_GAP_REFERENCE.parameters,
  sizingParameters: SizingParameters = MINIGRID_SIZING_REFERENCE.parameters,
): PueGapResult {
  const kwh = demand.years.find((one) => one.year === at.year)?.[at.case] ?? null;
  const needed =
    kwh === null
      ? null
      : sizeSolar({
          energyKwhPerDay: kwh,
          daytimeShare: 1 - sizingParameters.nightShare,
          withStorage: true,
          peakSunHours: 1,
          performanceRatio: 1,
          depthOfDischarge: sizingParameters.chemistry.depthOfDischarge,
          roundTripEfficiency: sizingParameters.chemistry.roundTripEfficiency,
        }).pvMakesKwh;
  const gap = needed === null ? null : Math.max(0, parameters.targetUtilisation * sizing.pvEnergyAverageKwh - needed);
  return {
    year: at.year,
    case: at.case,
    target: parameters.targetUtilisation,
    utilisation: needed === null ? null : needed / sizing.pvEnergyAverageKwh,
    productiveKwhPerDay: gap,
    examples: PUE_EXAMPLES.map((one) => ({ name: one.name, kwhPerDay: one.kw * one.hoursPerDay, units: gap === null ? null : gap / (one.kw * one.hoursPerDay) })),
    method: { id: MINIGRID_PUE_GAP_REFERENCE.id, version: MINIGRID_PUE_GAP_REFERENCE.version },
  };
}
