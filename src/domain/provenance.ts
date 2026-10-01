import type { IsoTimestamp } from "./primitives";

/* ==========================================================
   GRIDINTEL DOMAIN — PROVENANCE

   Every value in GridIntel has one of three origins, and they are
   never stored in the same field:
   - observed: measurements, events and records from source systems,
     each carrying `Provenance` (and `DataQuality` where it applies);
   - reported: figures published by someone else (`ReportedKpi`);
   - calculated: produced by GridIntel analytics under a named,
     versioned methodology (not part of the stored domain).
========================================================== */

export type DataSourceKind =
  | "scada"
  | "smart_meter"
  | "edge_device"
  | "billing_system"
  | "manual_entry"
  | "spreadsheet_import"
  | "api"
  | "gis"
  /**
   * A deliberately designed, internally consistent demonstration dataset
   * that exercises the analytics engine. It describes no real network,
   * customer or transaction. Every result derived from it must say so.
   */
  | "synthetic";

/** A system or feed that records come from. */
export interface DataSource {
  id: string;
  name: string;
  kind: DataSourceKind;
  organizationId?: string;
  description?: string;
}

/**
 * Where a record came from and how it was obtained. Provenance travels
 * with the record (or batch); quality travels with each value.
 */
export interface Provenance {
  /** `DataSource.id` of the originating system. */
  sourceSystem: string;
  /** The record's own id in that system, when it has one. */
  sourceRecordId?: string;
  /** When GridIntel received the record (not when it was measured). */
  ingestedAt: IsoTimestamp;
  /**
   * How an estimated or substituted value was produced, or any
   * transformation applied on ingest (e.g. a polarity correction).
   */
  method?: string;
  /** Version of the methodology named in `method`, if it has one. */
  methodologyVersion?: string;
}

/**
 * Identifies one version of a calculation methodology. Methodologies are
 * versioned and never edited in place: a changed rule is a new version,
 * and every calculated value names the id and version that produced it.
 */
export interface MethodologyRef {
  id: string;
  version: string;
}
