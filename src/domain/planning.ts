import type { ServiceBand } from "./network";
import type { IsoDate } from "./primitives";

/* ==========================================================
   GRIDINTEL DOMAIN — PLANNING: PUBLISHED METERING FIGURES

   Figures published by a regulator or reported in the press, held
   exactly as stated, each with the document, page and table it was
   taken from. They are reported figures: never observations, never
   calculated. A figure a document does not give is null, never 0.
========================================================== */

/** Where a published figure was taken from. */
export interface Citation {
  id: string;
  /** The publisher and the document, e.g. "NERC, Second Quarter 2026 Report". */
  title: string;
  /** Null when the source is not published online (e.g. the hackathon brief). */
  url: string | null;
  /** The date the document was published. */
  published: IsoDate | null;
  /** Primary: the publisher's own document. Secondary: a report of it by someone else. */
  standing: "primary" | "secondary";
  /** The page and table, or the section, the figures come from. */
  locator?: string;
}

/** The Nigerian distribution companies, as NERC names them. */
export type DiscoId = "abuja" | "benin" | "eko" | "enugu" | "ibadan" | "ikeja" | "jos" | "kaduna" | "kano" | "port_harcourt" | "yola";

/** One DisCo's metering at a date, as the regulator published it. */
export interface PublishedMetering {
  disco: DiscoId;
  /** The date the counts stand at. */
  asOf: IsoDate;
  /** Active registered customers: vended or billed at least once in 12 months (NERC's definition). */
  activeCustomers: number;
  meteredCustomers: number;
  /** The metering rate as published, in percent. Shown beside the rate calculated from the counts. */
  meteringRatePercent: number;
  citationId: string;
}

/** Meters one DisCo installed in a quarter, all schemes together, as published. */
export interface PublishedInstallations {
  disco: DiscoId;
  /** The quarter, e.g. "2026-Q2". */
  quarter: string;
  meters: number;
  citationId: string;
}

/** A national figure reported without a DisCo breakdown, e.g. in the press. */
export interface ReportedNationalMetering {
  asOf: IsoDate;
  /** The month the figures describe, when it differs from the publication. */
  period: string;
  meteringRatePercent: number | null;
  activeCustomers: number | null;
  meteredCustomers: number | null;
  unmeteredCustomers: number | null;
  citationId: string;
}

/** The allowed residential (non-maximum-demand) tariff of one band of one DisCo, as ordered. */
export interface BandTariff {
  disco: DiscoId;
  band: ServiceBand;
  /** Naira per kWh, as the order states it; null when the order lists no tariff for the band. */
  nairaPerKwh: number | null;
  /** The date the tariff applies from. */
  effective: IsoDate;
  citationId: string;
}
