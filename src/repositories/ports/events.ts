import type { Alarm, Outage, Period } from "@/domain";
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

export interface AlarmQuery {
  /**
   * Alarms raised before `end` and not cleared at or before `start` are
   * returned: those raised in the period, and those still standing when it
   * began. An alarm whose raise time the source did not record is always
   * returned, so that it is reported as undated instead of disappearing.
   *
   * These are alarms as a source system recorded them. Conditions that
   * GridIntel derives from telemetry are calculated, not stored, and are
   * never returned here.
   */
  period: Period;
}

export interface EventRepository {
  listOutages(query: OutageQuery): Promise<RepositoryResult<Outage>>;
  listAlarms(query: AlarmQuery): Promise<RepositoryResult<Alarm>>;
}
