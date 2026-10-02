import type { IsoTimestamp, Period } from "@/domain";
import type { GridIntelRepositories } from "../../repositories/ports/index.ts";
import type {
  CalculationContext,
  LoadingResult,
  LoadingTarget,
  OverloadResult,
  PeakLoadingResult,
} from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { Sourced } from "./sourcing.ts";
import {
  LOADING_REFERENCE,
  MS_PER_MINUTE,
  calculateLoading,
  detectOverload,
  peakLoading,
  toEpochMs,
} from "../../analytics/index.ts";
import { NO_CACHE, resultKey } from "./cache.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — EQUIPMENT LOADING

   Loading of a distribution transformer or a feeder at an as-of
   time, from the telemetry readings recent enough for the
   methodology, and optionally the highest loading observed over a
   window.
========================================================== */

export interface AssetLoading {
  /** null when the asset is not in the registry. */
  loading: LoadingResult | null;
  overload: OverloadResult | null;
  /** Present when a window was asked for. */
  peak: PeakLoadingResult | null;
}

interface LoadingParams {
  repos: GridIntelRepositories;
  asset: { kind: "distribution_transformer" | "feeder"; id: string };
  asOf: IsoTimestamp;
  /** Also report the highest loading observed in this window. */
  window?: Period;
  context: CalculationContext;
  cache?: ServiceCache;
}

export function assetLoading(params: LoadingParams): Promise<Sourced<AssetLoading>> {
  const key = `${resultKey("loading", params.asset, params.window ?? null, params.asOf)}|${params.context.computedAt}`;
  return (params.cache ?? NO_CACHE).get(key, () => computeLoading(params));
}

async function computeLoading(params: LoadingParams): Promise<Sourced<AssetLoading>> {
  const { repos, asset, asOf, window, context } = params;
  const trail = new SourceTrail();
  const { index } = await loadTopology(repos.registry, asOf, params.cache);

  const record = asset.kind === "feeder" ? index.feederById.get(asset.id) : index.transformerById.get(asset.id);
  const asOfMs = toEpochMs(asOf);
  if (record === undefined || asOfMs === null) {
    return { result: { loading: null, overload: null, peak: null }, sourcing: await trail.resolve(repos.sources) };
  }
  trail.add([record]);
  const target = { kind: asset.kind, asset: record } as LoadingTarget;
  const parameters = LOADING_REFERENCE.parameters;

  const recent = await repos.observations.listTelemetry({
    sources: [asset],
    from: new Date(asOfMs - parameters.maxReadingAgeMinutes * MS_PER_MINUTE).toISOString(),
    asOf,
  });
  trail.add(recent.records);
  const loading = calculateLoading({ target, telemetry: recent.records, asOf, context });

  let peak: PeakLoadingResult | null = null;
  if (window !== undefined) {
    const history = await repos.observations.listTelemetry({ sources: [asset], from: window.start, asOf: window.end });
    trail.add(history.records);
    peak = peakLoading({
      target,
      telemetry: history.records,
      window,
      overloadThreshold: parameters.overloadThreshold,
      context,
    });
  }

  return { result: { loading, overload: detectOverload(loading), peak }, sourcing: await trail.resolve(repos.sources) };
}
