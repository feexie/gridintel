import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue } from "../../analytics/index.ts";
import type { ScopeRef } from "@/domain";
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
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "./__fixtures__/sparse.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   WHAT A SPARSE SOURCE CAN AND CANNOT SUPPORT

   The sparse source has no interval energy, no boundary meters, no
   customer accounts, no dated outages and no telemetry. Each
   calculation below must say what is missing; none may return a
   value made from nothing.
========================================================== */

const CONTEXT = { computedAt: "2026-10-01T00:00:00Z" };

describe("sparse source: topology", () => {
  it("resolves the electrical chain through the analytics topology index", async () => {
    const { index, topologyBasis } = await loadTopology(sparseRepositories().registry, SPARSE_AS_OF);
    assert.equal(topologyBasis, "current_only");
    assert.deepEqual(transformersOnFeeder(index, "FD-1").map((dt) => dt.id), ["DT-1", "DT-2"]);
    const points = servicePointsOnTransformer(index, "DT-1");
    assert.deepEqual(points.map((sp) => sp.id), ["SP-1", "SP-2"]);
    assert.equal(adminRegionOfServicePoint(index, points[0]), "R-1");
  });

  it("flags customer accounts as not available, so a registry customer count of 0 is not a real zero", async () => {
    const { index, coverage } = await loadTopology(sparseRepositories().registry, SPARSE_AS_OF);
    assert.equal(coverage.customers, "not_available");
    assert.equal(customersServed(index, { kind: "feeder", id: "FD-1" }).input.value, 0);
  });
});

describe("sparse source: energy accounting", () => {
  for (const scope of [
    { kind: "distribution_transformer", id: "DT-1" },
    { kind: "feeder", id: "FD-1" },
    { kind: "substation", id: "SS-1" },
  ] satisfies ScopeRef[]) {
    it(`is insufficient_data for ${scope.kind} ${scope.id}: no boundary meters or intervals`, async () => {
      const repos = sparseRepositories();
      const { index } = await loadTopology(repos.registry, SPARSE_AS_OF);
      const boundary = sectionBoundary(index, scope);
      assert.ok(boundary.input.every((requirement) => requirement.meterIds.length === 0));
      const meterIds = [...boundary.input, ...boundary.downstream].flatMap((requirement) => requirement.meterIds);
      const intervals = await repos.observations.listIntervalEnergy({ meterIds, period: SPARSE_PERIOD });
      assert.equal(intervals.completeness, "not_available");

      const account = computeEnergyAccount({ index, scope, period: SPARSE_PERIOD, intervals: intervals.records, computedAt: CONTEXT.computedAt });
      assert.equal(account.status, "insufficient_data");
      assert.equal(account.received.value, null);
      assert.ok(account.missingInputs.length > 0);
    });
  }
});

describe("sparse source: reliability", () => {
  it("returns the undated outages, which analytics excludes for missing data", async () => {
    const repos = sparseRepositories();
    const { records, completeness } = await repos.events.listOutages({ period: SPARSE_PERIOD });
    assert.equal(records.length, 2);
    assert.equal(completeness, "partial");

    const unknownServed: InputValue = { value: null, unit: "count", origin: "calculated", quality: "missing" };
    const result = calculateReliability({
      scope: { kind: "organization", id: "ORG-1" },
      period: SPARSE_PERIOD,
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

describe("sparse source: loading", () => {
  it("is insufficient_data for DT-1; the reported loading stays a separate figure", async () => {
    const repos = sparseRepositories();
    const { index } = await loadTopology(repos.registry, SPARSE_AS_OF);
    const dt = index.transformerById.get("DT-1");
    assert.ok(dt);
    const telemetry = await repos.observations.listTelemetry({
      sources: [{ kind: "distribution_transformer", id: dt.id }],
      from: "2026-07-12T08:45:00Z",
      asOf: SPARSE_AS_OF,
    });
    assert.deepEqual(telemetry.records, []);

    const loading = calculateLoading({
      target: { kind: "distribution_transformer", asset: dt },
      telemetry: telemetry.records,
      asOf: SPARSE_AS_OF,
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
