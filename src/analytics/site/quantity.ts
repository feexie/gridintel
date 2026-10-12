import type { AssetRef, DataQuality, IntervalEnergy, KpiBasis, KpiKey, KpiUnit, Meter, MethodologyRef, Period, ScopeRef, TelemetryPoint, MetricKey } from "@/domain";
import type { CalculatedKpi, InputValue, Warning } from "../core/result.ts";
import { worstQuality } from "../core/quality.ts";
import { finalizeKpi } from "../core/result.ts";
import { MS_PER_MINUTE, periodBounds, toEpochMs } from "../core/time.ts";
import { sumMeterEnergy } from "../energy/intervals.ts";

/* ==========================================================
   ANALYTICS — SITE QUANTITIES

   A Quantity is a calculation input that also says, when it has no
   value, exactly what is missing. Every site figure is built from
   quantities, so a figure that cannot be given names the meter, the
   reading or the record that would be needed, and a figure that can
   lists every input with its origin and quality.

   Missing is never zero. The only zeros made here are real ones: a
   site whose complete registry holds no generator generated nothing
   from a generator.
========================================================== */

export interface Quantity extends InputValue {
  /** What is missing, when `value` is null. */
  missing: string[];
  warnings: Warning[];
}

export function missingQuantity(unit: KpiUnit, missing: string, warnings: Warning[] = [], ref?: string): Quantity {
  return { value: null, unit, origin: "observed", quality: "missing", missing: [missing], warnings, ...(ref === undefined ? {} : { ref }) };
}

/** A value known exactly without a measurement, e.g. a count from the registry or a real zero. */
export function knownQuantity(value: number, unit: KpiUnit, ref: string): Quantity {
  return { value, unit, origin: "calculated", quality: "measured", ref, missing: [], warnings: [] };
}

/** A calculated figure as an input to the next one. */
export function kpiQuantity(kpi: CalculatedKpi): Quantity {
  return {
    value: kpi.value,
    unit: kpi.unit,
    origin: "calculated",
    quality: kpi.value === null ? "missing" : (kpi.quality ?? "measured"),
    ...(kpi.estimatedInputs.length > 0 ? { estimatedShare: null } : {}),
    ref: `calculated:${kpi.metric}`,
    missing: kpi.value === null ? (kpi.missingInputs.length > 0 ? kpi.missingInputs : [kpi.metric.replaceAll("_", " ")]) : [],
    warnings: [],
  };
}

/* ==========================================================
   FROM METERS
========================================================== */

export type IntervalsByMeter = ReadonlyMap<string, readonly IntervalEnergy[]>;

export function intervalsByMeter(intervals: readonly IntervalEnergy[]): IntervalsByMeter {
  const groups = new Map<string, IntervalEnergy[]>();
  for (const interval of intervals) {
    const list = groups.get(interval.meterId);
    if (list === undefined) groups.set(interval.meterId, [interval]);
    else list.push(interval);
  }
  return groups;
}

/**
 * The energy through a set of meters over the period, on one channel. Each group is what must
 * be metered (an asset, a connection) with the meters found for it: a group with no meter, or a
 * meter without a complete channel, makes the total missing and is named.
 */
export function meteredEnergy(
  groups: readonly { what: string; meters: readonly Meter[] }[],
  intervals: IntervalsByMeter,
  period: Period,
  channel: "import" | "export" | "net",
): Quantity {
  const missing: string[] = [];
  const warnings: Warning[] = [];
  const qualities: DataQuality[] = [];
  const meterIds: string[] = [];
  let total = 0;
  for (const group of groups) {
    if (group.meters.length === 0) {
      missing.push(group.what);
      continue;
    }
    for (const meter of group.meters) {
      const sum = sumMeterEnergy(meter, intervals.get(meter.id) ?? [], period);
      warnings.push(...sum.warnings);
      const value = channel === "import" ? sum.importKwh : channel === "export" ? sum.exportKwh : sum.netKwh;
      if (value === null) {
        missing.push(...(sum.missingInputs.length > 0 ? sum.missingInputs : [`interval energy for meter ${meter.id}`]));
        continue;
      }
      total += value;
      meterIds.push(meter.id);
      if (sum.quality !== null) qualities.push(sum.quality);
    }
  }
  const ref = meterIds.length <= 3 ? `meters:${meterIds.join(",")}` : `meters:${meterIds.length}`;
  if (missing.length > 0) return { value: null, unit: "kWh", origin: "observed", quality: "missing", missing: [...new Set(missing)], warnings };
  const quality = worstQuality(qualities) ?? "measured";
  return { value: total, unit: "kWh", origin: "observed", quality, ...(quality === "estimated" || quality === "substituted" ? { estimatedShare: null } : {}), ref, missing: [], warnings };
}

