import type { DiscoId } from "./planning";
import type { IsoDate } from "./primitives";

/* ==========================================================
   GRIDINTEL DOMAIN — PLANNING: THE METERING MARKETPLACE

   Funders pledge money (or meters) for metering; DisCos approve
   customers' meter applications. The marketplace matches the two.
   A pledge and an application are records as their sources hold
   them: never totalled or matched here.
========================================================== */

/** Who the money comes from: private capital, a development finance institution, or a public programme. */
export type FunderKind = "private" | "dfi" | "public";

/** The band of an application. Band A is split by the meter it needs; Lifeline (R1) customers are exempt from the meter charge. */
export type MarketplaceBand = "A1" | "A3" | "B" | "C" | "D" | "E" | "lifeline";

/** A funder's pledge to the metering marketplace. */
export interface MeterPledge {
  id: string;
  /** The funder's name as shown, e.g. "Mission 300-style programme". */
  funder: string;
  kind: FunderKind;
  /** Pledged in naira; null when the pledge is a number of meters. */
  amountNaira: number | null;
  /** Pledged as a number of meters; null when the pledge is in naira. */
  meters: number | null;
  bands: readonly MarketplaceBand[];
  discos: readonly DiscoId[];
  /** The return the funder asks, in percent a year; 0 for a grant. */
  returnPercent: number;
  /** The currency the return is set in. */
  returnCurrency: "naira" | "usd";
  /** How long the funder will wait to be repaid, in months; null for a grant, which is not repaid. */
  tenorMonths: number | null;
  sourceId: string;
}

/** One household's meter, from application to installation, as the marketplace records it. Holds no name or address: a reference only. */
export interface MeterJourneyRecord {
  reference: string;
  disco: DiscoId;
  band: MarketplaceBand;
  /** The feeder the DisCo confirmed. */
  feeder: string;
  appliedOn: IsoDate;
  approvedOn: IsoDate;
  fundedOn: IsoDate;
  installedOn: IsoDate;
  /** The DisCo confirms the meter commissioned and vending: the verified install. */
  confirmedOn: IsoDate;
  /** The household's usual recharge, in naira, and how many days apart. */
  rechargeNaira: number;
  rechargeEveryDays: number;
  sourceId: string;
}

/** The steps a meter application waits at before it is approved (the front door's status flow, ADR 0021). */
export type PendingApplicationStep = "submitted" | "under_review" | "verified" | "assigned";

/** Meter applications waiting at one DisCo, at one step, as the source holds them: a count, with no customer's details. */
export interface PendingMeterApplications {
  /** The DisCo whose queue it is: one of NERC's eleven, or the organization id of a DisCo on GridIntel (the synthetic demonstration DisCo). */
  disco: string;
  step: PendingApplicationStep;
  count: number;
  sourceId: string;
}

/** Meter applications a DisCo has approved for one band. */
export interface MeterApplication {
  disco: DiscoId;
  band: MarketplaceBand;
  approved: number;
  sourceId: string;
}
