import type { DataSource, Outage, Provenance, ReportedKpi } from "@/domain";
import type { DomainDataset } from "../../../repositories/memory/dataset.ts";
import type { GridIntelRepositories } from "../../../repositories/ports/index.ts";
import { buildRegistry } from "../../../analytics/__fixtures__/network.ts";
import { createInMemoryRepositories } from "../../../repositories/memory/inMemoryRepositories.ts";

/* ==========================================================
   TEST FIXTURE — A SPARSE SOURCE

   What a utility looks like when all it can give is an asset list
   and a few spreadsheet figures: the Phase 3 test network with no
   meters, no customer accounts, no interval energy, no telemetry
   and no billing records; two outages nobody timed; and reported
   figures that state neither a period nor a basis.

   It exists to show that the services return "insufficient data"
   on such a source, never a number made from nothing.
========================================================== */

export const SPARSE_PERIOD = { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" };
export const SPARSE_AS_OF = "2026-07-12T09:45:00Z";

const OPERATIONS: DataSource = { id: "sparse-operations", name: "Operations spreadsheet", kind: "spreadsheet_import" };
const EXECUTIVE: DataSource = { id: "sparse-executive", name: "Executive spreadsheet", kind: "spreadsheet_import" };

function provenance(source: DataSource): Provenance {
  return { sourceSystem: source.id, ingestedAt: SPARSE_AS_OF };
}

const AUDIT = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

function reported(
  source: DataSource,
  scope: ReportedKpi["scope"],
  metric: ReportedKpi["metric"],
  value: number,
  unit: ReportedKpi["unit"],
): ReportedKpi {
  const scopeId = "id" in scope ? scope.id : scope.label;
  return {
    id: `rk:${source.id}:${scope.kind}:${scopeId}:${metric}`,
    metric,
    scope,
    period: null,
    asOf: null,
    value,
    unit,
    ...(unit === "currency" ? { currency: "NGN" } : {}),
    source: { name: source.name, kind: "utility" },
    document: null,
    basis: null,
    methodology: null,
    reportedAt: null,
    provenance: provenance(source),
  };
}

function undatedOutage(id: string): Outage {
  return {
    id,
    origin: { kind: "feeder", label: "Region 1 / Feeder 4" },
    planned: null,
    cause: "unknown",
    responsibleParty: "unknown",
    exposures: [
      { affected: { kind: "feeder", label: "Region 1 / Feeder 4" }, customersAffected: 1200, customerCountBasis: "recorded", quality: "measured" },
    ],
    provenance: provenance(EXECUTIVE),
  };
}

const region = (id: string) => ({ kind: "region" as const, id });

export function sparseDataset(): DomainDataset {
  const registry = buildRegistry();
  const own = provenance(OPERATIONS);
  const tag = <T extends { provenance: Provenance }>(records: readonly T[]): T[] => records.map((record) => ({ ...record, provenance: own }));
  return {
    registry: {
      organizations: [
        { ...AUDIT, id: "ORG-1", name: "Sparse Utility", kind: "distribution_utility", currency: "NGN", provenance: own },
      ],
      regions: tag(registry.regions),
      substations: tag(registry.substations),
      powerTransformers: [],
      feeders: tag(registry.feeders),
      distributionTransformers: tag(registry.distributionTransformers),
      servicePoints: tag(registry.servicePoints),
      meters: [],
      customers: [],
      edgeDevices: [],
    },
    registryCoverage: {
      organizations: "complete",
      regions: "complete",
      substations: "partial",
      powerTransformers: "not_available",
      feeders: "partial",
      distributionTransformers: "partial",
      servicePoints: "partial",
      meters: "not_available",
      customers: "not_available",
      edgeDevices: "not_available",
    },
    intervalEnergy: [],
    telemetry: [],
    heartbeats: [],
    outages: [undatedOutage("O-1"), undatedOutage("O-2")],
    reportedKpis: [
      reported(OPERATIONS, region("R-1"), "collection_efficiency", 91.8, "percent"),
      reported(EXECUTIVE, region("R-1"), "revenue_billed", 820_000_000, "currency"),
      reported(EXECUTIVE, region("R-1"), "revenue_collected", 710_000_000, "currency"),
      reported(EXECUTIVE, region("R-1"), "collection_efficiency", 86.6, "percent"),
      reported(EXECUTIVE, region("R-2"), "revenue_billed", 500_000_000, "currency"),
      reported(EXECUTIVE, region("R-2"), "revenue_collected", 400_000_000, "currency"),
      reported(EXECUTIVE, region("R-3"), "revenue_billed", 300_000_000, "currency"),
      reported(OPERATIONS, { kind: "distribution_transformer", id: "DT-1" }, "transformer_loading", 68, "percent"),
    ],
    billingRecords: [],
    payments: [],
    dataSources: [OPERATIONS, EXECUTIVE],
    completeness: {
      intervalEnergy: "not_available",
      telemetry: "partial",
      heartbeats: "not_available",
      outages: "partial",
      reportedKpis: "partial",
      billing: "not_available",
    },
  };
}

export function sparseRepositories(): GridIntelRepositories {
  return createInMemoryRepositories(sparseDataset());
}
