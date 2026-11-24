import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: DOES A HUB FIT ITS TRANSFORMER AND FEEDER?

   At each horizon:
   - the DT's own load = its observed peak kVA × (1 + yearly load
     growth)^(months ÷ 12);
   - headroom = rating × the loading methodology's overload threshold
     − the DT's own load (negative when it is already over);
   - the hub charges its day's energy in the feeder's hours of supply:
     it draws kWh a day ÷ hours, but never more than its chargers;
   - it fits the DT when that draw ÷ the hub's power factor is within
     the headroom (the cautious case: the hub's charging is taken to
     coincide with the DT's peak);
   - it fits the hours when its chargers can take the day's energy in
     the feeder's hours of supply.
   A hub that fails either is named with the limit it fails: "DT
   rating", "supply hours", or both. A DT with no observed peak, or a
   feeder with no hours of supply calculated, gives no answer for
   that test, never a fit.
========================================================== */

export interface HeadroomParameters {
  /** Growth of the DT's own load a year, 0 to 1. Assumption. */
  loadGrowthPerYear: number;
  /** The hub's power factor. Assumption. */
  hubPowerFactor: number;
}

export const EMOBILITY_HEADROOM_REFERENCE: Methodology<HeadroomParameters> = {
  id: "gridintel.planning.emobility-headroom",
  version: "0.1.0",
  name: "GridIntel reference hub fit on a distribution transformer and feeder",
  description:
    "The DT's observed peak grown a year, against its rating at the loading methodology's threshold, plus the hub's charging draw; and whether the hub's chargers can take its day's energy in the feeder's hours of supply.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { loadGrowthPerYear: 0.05, hubPowerFactor: 0.95 },
};

export type HeadroomLimit = "DT rating" | "supply hours";

export interface HubSiteFacts {
  ratingKva: number;
  /** The highest loading observed on the DT, kVA; null without telemetry. */
  observedPeakKva: number | null;
  /** Loading above this fraction of rating is an overload (the loading methodology's own). */
  overloadThreshold: number;
  /** The feeder's average hours of supply a day; null when not calculated. */
  hoursOfSupply: number | null;
  chargerKw: number;
}

export interface HeadroomAt {
  months: number;
  hubKwhPerDay: number;
  /** The DT's own load at the horizon, kVA; null without an observed peak. */
  dtLoadKva: number | null;
  /** Room left on the DT before the hub, kVA; negative when already over; null without an observed peak. */
  headroomKva: number | null;
  /** What the hub draws while charging, kW; null without hours of supply. */
  hubDrawKw: number | null;
  hubDrawKva: number | null;
  /** null when it cannot be told. */
  fitsRating: boolean | null;
  fitsHours: boolean | null;
  /** True only when both are known and pass; null when either is unknown and neither fails. */
  fits: boolean | null;
  limits: HeadroomLimit[];
  /** Why a test could not be made. */
  unknown: string[];
}

export function headroomAt(site: HubSiteFacts, months: number, hubKwhPerDay: number, parameters = EMOBILITY_HEADROOM_REFERENCE.parameters): HeadroomAt {
  const unknown: string[] = [];
  const dtLoadKva = site.observedPeakKva === null ? null : site.observedPeakKva * (1 + parameters.loadGrowthPerYear) ** (months / 12);
  if (dtLoadKva === null) unknown.push("no observed peak on the DT");
  const headroomKva = dtLoadKva === null ? null : site.ratingKva * site.overloadThreshold - dtLoadKva;
  const hours = site.hoursOfSupply;
  if (hours === null || hours <= 0) unknown.push("no hours of supply calculated for the feeder");
  const hubDrawKw = hours === null || hours <= 0 ? null : Math.min(hubKwhPerDay / hours, site.chargerKw);
  const hubDrawKva = hubDrawKw === null ? null : hubDrawKw / parameters.hubPowerFactor;
  const fitsRating = headroomKva === null || hubDrawKva === null ? null : hubDrawKva <= headroomKva;
  const fitsHours = hours === null || hours <= 0 ? null : site.chargerKw * hours >= hubKwhPerDay;
  const limits: HeadroomLimit[] = [];
  if (fitsRating === false) limits.push("DT rating");
  if (fitsHours === false) limits.push("supply hours");
  const fits = limits.length > 0 ? false : fitsRating === null || fitsHours === null ? null : true;
  return { months, hubKwhPerDay, dtLoadKva, headroomKva, hubDrawKw, hubDrawKva, fitsRating, fitsHours, fits, limits, unknown };
}

/** The test at each horizon, each with the hub's energy at that horizon. */
export function headroomOverTime(site: HubSiteFacts, kwhByHorizon: readonly { months: number; kwhPerDay: number }[], parameters = EMOBILITY_HEADROOM_REFERENCE.parameters): HeadroomAt[] {
  return kwhByHorizon.map((one) => headroomAt(site, one.months, one.kwhPerDay, parameters));
}
