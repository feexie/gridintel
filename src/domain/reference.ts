import type { IsoDate } from "./primitives";

/* ==========================================================
   GRIDINTEL DOMAIN — REFERENCE SITES

   A reference site is a real mini-grid whose records someone else
   has published under a licence, held so that GridIntel can show
   what a real site looked like and, later, plan new ones from it
   (docs/design/MG-PLAN.md). It is NOT one of an organization's own
   sites: it is never added to a portfolio's counts or totals, and
   it is shown with its citation and licence wherever it appears.

   Everything held here is REPORTED: as the publisher states it, with
   the publisher's own status words kept. What GridIntel works out
   from it is calculated in src/analytics under a named method.

   Customer and meter codes are the publisher's pseudonymous codes.
   They are used to count and to group, and never shown.

   Missing values stay null, never 0 (a gap day is not a day of no
   use).
========================================================== */

export type ReferenceCustomerClass = "residential" | "non_residential";

/** One item of the publisher's description of the site, with the publisher's own status word ("Reported", "Conflicting values", ...). */
export interface ReferenceFact {
  item: string;
  value: string;
  unit: string | null;
  status: string | null;
  notes: string | null;
  source: string | null;
}

export interface ReferenceSite {
  id: string;
  /** The publisher's site code, e.g. "RMG01". */
  code: string;
  name: string;
  country: string;
  /** The region as the publisher words it. */
  region: string;
  /** True when the publisher withheld the location: the site has no point on a map. */
  locationWithheld: boolean;
  /** `DataSource.id` of the published dataset. */
  sourceId: string;
  facts: ReferenceFact[];
}

/** One day at the site, as published. */
export interface ReferenceSiteDay {
  siteId: string;
  date: IsoDate;
  /** The site total at the site's data concentrator; null where the series has no value. */
  communityKwh: number | null;
  /** The sum of the meters with a reading that day; null on a day with no meter data. */
  sumOfMetersKwh: number | null;
  metersReporting: number | null;
  /** Credit bought through agents that day (payments of type PAY). Not the value of energy used. */
  creditBoughtNgn: number | null;
  /** The publisher's data flags for the day, e.g. "gap_no_meter_data". */
  flags: string[];
  /** 1 when an event of the operator's fault log falls on the day; 0 when none is logged; null outside the log's period. */
  loggedOutage: 0 | 1 | null;
}

/** One meter's use on one day, as published. */
export interface ReferenceMeterDay {
  siteId: string;
  date: IsoDate;
  /** The publisher's pseudonymous code: for counting only, never shown. */
  meterCode: string;
  kwh: number;
  customerClass: ReferenceCustomerClass | null;
}

export interface ReferenceCustomer {
  siteId: string;
  /** The publisher's pseudonymous code: for counting only, never shown. */
  customerCode: string;
  customerClass: ReferenceCustomerClass | null;
  yearCreated: number | null;
  metersLinked: number | null;
}

/** A payment record. PAY is credit bought through an agent; UCU and REV are adjustments. */
export interface ReferencePayment {
  siteId: string;
  date: IsoDate;
  amountNgn: number;
  type: string;
  /** The publisher's pseudonymous code: for counting only, never shown. */
  customerCode: string | null;
}

/** An event of the operator's fault log. */
export interface ReferenceOutage {
  siteId: string;
  eventId: string;
  date: IsoDate;
  startTime: string | null;
  endTime: string | null;
  crossesMidnight: boolean;
  durationHoursRecorded: number | null;
  durationHoursFromTimes: number | null;
  cause: string;
  causeCategory: string | null;
  customersInterrupted: number | null;
  customersServed: number | null;
  customerHours: number | null;
  notes: string | null;
}

/** Reliability indices for a month, as the operator's report gives them. Null where the source gives none. */
export interface ReferenceReportedIndices {
  siteId: string;
  /** "YYYY-MM". */
  month: string;
  eventsLogged: number;
  saidiHours: number | null;
  caidiHours: number | null;
  saifi: number | null;
  /** ASAI as the report computes it (monthly SAIDI over 8,760 hours). */
  asaiPercentAsReported: number | null;
  /** ASAI recalculated by the publisher on the hours in the month. */
  asaiPercentHoursInMonth: number | null;
  notes: string | null;
}

/** A tariff, a dated event or a data note, as published. Dates are as precise as the publisher gives them ("2023-07", "2023-04-26"). */
export interface ReferenceTariffEvent {
  siteId: string;
  recordType: "tariff" | "event" | "data_note";
  periodStart: string | null;
  periodEnd: string | null;
  description: string;
  value: number | null;
  unit: string | null;
  source: string | null;
  notes: string | null;
}

/** One line of the site's build cost, as published: the actual cost by category, or the design-only estimate. */
export interface ReferenceCapexLine {
  siteId: string;
  /** The publisher's record kind, e.g. "actual_cost", "actual_cost_derived", "pre_construction_estimate". */
  record: string;
  category: string;
  itemsIncluded: string | null;
  costNgn: number | null;
  /** The rate the source converts at, ₦ a US dollar. */
  ngnPerUsd: number | null;
  priceYear: number | null;
  notes: string | null;
}

/** One operating-cost line, as published (OPEX); blanks stay null. */
export interface ReferenceOpexLine {
  siteId: string;
  period: string | null;
  item: string;
  category: string;
  amount: number | null;
  unit: string | null;
  /** "Site", "Company accounts line", … as the publisher words it. */
  scope: string | null;
  notes: string | null;
}

/** A known gap or limitation, in the publisher's words. */
export interface ReferenceCaveat {
  siteId: string;
  id: string;
  topic: string;
  description: string;
}

/**
 * A figure the publisher states about its own data, held so that GridIntel can set its own
 * calculation beside it. Transcribed, never calculated by the adapter.
 */
export interface ReferenceClaim {
  siteId: string;
  key: "meter_gap_share" | "meters_reached_share" | "customers_buying_credit";
  /** What the figure counts, in the publisher's terms. */
  label: string;
  value: number;
  unit: "fraction" | "customers";
  /** The decimals the publisher gives: a calculation agrees when it rounds to the same figure. */
  decimals: number;
  /** The days or the year the figure covers, inclusive. */
  from: IsoDate;
  to: IsoDate;
  /** Where in the dataset it is stated, e.g. "Caveats C05". */
  locator: string;
}
