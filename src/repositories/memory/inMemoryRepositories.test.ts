import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IntervalEnergy, Outage, OutageExposure, Provenance, ReportedKpi, TelemetryPoint } from "@/domain";
import type { RegistryCoverage } from "../ports/index.ts";
import type { DomainDataset } from "./dataset.ts";
import { createInMemoryRepositories } from "./inMemoryRepositories.ts";

const PROVENANCE: Provenance = { sourceSystem: "test", ingestedAt: "2026-01-02T00:00:00Z" };
const PERIOD = { start: "2026-01-01T01:00:00Z", end: "2026-01-01T02:00:00Z" };

const COVERAGE: RegistryCoverage = {
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

function interval(meterId: string, intervalStart: string, intervalMinutes = 30): IntervalEnergy {
  return { meterId, intervalStart, intervalMinutes, importKwh: 1, exportKwh: 0, quality: "measured", provenance: PROVENANCE };
}

function point(kind: "meter" | "service_point", id: string, observedAt: string): TelemetryPoint {
  return { source: { kind, id }, metric: "voltage_v", observedAt, value: 230, quality: "measured", provenance: PROVENANCE };
}

function outage(id: string, exposure: Partial<OutageExposure>): Outage {
  return {
    id,
    origin: { kind: "feeder", id: "FD-1" },
    planned: false,
    cause: "fault",
    responsibleParty: "distribution",
    exposures: [
      { affected: { kind: "feeder", id: "FD-1" }, customersAffected: 10, customerCountBasis: "recorded", quality: "measured", ...exposure },
    ],
    provenance: PROVENANCE,
  };
}

function kpi(id: string, metric: ReportedKpi["metric"], scope: ReportedKpi["scope"]): ReportedKpi {
  return {
    id,
    metric,
    scope,
    period: null,
    asOf: null,
    value: 1,
    unit: "count",
    source: { name: "test", kind: "other" },
    document: null,
    basis: null,
    methodology: null,
    reportedAt: null,
    provenance: PROVENANCE,
  };
}

function dataset(overrides: Partial<DomainDataset> = {}): DomainDataset {
  return {
    registry: {
      organizations: [],
      regions: [],
      substations: [],
      powerTransformers: [],
      feeders: [],
      distributionTransformers: [],
      servicePoints: [],
      meters: [],
      customers: [],
      edgeDevices: [],
    },
    registryCoverage: COVERAGE,
    intervalEnergy: [],
    telemetry: [],
    heartbeats: [],
    outages: [],
    reportedKpis: [],
    billingRecords: [],
    payments: [],
    dataSources: [{ id: "test", name: "Test", kind: "mock" }],
    completeness: {
      intervalEnergy: "complete",
      telemetry: "partial",
      heartbeats: "partial",
      outages: "partial",
      reportedKpis: "not_available",
      billing: "not_available",
    },
    ...overrides,
  };
}

describe("in-memory registry repository", () => {
  it("returns the snapshot and coverage, marked current-only, for any as-of time", async () => {
    const data = dataset();
    const repos = createInMemoryRepositories(data);
    const early = await repos.registry.getSnapshot({ asOf: "2020-01-01T00:00:00Z" });
    const late = await repos.registry.getSnapshot({ asOf: "2030-01-01T00:00:00Z" });
    assert.equal(early.topologyBasis, "current_only");
    assert.equal(early.snapshot, data.registry);
    assert.equal(late.snapshot, data.registry);
    assert.deepEqual(early.coverage, COVERAGE);
  });

  it("rejects an as-of time without a zone", async () => {
    const repos = createInMemoryRepositories(dataset());
    await assert.rejects(repos.registry.getSnapshot({ asOf: "2026-01-01T00:00:00" }), RangeError);
  });
});

describe("in-memory interval energy", () => {
  const data = dataset({
    intervalEnergy: [
      interval("M-1", "2026-01-01T00:30:00Z"), // ends exactly at the period start
      interval("M-1", "2026-01-01T00:30:00Z", 60), // straddles the start
      interval("M-1", "2026-01-01T01:30:00Z"), // inside
      interval("M-1", "2026-01-01T02:00:00Z"), // starts exactly at the period end
      interval("M-1", "not a time"), // cannot be placed in time
      interval("M-2", "2026-01-01T01:00:00Z"), // another meter
    ],
  });
  const repos = createInMemoryRepositories(data);

  it("returns intervals of the requested meters that overlap the half-open period", async () => {
    const result = await repos.observations.listIntervalEnergy({ meterIds: ["M-1"], period: PERIOD });
    assert.deepEqual(
      result.records.map((record) => [record.intervalStart, record.intervalMinutes]),
      [
        ["2026-01-01T00:30:00Z", 60],
        ["2026-01-01T01:30:00Z", 30],
        ["not a time", 30],
      ],
    );
    assert.equal(result.completeness, "complete");
  });

  it("does not sum or otherwise change the records", async () => {
    const result = await repos.observations.listIntervalEnergy({ meterIds: ["M-1", "M-2"], period: PERIOD });
    for (const record of result.records) assert.ok(data.intervalEnergy.includes(record));
  });

  it("rejects an empty or invalid period", async () => {
    await assert.rejects(
      repos.observations.listIntervalEnergy({ meterIds: ["M-1"], period: { start: PERIOD.end, end: PERIOD.start } }),
      RangeError,
    );
  });
});

describe("in-memory telemetry", () => {
  const data = dataset({
    telemetry: [
      point("meter", "M-1", "2026-01-01T00:59:59Z"),
      point("meter", "M-1", "2026-01-01T01:00:00Z"),
      point("meter", "M-1", "2026-01-01T02:00:00Z"),
      point("meter", "M-1", "2026-01-01T02:00:01Z"),
      point("service_point", "M-1", "2026-01-01T01:30:00Z"),
      point("meter", "M-1", "undated"),
    ],
  });
  const repos = createInMemoryRepositories(data);

  it("returns points for the requested sources with from ≤ observedAt ≤ asOf", async () => {
    const result = await repos.observations.listTelemetry({
      sources: [{ kind: "meter", id: "M-1" }],
      from: "2026-01-01T01:00:00Z",
      asOf: "2026-01-01T02:00:00Z",
    });
    assert.deepEqual(
      result.records.map((record) => record.observedAt),
      ["2026-01-01T01:00:00Z", "2026-01-01T02:00:00Z", "undated"],
    );
    assert.equal(result.completeness, "partial");
  });

  it("matches sources by kind as well as id", async () => {
    const result = await repos.observations.listTelemetry({
      sources: [{ kind: "service_point", id: "M-1" }],
      from: "2026-01-01T00:00:00Z",
      asOf: "2026-01-02T00:00:00Z",
    });
    assert.deepEqual(result.records.map((record) => record.source.kind), ["service_point"]);
  });
});

describe("in-memory outages", () => {
  const data = dataset({
    outages: [
      outage("ended-before", { interruptedAt: "2026-01-01T00:00:00Z", restoredAt: "2026-01-01T00:30:00Z" }),
      outage("restored-at-start", { interruptedAt: "2026-01-01T00:00:00Z", restoredAt: "2026-01-01T01:00:00Z" }),
      outage("overlapping", { interruptedAt: "2026-01-01T00:30:00Z", restoredAt: "2026-01-01T01:30:00Z" }),
      outage("still-open", { interruptedAt: "2026-01-01T00:00:00Z" }),
      outage("starts-at-end", { interruptedAt: "2026-01-01T02:00:00Z", restoredAt: "2026-01-01T03:00:00Z" }),
      outage("undated", {}),
      outage("unreadable-restoration", { interruptedAt: "2026-01-01T00:00:00Z", restoredAt: "later" }),
    ],
  });
  const repos = createInMemoryRepositories(data);

  it("returns outages overlapping the period, and always those whose times are unknown", async () => {
    const result = await repos.events.listOutages({ period: PERIOD });
    assert.deepEqual(
      result.records.map((record) => record.id),
      ["overlapping", "still-open", "undated", "unreadable-restoration"],
    );
    assert.equal(result.completeness, "partial");
  });
});

describe("in-memory reported figures", () => {
  const data = dataset({
    reportedKpis: [
      kpi("a", "customer_count", { kind: "region", id: "R-1" }),
      kpi("b", "customer_count", { kind: "region", id: "R-2" }),
      kpi("c", "feeder_count", { kind: "region", id: "R-1" }),
      kpi("d", "customer_count", { kind: "region", label: "Somewhere" }),
    ],
  });
  const repos = createInMemoryRepositories(data);

  it("filters by metric and resolved scope", async () => {
    const result = await repos.reported.listReportedKpis({
      metrics: ["customer_count"],
      scopes: [{ kind: "region", id: "R-1" }],
    });
    assert.deepEqual(result.records.map((record) => record.id), ["a"]);
    assert.equal(result.completeness, "not_available");
  });

  it("returns every figure, including unresolved scopes, without filters", async () => {
    const result = await repos.reported.listReportedKpis({});
    assert.deepEqual(result.records.map((record) => record.id), ["a", "b", "c", "d"]);
  });
});

describe("in-memory data sources", () => {
  it("lists the dataset's sources", async () => {
    const repos = createInMemoryRepositories(dataset());
    assert.deepEqual(await repos.sources.listDataSources(), [{ id: "test", name: "Test", kind: "mock" }]);
  });
});
