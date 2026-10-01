import type { RegistryCoverage } from "../ports/index.ts";
import type { DomainDataset } from "../memory/dataset.ts";
import type { LegacyData } from "./legacy.ts";
import type { MappingIssue, MappingReport } from "./issues.ts";
import { LEGACY_DATA, LEGACY_DATASETS } from "./legacy.ts";
import { mappingIssue } from "./issues.ts";
import { MOCK_DATA_SOURCES } from "./sources.ts";
import { mapRegistry } from "./mapRegistry.ts";
import { mapObservations } from "./mapObservations.ts";
import { mapEvents } from "./mapEvents.ts";
import { mapReported } from "./mapReported.ts";

/* ==========================================================
   MOCK ADAPTER — DATASET

   Maps the legacy mock data into one canonical DomainDataset.
   This is a pure function of its input: the same legacy data
   always gives the same dataset and the same mapping report, and
   the input is never modified. Nothing is corrected, invented or
   substituted; what could not be carried across is in the report.
========================================================== */

export interface MockDatasetBuild {
  dataset: DomainDataset;
  report: MappingReport;
}

/**
 * How complete the mock registry is. The mock is a demonstration
 * sample: it holds one substation of the twelve it reports for
 * Adamawa, one feeder of that substation's twelve, three of that
 * feeder's forty-seven transformers, and no customer accounts.
 */
const REGISTRY_COVERAGE: RegistryCoverage = {
  organizations: "complete",
  regions: "complete",
  substations: "partial",
  powerTransformers: "not_available",
  feeders: "partial",
  distributionTransformers: "partial",
  servicePoints: "partial",
  meters: "partial",
  customers: "not_available",
  edgeDevices: "partial",
};

const SAMPLE_DATASET: Partial<Record<keyof RegistryCoverage, string>> = {
  substations: LEGACY_DATASETS.substations,
  feeders: LEGACY_DATASETS.feeders,
  distributionTransformers: LEGACY_DATASETS.transformers,
  servicePoints: LEGACY_DATASETS.meters,
  meters: LEGACY_DATASETS.meters,
  edgeDevices: LEGACY_DATASETS.edgeDevices,
};

function sampleIssues(): MappingIssue[] {
  return (Object.keys(REGISTRY_COVERAGE) as (keyof RegistryCoverage)[])
    .filter((collection) => REGISTRY_COVERAGE[collection] === "partial")
    .map((collection) =>
      mappingIssue(
        "REGISTRY_SAMPLE_ONLY",
        `The registry holds only a sample of ${collection}; counts derived from it are not totals.`,
        { dataset: SAMPLE_DATASET[collection] ?? collection, field: collection },
      ),
    );
}

export function buildMockDataset(legacy: LegacyData = LEGACY_DATA): MockDatasetBuild {
  const registry = mapRegistry(legacy);
  const observations = mapObservations(legacy);
  const events = mapEvents(legacy);
  const reported = mapReported(legacy);

  return {
    dataset: {
      registry: registry.registry,
      registryCoverage: REGISTRY_COVERAGE,
      intervalEnergy: [],
      telemetry: observations.telemetry,
      heartbeats: observations.heartbeats,
      outages: events.outages,
      reportedKpis: reported.reportedKpis,
      dataSources: MOCK_DATA_SOURCES,
      completeness: {
        intervalEnergy: "not_available",
        telemetry: "partial",
        heartbeats: "partial",
        outages: "partial",
        reportedKpis: "partial",
      },
    },
    report: {
      issues: [
        ...registry.issues,
        ...sampleIssues(),
        ...observations.issues,
        ...events.issues,
        ...reported.issues,
      ],
    },
  };
}

let cached: MockDatasetBuild | null = null;

/** The mock dataset built from the legacy data, built once on first use. */
export function mockDataset(): MockDatasetBuild {
  cached ??= buildMockDataset();
  return cached;
}
