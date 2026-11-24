import type { IsoDate } from "./primitives";
import type { ReferenceCustomerClass } from "./reference";

/* ==========================================================
   DOMAIN — MINI-GRID PLANNING (Phase MG-PLAN-A)

   A planned community and the reference figures a plan for it is
   built on (docs/design/MG-PLAN.md, section 3). Reference sites are
   a list: every benchmark is taken from `ReferenceBasis[]`, one entry
   per reference site, and says how many sites it rests on. With one
   site the benchmark is that site's figure, never a typical value.

   Years are years of operation, 1 to 5. A figure the data cannot
   give is null, never 0.
========================================================== */

/** The customer classes a plan counts, as the reference data splits them. */
export type PlanningClass = ReferenceCustomerClass;

/** Per year of operation, years 1 to 5 (index 0 is year 1); null where the reference has no figure. */
export type ByYear = readonly (number | null)[];

/** One tariff change at a reference site, with the use per reporting meter-day either side of it. */
export interface ReferenceTariffChange {
  id: string;
  fromTariff: number;
  toTariff: number;
  /** The calendar month the change is reported in; left out of both windows, since its day is not recorded. */
  changeMonth: string;
  before: ReferenceUseWindow;
  after: ReferenceUseWindow;
  /** What else changed across the windows, from the data, in words. */
  confounders: string[];
}

export interface ReferenceUseWindow {
  start: IsoDate;
  end: IsoDate;
  days: number;
  /** Σ sum of meters ÷ Σ meters reporting over the window's days. */
  kwhPerMeterDay: number;
  metersReporting: number;
  /** Share of the window's meter-days at 0 kWh. */
  zeroShare: number;
}

/** The 2019 build cost of a reference site, by the publisher's categories, with what it bought. */
export interface ReferenceCapex {
  priceYear: number;
  storageNgn: number;
  generationNgn: number;
  distributionAndMeteringNgn: number;
  /** Shared balance of system and soft costs: scaled with the rest, in proportion. */
  otherNgn: number;
  totalNgn: number;
  pvKwp: number;
  storageKwh: number;
  /** The connections distribution and metering paid for: the meters bought. */
  connections: number;
}

/** What one reference site gives a plan, derived from its published records. */
export interface ReferenceBasis {
  siteId: string;
  siteCode: string;
  sourceId: string;
  /** The first day of year 1 of operation (the first day with meter data). */
  operationStart: IsoDate;
  /** Site kWh per reporting meter-day (sum of meters ÷ meters reporting), across the days of each year of operation. */
  siteKwhPerMeterDay: { p50: ByYear; p90: ByYear };
  /** The class's share of the year's metered energy ÷ its share of the year's meter-days. */
  classFactor: Record<PlanningClass, ByYear>;
  /** The class's own P90 meter-day over the whole record: for the no-diversity upper bound only. */
  classP90MeterDay: Record<PlanningClass, number | null>;
  /** Accounts created to the end of year n ÷ accounts in the file. */
  ramp: ByYear;
  /** Customers who bought credit in year n ÷ accounts created to date. */
  buyingShare: ByYear;
  /** The days left out, and why. */
  exclusions: string[];
  /** The site total against the sum of the meters: reference only, never a loss figure. */
  meterGap: { low: number; high: number } | null;
  tariffChanges: ReferenceTariffChange[];
  capex: ReferenceCapex | null;
  /** The tariffs the site charged, ₦/kWh, in order. */
  tariffs: number[];
}

/** A community a mini-grid is planned for. */
export interface PlannedCommunity {
  id: string;
  name: string;
  /** The planned site's point; sun hours are retrieved for it. */
  latitude: number;
  longitude: number;
  customers: Record<PlanningClass, number>;
  /** NASA POWER climatology at the planned site: the annual mean and the lowest month, with the citation's id. */
  solar: { averagePeakSunHours: number; rainySeasonPeakSunHours: number; rainySeasonMonth: string; citationId: string };
  /** `DataSource.id` of the record. */
  sourceId: string;
}
