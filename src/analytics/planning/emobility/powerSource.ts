import type { VehicleSegment } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { sizeSolar, solarMakesKwh, solarServesKwh } from "../solar.ts";
import { EMOBILITY_DEMAND_REFERENCE, energyUsedPerSwap, type DemandParameters, type SwapSegment } from "./demand.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: HOW TO POWER A HUB

   For a hub's kWh a day, five options, each on an average day of the
   year and on a rainy-season day:
   - grid with diesel backup: the grid supplies what the hub can draw
     in the feeder's hours of supply (its chargers and the DT's
     headroom limit the draw); diesel the rest;
   - diesel only;
   - solar + grid: PV sized for the day's charging in sun hours (the
     daytime share) on an average day; what PV does not supply comes
     from the grid, then diesel;
   - solar + BESS: PV sized for the whole day's energy on an average
     day, BESS for the energy charged outside sun hours; diesel
     backup for what PV does not make on the day;
   - hybrid: PV and BESS as solar + BESS, then the grid, then diesel.
   No option is solar every day: PV is sized to the average day, and
   a rainy-season day leaves a shortfall the backup meets.

   The sizing below is the shared rule in analytics/planning/solar.ts
   (moved there for the mini-grid planner; results unchanged).
   PV kWp = energy PV is to make ÷ (peak sun hours × performance
   ratio). With a BESS, the energy charged outside sun hours passes
   through it and loses (1 − round-trip efficiency): PV makes the
   daytime share plus the rest ÷ round-trip efficiency. BESS kWh =
   the day's energy × (1 − daytime share) ÷ depth of discharge. On a
   day, PV's output meets the daytime charging first; what is left
   charges the BESS, which returns it × round-trip efficiency.

   Costs are fuel and tariff only: diesel ₦/kWh = price a litre ÷ kWh
   a litre, excluding genset O&M and replacement, at the base and the
   low diesel price; grid at the
   feeder's band tariff. A solar option's cost per kWh is not given
   until its installed cost is supplied (an EPC quote): showing its
   backup's fuel alone would make it look free. Payback against
   diesel = installed cost ÷ (diesel-only fuel cost a day − the
   option's fuel and tariff cost a day) ÷ days a month.

   CO2 avoided is against petrol vehicles covering the same distance:
   distance = energy the rider uses × km a kWh; petrol = distance ÷
   km a litre × kg CO2 a litre. The hub's own emissions are diesel
   litres × kg CO2 a litre, plus grid kWh × the grid factor. Without
   a cited grid factor an option that draws on the grid has no CO2
   figure, never 0. Solar counts operating emissions only (none).
   Where the difference from petrol is within ±10% of the petrol
   figure, the result is "no material saving under these
   assumptions", not a precise figure: the vehicles' fuel economy and
   range are assumptions.
========================================================== */

export interface PowerSourceParameters {
  /** ₦ a litre, the base case. Reported (cited by the service). */
  dieselPricePerLitre: number;
  /** ₦ a litre, the low case. Reported (cited by the service). */
  dieselLowPricePerLitre: number;
  /** kWh a generator makes from a litre. Assumption. */
  dieselKwhPerLitre: number;
  /** IPCC 2006, Vol. 2, Ch. 2, Table 2.2: 74,100 kg CO2/TJ × 43.0 TJ/Gg × 0.84 kg/L. */
  dieselKgCo2PerLitre: number;
  /** IPCC 2006, Vol. 2, Ch. 3, Table 3.2.1: 69,300 kg CO2/TJ × 44.3 TJ/Gg × 0.753 kg/L. */
  petrolKgCo2PerLitre: number;
  /** Petrol vehicle km a litre. Assumption. */
  petrolKmPerLitre: Record<SwapSegment, number>;
  /** Electric vehicle km a kWh used. Assumption. */
  evKmPerKwh: Record<SwapSegment, number>;
  /** Grid kg CO2 a kWh; null until a source is cited. Reported (cited by the service). */
  gridKgCo2PerKwh: number | null;
  pvPerformanceRatio: number;
  bessDepthOfDischarge: number;
  /** Share of the energy put into the BESS that comes back out. Assumption. */
  bessRoundTripEfficiency: number;
  /** Within this share of the petrol figure, a CO2 difference is not material. */
  co2MaterialShare: number;
  /** Share of the day's charging done in sun hours. Assumption. */
  daytimeChargingShare: number;
  daysPerMonth: number;
}

export const EMOBILITY_POWER_SOURCE_REFERENCE: Methodology<PowerSourceParameters> = {
  id: "gridintel.planning.emobility-power-source",
  version: "0.1.0",
  name: "GridIntel reference power-source comparison for a swap hub",
  description:
    "Energy by source, fuel and tariff cost, diesel litres, CO2 avoided against petrol vehicles and payback against diesel for grid with backup, diesel, solar + grid, solar + BESS and hybrid, on an average and a rainy-season day.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {
    dieselPricePerLitre: 3_277.47,
    dieselLowPricePerLitre: 1_750,
    dieselKwhPerLitre: 3,
    dieselKgCo2PerLitre: 2.68,
    petrolKgCo2PerLitre: 2.31,
    petrolKmPerLitre: { motorcycle: 40, tricycle: 30 },
    evKmPerKwh: { motorcycle: 25, tricycle: 12 },
    gridKgCo2PerKwh: 0.395,
    pvPerformanceRatio: 0.8,
    bessDepthOfDischarge: 0.9,
    bessRoundTripEfficiency: 0.9,
    co2MaterialShare: 0.1,
    daytimeChargingShare: 0.5,
    daysPerMonth: 30.4,
  },
};

