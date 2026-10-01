import type { IsoTimestamp, Period } from "@/domain";

/* ==========================================================
   DEMO ADAPTER — CLOCK

   The synthetic dataset covers one fixed calendar month in West
   Africa Time (UTC+1, no daylight saving). The demo clock is the
   end of that month: nothing in the dataset is later than it.
========================================================== */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
const WAT_OFFSET_MS = HOUR_MS;

export const DEMO_DAYS = 30;
export const DEMO_HOURS = DEMO_DAYS * 24;

/** September 2026, [start, end). */
export const DEMO_PERIOD: Period = {
  start: "2026-09-01T00:00:00+01:00",
  end: "2026-10-01T00:00:00+01:00",
};

/** The "now" of the demo: every as-of query should use this instant. */
export const DEMO_CLOCK: IsoTimestamp = DEMO_PERIOD.end;

export const PERIOD_START_MS = Date.parse(DEMO_PERIOD.start);
export const PERIOD_END_MS = Date.parse(DEMO_PERIOD.end);

/** An epoch time written as a WAT timestamp, e.g. "2026-09-01T00:00:00+01:00". */
export function wat(ms: number): IsoTimestamp {
  return new Date(ms + WAT_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, "+01:00");
}

/** Epoch ms of a WAT wall-clock time on day `day` (0 = 1 September). */
export function at(day: number, hour: number, minute = 0): number {
  return PERIOD_START_MS + ((day * 24 + hour) * 60 + minute) * MINUTE_MS;
}

/** Epoch ms at which hourly interval `h` starts (0 = first hour of the period). */
export function hourStart(h: number): number {
  return PERIOD_START_MS + h * HOUR_MS;
}

/** Day of the week in WAT for day `day`: 0 = Sunday … 6 = Saturday. */
export function weekday(day: number): number {
  return new Date(at(day, 12) + WAT_OFFSET_MS).getUTCDay();
}
