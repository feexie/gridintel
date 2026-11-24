import type { Coordinates } from "./geo";
import type { FunderKind } from "./marketplace";
import type { IsoDate } from "./primitives";

/* ==========================================================
   GRIDINTEL DOMAIN — PLANNING: E-MOBILITY HUBS

   Battery-swap and charging hubs for electric two- and three-
   wheelers, the operators that run them, funders' pledges to them,
   and the swaps they record. Records as their sources hold them:
   never totalled, matched or scored here.
========================================================== */

/** Buses and cars are named so the model can hold them; no input gives them a battery or a use yet, so they carry no figure. */
export type VehicleSegment = "motorcycle" | "tricycle" | "bus" | "car";

export type HubKind = "swap" | "charging";

/** A candidate is a site under study; planned is approved; installed is built and recording swaps. */
export type HubStatus = "candidate" | "planned" | "installed";

export interface HubOperator {
  id: string;
  name: string;
  sourceId: string;
}

/** The solar resource at a hub, as a cited source gives it. */
export interface HubSolarResource {
  /** Peak sun hours a day, the year's average (kWh per m² per day). */
  annualPeakSunHours: number;
  /** The lowest month's figure, for the rainy-season case. */
  rainySeasonPeakSunHours: number;
  /** The month the rainy-season figure is for, e.g. "August". */
  rainySeasonMonth: string;
  citationId: string;
}

export interface Hub {
  id: string;
  name: string;
  kind: HubKind;
  operatorId: string;
  /** The distribution transformer that would supply the hub. */
  transformerId: string;
  location: Coordinates;
  status: HubStatus;
  /** Swaps a day the hub is planned for, by vehicle segment. */
  plannedSwapsPerDay: Partial<Record<VehicleSegment, number>>;
  /** Installed charger capacity, kW. */
  chargerKw: number;
  solar: HubSolarResource;
  /**
   * The hub's cost (swap cabinets and battery stock), naira. Synthetic in the demonstration
   * dataset: used only to exercise pledge matching, never an investment figure. Null when unknown.
   */
  costNaira: number | null;
  installedOn: IsoDate | null;
  sourceId: string;
}

/** A funder's pledge to hubs and their batteries (rider and vehicle finance are out of scope). */
export interface HubPledge {
  id: string;
  funder: string;
  kind: FunderKind;
  amountNaira: number;
  /** The return the funder asks, percent a year; 0 for a grant. */
  returnPercent: number;
  /** How long the funder will wait to be repaid, months; null for a grant. */
  tenorMonths: number | null;
  /** The feeders whose hubs the pledge may fund. */
  feeders: readonly string[];
  sourceId: string;
}

/** One hub's swaps on one day. */
export interface HubSwapDay {
  hubId: string;
  day: IsoDate;
  swaps: number;
  /** Energy drawn to charge the batteries swapped, kWh. */
  kwhCharged: number;
  /** Minutes in the day the hub could swap. */
  minutesAvailable: number;
  sourceId: string;
}
