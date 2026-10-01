import type { Outage, Period } from "@/domain";
import type { RepositoryResult } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — EVENTS
========================================================== */

export interface OutageQuery {
  /**
   * Outages with any exposure overlapping [start, end) are returned.
   * An outage with an exposure whose times are unknown is always
   * returned, so analytics can report it as excluded for missing data
   * instead of it disappearing.
   */
  period: Period;
}

export interface EventRepository {
  listOutages(query: OutageQuery): Promise<RepositoryResult<Outage>>;
}
