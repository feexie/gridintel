import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Provenance } from "@/domain";
import type { MappingIssueCode } from "./issues.ts";
import { DEFAULT_SEVERITY } from "./issues.ts";
import { LEGACY_DATA } from "./legacy.ts";
import { MOCK_INGESTED_AT } from "./sources.ts";
import { buildMockDataset, mockDataset } from "./buildMockDataset.ts";
import { createMockRepositories } from "./index.ts";

const { dataset, report } = buildMockDataset();
const { registry } = dataset;

function allProvenance(): Provenance[] {
  return [
    ...registry.organizations,
    ...registry.regions,
    ...registry.substations,
    ...registry.feeders,
    ...registry.distributionTransformers,
    ...registry.servicePoints,
    ...registry.meters,
    ...registry.edgeDevices,
    ...dataset.telemetry,
    ...dataset.heartbeats,
    ...dataset.outages,
    ...dataset.reportedKpis,
  ].map((record) => record.provenance);
}

describe("mock dataset: determinism", () => {
  it("builds the same dataset and report every time", () => {
    assert.deepEqual(buildMockDataset(), buildMockDataset());
  });

  it("builds once and reuses the result", () => {
    assert.equal(mockDataset(), mockDataset());
  });

  it("does not modify the legacy data", () => {
    const before = JSON.stringify(LEGACY_DATA);
    buildMockDataset();
    assert.equal(JSON.stringify(LEGACY_DATA), before);
  });
});

describe("mock dataset: provenance", () => {
  it("gives every record provenance from a listed mock data source", () => {
    const sourceIds = new Set(dataset.dataSources.map((source) => source.id));
    assert.ok(dataset.dataSources.every((source) => source.kind === "mock"));
    for (const provenance of allProvenance()) {
      assert.ok(sourceIds.has(provenance.sourceSystem), provenance.sourceSystem);
      assert.equal(provenance.ingestedAt, MOCK_INGESTED_AT);
    }
  });

  it("marks every reported figure as GridIntel mock data", () => {
    assert.ok(dataset.reportedKpis.every((kpi) => kpi.source.kind === "gridintel_mock" && kpi.period === null));
  });
});

describe("mock dataset: references", () => {
  it("has no dangling references", () => {
    const ids = (records: readonly { id: string }[]) => new Set(records.map((record) => record.id));
    const orgs = ids(registry.organizations);
    const regions = ids(registry.regions);
    const substations = ids(registry.substations);
    const feeders = ids(registry.feeders);
    const dts = ids(registry.distributionTransformers);
    const sps = ids(registry.servicePoints);
    const assets: Record<string, Set<string>> = {
      substation: substations,
      feeder: feeders,
      distribution_transformer: dts,
      service_point: sps,
      meter: ids(registry.meters),
      edge_device: ids(registry.edgeDevices),
    };

    assert.ok(registry.regions.every((region) => orgs.has(region.organizationId)));
    assert.ok(registry.substations.every((ss) => ss.adminRegionId === undefined || regions.has(ss.adminRegionId)));
    assert.ok(registry.feeders.every((feeder) => substations.has(feeder.origin.substationId)));
    assert.ok(registry.distributionTransformers.every((dt) => feeders.has(dt.feederId)));
    assert.ok(registry.servicePoints.every((sp) =>
      sp.supply.kind === "feeder" ? feeders.has(sp.supply.feederId) : dts.has(sp.supply.transformerId)));
    assert.ok(registry.meters.every((meter) =>
      meter.installation.role === "service_point" && sps.has(meter.installation.servicePointId)));
    assert.ok(registry.edgeDevices.every((device) => assets[device.attachedTo.kind]?.has(device.attachedTo.id)));
    assert.ok(dataset.telemetry.every((point) => assets[point.source.kind]?.has(point.source.id)));
  });
});

describe("mock dataset: nothing invented", () => {
  it("holds no interval energy, and says it is not available", () => {
    assert.deepEqual(dataset.intervalEnergy, []);
    assert.equal(dataset.completeness.intervalEnergy, "not_available");
  });

  it("holds no customer accounts or power transformers, and says so", () => {
    assert.equal(dataset.registryCoverage.customers, "not_available");
    assert.equal(dataset.registryCoverage.powerTransformers, "not_available");
  });

  it("contains no customer names", () => {
    const text = JSON.stringify(dataset);
    for (const name of LEGACY_DATA.meters.map((meter) => meter.customerName)) assert.equal(text.includes(name), false, name);
  });

  it("does not map revenue.ts", () => {
    assert.equal(JSON.stringify(dataset).includes("rev-00"), false);
  });

  it("does not link the executive events to the registry", () => {
    assert.ok(dataset.outages.every((outage) => !("id" in outage.origin)));
  });
});

describe("mock dataset: mapping report", () => {
  const codes = new Set(report.issues.map((issue) => issue.code));

  it("has no errors for the current mock data", () => {
    assert.deepEqual(report.issues.filter((issue) => issue.severity === "error"), []);
  });

  it("reports every known limitation of the mock data", () => {
    const expected: MappingIssueCode[] = [
      "PII_DROPPED",
      "DERIVED_STATE_NOT_STORED",
      "UNMAPPED_FIELD",
      "REGISTRY_SAMPLE_ONLY",
      "CONFLICTING_SOURCES",
      "UNPARSEABLE_TIME",
      "ASSUMED_VALUE",
    ];
    for (const code of expected) assert.ok(codes.has(code), code);
    assert.equal(codes.has("DANGLING_REFERENCE"), false);
  });

  it("gives every issue an explicit severity from the severity model", () => {
    for (const issue of report.issues) {
      assert.ok(["info", "warning", "error"].includes(issue.severity));
      assert.equal(issue.severity, DEFAULT_SEVERITY[issue.code], `${issue.code} ${issue.source.recordId ?? ""}`);
    }
    assert.deepEqual(DEFAULT_SEVERITY, {
      PII_DROPPED: "info",
      DERIVED_STATE_NOT_STORED: "info",
      UNMAPPED_FIELD: "warning",
      REGISTRY_SAMPLE_ONLY: "warning",
      CONFLICTING_SOURCES: "warning",
      UNPARSEABLE_TIME: "warning",
      DANGLING_REFERENCE: "error",
      ASSUMED_VALUE: "warning",
    });
  });

  it("states once for each sampled registry collection that it is only a sample", () => {
    const sampled = report.issues.filter((issue) => issue.code === "REGISTRY_SAMPLE_ONLY").map((issue) => issue.source.field);
    assert.deepEqual(sampled, ["substations", "feeders", "distributionTransformers", "servicePoints", "meters", "edgeDevices"]);
  });
});

describe("mock repositories", () => {
  it("serve the mock dataset through the ports", async () => {
    const repos = createMockRepositories();
    const { snapshot, topologyBasis } = await repos.registry.getSnapshot({ asOf: MOCK_INGESTED_AT });
    assert.equal(topologyBasis, "current_only");
    assert.equal(snapshot.feeders.length, 1);
    assert.deepEqual((await repos.sources.listDataSources()).map((source) => source.id), ["mock-operations", "mock-executive"]);
  });
});
