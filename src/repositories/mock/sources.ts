import type { DataSource, IsoTimestamp, Provenance } from "@/domain";
import type { MappingIssue } from "./issues.ts";
import { mappingIssue } from "./issues.ts";

/* ==========================================================
   MOCK ADAPTER — DATA SOURCES AND SOURCE CONVENTIONS
========================================================== */

/** The demonstration organization that owns the mock regions (Phase 4 decision D1). Not YEDC. */
export const MOCK_ORGANIZATION_ID = "mock-utility";

/**
 * `Provenance.ingestedAt` for every mock record (D6): the latest
 * timestamp that appears anywhere in the legacy mock data.
 */
export const MOCK_INGESTED_AT: IsoTimestamp = "2026-07-12T09:45:00Z";

export const OPERATIONS_SOURCE: DataSource = {
  id: "mock-operations",
  name: "GridIntel mock operations dataset",
  kind: "mock",
  organizationId: MOCK_ORGANIZATION_ID,
  description: "Demonstration data behind the utility operations center (regions, assets, meters, edge devices).",
};

export const EXECUTIVE_SOURCE: DataSource = {
  id: "mock-executive",
  name: "GridIntel mock executive dataset",
  kind: "mock",
  organizationId: MOCK_ORGANIZATION_ID,
  description: "Demonstration data behind the executive dashboard (regional figures and operational events).",
};

export const MOCK_DATA_SOURCES: readonly DataSource[] = [OPERATIONS_SOURCE, EXECUTIVE_SOURCE];

export function mockProvenance(source: DataSource, sourceRecordId?: string, method?: string): Provenance {
  return {
    sourceSystem: source.id,
    ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
    ingestedAt: MOCK_INGESTED_AT,
    ...(method === undefined ? {} : { method }),
  };
}

const EXPLICIT_ZONE = /(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** True for an ISO 8601 timestamp with an explicit zone that parses. */
export function isZonedTimestamp(value: string): boolean {
  return EXPLICIT_ZONE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * An audit time (createdAt / updatedAt). A date-only value becomes
 * midnight UTC with an ASSUMED_VALUE issue (D5). Any other value that
 * is not a zoned timestamp is kept as written, with an
 * UNPARSEABLE_TIME warning; audit times are never used by analytics.
 */
export function auditTimestamp(
  value: string,
  source: MappingIssue["source"],
  issues: MappingIssue[],
): IsoTimestamp {
  if (isZonedTimestamp(value)) return value;
  if (DATE_ONLY.test(value) && !Number.isNaN(Date.parse(value))) {
    issues.push(
      mappingIssue("ASSUMED_VALUE", `Date-only audit time "${value}" taken as midnight UTC.`, source),
    );
    return `${value}T00:00:00Z`;
  }
  issues.push(mappingIssue("UNPARSEABLE_TIME", `Audit time "${value}" is not a zoned timestamp; kept as written.`, source));
  return value;
}
