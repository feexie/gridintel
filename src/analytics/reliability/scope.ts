import type { AssetRef, EntityRef, Outage, ScopeRef } from "@/domain";
import type { Warning } from "../core/result.ts";
import type { TopologyIndex } from "../topology/registry.ts";
import { TOPOLOGY_CURRENT_ONLY, adminRegionOfServicePoint } from "../topology/registry.ts";

/* ==========================================================
   ANALYTICS — OUTAGES ATTRIBUTABLE TO A SCOPE

   Selects the outage exposures that belong to a scope: those whose
   affected element IS the scope or lies under it.

   An exposure on an element ABOVE the scope (the feeder that
   supplies the transformer being reported on) did interrupt the
   scope's customers, but its customer count is for the larger
   element and cannot be apportioned. Such exposures are returned as
   unattributable, with a warning, never dropped silently and never
   scaled by a guess. Exposures on unresolved names are treated the
   same way.
========================================================== */

export interface UnattributableExposure {
  outageId: string;
  exposureIndex: number;
  reason: "ABOVE_SCOPE" | "UNRESOLVED_REFERENCE" | "UNSUPPORTED_ELEMENT";
}

export interface ScopedOutages {
  /** Outages reduced to the exposures inside the scope. */
  outages: Outage[];
  unattributable: UnattributableExposure[];
  warnings: Warning[];
}

interface Position {
  servicePointId?: string;
  transformerId?: string;
  feederId?: string;
  substationId?: string;
  regionId: string | null;
}

function feederPosition(index: TopologyIndex, feederId: string): Position | null {
  const feeder = index.feederById.get(feederId);
  if (!feeder) return null;
  const substation = index.substationById.get(feeder.origin.substationId);
  return {
    feederId,
    substationId: feeder.origin.substationId,
    regionId: feeder.adminRegionId ?? substation?.adminRegionId ?? null,
  };
}

function transformerPosition(index: TopologyIndex, transformerId: string): Position | null {
  const dt = index.transformerById.get(transformerId);
  if (!dt) return null;
  const feeder = feederPosition(index, dt.feederId);
  return {
    transformerId,
    feederId: dt.feederId,
    substationId: feeder?.substationId,
    regionId: dt.adminRegionId ?? feeder?.regionId ?? null,
  };
}

/** Where an affected element sits in the current topology; null if it is not in the registry. */
function position(index: TopologyIndex, asset: AssetRef): Position | null | "unsupported" {
  switch (asset.kind) {
    case "substation": {
      const substation = index.substationById.get(asset.id);
      return substation ? { substationId: asset.id, regionId: substation.adminRegionId ?? null } : null;
    }
    case "feeder":
      return feederPosition(index, asset.id);
    case "distribution_transformer":
      return transformerPosition(index, asset.id);
    case "service_point": {
      const sp = index.servicePointById.get(asset.id);
      if (!sp) return null;
      const parent =
        sp.supply.kind === "feeder"
          ? feederPosition(index, sp.supply.feederId)
          : transformerPosition(index, sp.supply.transformerId);
      return { ...(parent ?? { regionId: null }), servicePointId: asset.id, regionId: adminRegionOfServicePoint(index, sp) };
    }
    default:
      return "unsupported";
  }
}

type Relation = "inside" | "above" | "outside";

function relation(index: TopologyIndex, scope: ScopeRef, affected: AssetRef, at: Position): Relation {
  switch (scope.kind) {
    case "distribution_transformer": {
      if (at.transformerId === scope.id) return "inside";
      const own = transformerPosition(index, scope.id);
      if (own === null) return "outside";
      if (affected.kind === "feeder" && affected.id === own.feederId) return "above";
      if (affected.kind === "substation" && affected.id === own.substationId) return "above";
      return "outside";
    }
    case "feeder": {
      if (at.feederId === scope.id) return "inside";
      const own = feederPosition(index, scope.id);
      if (own !== null && affected.kind === "substation" && affected.id === own.substationId) return "above";
      return "outside";
    }
    case "substation":
      return at.substationId === scope.id ? "inside" : "outside";
    case "region":
      return at.regionId === scope.id ? "inside" : "outside";
    case "organization": {
      const region = at.regionId === null ? undefined : index.regionById.get(at.regionId);
      return region?.organizationId === scope.id ? "inside" : "outside";
    }
  }
}

function isResolved(ref: EntityRef): ref is AssetRef {
  return "id" in ref;
}

export function outagesForScope(index: TopologyIndex, scope: ScopeRef, outages: readonly Outage[]): ScopedOutages {
  const unattributable: UnattributableExposure[] = [];
  const selected: Outage[] = [];

  for (const outage of outages) {
    const exposures = outage.exposures.filter((exposure, exposureIndex) => {
      if (!isResolved(exposure.affected)) {
        unattributable.push({ outageId: outage.id, exposureIndex, reason: "UNRESOLVED_REFERENCE" });
        return false;
      }
      const at = position(index, exposure.affected);
      if (at === null) return false;
      if (at === "unsupported") {
        unattributable.push({ outageId: outage.id, exposureIndex, reason: "UNSUPPORTED_ELEMENT" });
        return false;
      }
      const where = relation(index, scope, exposure.affected, at);
      if (where === "above") unattributable.push({ outageId: outage.id, exposureIndex, reason: "ABOVE_SCOPE" });
      return where === "inside";
    });
    if (exposures.length > 0) selected.push({ ...outage, exposures });
  }

  const warnings: Warning[] = [TOPOLOGY_CURRENT_ONLY];
  if (unattributable.length > 0) {
    warnings.push({
      code: "EXPOSURES_NOT_ATTRIBUTABLE",
      message:
        `${unattributable.length} exposure(s) could not be attributed to ${scope.kind} "${scope.id}": they are ` +
        "recorded on an element above the scope, on an unresolved name, or on an element kind that is not " +
        "placed in the topology. They are not in the indices, which may therefore be understated.",
      ref: scope.id,
    });
  }
  return { outages: selected, unattributable, warnings };
}
