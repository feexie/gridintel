import type { IsoTimestamp, Money, Period } from "./primitives";
import type { Provenance } from "./provenance";

/* ==========================================================
   GRIDINTEL DOMAIN — BILLING AND PAYMENTS

   Commercial records as the billing or vending system holds them.
   They are append-only: a correction is a new record.

   Energy billed is what the utility charged for, which is not the
   energy delivered. How the billed energy was arrived at is stated
   on every record (`basis`), because an estimated bill is not a
   measurement and must never be read as one.
========================================================== */

/**
 * How the billed energy was determined.
 * - meter_reading: read from the customer's meter (postpaid).
 * - prepaid_vend: energy credit sold to a prepaid meter. The charge is
 *   raised and paid in the same transaction.
 * - estimated: no meter reading; the energy is an estimate under the
 *   utility's estimation method (`Provenance.method` names it).
 */
export type BillingBasis = "meter_reading" | "prepaid_vend" | "estimated";

/** One charge raised against a customer account: a bill or a prepaid vend. */
export interface BillingRecord {
  id: string;
  customerId: string;
  basis: BillingBasis;
  /** When the charge was raised: the bill's issue time or the vend time. */
  billedAt: IsoTimestamp;
  /** The consumption the charge covers. Absent for a prepaid vend. */
  consumptionPeriod?: Period;
  /** null when the record states an amount but no energy. Never 0 as a placeholder. */
  energyKwh: number | null;
  amount: Money;
  /** The tariff applied, as the source names it, e.g. "Band A non-MD". */
  tariffCode?: string;
  provenance: Provenance;
}

/** Money received from a customer. */
export interface Payment {
  id: string;
  customerId: string;
  receivedAt: IsoTimestamp;
  amount: Money;
  /** The charge this payment settles, when the source links them. */
  billingRecordId?: string;
  channel?: "vending" | "bank" | "agent" | "cash_office" | "other";
  provenance: Provenance;
}
