import type { EntityLocation, LocatedRef, PowerTransformer } from "@/domain";
import type { Registry } from "../topology/registry.ts";
import { isUsableGeometry } from "./geometry.ts";

/* ==========================================================
   ANALYTICS — WHERE THE NETWORK'S ASSETS ARE

   The registry holds a location on the asset it belongs to. This
   reads those fields into the one shape every located entity has
   (`EntityLocation`), so that nothing above it needs to know which
   field of which record a location came from.

   Nothing is placed by guessing. An asset with no location, or with
   one that cannot be drawn, is returned as not located, with the
   reason, and is never dropped silently. A power transformer has no
   location of its own and takes its substation's, marked inherited.

   Only in-service assets are read, as everywhere in the topology.
========================================================== */

export interface NotLocated {
  entity: LocatedRef;
  reason: "no_location_recorded" | "location_not_usable" | "parent_not_located";
}

export interface RegistryLocations {
  located: EntityLocation[];
  notLocated: NotLocated[];
}

export function registryLocations(registry: Registry & { powerTransformers: readonly PowerTransformer[] }): RegistryLocations {
  const located: EntityLocation[] = [];
  const notLocated: NotLocated[] = [];
  const add = (location: EntityLocation) => {
    if (isUsableGeometry(location.geometry)) located.push(location);
    else notLocated.push({ entity: location.entity, reason: "location_not_usable" });
  };
  const inService = <T extends { lifecycle: string }>(records: readonly T[]) => records.filter((record) => record.lifecycle === "in_service");

  const substationAt = new Map<string, EntityLocation>();
  for (const substation of inService(registry.substations)) {
    const entity = { kind: "substation", id: substation.id };
    if (substation.location === undefined) {
      notLocated.push({ entity, reason: "no_location_recorded" });
      continue;
    }
    const location: EntityLocation = {
      entity,
      geometry: { type: "point", point: substation.location },
      basis: substation.locationBasis ?? "unspecified",
      provenance: substation.provenance,
    };
    add(location);
    if (isUsableGeometry(location.geometry)) substationAt.set(substation.id, location);
  }

  for (const transformer of inService(registry.powerTransformers)) {
    const entity = { kind: "power_transformer", id: transformer.id };
    const parent = substationAt.get(transformer.substationId);
    if (parent === undefined) notLocated.push({ entity, reason: "parent_not_located" });
    else located.push({ entity, geometry: parent.geometry, basis: "inherited", inheritedFrom: parent.entity, provenance: parent.provenance });
  }

  for (const feeder of inService(registry.feeders)) {
    const entity = { kind: "feeder", id: feeder.id };
    if (feeder.route === undefined) notLocated.push({ entity, reason: "no_location_recorded" });
    else add({ entity, geometry: { type: "line", path: feeder.route }, basis: feeder.routeBasis ?? "unspecified", provenance: feeder.provenance });
  }

  for (const transformer of inService(registry.distributionTransformers)) {
    const entity = { kind: "distribution_transformer", id: transformer.id };
    if (transformer.location === undefined) notLocated.push({ entity, reason: "no_location_recorded" });
    else add({ entity, geometry: { type: "point", point: transformer.location }, basis: transformer.locationBasis ?? "unspecified", provenance: transformer.provenance });
  }

  for (const point of inService(registry.servicePoints)) {
    const entity = { kind: "service_point", id: point.id };
    if (point.location === undefined) notLocated.push({ entity, reason: "no_location_recorded" });
    else add({ entity, geometry: { type: "point", point: point.location }, basis: point.locationBasis ?? "unspecified", provenance: point.provenance });
  }

  return { located, notLocated };
}
