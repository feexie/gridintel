import type { IsoTimestamp, Period } from "@/domain";

/* ==========================================================
   ANALYTICS — TIME

   Timestamps must carry an explicit zone ("Z" or "+hh:mm"). A
   timestamp without one would be read in the machine's local zone,
   which would make results depend on where the code runs, so it is
   rejected instead.
========================================================== */

export const MS_PER_MINUTE = 60_000;

const EXPLICIT_ZONE = /(Z|[+-]\d{2}:\d{2})$/;

// Interval data repeats the same few timestamps across thousands of records, and parsing is
// the cost that dominates summing them. The parse is a pure function of the string, so its
// results are remembered; the memo is emptied when it grows large.
const PARSED = new Map<string, number | null>();
const PARSED_LIMIT = 100_000;

/** Milliseconds since the epoch, or null if the timestamp is invalid or has no zone. */
export function toEpochMs(timestamp: IsoTimestamp): number | null {
  const known = PARSED.get(timestamp);
  if (known !== undefined) return known;
  let ms: number | null = null;
  if (EXPLICIT_ZONE.test(timestamp)) {
    const parsed = Date.parse(timestamp);
    ms = Number.isNaN(parsed) ? null : parsed;
  }
  if (PARSED.size >= PARSED_LIMIT) PARSED.clear();
  PARSED.set(timestamp, ms);
  return ms;
}

/** Start and end in epoch ms, or null if the period is invalid or empty. */
export function periodBounds(period: Period): { startMs: number; endMs: number } | null {
  const startMs = toEpochMs(period.start);
  const endMs = toEpochMs(period.end);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  return { startMs, endMs };
}

/** Minutes of [startMs, endMs) that fall inside [periodStartMs, periodEndMs). */
export function overlapMinutes(
  startMs: number,
  endMs: number,
  periodStartMs: number,
  periodEndMs: number,
): number {
  const overlap = Math.min(endMs, periodEndMs) - Math.max(startMs, periodStartMs);
  return overlap > 0 ? overlap / MS_PER_MINUTE : 0;
}