export type PowerOption = "grid_diesel" | "diesel" | "solar_grid" | "solar_bess" | "hybrid";
export const POWER_OPTIONS: readonly PowerOption[] = ["grid_diesel", "diesel", "solar_grid", "solar_bess", "hybrid"];
export type SunCase = "average" | "rainy_season";

export interface HubPowerFacts {
  /** Swaps a day by segment, at the horizon studied. */
  swapsPerDay: Partial<Record<VehicleSegment, number>>;
  kwhPerDay: number;
  grid: {
    /** The feeder's band tariff, ₦/kWh; null when the band has no published tariff. */
    tariffPerKwh: number | null;
    /** The feeder's average hours of supply a day; null when not calculated. */
    hoursOfSupply: number | null;
    /** What the hub may draw from the grid: its chargers, within the DT's headroom, kW; null when unknown. */
    availableKw: number | null;
  };
  solar: { averagePeakSunHours: number; rainySeasonPeakSunHours: number };
  /** Installed costs; null is a placeholder until an EPC quote is supplied. */
  installed: { pvNairaPerKwp: number | null; bessNairaPerKwh: number | null };
}

export interface OptionDay {
  sun: SunCase;
  solarKwh: number;
  gridKwh: number;
  dieselKwh: number;
  dieselLitres: number;
  /** Fuel and tariff, ₦ a day, at the base diesel price. */
  fuelAndTariffPerDay: number;
  /** ₦ a kWh, fuel and tariff only, at the base diesel price; null for a solar option without its installed cost. */
  costPerKwh: number | null;
  costPerSwap: number | null;
  /** The same at the low diesel price. */
  costPerKwhLowDiesel: number | null;
  costPerSwapLowDiesel: number | null;
  hubKgCo2PerDay: number | null;
  /** Against petrol vehicles over the same distance; null without a grid factor where the grid is used. */
  kgCo2AvoidedPerDay: number | null;
  kgCo2AvoidedPerSwap: number | null;
  /** kg CO2 a day petrol vehicles would emit over the same distance. */
  petrolKgCo2PerDay: number;
  /** Avoided ÷ petrol: "saving" above +10%, "no_material_saving" within ±10%, "more_than_petrol" below −10%; null without a figure. */
  co2Finding: Co2Finding | null;
  dieselLitresAvoidedPerDay: number;
}

export type Co2Finding = "saving" | "no_material_saving" | "more_than_petrol";

export interface OptionResult {
  option: PowerOption;
  /** null when the option cannot be studied (e.g. no grid figures); the reason says why. */
  pvKwp: number | null;
  bessKwh: number | null;
  /** ₦; null while an installed cost is a placeholder. */
  installedCost: number | null;
  days: Record<SunCase, OptionDay> | null;
  /** Months, on an average day; null while the cost is a placeholder, or when the option saves nothing. */
  paybackMonths: number | null;
  reasons: string[];
}

