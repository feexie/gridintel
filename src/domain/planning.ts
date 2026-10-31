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
/** One DisCo's commercial performance in a quarter, as the regulator published it. */
export interface PublishedDiscoPerformance {
  disco: DiscoId;
  /** e.g. "2026-Q2". */
  quarter: string;
  /** Revenue collected as a share of billing, in percent; null when not published. */
  collectionEfficiencyPercent: number | null;
  /** Aggregate technical, commercial and collection loss, in percent; null when not published. */
  atccLossPercent: number | null;
  /** The ATC&C loss the tariff order allows, in percent; null when not published. */
  atccTargetPercent: number | null;
  citationId: string;
}

/** A public metering programme as reported: its size, funding and first year. */
export interface PublicMeteringProgramme {
  id: string;
  name: string;
  /** Meters in the whole programme, as reported; null when not stated. */
  totalMeters: number | null;
  /** Every count of the programme's meters that a source reports, each with its source: sources differ, so all are kept. */
  reportedMeterCounts: { meters: number; citationId: string }[];
  /** Money raised for it, in naira, as reported; null when not stated. */
  fundingNaira: number | null;
  /** How the money was raised, as reported. */
  fundedBy: string | null;
  firstYear: number | null;
  firstYearMeters: number | null;
  implementer: string | null;
  citationIds: string[];
}

export interface BandTariff {
  disco: DiscoId;
  band: ServiceBand;
  /** Naira per kWh, as the order states it; null when the order lists no tariff for the band. */
  nairaPerKwh: number | null;
  /** The date the tariff applies from. */
  effective: IsoDate;
  citationId: string;
}

/** The meters a DisCo is planned to install in a quarter of the metering programme. */
export interface MeteringPlanQuarter {
  disco: DiscoId;
  /** "2026-Q3". */
  quarter: string;
  plannedMeters: number;
}

/** One DisCo's quarter in the metering programme, as monitoring records it. */
export interface MeteringMonitoringRecord {
  disco: DiscoId;
  quarter: string;
  metersInstalled: number;
  /** Installs verified: a certified installer, the meter commissioned and vending. Tranches are released against these. */
  metersVerified: number;
  /** Average hours of supply a day to the customers metered under the programme. */
  supplyHoursPerDay: number;
  /** Average consumption a month of a customer metered under the programme, in kWh. */
  consumptionKwhPerMonth: number;
  /** Meter charges collected into escrow in the quarter, in naira. */
  escrowCollected: number;
  /** Paid to investors from escrow in the quarter, in naira. */
  investorRepaid: number;
  sourceId: string;
}
