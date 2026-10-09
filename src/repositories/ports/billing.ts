import type { BillingRecord, Payment, Period } from "@/domain";
import type { RepositoryResult } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — BILLING AND PAYMENTS

   Raw records only. Nothing is summed, and no record is attributed
   to a network scope here; that is done by analytics through the
   topology index.
========================================================== */

export interface BillingQuery {
  /** Charges with start ≤ billedAt < end, or payments with start ≤ receivedAt < end. */
  period: Period;
  /**
   * Only the records of these accounts, when given. Selecting by identity, as a meter query
   * does; the records returned are the ones the unrestricted query would return for them.
   */
  customerIds?: readonly string[];
}

export interface BillingRepository {
  listBillingRecords(query: BillingQuery): Promise<RepositoryResult<BillingRecord>>;
  listPayments(query: BillingQuery): Promise<RepositoryResult<Payment>>;
}
