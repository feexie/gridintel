import type { AssetRef } from "@/domain";
import type { PlacedRecords } from "./place.ts";
import type { TopologyIndex } from "./registry.ts";
import { placeOfAsset } from "./place.ts";
import { feedersOfSubstation, servicePointsDirectOnFeeder, servicePointsOnTransformer, transformersOnFeeder } from "./registry.ts";

/* ==========================================================
   ANALYTICS — TRACING THE NETWORK FROM AN ASSET

   What supplies an asset (upstream, nearest first) and what is
   supplied through it (downstream), from the CURRENT topology.

   Upstream of a distribution transformer is its feeder, the power
   transformer the feeder's origin names (when it names one) and the
   substation. Downstream of a feeder is its transformers and every
   service point on them or directly on it.

   A power transformer's downstream is the feeders whose origin
   names it. Where a substation's feeders name no power transformer,
   what hangs from each transformer is not recorded, and the trace
   says so (`downstreamKnown: false`) instead of assuming.

   An asset that is not in the registry has no trace.
========================================================== */

export interface NetworkTrace {
  subject: AssetRef;
  /** What supplies the subject, nearest first. */
  upstream: AssetRef[];
  /** The administrative region the subject is in; null when it has none. */
  regionId: string | null;
  /** What is supplied through the subject, in id order within each kind. The subject itself is not listed. */
  downstream: {
    feeders: string[];
    distributionTransformers: string[];
    servicePoints: string[];
  };
  /** False when the registry does not record what the subject supplies. */
  downstreamKnown: boolean;
}

export function traceAsset(index: TopologyIndex, records: PlacedRecords, asset: AssetRef): NetworkTrace | null {
  const place = placeOfAsset(index, records, asset);
  if (place === null) return null;

  const feederIds = (ids: readonly string[]) => [...ids].sort();
  const under = (feeders: readonly string[], ownTransformers: readonly string[] = [], ownPoints: readonly string[] = []) => {
    const transformers = [...ownTransformers, ...feeders.flatMap((id) => transformersOnFeeder(index, id).map((dt) => dt.id))];
    const points = [
      ...ownPoints,
      ...feeders.flatMap((id) => servicePointsDirectOnFeeder(index, id).map((sp) => sp.id)),
      ...transformers.flatMap((id) => servicePointsOnTransformer(index, id).map((sp) => sp.id)),
    ];
    return { feeders: feederIds(feeders), distributionTransformers: [...new Set(transformers)].sort(), servicePoints: [...new Set(points)].sort() };
  };

  const upstream: AssetRef[] = [];
  let downstream: NetworkTrace["downstream"] = { feeders: [], distributionTransformers: [], servicePoints: [] };
  let downstreamKnown = true;
  const feeder = place.feederId === null ? undefined : index.feederById.get(place.feederId);
  const feedingTransformer = feeder?.origin.powerTransformerId;

  switch (asset.kind) {
    case "substation":
      downstream = under(feedersOfSubstation(index, asset.id).map((candidate) => candidate.id));
      break;
    case "power_transformer": {
      const feeders = place.substationId === null ? [] : feedersOfSubstation(index, place.substationId);
      // With no feeder naming any transformer, which feeders hang from this one is not recorded.
      downstreamKnown = feeders.length === 0 || feeders.some((candidate) => candidate.origin.powerTransformerId !== undefined);
      downstream = under(feeders.filter((candidate) => candidate.origin.powerTransformerId === asset.id).map((candidate) => candidate.id));
      break;
    }
    case "feeder":
      downstream = under([asset.id]);
      downstream.feeders = [];
      break;
    case "distribution_transformer":
      downstream = under([], [], servicePointsOnTransformer(index, asset.id).map((sp) => sp.id));
      break;
    default:
      // A service point, a meter or a device supplies nothing further.
      break;
  }

  // Nearest first: the asset a meter or device sits on, then transformer, feeder, power transformer, substation.
  const above = (kind: AssetRef["kind"], id: string | null | undefined) => {
    if (id !== null && id !== undefined && !(asset.kind === kind && asset.id === id)) upstream.push({ kind, id });
  };
  above("distribution_transformer", place.transformerId);
  above("feeder", place.feederId);
  above("power_transformer", feedingTransformer);
  above("substation", place.substationId);

  return { subject: asset, upstream, regionId: place.regionId, downstream, downstreamKnown };
}
