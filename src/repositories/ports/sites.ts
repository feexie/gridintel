import type { Customer, GenerationAsset, Meter, MinigridSite, Organization, ServicePoint } from "@/domain";
import type { AsOfQuery, Completeness } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — SITE REGISTRY

   Mini-grid sites with their generation and storage assets, their
   meters, and the connections and accounts they supply. Returned as
   a snapshot of records; which asset belongs to which site is read
   by the analytics site index, never here.

   A site's observations, charges, payments, interruptions and
   reported figures come through the same ports as any other
   organization's (observations, billing, events, reporting). Only
   the registry differs, because a site is under no substation.
========================================================== */

export interface SiteRegistrySnapshot {
  organizations: readonly Organization[];
  sites: readonly MinigridSite[];
  generationAssets: readonly GenerationAsset[];
  /** Connections supplied by a site: `supply.kind` is "site". */
  servicePoints: readonly ServicePoint[];
  /** Generation, storage, site-output and customer meters. */
  meters: readonly Meter[];
  customers: readonly Customer[];
}

export type SiteRegistryCoverage = Record<keyof SiteRegistrySnapshot, Completeness>;

export interface SiteSnapshotResult {
  snapshot: SiteRegistrySnapshot;
  /** "current_only": each record holds its current site. History is not modelled yet. */
  topologyBasis: "current_only";
  /** "not_available" throughout for a source that holds no sites: an empty list is then not "none". */
  coverage: SiteRegistryCoverage;
}

export interface SiteRepository {
  getSnapshot(query: AsOfQuery): Promise<SiteSnapshotResult>;
}
