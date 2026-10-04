import type {
  Customer,
  DistributionTransformer,
  Feeder,
  Meter,
  MeterInstallation,
  Region,
  ScopeRef,
  ServicePoint,
  Substation,
} from "@/domain";
import type { InputValue, Warning } from "../core/result.ts";

/* ==========================================================
   ANALYTICS — MINIMAL TOPOLOGY (CURRENT ONLY)

   Resolves which records sit under a scope, using the CURRENT
   parent fields on each record. Topology history is not modelled
   yet, so every result carries a TOPOLOGY_CURRENT_ONLY warning:
   a historical period is resolved against today's topology.

   Only records with lifecycle "in_service" (and customer accounts
   with status "active") are counted. Nothing is inferred: an
   asset is never assumed to have a meter.
========================================================== */

export interface Registry {
  regions: readonly Region[];
  substations: readonly Substation[];
  feeders: readonly Feeder[];
  distributionTransformers: readonly DistributionTransformer[];
  servicePoints: readonly ServicePoint[];
  meters: readonly Meter[];
  customers: readonly Customer[];
}

export type MeterRole = MeterInstallation["role"];

export interface TopologyIndex {
  registry: Registry;
  regionById: ReadonlyMap<string, Region>;
  substationById: ReadonlyMap<string, Substation>;
  feederById: ReadonlyMap<string, Feeder>;
  transformerById: ReadonlyMap<string, DistributionTransformer>;
  servicePointById: ReadonlyMap<string, ServicePoint>;
  /** In-service meters by "<role>:<asset id>", each list in id order. */
  metersByInstallation: ReadonlyMap<string, readonly Meter[]>;
  /** In-service service points by the transformer that supplies them, each list in id order. */
  servicePointsByTransformer: ReadonlyMap<string, readonly ServicePoint[]>;
  /** In-service service points supplied directly by a feeder, each list in id order. */
  servicePointsByFeeder: ReadonlyMap<string, readonly ServicePoint[]>;
}

function installedOn(installation: MeterInstallation): string {
  switch (installation.role) {
    case "service_point":
      return installation.servicePointId;
    case "feeder_head":
      return installation.feederId;
    case "dt_totalizer":
      return installation.transformerId;
    case "substation_incomer":
    case "grid_interface":
      return installation.substationId;
  }
}

function group<T extends { id: string }>(records: readonly T[], key: (record: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const k = key(record);
    if (k === null) continue;
    const list = groups.get(k);
    if (list === undefined) groups.set(k, [record]);
    else list.push(record);
  }
  for (const list of groups.values()) sortById(list);
  return groups;
}

export const TOPOLOGY_CURRENT_ONLY: Warning = {
  code: "TOPOLOGY_CURRENT_ONLY",
  message:
    "Resolved against the current registry topology; historical changes to parents are not reflected.",
};

function byId<T extends { id: string }>(records: readonly T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]));
}

