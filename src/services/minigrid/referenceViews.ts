import type { SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — REFERENCE SITE VIEW MODELS

   What the screens receive for a reference site: a real mini-grid
   whose records someone else published (docs/design/MG-PLAN.md).
   Plain, serialisable data; every figure arrives formatted, with
   its origin and one line on where it came from. Every view carries
   the dataset's attribution, which the licence requires wherever
   the data is shown. Nothing here is synthetic, and nothing here is
   part of an organization's portfolio.
========================================================== */

/** The credit the dataset's licence requires, shown wherever its data is. */
export interface ReferenceAttributionView {
  /** The citation in full: authors, year, title, version and DOI. */
  citation: string;
  url: string;
  licence: string;
  licenceUrl: string;
  /** "GridIntel's calculations on the published data; the data are unchanged." */
  changes: string;
}

export type ReferenceOrigin = "reported" | "calculated";

/** How GridIntel's calculation stands against the figure the publisher states. */
export type ReferenceStanding = "agrees" | "differs" | "not_calculable";

/** A figure the publisher states, beside GridIntel's calculation from the published records. */
export interface ReferenceClaimView {
  label: string;
  /** As the publisher states it, formatted. */
  stated: string;
  /** GridIntel's calculation, formatted; null when it cannot be calculated. */
  calculated: string | null;
  standing: ReferenceStanding;
  /** Where the publisher states it, and how the calculation is made. */
  basis: string;
}

/** One item of the publisher's description of the site. */
export interface ReferenceFactView {
  label: string;
  value: string;
  /** The publisher's own status word: "Reported", "Conflicting values", ... */
  status: string | null;
  note: string | null;
}

export interface ReferenceYearView {
  year: string;
  /** "365 of 365"; the gap days are not counted as days of no use. */
  daysWithMeterData: string;
  kwhPerDay: string | null;
  meanMetersReporting: string | null;
  kwhPerReportingMeterDay: string | null;
  zeroMeterDays: string | null;
  creditBuyers: string;
  accountsToDate: string;
  /** Buyers ÷ accounts created to date. */
  buyersShare: string | null;
  /** "A part year" note for the first and last years. */
  note: string | null;
}

export interface ReferenceReliabilityMonthView {
  month: string;
  events: number;
  reported: { saidi: string | null; saifi: string | null; caidi: string | null; asaiAsReported: string | null; asaiHoursInMonth: string | null };
  calculated: { saidi: string | null; saifi: string | null; caidi: string | null; asai: string | null };
  /** The reported SAIDI against the calculation, at two decimals; null for a month with no logged outage. */
  standing: ReferenceStanding | null;
  /** "No outage logged", or events whose recorded duration and times disagree. */
  note: string | null;
}

export interface ReferenceTariffView {
  period: string;
  value: string;
  note: string | null;
}

export interface ReferenceCaveatView {
  id: string;
  topic: string;
  description: string;
}

export interface ReferenceSiteView {
  id: string;
  code: string;
  name: string;
  region: string;
  /** Why there is no point on a map. */
  locationNote: string;
  /** "Reference site, published data: not part of any organization's portfolio." */
  standingNote: string;
  facts: ReferenceFactView[];
  meterGap: ReferenceClaimView[];
  /** The causes, in the publisher's words; GridIntel does not apportion the gap. */
  meterGapCauses: string;
  years: ReferenceYearView[];
  repeatBuyers: { label: string; value: string; basis: string };
  creditBuyers: ReferenceClaimView[];
  reliability: ReferenceReliabilityMonthView[];
  reliabilityNote: string;
  tariffs: ReferenceTariffView[];
  tariffNote: string;
  events: ReferenceTariffView[];
  supply: string;
  /** What these figures may not be read as. */
  notClaimed: string[];
  caveats: ReferenceCaveatView[];
  /** How the caveats are quoted. */
  caveatNote: string;
  attribution: ReferenceAttributionView;
  /** The published dataset: never synthetic. */
  sourcing: SourcingView;
}

/** A reference site as a card on the Sites screen. */
export interface ReferenceSiteCardView {
  id: string;
  code: string;
  name: string;
  region: string;
  plant: string;
  href: string;
  meterGap: ReferenceClaimView;
  creditBuyers: { label: string; value: string };
  tariff: { label: string; value: string };
  attribution: ReferenceAttributionView;
}

export interface ReferenceSitesView {
  heading: string;
  note: string;
  sites: ReferenceSiteCardView[];
  sourcing: SourcingView;
}
