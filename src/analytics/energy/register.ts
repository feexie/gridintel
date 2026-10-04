import type { DataQuality, IsoTimestamp, Meter, Period, TelemetryPoint } from "@/domain";
import type { CalcStatus, Warning } from "../core/result.ts";
import { worstQuality } from "../core/quality.ts";
import { periodBounds, toEpochMs } from "../core/time.ts";

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
