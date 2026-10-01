import type { IsoTimestamp } from "@/domain";

/* ==========================================================
   REPOSITORY PORTS — COMMON

   Repositories retrieve records by identity, scope and time. They
   never traverse topology, aggregate, calculate, pick a "latest"
   value or derive state; that belongs to src/analytics.

   Repositories never read the clock: every time a query depends on
   is supplied by the caller.
========================================================== */

/**
 * How completely the source holds a kind of record.
 * - complete: every record of this kind in the source's world is held.
 * - partial: some records are held; an absent record may still exist.
 * - not_available: the source does not hold this kind of record at all.
 *
 * An empty result is only "there are none" when completeness is
 * "complete". Otherwise it means nothing is known, never zero.
 */
export type Completeness = "complete" | "partial" | "not_available";

export interface AsOfQuery {
  asOf: IsoTimestamp;
}

export interface RepositoryResult<T> {
  records: T[];
  completeness: Completeness;
}