/* ==========================================================
   FROM TELEMETRY
========================================================== */

function pointsOf(telemetry: readonly TelemetryPoint[], source: AssetRef, metric: MetricKey): { point: TelemetryPoint; ms: number }[] {
  const points: { point: TelemetryPoint; ms: number }[] = [];
  for (const point of telemetry) {
    if (point.metric !== metric || point.source.kind !== source.kind || point.source.id !== source.id) continue;
    const ms = toEpochMs(point.observedAt);
    if (ms !== null) points.push({ point, ms });
  }
  return points.sort((a, b) => a.ms - b.ms);
}

/** The usable reading nearest to an instant, within the tolerance; null when there is none. */
export function readingAt(telemetry: readonly TelemetryPoint[], source: AssetRef, metric: MetricKey, atMs: number, toleranceMinutes: number): TelemetryPoint | null {
  let best: { point: TelemetryPoint; distance: number } | null = null;
  for (const { point, ms } of pointsOf(telemetry, source, metric)) {
    if (point.value === null || point.quality === "missing") continue;
    const distance = Math.abs(ms - atMs);
    if (distance <= toleranceMinutes * MS_PER_MINUTE && (best === null || distance < best.distance)) best = { point, distance };
  }
  return best?.point ?? null;
}

/**
 * How far a cumulative register advanced over the period: its reading at the end less its
 * reading at the start, each within the tolerance of that end. A register with no reading at
 * either end has no advance, and one that went backwards (a reset, a replaced device) has none
 * either; neither is taken as zero.
 */
export function registerAdvanceOver(telemetry: readonly TelemetryPoint[], source: AssetRef, metric: MetricKey, period: Period, toleranceMinutes: number, unit: KpiUnit): Quantity {
  const what = `${metric} of ${source.kind} ${source.id}`;
  const bounds = periodBounds(period);
  if (bounds === null) return missingQuantity(unit, "period");
  const opening = readingAt(telemetry, source, metric, bounds.startMs, toleranceMinutes);
  const closing = readingAt(telemetry, source, metric, bounds.endMs, toleranceMinutes);
  if (opening === null || closing === null) {
    const ends = [opening === null ? "start" : null, closing === null ? "end" : null].filter((end) => end !== null).join(" and ");
    return missingQuantity(unit, `a reading of ${what} at the ${ends} of the period`);
  }
  const advance = (closing.value as number) - (opening.value as number);
  if (advance < 0) {
    return missingQuantity(unit, `a continuous ${what} over the period`, [{ code: "REGISTER_WENT_BACKWARDS", message: `The ${what} is lower at the end of the period than at its start.`, ref: source.id }]);
  }
  const quality = worstQuality([opening.quality, closing.quality]) ?? "measured";
  return { value: advance, unit, origin: "observed", quality, ...(quality === "estimated" || quality === "substituted" ? { estimatedShare: null } : {}), ref: `${metric}:${source.id}`, missing: [], warnings: [] };
}

/**
 * The time-integral over the period of a series whose readings are each the MEAN over the
 * recording interval ending at the reading (irradiance, curtailed power): Σ reading × interval
 * length in hours. The readings must be evenly spaced and cover the whole period. A gap makes
 * the integral missing; nothing is interpolated.
 */
