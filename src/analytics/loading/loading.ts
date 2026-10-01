import type {
  AssetRef,
  DataQuality,
  DistributionTransformer,
  Feeder,
  IsoTimestamp,
  MethodologyRef,
  TelemetryPoint,
} from "@/domain";
import type { LoadingParameters, Methodology } from "../core/methodology.ts";
import type { CalcStatus, CalculatedKpi, CalculationContext, InputValue, Warning } from "../core/result.ts";
import type { ApparentPowerMethod, ElectricalSemantics, ReadingUsed } from "./apparentPower.ts";
import { LOADING_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { finalizeKpi } from "../core/result.ts";
import { worstQuality } from "../core/quality.ts";
import { toEpochMs } from "../core/time.ts";
import { apparentPowerKva, latestReading, withinSkew } from "./apparentPower.ts";

/* ==========================================================
   ANALYTICS — EQUIPMENT LOADING AND OVERLOAD

   Loading is calculated from measurements and ratings only:
   - apparent power ÷ rated capacity (kVA), when apparent power can
     be derived (see apparentPower.ts) and a capacity rating exists;
   - otherwise, the highest phase current ÷ rated current, when
     currents labelled for phases A, B and C (or a declared
     single-phase current) and a current rating exist.

   A stored or reported loading percentage is never an input. If
   neither method has what it needs, the result is insufficient_data
   and names what is missing.
========================================================== */

export type LoadingTarget =
  | { kind: "distribution_transformer"; asset: DistributionTransformer }
  | { kind: "feeder"; asset: Feeder };

export type LoadingBasis = "apparent_power_vs_rated_capacity" | "current_vs_rated_current";

export interface LoadingResult {
  kind: "loading";
  asset: AssetRef;
  asOf: IsoTimestamp;
  status: CalcStatus;
  /** Loading as a fraction of rating (1 = 100%). */
  loadingFraction: number | null;
  basis: LoadingBasis | null;
  apparentPowerKva: number | null;
  apparentPowerMethod: ApparentPowerMethod | null;
  ratedCapacityKva: number | null;
  maxPhaseCurrentA: number | null;
  ratedCurrentA: number | null;
  readings: ReadingUsed[];
  missingInputs: string[];
  quality: DataQuality | null;
  warnings: Warning[];
  methodology: MethodologyRef;
  computedAt: IsoTimestamp;
}

function ratings(target: LoadingTarget): { capacityKva: number | null; currentA: number | null } {
  if (target.kind === "distribution_transformer") {
    return { capacityKva: target.asset.ratingKva, currentA: null };
  }
  const feeder = target.asset;
  return {
    capacityKva: feeder.ratedCapacityMva === undefined ? null : feeder.ratedCapacityMva * 1000,
    currentA: feeder.ratedCurrentA ?? null,
  };
}

export function calculateLoading(params: {
  target: LoadingTarget;
  telemetry: readonly TelemetryPoint[];
  asOf: IsoTimestamp;
  /** Electrical semantics of the telemetry, if known from the source system. */
  semantics?: ElectricalSemantics;
  methodology?: Methodology<LoadingParameters>;
  context: CalculationContext;
}): LoadingResult {
  const { target, asOf, context } = params;
  const methodology = params.methodology ?? LOADING_REFERENCE;
  const parameters = methodology.parameters;
  const assetRef: AssetRef = { kind: target.kind, id: target.asset.id };
  const points = params.telemetry.filter(
    (point) => point.source.kind === assetRef.kind && point.source.id === assetRef.id,
  );
  const rating = ratings(target);
  const warnings: Warning[] = [];
  const missingInputs: string[] = [];

  const base = {
    kind: "loading" as const,
    asset: assetRef,
    asOf,
    ratedCapacityKva: rating.capacityKva,
    ratedCurrentA: rating.currentA,
    methodology: methodologyRef(methodology),
    computedAt: context.computedAt,
  };

  // Declared semantics must agree with the registry where the registry records phases.
  let semantics = params.semantics;
  const registeredPhases = target.kind === "distribution_transformer" ? target.asset.phases : undefined;
  if (semantics !== undefined && registeredPhases !== undefined && semantics.phases !== registeredPhases) {
    warnings.push({
      code: "SEMANTICS_CONFLICT",
      message: `Declared ${semantics.phases}-phase semantics conflict with the registry (${registeredPhases}-phase); they were not used.`,
      ref: assetRef.id,
    });
    semantics = undefined;
  }

  // Method 1: apparent power vs rated capacity.
  const apparent = apparentPowerKva({ points, asOf, parameters, semantics });
  warnings.push(...apparent.warnings);
  if (apparent.kva !== null && rating.capacityKva !== null && rating.capacityKva > 0) {
    return {
      ...base,
      status: "ok",
      loadingFraction: apparent.kva / rating.capacityKva,
      basis: "apparent_power_vs_rated_capacity",
      apparentPowerKva: apparent.kva,
      apparentPowerMethod: apparent.method,
      maxPhaseCurrentA: null,
      readings: apparent.readings,
      missingInputs: [],
      quality: worstQuality(apparent.readings.map((reading) => reading.quality)),
      warnings,
    };
  }
  if (rating.capacityKva === null) missingInputs.push("rated capacity");
  else if (rating.capacityKva <= 0) missingInputs.push("positive rated capacity");
  if (apparent.kva === null) {
    missingInputs.push(...apparent.unavailable.map((u) => `apparent power (${u.method}): ${u.reason}`));
  }

  // Method 2: highest phase current vs rated current.
  const asOfMs = toEpochMs(asOf);
  if (rating.currentA !== null && rating.currentA > 0 && asOfMs !== null) {
    const phaseCurrents = (["A", "B", "C"] as const).map((phase) =>
      latestReading(points, "current_a", phase, asOfMs, parameters),
    );
    let currents: ReadingUsed[] | null = null;
    if (phaseCurrents.every((reading) => reading !== null)) {
      currents = phaseCurrents as ReadingUsed[];
    } else if (semantics?.phases === 1) {
      const single = latestReading(points, "current_a", "A", asOfMs, parameters) ??
        latestReading(points, "current_a", null, asOfMs, parameters);
      currents = single === null ? null : [single];
    }
    if (currents !== null && withinSkew(currents, parameters)) {
      const maxCurrent = Math.max(...currents.map((reading) => reading.value));
      return {
        ...base,
        status: "ok",
        loadingFraction: maxCurrent / rating.currentA,
        basis: "current_vs_rated_current",
        apparentPowerKva: apparent.kva,
        apparentPowerMethod: apparent.method,
        maxPhaseCurrentA: maxCurrent,
        readings: currents,
        missingInputs: [],
        quality: worstQuality(currents.map((reading) => reading.quality)),
        warnings,
      };
    }
    missingInputs.push(
      currents === null
        ? "phase currents labelled A, B and C (or a declared single-phase current)"
        : "simultaneous phase-current readings",
    );
  } else if (rating.currentA === null) {
    missingInputs.push("rated current");
  }

  return {
    ...base,
    status: "insufficient_data",
    loadingFraction: null,
    basis: null,
    apparentPowerKva: apparent.kva,
    apparentPowerMethod: apparent.method,
    maxPhaseCurrentA: null,
    readings: [],
    missingInputs,
    quality: null,
    warnings,
  };
}

/* ==========================================================
   OVERLOAD
========================================================== */

export interface OverloadResult {
  asset: AssetRef;
  status: CalcStatus;
  /** null when loading could not be calculated. */
  overloaded: boolean | null;
  loadingFraction: number | null;
  threshold: number;
  /** loading − threshold; positive means over the threshold. */
  marginFraction: number | null;
  methodology: MethodologyRef;
}

/** Overloaded means loading strictly above the methodology's threshold. */
export function detectOverload(
  loading: LoadingResult,
  methodology: Methodology<LoadingParameters> = LOADING_REFERENCE,
): OverloadResult {
  const threshold = methodology.parameters.overloadThreshold;
  const value = loading.status === "ok" ? loading.loadingFraction : null;
  return {
    asset: loading.asset,
    status: loading.status,
    overloaded: value === null ? null : value > threshold,
    loadingFraction: value,
    threshold,
    marginFraction: value === null ? null : value - threshold,
    methodology: methodologyRef(methodology),
  };
}

function loadingKpiInputs(loading: LoadingResult): Record<string, InputValue> {
  const quality = loading.quality ?? "missing";
  if (loading.basis === "apparent_power_vs_rated_capacity") {
    return {
      apparentPower: {
        value: loading.apparentPowerKva,
        unit: "kVA",
        origin: loading.apparentPowerMethod === "measured_apparent_power" ? "observed" : "calculated",
        quality,
        ref: loading.apparentPowerMethod ?? undefined,
      },
      ratedCapacity: { value: loading.ratedCapacityKva, unit: "kVA", origin: "observed", quality: "measured", ref: "registry rating" },
    };
  }
  if (loading.basis === "current_vs_rated_current") {
    // Amperes are not a KPI unit; the readings themselves are in LoadingResult.readings.
    return {
      currentRatio: {
        value: loading.loadingFraction,
        unit: "fraction",
        origin: "calculated",
        quality,
        ref: "highest phase current ÷ rated current",
      },
    };
  }
  return {};
}

/** A distribution transformer's loading as a calculated KPI, for comparison with reported loading. */
export function transformerLoadingKpi(loading: LoadingResult): CalculatedKpi {
  return finalizeKpi({
    kind: "calculated",
    metric: "transformer_loading",
    scope: { kind: "distribution_transformer", id: loading.asset.id },
    period: null,
    asOf: loading.asOf,
    status: loading.status,
    value: loading.loadingFraction,
    unit: "fraction",
    methodology: loading.methodology,
    basis: {},
    inputs: loadingKpiInputs(loading),
    missingInputs: loading.missingInputs,
    coverage: null,
    quality: loading.quality,
    warnings: loading.warnings,
    computedAt: loading.computedAt,
  });
}
