import type { VehicleSegment } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: SWAP DEMAND AND CHARGING ENERGY

   - Energy drawn to recharge one swapped battery
       = pack kWh × (1 − state of charge on return) ÷ charging efficiency.
     The upper case is full depletion: pack kWh ÷ charging efficiency.
   - A hub's swaps a day grow with the vehicles it serves, compounding
     at the adoption case's yearly rate: swaps × (1 + rate)^(months ÷ 12).
   - Vehicles served = swaps a day ÷ swaps a vehicle a day.
   - Charging power = kWh a day ÷ the hours the hub can charge in.

   Only motorcycles and tricycles have a battery and a use in the
   inputs. Swaps of any other segment are named as not counted, never
   counted as 0 kWh.
========================================================== */

export type AdoptionCase = "slow" | "base" | "fast";
export type SwapSegment = "motorcycle" | "tricycle";

export const ADOPTION_CASES: readonly AdoptionCase[] = ["slow", "base", "fast"];
/** Months from now the planner looks at. */
export const HORIZONS = [0, 12, 24, 48] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface DemandParameters {
  /** Battery pack, kWh. Assumption. */
  batteryKwh: Record<SwapSegment, number>;
  /** State of charge a battery comes back with, 0 to 1. Assumption. */
  stateOfChargeOnReturn: number;
  /** Energy stored ÷ energy drawn, 0 to 1. Assumption. */
  chargingEfficiency: number;
  /** Swaps a vehicle makes a day. Assumption. */
  swapsPerVehicleDay: Record<SwapSegment, number>;
  /** Yearly growth in vehicles served, by adoption case. Assumption, never a forecast. */
  adoptionPerYear: Record<AdoptionCase, number>;
}

export const EMOBILITY_DEMAND_REFERENCE: Methodology<DemandParameters> = {
  id: "gridintel.planning.emobility-demand",
  version: "0.1.0",
  name: "GridIntel reference e-mobility swap demand",
  description:
    "Energy per swap from pack size, state of charge on return and charging efficiency; a hub's swaps a day grown at a stated adoption rate to 12, 24 and 48 months; vehicles served and charging power.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {
    batteryKwh: { motorcycle: 3, tricycle: 5 },
    stateOfChargeOnReturn: 0.25,
    chargingEfficiency: 0.9,
    swapsPerVehicleDay: { motorcycle: 1.5, tricycle: 2 },
    adoptionPerYear: { slow: 0.15, base: 0.35, fast: 0.6 },
  },
};

const SWAP_SEGMENTS: readonly SwapSegment[] = ["motorcycle", "tricycle"];
const isSwapSegment = (segment: VehicleSegment): segment is SwapSegment => (SWAP_SEGMENTS as readonly VehicleSegment[]).includes(segment);

/** kWh drawn to recharge one swapped battery: the base case, and full depletion as the upper case. */
export function energyPerSwap(segment: SwapSegment, parameters = EMOBILITY_DEMAND_REFERENCE.parameters): { base: number; upper: number } {
  const pack = parameters.batteryKwh[segment];
  return { base: (pack * (1 - parameters.stateOfChargeOnReturn)) / parameters.chargingEfficiency, upper: pack / parameters.chargingEfficiency };
}

/** kWh the rider uses from one battery: pack × (1 − state of charge on return). */
export function energyUsedPerSwap(segment: SwapSegment, parameters = EMOBILITY_DEMAND_REFERENCE.parameters): number {
  return parameters.batteryKwh[segment] * (1 - parameters.stateOfChargeOnReturn);
}

export interface DayEnergy {
  swaps: number;
  kwh: number;
  kwhUpper: number;
  /** Segments with swaps that have no battery or use in the inputs; their swaps are not in kwh. */
  notCounted: VehicleSegment[];
}

/** A day's swaps, by segment, as energy drawn. */
export function dayEnergy(swaps: Partial<Record<VehicleSegment, number>>, parameters = EMOBILITY_DEMAND_REFERENCE.parameters): DayEnergy {
  let total = 0;
  let kwh = 0;
  let kwhUpper = 0;
  const notCounted: VehicleSegment[] = [];
  for (const [segment, count] of Object.entries(swaps) as [VehicleSegment, number][]) {
    if (!(count > 0)) continue;
    total += count;
    if (!isSwapSegment(segment)) {
      notCounted.push(segment);
      continue;
    }
    const each = energyPerSwap(segment, parameters);
    kwh += count * each.base;
    kwhUpper += count * each.upper;
  }
  return { swaps: total, kwh, kwhUpper, notCounted };
}

/** The growth factor at a horizon: (1 + rate)^(months ÷ 12). */
export function growthFactor(ratePerYear: number, months: number): number {
  return (1 + ratePerYear) ** (months / 12);
}

export interface DemandRow {
  adoption: AdoptionCase;
  months: Horizon;
  swapsPerDay: Partial<Record<VehicleSegment, number>>;
  totalSwapsPerDay: number;
  /** Vehicles served, motorcycles and tricycles only. */
  vehiclesServed: number;
  kwhPerDay: number;
  kwhPerDayUpper: number;
  /** kWh a day ÷ charging hours; null when the hub has no hours to charge in. */
  chargingKw: number | null;
  notCounted: VehicleSegment[];
}

/** A hub's demand at each horizon under each adoption case. */
export function projectDemand(swapsNow: Partial<Record<VehicleSegment, number>>, chargingHours: number | null, parameters = EMOBILITY_DEMAND_REFERENCE.parameters): DemandRow[] {
  const rows: DemandRow[] = [];
  for (const adoption of ADOPTION_CASES) {
    for (const months of HORIZONS) {
      const factor = growthFactor(parameters.adoptionPerYear[adoption], months);
      const swapsPerDay: Partial<Record<VehicleSegment, number>> = {};
      let vehiclesServed = 0;
      for (const [segment, count] of Object.entries(swapsNow) as [VehicleSegment, number][]) {
        swapsPerDay[segment] = count * factor;
        if (isSwapSegment(segment)) vehiclesServed += (count * factor) / parameters.swapsPerVehicleDay[segment];
      }
      const energy = dayEnergy(swapsPerDay, parameters);
      rows.push({
        adoption,
        months,
        swapsPerDay,
        totalSwapsPerDay: energy.swaps,
        vehiclesServed,
        kwhPerDay: energy.kwh,
        kwhPerDayUpper: energy.kwhUpper,
        chargingKw: chargingHours === null || chargingHours <= 0 ? null : energy.kwh / chargingHours,
        notCounted: energy.notCounted,
      });
    }
  }
  return rows;
}
