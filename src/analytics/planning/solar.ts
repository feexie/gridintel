/* ==========================================================
   ANALYTICS — SOLAR AND STORAGE SIZING SHARED BY THE PLANNERS

   The day/night arithmetic for PV with or without a battery, moved
   here from the E-mobility power-source comparison so the mini-grid
   planner uses the same rule (docs/design/MG-PLAN.md 3.5). EMOB-A
   calls it with its results and method version unchanged, pinned by
   src/services/planning/emobility.pinned.test.ts.

   Sizing, for a day's energy E and a daytime share d:
   - the daytime part, E × d, is served direct from PV;
   - with storage, the rest, E − E × d, passes through the battery
     and loses (1 − round-trip efficiency η): PV makes E × d +
     (E − E × d) ÷ η;
   - PV kWp = what PV makes ÷ (peak sun hours × performance ratio);
   - battery kWh = the energy through it ÷ depth of discharge.

   On a day: PV makes kWp × sun hours × PR. It meets the daytime part
   first; what is left charges the battery, which returns it × η, up
   to the energy that was to pass through it.

   No hour-by-hour dispatch and no loss-of-load probability: daily
   energy only.
========================================================== */

export interface SolarSizingInput {
  /** kWh a day the system is to serve. */
  energyKwhPerDay: number;
  /** Share of the day's energy used while the sun is up. */
  daytimeShare: number;
  /** Whether a battery carries the rest of the day; without one, PV serves the daytime part only. */
  withStorage: boolean;
  /** Peak sun hours of the day PV is sized for. */
  peakSunHours: number;
  performanceRatio: number;
  depthOfDischarge: number;
  /** Share of the energy put into the battery that comes back out. */
  roundTripEfficiency: number;
}

export interface SolarSizing {
  /** kWh a day used while the sun is up. */
  daytimeKwh: number;
  /** kWh a day that passes through the battery; 0 without one. */
  throughStorageKwh: number;
  /** kWh a day PV is to make on the day it is sized for. */
  pvMakesKwh: number;
  pvKwp: number;
  /** Usable capacity ÷ depth of discharge; null without storage. */
  storageKwh: number | null;
}

/** PV and battery sized for a day's energy. */
export function sizeSolar(input: SolarSizingInput): SolarSizing {
  const daytimeKwh = input.energyKwhPerDay * input.daytimeShare;
  const throughStorageKwh = input.withStorage ? input.energyKwhPerDay - daytimeKwh : 0;
  // PV makes the daytime part, plus what passes through the battery grossed up for its losses.
  const pvMakesKwh = daytimeKwh + throughStorageKwh / input.roundTripEfficiency;
  return {
    daytimeKwh,
    throughStorageKwh,
    pvMakesKwh,
    pvKwp: pvMakesKwh / (input.peakSunHours * input.performanceRatio),
    storageKwh: input.withStorage ? throughStorageKwh / input.depthOfDischarge : null,
  };
}

/** kWh PV makes on a day. */
export function solarMakesKwh(pvKwp: number, peakSunHours: number, performanceRatio: number): number {
  return pvKwp * peakSunHours * performanceRatio;
}

/** kWh served from PV on a day: the daytime part first, then through the battery at its round-trip efficiency. */
export function solarServesKwh(madeKwh: number, daytimeKwh: number, throughStorageKwh: number, roundTripEfficiency: number): number {
  const direct = Math.min(daytimeKwh, madeKwh);
  return direct + Math.min(throughStorageKwh, Math.max(0, madeKwh - direct) * roundTripEfficiency);
}
