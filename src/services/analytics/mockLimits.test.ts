import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue } from "../../analytics/index.ts";
import type { Period, ScopeRef } from "@/domain";
import {
  adminRegionOfServicePoint,
  calculateLoading,
  calculateReliability,
  computeEnergyAccount,
  customersServed,
  sectionBoundary,
  servicePointsOnTransformer,
  transformersOnFeeder,
} from "../../analytics/index.ts";
import { createMockRepositories } from "../../repositories/mock/index.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   WHAT THE MOCK DATA CAN AND CANNOT SUPPORT

   The mock data has no interval energy, no boundary meters, no
   dated outages and no per-phase transformer readings. Each
   calculation below must say what is missing; none may return a
   value made from nothing.
========================================================== */

const AS_OF = "2026-07-12T09:45:00Z";
const JULY: Period = { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" };
const CONTEXT = { computedAt: "2026-10-01T00:00:00Z" };

describe("mock topology", () => {
  it("resolves the electrical chain through the analytics topology index", async () => {
    const { index, topologyBasis } = await loadTopology(createMockRepositories().registry, AS_OF);
    assert.equal(topologyBasis, "current_only");
    assert.deepEqual(transformersOnFeeder(index, "ADM-FD-001").map((dt) => dt.id), ["ADM-TR-001", "ADM-TR-002", "ADM-TR-003"]);
    const points = servicePointsOnTransformer(index, "ADM-TR-001");
    assert.deepEqual(points.map((sp) => sp.id), ["SP:ADM-MTR-001", "SP:ADM-MTR-002"]);
    assert.equal(adminRegionOfServicePoint(index, points[0]), "adamawa");
  });

  it("flags customer accounts as not available, so a registry customer count of 0 is not a real zero", async () => {
    const { index, coverage } = await loadTopology(createMockRepositories().registry, AS_OF);
    assert.equal(coverage.customers, "not_available");
    assert.equal(customersServed(index, { kind: "feeder", id: "ADM-FD-001" }).input.value, 0);
  });
});

describe("mock energy accounting", () => {
  for (const scope of [
    { kind: "distribution_transformer", id: "ADM-TR-001" },
    { kind: "feeder", id: "ADM-FD-001" },
    { kind: "substation", id: "ADM-SS-001" },
  ] satisfies ScopeRef[]) {
    it(`is insufficient_data for ${scope.kind} ${scope.id}: no boundary meters or intervals`, async () => {
      const repos = createMockRepositories();
      const { index } = await loadTopology(repos.registry, AS_OF);
      const boundary = sectionBoundary(index, scope);
      assert.ok(boundary.input.every((requirement) => requirement.meterIds.length === 0));
      const meterIds = [...boundary.input, ...boundary.downstream].flatMap((requirement) => requirement.meterIds);
      const intervals = await repos.observations.listIntervalEnergy({ meterIds, period: JULY });
      assert.equal(intervals.completeness, "not_available");

      const account = computeEnergyAccount({ index, scope, period: JULY, intervals: intervals.records, computedAt: CONTEXT.computedAt });
      assert.equal(account.status, "insufficient_data");
      assert.equal(account.received.value, null);
      assert.ok(account.missingInputs.length > 0);
    });
  }
});

describe("mock reliability", () => {
  it("returns the undated executive events, which analytics excludes for missing data", async () => {
    const repos = createMockRepositories();
    const { records, completeness } = await repos.events.listOutages({ period: JULY });
    assert.equal(records.length, 2);
    assert.equal(completeness, "partial");

    const unknownServed: InputValue = { value: null, unit: "count", origin: "calculated", quality: "missing" };
    const result = calculateReliability({
      scope: { kind: "organization", id: "mock-utility" },
      period: JULY,
      outages: records,
      customersServed: unknownServed,
      context: CONTEXT,
    });
    assert.equal(result.components.excludedForData, 2);
    assert.equal(result.saidi.status, "insufficient_data");
    assert.equal(result.saidi.value, null);
    assert.equal(result.saifi.status, "insufficient_data");
  });
});

describe("mock loading", () => {
  it("is insufficient_data for ADM-TR-001; the reported loading stays a separate figure", async () => {
    const repos = createMockRepositories();
    const { index } = await loadTopology(repos.registry, AS_OF);
    const dt = index.transformerById.get("ADM-TR-001");
    assert.ok(dt);
    const telemetry = await repos.observations.listTelemetry({
      sources: [{ kind: "distribution_transformer", id: dt.id }],
      from: "2026-07-12T08:45:00Z",
      asOf: AS_OF,
    });
    assert.deepEqual(telemetry.records, []);

    const loading = calculateLoading({
      target: { kind: "distribution_transformer", asset: dt },
      telemetry: telemetry.records,
      asOf: AS_OF,
      context: CONTEXT,
    });
    assert.equal(loading.status, "insufficient_data");
    assert.equal(loading.loadingFraction, null);

    const reported = await repos.reported.listReportedKpis({
      metrics: ["transformer_loading"],
      scopes: [{ kind: "distribution_transformer", id: dt.id }],
    });
    assert.deepEqual(reported.records.map((kpi) => [kpi.value, kpi.unit]), [[68, "percent"]]);
  });
});
