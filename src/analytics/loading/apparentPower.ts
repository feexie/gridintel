import type { DataQuality, IsoTimestamp, MetricKey, TelemetryPoint } from "@/domain";
import type { LoadingParameters } from "../core/methodology.ts";
import type { Warning } from "../core/result.ts";
import { MS_PER_MINUTE, toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — APPARENT POWER FROM TELEMETRY

   Apparent power S (kVA) is derived from measured telemetry by the
   first method whose inputs are available and unambiguous:

     1. measured_apparent_power   S (phase "total")
     2. active_reactive           S = √(P² + Q²)  (P, Q phase "total")
     3. active_power_factor       S = P ÷ PF      (P, PF phase "total")
     4. voltage_current           three-phase: S = Σ V_LN × I per phase
                                  (A, B, C); single-phase: S = V × I.
                                  Needs DECLARED electrical semantics;
                                  line-to-line voltages are not
                                  converted, so a three-phase
                                  line-to-line declaration is
                                  insufficient

   Nothing is assumed:
   - Aggregate quantities (S, P, Q, PF) are only used when labelled
     phase "total". An unlabelled power reading could be one phase
     or the total, so it is not used.
   - Voltage × current needs the number of phases and whether the
     voltage is line-to-line or line-to-neutral. Telemetry does not
     record this, so it must be declared by the caller (e.g. from
     the source system's configuration). Without a declaration the
     method is not attempted.
   - A nominal voltage is never used in place of a measured one.
   - Readings combined in one method must be within the
     methodology's skew limit of each other.
========================================================== */

export interface ElectricalSemantics {
  phases: 1 | 3;
  /** What the voltage readings measure. */
  voltageBasis: "line_to_line" | "line_to_neutral";
}

export type ApparentPowerMethod =
  | "measured_apparent_power"
  | "active_reactive"
  | "active_power_factor"
  | "voltage_current";

export interface ReadingUsed {
  metric: MetricKey;
  phase: TelemetryPoint["phase"] | null;
  value: number;
  observedAt: IsoTimestamp;
  quality: DataQuality;
}

export interface ApparentPowerOutcome {
  kva: number | null;
  method: ApparentPowerMethod | null;
  readings: ReadingUsed[];
  /** Why each method that was tried could not be used. */
  unavailable: { method: ApparentPowerMethod; reason: string }[];
  warnings: Warning[];
}

/** The latest usable reading of a metric/phase within the age limit, by observation time. */
export function latestReading(
  points: readonly TelemetryPoint[],
  metric: MetricKey,
  phase: TelemetryPoint["phase"] | null,
  asOfMs: number,
  parameters: LoadingParameters,
): ReadingUsed | null {
  let best: { point: TelemetryPoint; ms: number } | null = null;
  for (const point of points) {
    if (point.metric !== metric) continue;
    if ((point.phase ?? null) !== phase) continue;
    if (point.value === null || point.quality === "missing") continue;
    const ms = toEpochMs(point.observedAt);
    if (ms === null || ms > asOfMs) continue;
    if (asOfMs - ms > parameters.maxReadingAgeMinutes * MS_PER_MINUTE) continue;
    if (best === null || ms > best.ms) best = { point, ms };
  }
  if (best === null) return null;
  return {
    metric,
    phase,
    value: best.point.value as number,
    observedAt: best.point.observedAt,
    quality: best.point.quality,
  };
}

/** True if all readings were observed within the skew limit of each other. */
export function withinSkew(readings: readonly ReadingUsed[], parameters: LoadingParameters): boolean {
  const times = readings.map((reading) => toEpochMs(reading.observedAt) as number);
  return Math.max(...times) - Math.min(...times) <= parameters.maxReadingSkewMinutes * MS_PER_MINUTE;
}

const PHASES = ["A", "B", "C"] as const;

export function apparentPowerKva(params: {
  points: readonly TelemetryPoint[];
  asOf: IsoTimestamp;
  parameters: LoadingParameters;
  semantics?: ElectricalSemantics;
}): ApparentPowerOutcome {
  const { points, parameters, semantics } = params;
  const unavailable: { method: ApparentPowerMethod; reason: string }[] = [];
  const warnings: Warning[] = [];
  const asOfMs = toEpochMs(params.asOf);
  if (asOfMs === null) {
    return {
      kva: null,
      method: null,
      readings: [],
      unavailable: [],
      warnings: [{ code: "INVALID_AS_OF", message: "The as-of time is invalid or has no explicit time zone." }],
    };
  }
  const read = (metric: MetricKey, phase: TelemetryPoint["phase"] | null) =>
    latestReading(points, metric, phase, asOfMs, parameters);

  const unlabelledPower = points.some(
    (point) =>
      (point.metric === "apparent_power_kva" || point.metric === "active_power_kw" || point.metric === "reactive_power_kvar") &&
      point.phase === undefined,
  );
  if (unlabelledPower) {
    warnings.push({
      code: "PHASE_UNSPECIFIED",
      message: "Power readings without a phase label were not used: they could be one phase or the total.",
    });
  }

  // 1. Measured apparent power.
  const s = read("apparent_power_kva", "total");
  if (s !== null) return { kva: s.value, method: "measured_apparent_power", readings: [s], unavailable, warnings };
  unavailable.push({ method: "measured_apparent_power", reason: "no recent total apparent-power reading" });

  // 2. Active and reactive power.
  const p = read("active_power_kw", "total");
  const q = read("reactive_power_kvar", "total");
  if (p !== null && q !== null) {
    if (withinSkew([p, q], parameters)) {
      return { kva: Math.hypot(p.value, q.value), method: "active_reactive", readings: [p, q], unavailable, warnings };
    }
    unavailable.push({ method: "active_reactive", reason: "P and Q readings are not simultaneous" });
  } else {
    unavailable.push({ method: "active_reactive", reason: "no recent total P and Q readings" });
  }

  // 3. Active power and power factor.
  const pf = read("power_factor", "total");
  if (p !== null && pf !== null) {
    if (!withinSkew([p, pf], parameters)) {
      unavailable.push({ method: "active_power_factor", reason: "P and PF readings are not simultaneous" });
    } else if (!(pf.value > 0 && pf.value <= 1)) {
      unavailable.push({ method: "active_power_factor", reason: `power factor ${pf.value} is outside (0, 1]` });
    } else {
      return { kva: p.value / pf.value, method: "active_power_factor", readings: [p, pf], unavailable, warnings };
    }
  } else {
    unavailable.push({ method: "active_power_factor", reason: "no recent total P and PF readings" });
  }

  // 4. Voltage and current, only with declared semantics.
  if (semantics === undefined) {
    unavailable.push({
      method: "voltage_current",
      reason: "electrical semantics (phases, voltage basis) not declared",
    });
    return { kva: null, method: null, readings: [], unavailable, warnings };
  }

  if (semantics.phases === 3) {
    if (semantics.voltageBasis === "line_to_line") {
      // Per-phase apparent power needs line-to-neutral voltages. Deriving them from line-to-line
      // voltages (÷ √3) assumes a symmetrical system, which is not done without a methodology for it.
      unavailable.push({
        method: "voltage_current",
        reason: "three-phase apparent power needs line-to-neutral voltages; line-to-line voltages were declared",
      });
      return { kva: null, method: null, readings: [], unavailable, warnings };
    }
    const currents = PHASES.map((phase) => read("current_a", phase));
    const voltages = PHASES.map((phase) => read("voltage_v", phase));
    if (currents.some((c) => c === null) || voltages.some((v) => v === null)) {
      unavailable.push({
        method: "voltage_current",
        reason: "needs recent voltage and current readings labelled for each of phases A, B and C",
      });
      return { kva: null, method: null, readings: [], unavailable, warnings };
    }
    const used = [...(currents as ReadingUsed[]), ...(voltages as ReadingUsed[])];
    if (!withinSkew(used, parameters)) {
      unavailable.push({ method: "voltage_current", reason: "voltage and current readings are not simultaneous" });
      return { kva: null, method: null, readings: [], unavailable, warnings };
    }
    // S = Σ V_phase × I_phase over the three phases (line-to-neutral voltages).
    const va = PHASES.reduce(
      (sum, _phase, i) => sum + (voltages[i] as ReadingUsed).value * (currents[i] as ReadingUsed).value,
      0,
    );
    return { kva: va / 1000, method: "voltage_current", readings: used, unavailable, warnings };
  }

  // Single phase: one voltage and one current across the same load.
  const current = read("current_a", "A") ?? read("current_a", null);
  const voltage = read("voltage_v", "A") ?? read("voltage_v", null);
  if (current === null || voltage === null) {
    unavailable.push({ method: "voltage_current", reason: "needs a recent voltage and current reading" });
    return { kva: null, method: null, readings: [], unavailable, warnings };
  }
  if (!withinSkew([current, voltage], parameters)) {
    unavailable.push({ method: "voltage_current", reason: "voltage and current readings are not simultaneous" });
    return { kva: null, method: null, readings: [], unavailable, warnings };
  }
  return {
    kva: (voltage.value * current.value) / 1000,
    method: "voltage_current",
    readings: [voltage, current],
    unavailable,
    warnings,
  };
}
