import type { DataQuality, IsoTimestamp, Meter, Period, TelemetryPoint } from "@/domain";
import type { CalcStatus, Warning } from "../core/result.ts";
import { worstQuality } from "../core/quality.ts";
import { MS_PER_MINUTE, periodBounds, toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — REGISTER ADVANCE

   A meter that is read by hand leaves readings of its cumulative
   register, not energy per interval. What it shows for a period is
   the ADVANCE of the register between the first and the last
   reading taken within the period:

     advance = last reading − first reading

   The advance covers the time between those two readings, which is
   rarely the whole period. That span is returned with the value and
   must be shown with it; the advance is never stretched to the
   period, never summed with interval energy and never used in an
   energy account.

   Nothing is invented. With fewer than two usable readings there is
   no advance. A register that goes backwards (a meter change, a
   rollover) gives no advance either: the reason is not known here.
   An estimated reading makes the advance an estimate.

   AS CONSUMPTION RECORDED IN A PERIOD (ADR 0010). A register advance
   is measured consumption, but for the time between its two
   readings, not for the period. It counts toward a period's recorded
   consumption only when that time is close enough to the period:

     the opening reading lies within the reading window of the
     period's start, and the closing reading within the window of its
     end, on either side.

   The window is a parameter of the energy methodology (3 days in the
   reference methodology). The advance is then used AS IT IS. It is
   never pro-rated or stretched to the period: a reading taken two
   days early stays two days short. An advance that does not qualify
   is excluded, with the reason, and is never replaced by anything.
   An advance resting on an estimated reading is excluded too: it is
   an estimate, and this is a measured source.
========================================================== */

export interface RegisterAdvance {
  meterId: string;
  status: CalcStatus;
  /** kWh between the two readings; null when it cannot be given. */
  advanceKwh: number | null;
  opening: { at: IsoTimestamp; kwh: number } | null;
  closing: { at: IsoTimestamp; kwh: number } | null;
  /** Usable import-register readings of this meter within the period. */
  readings: number;
  quality: DataQuality | null;
  missingInputs: string[];
  warnings: Warning[];
}

/** Why a register advance does not count toward a period's recorded consumption. */
export type RegisterExclusion =
  | "no_readings"
  | "opening_outside_window"
  | "closing_outside_window"
  | "one_reading"
  | "estimated_reading"
  | "register_went_backwards"
  | "invalid_period";

export interface RegisterConsumption {
  meterId: string;
  /** True when the advance counts toward the period's recorded consumption. */
  counted: boolean;
  /** kWh between the two readings, exactly as read; null when not counted. */
  advanceKwh: number | null;
  opening: { at: IsoTimestamp; kwh: number } | null;
  closing: { at: IsoTimestamp; kwh: number } | null;
  exclusion: RegisterExclusion | null;
  /** The reason in words; null when counted. */
  reason: string | null;
  windowDays: number;
}

const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** The time span in which a register reading can open or close a period: the period widened by the window at both ends. */
export function registerReadingSpan(period: Period, windowDays: number): { from: IsoTimestamp; to: IsoTimestamp } | null {
  const bounds = periodBounds(period);
  if (bounds === null) return null;
  return {
    from: new Date(bounds.startMs - windowDays * MS_PER_DAY).toISOString(),
    to: new Date(bounds.endMs + windowDays * MS_PER_DAY).toISOString(),
  };
}

/**
 * A meter's register advance as consumption recorded in a period: counted
 * only when its opening reading is within `windowDays` of the period's start
 * and its closing reading within `windowDays` of the period's end. The
 * reading nearest each end is used. Nothing is pro-rated.
 */
export function registerConsumption(meter: Meter, readings: readonly TelemetryPoint[], period: Period, windowDays: number): RegisterConsumption {
  const days = `${windowDays} day${windowDays === 1 ? "" : "s"}`;
  const excluded = (exclusion: RegisterExclusion, reason: string, partial: Partial<RegisterConsumption> = {}): RegisterConsumption => ({
    meterId: meter.id,
    counted: false,
    advanceKwh: null,
    opening: null,
    closing: null,
    exclusion,
    reason,
    windowDays,
    ...partial,
  });

  const bounds = periodBounds(period);
  if (bounds === null) return excluded("invalid_period", "the period is invalid, empty, or has no explicit time zone");

  const usable = readings
    .filter((point) => point.source.kind === "meter" && point.source.id === meter.id && point.metric === "energy_import_register_kwh")
    .filter((point) => point.value !== null && point.quality !== "missing")
    .map((point) => ({ point, ms: toEpochMs(point.observedAt) }))
    .filter((entry): entry is { point: TelemetryPoint; ms: number } => entry.ms !== null);
  if (usable.length === 0) return excluded("no_readings", "no register reading is held for the meter");

  const windowMs = windowDays * MS_PER_DAY;
  const inside = (ms: number) => ms >= bounds.startMs && ms <= bounds.endMs;
  /** The reading nearest an end of the period, within the window; of two equally near, the one inside the period. */
  const nearest = (endMs: number) =>
    usable
      .filter((entry) => Math.abs(entry.ms - endMs) <= windowMs)
      .sort((a, b) => Math.abs(a.ms - endMs) - Math.abs(b.ms - endMs) || Number(inside(b.ms)) - Number(inside(a.ms)) || a.ms - b.ms)[0];

  const first = nearest(bounds.startMs);
  const last = nearest(bounds.endMs);
  if (first === undefined) return excluded("opening_outside_window", `no register reading within ${days} of the start of the period`);
  const opening = { at: first.point.observedAt, kwh: first.point.value as number };
  if (last === undefined) return excluded("closing_outside_window", `no register reading within ${days} of the end of the period`, { opening });
  if (last === first) return excluded("one_reading", "only one register reading is held near the period; an advance needs two", { opening });
  const closing = { at: last.point.observedAt, kwh: last.point.value as number };
  if (closing.kwh < opening.kwh) return excluded("register_went_backwards", "the register reads lower at the closing reading than at the opening one", { opening, closing });

  const estimate = (quality: DataQuality) => quality === "estimated" || quality === "substituted";
  if (estimate(first.point.quality) || estimate(last.point.quality)) {
    const which = estimate(first.point.quality) && estimate(last.point.quality) ? "both readings are estimates" : `the ${estimate(last.point.quality) ? "closing" : "opening"} reading is an estimate`;
    return excluded("estimated_reading", `${which}, not a reading of the meter`, { opening, closing });
  }

  return { meterId: meter.id, counted: true, advanceKwh: closing.kwh - opening.kwh, opening, closing, exclusion: null, reason: null, windowDays };
}

/** The advance of a meter's import register between its first and last reading within [start, end]. */
export function registerAdvance(meter: Meter, readings: readonly TelemetryPoint[], period: Period): RegisterAdvance {
  const none = (status: CalcStatus, missingInputs: string[], warnings: Warning[], partial: Partial<RegisterAdvance> = {}): RegisterAdvance => ({
    meterId: meter.id,
    status,
    advanceKwh: null,
    opening: null,
    closing: null,
    readings: 0,
    quality: null,
    missingInputs,
    warnings,
    ...partial,
  });

  const bounds = periodBounds(period);
  if (bounds === null) {
    return none("insufficient_data", ["period"], [{ code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." }]);
  }

  const usable = readings
    .filter((point) => point.source.kind === "meter" && point.source.id === meter.id && point.metric === "energy_import_register_kwh")
    .filter((point) => point.value !== null && point.quality !== "missing")
    .map((point) => ({ point, ms: toEpochMs(point.observedAt) }))
    // A reading at the very end of the period closes it, so the end is included here.
    .filter((entry): entry is { point: TelemetryPoint; ms: number } => entry.ms !== null && entry.ms >= bounds.startMs && entry.ms <= bounds.endMs)
    .sort((a, b) => a.ms - b.ms);

  if (usable.length < 2 || usable[0].ms === usable[usable.length - 1].ms) {
    return none("insufficient_data", [`two register readings of meter ${meter.id} in the period`], [], { readings: usable.length });
  }

  const first = usable[0].point;
  const last = usable[usable.length - 1].point;
  const opening = { at: first.observedAt, kwh: first.value as number };
  const closing = { at: last.observedAt, kwh: last.value as number };
  if (closing.kwh < opening.kwh) {
    return none(
      "not_computable",
      [],
      [
        {
          code: "REGISTER_WENT_BACKWARDS",
          message: `Meter ${meter.id}'s register reads lower at ${closing.at} than at ${opening.at}; the advance cannot be given.`,
          ref: meter.id,
        },
      ],
      { opening, closing, readings: usable.length },
    );
  }

  return {
    meterId: meter.id,
    status: "ok",
    advanceKwh: closing.kwh - opening.kwh,
    opening,
    closing,
    readings: usable.length,
    quality: worstQuality([first.quality, last.quality]),
    missingInputs: [],
    warnings: [],
  };
}
