import type { AssetRef, EdgeDevice, PowerTransformer, ScopeRef } from "@/domain";
import type { TopologyIndex } from "./registry.ts";
import { adminRegionOfServicePoint } from "./registry.ts";

/* ==========================================================
   ANALYTICS — WHERE AN ASSET SITS

   The place of any registry asset in the hierarchy, from the CURRENT
   topology: the transformer, feeder, substation and region above it
   (or that it is). Used to say whether a record about an asset, such
   as an alarm, belongs to a scope.

   A power transformer sits in its substation and is on no feeder. An
   edge device is placed where the asset it is attached to is. An
   asset that is not in the registry has no place: it belongs to no
   scope, and is never placed by guessing from its name.
========================================================== */

export interface AssetPlace {
  organizationId: string | null;
  regionId: string | null;
  substationId: string | null;
  feederId: string | null;
  transformerId: string | null;
}

/** The records the topology index does not hold but an asset reference may point at. */
export interface PlacedRecords {
  powerTransformers: readonly PowerTransformer[];
  edgeDevices: readonly EdgeDevice[];
}

export function placeOfAsset(index: TopologyIndex, records: PlacedRecords, asset: AssetRef): AssetPlace | null {
  let regionId: string | null = null;
  let substationId: string | null = null;
  let feederId: string | null = null;
  let transformerId: string | null = null;

  switch (asset.kind) {
    case "edge_device": {
      const device = records.edgeDevices.find((candidate) => candidate.id === asset.id);
      // A device attached to another device would loop; such a record is simply not placed.
      return device === undefined || device.attachedTo.kind === "edge_device" ? null : placeOfAsset(index, records, device.attachedTo);
    }
    case "meter": {
      const meter = index.registry.meters.find((candidate) => candidate.id === asset.id);
      if (meter === undefined) return null;
      const at = meter.installation;
      const on: AssetRef =
        at.role === "service_point"
          ? { kind: "service_point", id: at.servicePointId }
          : at.role === "feeder_head"
            ? { kind: "feeder", id: at.feederId }
            : at.role === "dt_totalizer"
              ? { kind: "distribution_transformer", id: at.transformerId }
              : { kind: "substation", id: at.substationId };
      return placeOfAsset(index, records, on);
    }
    case "service_point": {
      const point = index.servicePointById.get(asset.id);
      if (point === undefined) return null;
      if (point.supply.kind === "feeder") feederId = point.supply.feederId;
      else transformerId = point.supply.transformerId;
      regionId = adminRegionOfServicePoint(index, point);
      break;
    }
    case "distribution_transformer":
      if (!index.transformerById.has(asset.id)) return null;
      transformerId = asset.id;
      break;
    case "feeder":
      if (!index.feederById.has(asset.id)) return null;
      feederId = asset.id;
      break;
    case "power_transformer": {
      const transformer = records.powerTransformers.find((candidate) => candidate.id === asset.id);
      if (transformer === undefined) return null;
      substationId = transformer.substationId;
      break;
    }
    case "substation":
      if (!index.substationById.has(asset.id)) return null;
      substationId = asset.id;
      break;
  }

  if (transformerId !== null) feederId = index.transformerById.get(transformerId)?.feederId ?? null;
  if (feederId !== null) substationId = index.feederById.get(feederId)?.origin.substationId ?? null;
  if (regionId === null && substationId !== null) regionId = index.substationById.get(substationId)?.adminRegionId ?? null;
  const organizationId = regionId === null ? null : (index.regionById.get(regionId)?.organizationId ?? null);
  return { organizationId, regionId, substationId, feederId, transformerId };
}

/** Whether a placed asset is the scope itself or sits under it. */
export function placeInScope(place: AssetPlace, scope: ScopeRef): boolean {
  switch (scope.kind) {
    case "organization":
      return place.organizationId === scope.id;
    case "region":
      return place.regionId === scope.id;
    case "substation":
      return place.substationId === scope.id;
    case "feeder":
      return place.feederId === scope.id;
    case "distribution_transformer":
      return place.transformerId === scope.id;
  }
}
