import type { DiscoId } from "./planning";

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

/** Meter applications a DisCo has approved for one band. */
export interface MeterApplication {
  disco: DiscoId;
  band: MarketplaceBand;
  approved: number;
  sourceId: string;
}