const SWAP_SEGMENTS: readonly SwapSegment[] = ["motorcycle", "tricycle"];

/** Diesel ₦ a kWh, fuel only, at the base or the low price. */
export function dieselCostPerKwh(parameters = EMOBILITY_POWER_SOURCE_REFERENCE.parameters, price: "base" | "low" = "base"): number {
  return (price === "base" ? parameters.dieselPricePerLitre : parameters.dieselLowPricePerLitre) / parameters.dieselKwhPerLitre;
}

/** Whether a CO2 difference from petrol is material, within the method's share of the petrol figure. */
export function co2Finding(avoidedKg: number, petrolKg: number, parameters = EMOBILITY_POWER_SOURCE_REFERENCE.parameters): Co2Finding | null {
  if (petrolKg <= 0) return null;
  const share = avoidedKg / petrolKg;
  if (Math.abs(share) <= parameters.co2MaterialShare) return "no_material_saving";
  return share > 0 ? "saving" : "more_than_petrol";
}

/** kg CO2 a day petrol vehicles would emit covering the distance the hub's swaps give. */
export function petrolBaselineKgCo2(swapsPerDay: Partial<Record<VehicleSegment, number>>, parameters = EMOBILITY_POWER_SOURCE_REFERENCE.parameters, demand: DemandParameters = EMOBILITY_DEMAND_REFERENCE.parameters): number {
  let kg = 0;
  for (const segment of SWAP_SEGMENTS) {
    const swaps = swapsPerDay[segment] ?? 0;
    const km = swaps * energyUsedPerSwap(segment, demand) * parameters.evKmPerKwh[segment];
    kg += (km / parameters.petrolKmPerLitre[segment]) * parameters.petrolKgCo2PerLitre;
  }
  return kg;
}

const totalSwaps = (swaps: Partial<Record<VehicleSegment, number>>) => Object.values(swaps).reduce<number>((sum, count) => sum + (count ?? 0), 0);