export function integrateMeans(telemetry: readonly TelemetryPoint[], source: AssetRef, metric: MetricKey, period: Period, unit: KpiUnit, scale = 1): Quantity {
  const what = `${metric} of ${source.kind} ${source.id}`;
  const bounds = periodBounds(period);
  if (bounds === null) return missingQuantity(unit, "period");
  const inPeriod = pointsOf(telemetry, source, metric).filter(({ ms }) => ms > bounds.startMs && ms <= bounds.endMs);
  if (inPeriod.length < 2) return missingQuantity(unit, `readings of ${what} over the period`);
  // The recording interval is the shortest step between two readings, so that a gap does not pass for a longer interval.
  let spacingMs = Infinity;
  for (let i = 1; i < inPeriod.length; i++) spacingMs = Math.min(spacingMs, inPeriod[i].ms - inPeriod[i - 1].ms);
  const expected = (bounds.endMs - bounds.startMs) / spacingMs;
  const even = spacingMs > 0 && Number.isInteger(expected) && inPeriod.every(({ ms }) => (ms - bounds.startMs) % spacingMs === 0);
  const usable = inPeriod.filter(({ point }) => point.value !== null && point.quality !== "missing");
  if (!even || inPeriod.length !== expected || usable.length !== expected) {
    return missingQuantity(unit, `complete readings of ${what} over the period (${usable.length} usable${even ? ` of ${expected}` : ", not evenly spaced"})`, [
      { code: "SERIES_INCOMPLETE", message: `The ${what} does not cover the whole period at an even spacing.`, ref: source.id },
    ]);
  }
  const hours = spacingMs / (60 * MS_PER_MINUTE);
  const quality = worstQuality(usable.map(({ point }) => point.quality)) ?? "measured";
  const estimated = quality === "estimated" || quality === "substituted";
  const value = usable.reduce((total, { point }) => total + (point.value as number) * hours, 0) * scale;
  return {
    value,
    unit,
    origin: "observed",
    quality,
    ...(estimated ? { estimatedShare: usable.every(({ point }) => point.quality === "estimated" || point.quality === "substituted") ? 1 : null } : {}),
    ref: `${metric}:${source.id}`,
    missing: [],
    warnings: [],
  };
}

/** The usable readings of a series from the start of the period to its end, both included. */
export function readingsIn(telemetry: readonly TelemetryPoint[], source: AssetRef, metric: MetricKey, period: Period): TelemetryPoint[] {
  const bounds = periodBounds(period);
  if (bounds === null) return [];
  return pointsOf(telemetry, source, metric)
    .filter(({ ms, point }) => ms >= bounds.startMs && ms <= bounds.endMs && point.value !== null && point.quality !== "missing")
    .map(({ point }) => point);
}

/* ==========================================================
   A SITE FIGURE
========================================================== */

export interface SiteKpiContext {
  scope: ScopeRef;
  period: Period;
  methodology: MethodologyRef;
  computedAt: string;
}

function stripped(quantity: Quantity): InputValue {
  const { missing: _missing, warnings: _warnings, ...input } = quantity;
  void _missing;
  void _warnings;
  return input;
}

/**
 * One figure from named quantities. With any quantity missing the figure is
 * "insufficient_data" and names what is missing. `compute` returns null when the inputs are
 * there but the figure is undefined for them (a zero denominator): "not_computable". A figure
 * with any estimated input is "calculated_with_estimates" and lists them.
 */
export function siteKpi(
  context: SiteKpiContext,
  metric: KpiKey,
  unit: KpiUnit,
  quantities: Record<string, Quantity>,
  compute: (value: (name: string) => number) => number | null,
  options: { basis?: KpiBasis; residual?: string; warnings?: Warning[]; undefinedBecause?: string } = {},
): CalculatedKpi {
  const names = Object.keys(quantities);
  const inputs: Record<string, InputValue> = {};
  for (const name of names) inputs[name] = stripped(quantities[name]);
  const warnings = [...names.flatMap((name) => quantities[name].warnings), ...(options.warnings ?? [])];
  const base = {
    kind: "calculated" as const,
    metric,
    scope: context.scope,
    period: context.period,
    asOf: null,
    unit,
    methodology: context.methodology,
    basis: options.basis ?? {},
    inputs,
    ...(options.residual === undefined ? {} : { derivation: { kind: "residual" as const, note: options.residual } }),
    coverage: null,
    computedAt: context.computedAt,
  };
  const missingInputs = [...new Set(names.filter((name) => quantities[name].value === null).flatMap((name) => quantities[name].missing))];
  if (missingInputs.length > 0) return finalizeKpi({ ...base, status: "insufficient_data", value: null, missingInputs, quality: null, warnings });
  const value = compute((name) => quantities[name].value as number);
  const quality = worstQuality(names.map((name) => quantities[name].quality));
  if (value === null) {
    return finalizeKpi({
      ...base,
      status: "not_computable",
      value: null,
      missingInputs: [],
      quality,
      warnings: [...warnings, { code: "UNDEFINED_FOR_INPUTS", message: options.undefinedBecause ?? "The figure is undefined for these inputs (a zero denominator)." }],
    });
  }
  return finalizeKpi({ ...base, status: "ok", value, missingInputs: [], quality, warnings });
}

/** a ÷ b for `compute`: null when b is 0. */
export function over(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}