function sortById<T extends { id: string }>(records: T[]): T[] {
  return records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function buildTopologyIndex(registry: Registry): TopologyIndex {
  return {
    registry,
    regionById: byId(registry.regions),
    substationById: byId(registry.substations),
    feederById: byId(registry.feeders),
    transformerById: byId(registry.distributionTransformers),
    servicePointById: byId(registry.servicePoints),
    metersByInstallation: group(registry.meters, (meter) =>
      meter.lifecycle === "in_service" ? `${meter.installation.role}:${installedOn(meter.installation)}` : null,
    ),
    servicePointsByTransformer: group(registry.servicePoints, (sp) =>
      sp.lifecycle === "in_service" && sp.supply.kind === "distribution_transformer" ? sp.supply.transformerId : null,
    ),
    servicePointsByFeeder: group(registry.servicePoints, (sp) =>
      sp.lifecycle === "in_service" && sp.supply.kind === "feeder" ? sp.supply.feederId : null,
    ),
  };
}

/* ==========================================================
   ELECTRICAL CHILDREN
========================================================== */

export function feedersOfSubstation(index: TopologyIndex, substationId: string): Feeder[] {
  return sortById(
    index.registry.feeders.filter(
      (feeder) => feeder.lifecycle === "in_service" && feeder.origin.substationId === substationId,
    ),
  );
}

export function transformersOnFeeder(
  index: TopologyIndex,
  feederId: string,
): DistributionTransformer[] {
  return sortById(
    index.registry.distributionTransformers.filter(
      (dt) => dt.lifecycle === "in_service" && dt.feederId === feederId,
    ),
  );
}

/** Service points supplied directly by a DT. */
export function servicePointsOnTransformer(index: TopologyIndex, transformerId: string): ServicePoint[] {
  return [...(index.servicePointsByTransformer.get(transformerId) ?? [])];
}

/** Service points supplied directly by a feeder (not through a DT), e.g. MV customers. */
export function servicePointsDirectOnFeeder(index: TopologyIndex, feederId: string): ServicePoint[] {
  return [...(index.servicePointsByFeeder.get(feederId) ?? [])];
}

/** True if any substation lists this feeder as an upstream supply. */
export function feederSuppliesSubstation(index: TopologyIndex, feederId: string): boolean {
  return index.registry.substations.some((ss) => (ss.supplyFeederIds ?? []).includes(feederId));
}

/* ==========================================================
   ADMINISTRATIVE REGION
========================================================== */

function feederRegion(index: TopologyIndex, feeder: Feeder): string | null {
  if (feeder.adminRegionId) return feeder.adminRegionId;
  return index.substationById.get(feeder.origin.substationId)?.adminRegionId ?? null;
}

/**
 * A service point's admin region: its own `adminRegionId`, otherwise
 * the region of its electrical parent, walking up the current topology.
 */
export function adminRegionOfServicePoint(index: TopologyIndex, sp: ServicePoint): string | null {
  if (sp.adminRegionId) return sp.adminRegionId;
  if (sp.supply.kind === "feeder") {
    const feeder = index.feederById.get(sp.supply.feederId);
    return feeder ? feederRegion(index, feeder) : null;
  }
  const dt = index.transformerById.get(sp.supply.transformerId);
  if (!dt) return null;
  if (dt.adminRegionId) return dt.adminRegionId;
  const feeder = index.feederById.get(dt.feederId);
  return feeder ? feederRegion(index, feeder) : null;
}

/* ==========================================================
   SCOPE RESOLUTION
========================================================== */

export interface ScopeResolution<T> {
  /** null when the scope could not be resolved. */
  value: T | null;
  warnings: Warning[];
}

function scopeExists(index: TopologyIndex, scope: ScopeRef): boolean {
  switch (scope.kind) {
    case "organization":
      return index.registry.regions.some((region) => region.organizationId === scope.id);
    case "region":
      return index.regionById.has(scope.id);
    case "substation":
      return index.substationById.has(scope.id);
    case "feeder":
      return index.feederById.has(scope.id);
    case "distribution_transformer":
      return index.transformerById.has(scope.id);
  }
}

/** All in-service service points electrically or administratively under a scope. */
export function servicePointsUnder(
  index: TopologyIndex,
  scope: ScopeRef,
): ScopeResolution<ServicePoint[]> {
  if (!scopeExists(index, scope)) {
    return {
      value: null,
      warnings: [
        {
          code: "SCOPE_NOT_FOUND",
          message: `No ${scope.kind} "${scope.id}" in the registry.`,
          ref: scope.id,
        },
      ],
    };
  }

  let points: ServicePoint[];
  switch (scope.kind) {
    case "distribution_transformer":
      points = servicePointsOnTransformer(index, scope.id);
      break;
    case "feeder":
      points = [
        ...transformersOnFeeder(index, scope.id).flatMap((dt) =>
          servicePointsOnTransformer(index, dt.id),
        ),
        ...servicePointsDirectOnFeeder(index, scope.id),
      ];
      break;
    case "substation":
      points = feedersOfSubstation(index, scope.id).flatMap(
        (feeder) => servicePointsUnder(index, { kind: "feeder", id: feeder.id }).value ?? [],
      );
      break;
    case "region":
      points = index.registry.servicePoints.filter(
        (sp) => sp.lifecycle === "in_service" && adminRegionOfServicePoint(index, sp) === scope.id,
      );
      break;
    case "organization": {
      const regionIds = new Set(
        index.registry.regions
          .filter((region) => region.organizationId === scope.id)
          .map((region) => region.id),
      );
      points = index.registry.servicePoints.filter((sp) => {
        if (sp.lifecycle !== "in_service") return false;
        const region = adminRegionOfServicePoint(index, sp);
        return region !== null && regionIds.has(region);
      });
      break;
    }
  }

  return { value: sortById([...points]), warnings: [TOPOLOGY_CURRENT_ONLY] };
}

/** In-service meters installed with `role` on the given asset. */
export function metersWithRole(index: TopologyIndex, role: MeterRole, assetId: string): Meter[] {
  return [...(index.metersByInstallation.get(`${role}:${assetId}`) ?? [])];
}

/**
 * The number of active customer accounts connected under a scope, as a
 * calculation input. Its origin is "calculated" (from the registry),
 * and it inherits the TOPOLOGY_CURRENT_ONLY limitation.
 */
export function customersServed(
  index: TopologyIndex,
  scope: ScopeRef,
): { input: InputValue; warnings: Warning[] } {
  const points = servicePointsUnder(index, scope);
  const ref = `registry:customers_under:${scope.kind}:${scope.id}`;
  if (points.value === null) {
    return {
      input: { value: null, unit: "count", origin: "calculated", quality: "missing", ref },
      warnings: points.warnings,
    };
  }
  const pointIds = new Set(points.value.map((sp) => sp.id));
  const count = index.registry.customers.filter(
    (customer) =>
      customer.accountStatus === "active" &&
      customer.servicePointId !== undefined &&
      pointIds.has(customer.servicePointId),
  ).length;
  return {
    input: { value: count, unit: "count", origin: "calculated", quality: "measured", ref },
    warnings: points.warnings,
  };
}