export function comparePowerSources(facts: HubPowerFacts, parameters = EMOBILITY_POWER_SOURCE_REFERENCE.parameters, demand: DemandParameters = EMOBILITY_DEMAND_REFERENCE.parameters): OptionResult[] {
  const energy = facts.kwhPerDay;
  const swaps = totalSwaps(facts.swapsPerDay);
  const dieselPerKwh = dieselCostPerKwh(parameters);
  const dieselLowPerKwh = dieselCostPerKwh(parameters, "low");
  const baseline = petrolBaselineKgCo2(facts.swapsPerDay, parameters, demand);
  const pr = parameters.pvPerformanceRatio;
  const sunHours: Record<SunCase, number> = { average: facts.solar.averagePeakSunHours, rainy_season: facts.solar.rainySeasonPeakSunHours };

  const { tariffPerKwh, hoursOfSupply, availableKw } = facts.grid;
  const gridKnown = tariffPerKwh !== null && hoursOfSupply !== null && availableKw !== null;
  const gridCapacity = gridKnown ? Math.max(0, availableKw) * Math.max(0, hoursOfSupply) : 0;
  const dieselOnlyLitres = energy / parameters.dieselKwhPerLitre;
  const dieselOnlyCost = energy * dieselPerKwh;

  const day = (sun: SunCase, solarKwh: number, usesGrid: boolean, solarOption: boolean, installedKnown: boolean): OptionDay => {
    const gridKwh = usesGrid ? Math.min(energy - solarKwh, gridCapacity) : 0;
    const dieselKwh = Math.max(0, energy - solarKwh - gridKwh);
    const dieselLitres = dieselKwh / parameters.dieselKwhPerLitre;
    const fuelAndTariffPerDay = dieselKwh * dieselPerKwh + gridKwh * (tariffPerKwh ?? 0);
    const costed = !(solarOption && !installedKnown) && energy > 0;
    const costPerKwh = costed ? fuelAndTariffPerDay / energy : null;
    const costPerKwhLowDiesel = costed ? (dieselKwh * dieselLowPerKwh + gridKwh * (tariffPerKwh ?? 0)) / energy : null;
    const gridEmissions = gridKwh > 0 ? (parameters.gridKgCo2PerKwh === null ? null : gridKwh * parameters.gridKgCo2PerKwh) : 0;
    const hubKgCo2PerDay = gridEmissions === null ? null : dieselLitres * parameters.dieselKgCo2PerLitre + gridEmissions;
    const kgCo2AvoidedPerDay = hubKgCo2PerDay === null ? null : baseline - hubKgCo2PerDay;
    return {
      sun,
      solarKwh,
      gridKwh,
      dieselKwh,
      dieselLitres,
      fuelAndTariffPerDay,
      costPerKwh,
      costPerSwap: costPerKwh === null || swaps <= 0 ? null : (costPerKwh * energy) / swaps,
      costPerKwhLowDiesel,
      costPerSwapLowDiesel: costPerKwhLowDiesel === null || swaps <= 0 ? null : (costPerKwhLowDiesel * energy) / swaps,
      hubKgCo2PerDay,
      kgCo2AvoidedPerDay,
      kgCo2AvoidedPerSwap: kgCo2AvoidedPerDay === null || swaps <= 0 ? null : kgCo2AvoidedPerDay / swaps,
      petrolKgCo2PerDay: baseline,
      co2Finding: kgCo2AvoidedPerDay === null ? null : co2Finding(kgCo2AvoidedPerDay, baseline, parameters),
      dieselLitresAvoidedPerDay: dieselOnlyLitres - dieselLitres,
    };
  };

  const build = (option: PowerOption): OptionResult => {
    const reasons: string[] = [];
    const usesGrid = option === "grid_diesel" || option === "solar_grid" || option === "hybrid";
    if (usesGrid && !gridKnown) {
      if (tariffPerKwh === null) reasons.push("no published tariff for the feeder's band");
      if (hoursOfSupply === null) reasons.push("no hours of supply calculated for the feeder");
      if (availableKw === null) reasons.push("no headroom figure for the DT");
      return { option, pvKwp: null, bessKwh: null, installedCost: null, days: null, paybackMonths: null, reasons };
    }
    const withBess = option === "solar_bess" || option === "hybrid";
    const solarOption = withBess || option === "solar_grid";
    const eta = parameters.bessRoundTripEfficiency;
    // The shared sizing (analytics/planning/solar.ts): PV for the daytime charging, plus what passes through the BESS grossed up for its losses.
    const sizing = sizeSolar({
      energyKwhPerDay: energy,
      daytimeShare: parameters.daytimeChargingShare,
      withStorage: withBess,
      peakSunHours: sunHours.average,
      performanceRatio: pr,
      depthOfDischarge: parameters.bessDepthOfDischarge,
      roundTripEfficiency: eta,
    });
    const { daytimeKwh: daytime, throughStorageKwh: throughBess } = sizing;
    const pvKwp = solarOption ? sizing.pvKwp : null;
    const bessKwh = sizing.storageKwh;
    const pvCost = pvKwp === null ? 0 : facts.installed.pvNairaPerKwp === null ? null : pvKwp * facts.installed.pvNairaPerKwp;
    const bessCost = bessKwh === null ? 0 : facts.installed.bessNairaPerKwh === null ? null : bessKwh * facts.installed.bessNairaPerKwh;
    const installedCost = !solarOption || pvCost === null || bessCost === null ? null : pvCost + bessCost;
    if (solarOption && installedCost === null) reasons.push("placeholder: no EPC quote");
    if (usesGrid && parameters.gridKgCo2PerKwh === null) reasons.push("grid emission factor not available");

    const days = {} as Record<SunCase, OptionDay>;
    for (const sun of ["average", "rainy_season"] as const) {
      const made = pvKwp === null ? 0 : solarMakesKwh(pvKwp, sunHours[sun], pr);
      const solarKwh = solarServesKwh(made, daytime, throughBess, eta);
      days[sun] = day(sun, solarKwh, usesGrid, solarOption, installedCost !== null);
    }
    const saving = dieselOnlyCost - days.average.fuelAndTariffPerDay;
    const paybackMonths = installedCost === null || saving <= 0 ? null : installedCost / saving / parameters.daysPerMonth;
    if (installedCost !== null && saving <= 0) reasons.push("saves nothing against diesel");
    return { option, pvKwp, bessKwh, installedCost, days, paybackMonths, reasons };
  };

  return POWER_OPTIONS.map(build);
}
