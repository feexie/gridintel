import type { IsoTimestamp, Period, TelemetryPoint } from "@/domain";
import type { LoadingParameters, Methodology } from "../core/methodology.ts";
import type { CalculationContext } from "../core/result.ts";
import type { ElectricalSemantics } from "./apparentPower.ts";
import type { LoadingResult, LoadingTarget } from "./loading.ts";
import { periodBounds, toEpochMs } from "../core/time.ts";
import { calculateLoading } from "./loading.ts";

/* ==========================================================
   ANALYTICS — PEAK LOADING OVER A WINDOW

   Loading is evaluated at every instant at which the asset has a
   telemetry reading inside the window, and the highest result is
   returned. No instant is invented and nothing is interpolated, so
   the peak is the highest loading OBSERVED; a higher loading
   between readings would not be seen.
========================================================== */

export interface PeakLoadingResult {
  window: Period;
  /** The loading result at the peak instant; null when none could be calculated. */
  peak: LoadingResult | null;
  /** Instants with a reading in the window. */
  instantsEvaluated: number;
  /** Instants at which loading could be calculated. */
  instantsComputed: number;
  /** Instants at which loading was above the methodology's overload threshold. */
  instantsOverloaded: number;
}

export function peakLoading(params: {
  target: LoadingTarget;
  telemetry: readonly TelemetryPoint[];
  window: Period;
  overloadThreshold: number;
  semantics?: ElectricalSemantics;
  methodology?: Methodology<LoadingParameters>;
  context: CalculationContext;
}): PeakLoadingResult {
  const { target, window } = params;
  const empty: PeakLoadingResult = { window, peak: null, instantsEvaluated: 0, instantsComputed: 0, instantsOverloaded: 0 };
  const bounds = periodBounds(window);
  if (bounds === null) return empty;

  const points = params.telemetry.filter(
    (point) => point.source.kind === target.kind && point.source.id === target.asset.id,
  );
  const instants = new Map<number, IsoTimestamp>();
  for (const point of points) {
    const ms = toEpochMs(point.observedAt);
    if (ms !== null && ms >= bounds.startMs && ms < bounds.endMs) instants.set(ms, point.observedAt);
  }

  const result = { ...empty, instantsEvaluated: instants.size };
  for (const ms of [...instants.keys()].sort((a, b) => a - b)) {
    const loading = calculateLoading({
      target,
      telemetry: points,
      asOf: instants.get(ms) as IsoTimestamp,
      semantics: params.semantics,
      methodology: params.methodology,
      context: params.context,
    });
    if (loading.status !== "ok" || loading.loadingFraction === null) continue;
    result.instantsComputed += 1;
    if (loading.loadingFraction > params.overloadThreshold) result.instantsOverloaded += 1;
    if (result.peak === null || loading.loadingFraction > (result.peak.loadingFraction as number)) result.peak = loading;
  }
  return result;
}
