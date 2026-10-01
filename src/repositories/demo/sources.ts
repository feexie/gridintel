import type { DataSource, Provenance } from "@/domain";
import { DEMO_CLOCK } from "./clock.ts";

/* ==========================================================
   DEMO ADAPTER — DATA SOURCES

   Every source is of kind "synthetic". Each stands in for the kind
   of system a utility would hold such records in; none of them is a
   real system and none of the records describes a real asset,
   customer or transaction.
========================================================== */

export const DEMO_ORGANIZATION_ID = "demo-disco";

function source(id: string, name: string, description: string): DataSource {
  return { id, name, kind: "synthetic", organizationId: DEMO_ORGANIZATION_ID, description };
}

export const REGISTRY_SOURCE = source(
  "synthetic-registry",
  "Synthetic asset registry",
  "Stands in for an asset register and GIS: organizations, network assets, service points, meters, accounts.",
);
export const METERING_SOURCE = source(
  "synthetic-metering",
  "Synthetic meter data",
  "Stands in for a meter data management system: hourly interval energy for boundary and customer meters.",
);
export const SCADA_SOURCE = source(
  "synthetic-scada",
  "Synthetic telemetry",
  "Stands in for SCADA and transformer monitors: hourly power readings and device heartbeats.",
);
export const OUTAGE_SOURCE = source(
  "synthetic-outages",
  "Synthetic outage log",
  "Stands in for an outage management system: interruptions with per-transformer restoration times.",
);
export const BILLING_SOURCE = source(
  "synthetic-billing",
  "Synthetic billing and vending",
  "Stands in for a billing system and a prepaid vending system: bills, vends and payments.",
);
export const REPORT_SOURCE = source(
  "synthetic-reports",
  "Synthetic utility reports",
  "Stands in for the utility's own monthly report and its technical-loss study.",
);

export const DEMO_DATA_SOURCES: readonly DataSource[] = [
  REGISTRY_SOURCE,
  METERING_SOURCE,
  SCADA_SOURCE,
  OUTAGE_SOURCE,
  BILLING_SOURCE,
  REPORT_SOURCE,
];

const SHARED = new Map<string, Provenance>();

/** Provenance for a record from `dataSource`. Records without their own id or method share one object. */
export function demoProvenance(dataSource: DataSource, sourceRecordId?: string, method?: string): Provenance {
  if (sourceRecordId === undefined && method === undefined) {
    let shared = SHARED.get(dataSource.id);
    if (shared === undefined) {
      shared = { sourceSystem: dataSource.id, ingestedAt: DEMO_CLOCK };
      SHARED.set(dataSource.id, shared);
    }
    return shared;
  }
  return {
    sourceSystem: dataSource.id,
    ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
    ingestedAt: DEMO_CLOCK,
    ...(method === undefined ? {} : { method }),
  };
}
