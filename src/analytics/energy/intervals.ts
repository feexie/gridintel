import type { DataQuality, Fraction, IntervalEnergy, Meter, Period } from "@/domain";
import type { CalcStatus, Warning } from "../core/result.ts";
import type { MeterRole } from "../topology/registry.ts";
import { worstQuality } from "../core/quality.ts";
import { MS_PER_MINUTE, periodBounds, toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — METER ENERGY OVER A PERIOD

   Direction follows the meter's installation role:
   - boundary meters: import = energy flowing downstream into the
     section, export = reverse flow;
   - service-point meters: import = consumption, export = energy
     the customer injects.
   net = import − export, so a positive net is always the direction
   the boundary is defined in.

   A channel total is only produced when every expected interval in
   the period is present and usable. A gap, a null channel, or an
   interval with quality "missing" makes the total null. Nothing is
   interpolated or substituted, and nothing becomes 0. Intervals with
   quality "suspect" (or "estimated"/"substituted" from the source)
   are used and make the total's quality correspondingly worse.
========================================================== */

export interface MeterEnergyTotal {
  meterId: string;
  role: MeterRole;
  status: CalcStatus;
  importKwh: number | null;
  exportKwh: number | null;
  /** import − export; null unless both channels are complete. */
  netKwh: number | null;
  intervalMinutes: number | null;
  expectedIntervals: number | null;
  /** Intervals with quality other than "missing" and both channels present. */
  usableIntervals: number;
  coverage: Fraction | null;
  quality: DataQuality | null;
  missingInputs: string[];
  warnings: Warning[];
}

function insufficient(
  meter: Meter,
  missing: string,
  warnings: Warning[],
  partial: Partial<MeterEnergyTotal> = {},
): MeterEnergyTotal {
  return {
    meterId: meter.id,
    role: meter.installation.role,
    status: "insufficient_data",
    importKwh: null,
    exportKwh: null,
    netKwh: null,
    intervalMinutes: null,
    expectedIntervals: null,
    usableIntervals: 0,
    coverage: null,
    quality: null,
    missingInputs: [missing],
    warnings,
    ...partial,
  };
}

export function sumMeterEnergy(
  meter: Meter,
  intervals: readonly IntervalEnergy[],
  period: Period,
): MeterEnergyTotal {
  const bounds = periodBounds(period);
  if (bounds === null) {
    return insufficient(meter, "period", [
      { code: "INVALID_PERIOD", message: "The period is invalid, empty, or has no explicit time zone." },
    ]);
  }

  const warnings: Warning[] = [];
  const own = intervals.filter((interval) => interval.meterId === meter.id);
  const inPeriod = own.filter((interval) => {
    const startMs = toEpochMs(interval.intervalStart);
    return startMs !== null && startMs >= bounds.startMs && startMs < bounds.endMs;
  });

  if (inPeriod.length === 0) {
    return insufficient(meter, `interval energy for meter ${meter.id}`, [
      { code: "NO_INTERVAL_DATA", message: `No interval energy for meter ${meter.id} in the period.`, ref: meter.id },
    ]);
  }

  const lengths = new Set(inPeriod.map((interval) => interval.intervalMinutes));
  if (lengths.size !== 1) {
    return insufficient(meter, `consistent interval length for meter ${meter.id}`, [
      {
        code: "INTERVAL_LENGTH_INCONSISTENT",
        message: `Meter ${meter.id} has intervals of different lengths in the period.`,
        ref: meter.id,
      },
    ]);
  }
  const intervalMinutes = inPeriod[0].intervalMinutes;
  const intervalMs = intervalMinutes * MS_PER_MINUTE;
  const periodMs = bounds.endMs - bounds.startMs;
  if (!(intervalMinutes > 0) || periodMs % intervalMs !== 0) {
    return insufficient(meter, `interval length that divides the period for meter ${meter.id}`, [
      {
        code: "INTERVAL_LENGTH_INCOMPATIBLE",
        message: `Meter ${meter.id}'s ${intervalMinutes}-minute intervals do not divide the period evenly.`,
        ref: meter.id,
      },
    ]);
  }
  const expectedIntervals = periodMs / intervalMs;

  const slots = new Map<number, IntervalEnergy>();
  for (const interval of inPeriod) {
    const offset = (toEpochMs(interval.intervalStart) as number) - bounds.startMs;
    if (offset % intervalMs !== 0) {
      warnings.push({
        code: "INTERVAL_MISALIGNED",
        message: `Interval starting ${interval.intervalStart} is not aligned to the period; it was not used.`,
        ref: meter.id,
      });
      continue;
    }
    const slot = offset / intervalMs;
    if (slots.has(slot)) {
      return insufficient(
        meter,
        `a single reading per interval for meter ${meter.id}`,
        [
          {
            code: "DUPLICATE_INTERVAL",
            message: `Meter ${meter.id} has more than one record for the interval starting ${interval.intervalStart}.`,
            ref: meter.id,
          },
        ],
        { intervalMinutes, expectedIntervals },
      );
    }
    slots.set(slot, interval);
  }

  let importKwh: number | null = 0;
  let exportKwh: number | null = 0;
  let usableIntervals = 0;
  let gaps = 0;
  const qualities: DataQuality[] = [];

  for (let slot = 0; slot < expectedIntervals; slot++) {
    const interval = slots.get(slot);
    if (interval === undefined) {
      gaps++;
      importKwh = null;
      exportKwh = null;
      continue;
    }
    qualities.push(interval.quality);
    const usable = interval.quality !== "missing";
    const imp = usable ? interval.importKwh : null;
    const exp = usable ? interval.exportKwh : null;
    importKwh = importKwh === null || imp === null ? null : importKwh + imp;
    exportKwh = exportKwh === null || exp === null ? null : exportKwh + exp;
    if (imp !== null && exp !== null) usableIntervals++;
  }

  const missingInputs: string[] = [];
  if (gaps > 0) {
    warnings.push({
      code: "INTERVAL_GAP",
      message: `Meter ${meter.id} is missing ${gaps} of ${expectedIntervals} intervals.`,
      ref: meter.id,
    });
  }
  if (importKwh === null) missingInputs.push(`complete import channel for meter ${meter.id}`);
  if (exportKwh === null) missingInputs.push(`complete export channel for meter ${meter.id}`);

  const netKwh = importKwh !== null && exportKwh !== null ? importKwh - exportKwh : null;
  const quality =
    gaps > 0 || usableIntervals < expectedIntervals ? "missing" : worstQuality(qualities);

  return {
    meterId: meter.id,
    role: meter.installation.role,
    status: netKwh === null ? "insufficient_data" : "ok",
    importKwh,
    exportKwh,
    netKwh,
    intervalMinutes,
    expectedIntervals,
    usableIntervals,
    coverage: usableIntervals / expectedIntervals,
    quality,
    missingInputs,
    warnings,
  };
}
