import type {
  DataSource,
  ReferenceCaveat,
  ReferenceClaim,
  ReferenceCustomer,
  ReferenceMeterDay,
  ReferenceOutage,
  ReferencePayment,
  ReferenceReportedIndices,
  ReferenceSite,
  ReferenceSiteDay,
  ReferenceTariffEvent,
} from "@/domain";

/* ==========================================================
   REPOSITORY PORTS — REFERENCE SITES

   Real mini-grids whose records someone else has published
   (docs/design/MG-PLAN.md). The sites are a LIST: a second dataset
   is a second adapter, with no change here or in any method.

   Retrieval only, as published: no totals, no shares, no "latest".
   A site that is not held gives null; a kind of record the dataset
   does not hold gives an empty list, and the dataset's own coverage
   (its caveats) says what is missing.
========================================================== */

export interface ReferenceSiteRecords {
  site: ReferenceSite;
  /** The published dataset, with its licence and the credit it requires. */
  source: DataSource;
  days: readonly ReferenceSiteDay[];
  meterDays: readonly ReferenceMeterDay[];
  customers: readonly ReferenceCustomer[];
  payments: readonly ReferencePayment[];
  outages: readonly ReferenceOutage[];
  reportedIndices: readonly ReferenceReportedIndices[];
  tariffEvents: readonly ReferenceTariffEvent[];
  caveats: readonly ReferenceCaveat[];
  claims: readonly ReferenceClaim[];
}

/** Which reference site is held and the dataset it comes from, known without reading the records. */
export interface ReferenceCatalogueEntry {
  siteId: string;
  source: DataSource;
  /** The first and last day of the site's daily records, as the publisher states them. */
  covers: { start: string; end: string };
}

export interface ReferenceSiteRepository {
  /** Every site held and its dataset, without reading the published files. */
  catalogue(): Promise<readonly ReferenceCatalogueEntry[]>;
  /** Every reference site held, by id. */
  sites(): Promise<readonly ReferenceSite[]>;
  /** The datasets the sites come from. */
  sources(): Promise<readonly DataSource[]>;
  /** One site's records in full; null for a site that is not held. */
  records(siteId: string): Promise<ReferenceSiteRecords | null>;
}
