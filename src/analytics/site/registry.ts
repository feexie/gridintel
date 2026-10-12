import type { Customer, GenerationAsset, GenerationAssetKind, Meter, MinigridSite, ScopeRef, ServicePoint } from "@/domain";

/* ==========================================================
   ANALYTICS — SITE INDEX (CURRENT ONLY)

   Resolves what belongs to a mini-grid site: its generation and
   storage assets, its meters by role, the connections it supplies
   and their accounts. A site is under no substation, so none of
   this goes through the network topology index.

   Only records with lifecycle "in_service" are counted. Nothing is
   inferred: an asset is never assumed to have a meter.
========================================================== */

export interface SiteRegistry {
  sites: readonly MinigridSite[];
  generationAssets: readonly GenerationAsset[];
  servicePoints: readonly ServicePoint[];
  meters: readonly Meter[];
  customers: readonly Customer[];
}

export interface SiteIndex {
  registry: SiteRegistry;
  siteById: ReadonlyMap<string, MinigridSite>;
  /** In-service assets by site, in id order. */
  assetsBySite: ReadonlyMap<string, readonly GenerationAsset[]>;
  /** In-service meters by "<role>:<id of what they are installed on>", in id order. */
  metersByInstallation: ReadonlyMap<string, readonly Meter[]>;
  /** In-service connections by the site that supplies them, in id order. */
  servicePointsBySite: ReadonlyMap<string, readonly ServicePoint[]>;
  /** Accounts by service point, whatever their status. */
  customersByServicePoint: ReadonlyMap<string, readonly Customer[]>;
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
  for (const list of groups.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return groups;
}

function installedOn(meter: Meter): string | null {
  const at = meter.installation;
  switch (at.role) {
    case "generation":
    case "storage":
      return `${at.role}:${at.assetId}`;
    case "site_output":
      return `${at.role}:${at.siteId}`;
    case "service_point":
      return `${at.role}:${at.servicePointId}`;
    default:
      // A network boundary meter is not a site's.
      return null;
  }
}

export function buildSiteIndex(registry: SiteRegistry): SiteIndex {
  const inService = <T extends { lifecycle: string }>(record: T) => record.lifecycle === "in_service";
  return {
    registry,
    siteById: new Map(registry.sites.map((site) => [site.id, site])),
    assetsBySite: group(registry.generationAssets, (asset) => (inService(asset) ? asset.siteId : null)),
    metersByInstallation: group(registry.meters, (meter) => (inService(meter) ? installedOn(meter) : null)),
    servicePointsBySite: group(registry.servicePoints, (sp) => (inService(sp) && sp.supply.kind === "site" ? sp.supply.siteId : null)),
    customersByServicePoint: group(registry.customers, (customer) => customer.servicePointId ?? null),
  };
}

export function siteScope(siteId: string): ScopeRef {
  return { kind: "site", id: siteId };
}

/** The site's in-service assets of one kind, in id order. */
export function siteAssets<K extends GenerationAssetKind>(index: SiteIndex, siteId: string, kind: K): Extract<GenerationAsset, { kind: K }>[] {
  return (index.assetsBySite.get(siteId) ?? []).filter((asset): asset is Extract<GenerationAsset, { kind: K }> => asset.kind === kind);
}

/** In-service meters installed with `role` on an asset, a site or a service point. */
export function siteMeters(index: SiteIndex, role: "generation" | "storage" | "site_output" | "service_point", installedOnId: string): Meter[] {
  return [...(index.metersByInstallation.get(`${role}:${installedOnId}`) ?? [])];
}

export function siteServicePoints(index: SiteIndex, siteId: string): ServicePoint[] {
  return [...(index.servicePointsBySite.get(siteId) ?? [])];
}

/** Every account at a connection the site supplies, whatever its status, in id order. */
export function siteCustomers(index: SiteIndex, siteId: string): Customer[] {
  return siteServicePoints(index, siteId)
    .flatMap((sp) => index.customersByServicePoint.get(sp.id) ?? [])
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
