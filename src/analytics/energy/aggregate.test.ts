import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ScopeRef } from "@/domain";
import type { Registry } from "../topology/registry.ts";
import type { InputValue, MonetaryInput } from "../core/result.ts";
import { CONTEXT, PERIOD, PROVENANCE, buildIntervals, buildRegistry } from "../__fixtures__/network.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { aggregateEnergyAccounts, computeEnergyAccount } from "./account.ts";
import { sectionsForScope } from "./cut.ts";

const REGION: ScopeRef = { kind: "region", id: "R-1" };
const AUDIT = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

/** The fixture registry with a second region, and whatever the test moves into it. */
function registry(change: (registry: Registry) => void = () => {}): Registry {
  const base = buildRegistry();
  base.regions = [...base.regions, { ...AUDIT, id: "R-2", organizationId: "ORG-2", name: "Region 2", provenance: PROVENANCE }];
  change(base);
  return base;
}

const cut = (scope: ScopeRef, change?: (registry: Registry) => void) => sectionsForScope(buildTopologyIndex(registry(change)), scope);
const moveServicePoint = (id: string) => (r: Registry) => {
  r.servicePoints = r.servicePoints.map((sp) => (sp.id === id ? { ...sp, adminRegionId: "R-2" } : sp));
};
const moveTransformer = (id: string) => (r: Registry) => {
  r.distributionTransformers = r.distributionTransformers.map((dt) => (dt.id === id ? { ...dt, adminRegionId: "R-2" } : dt));
};

describe("sections of a scope", () => {
  it("is the scope itself for an electrical scope", () => {
    const feeder: ScopeRef = { kind: "feeder", id: "FD-1" };
    assert.deepEqual(cut(feeder).sections, [feeder]);
  });

  it("takes a whole substation when all of it is inside the region, so nothing below it is counted again", () => {
    const result = cut(REGION);
    assert.equal(result.status, "ok");
    assert.deepEqual(result.sections, [{ kind: "substation", id: "SS-1" }]);
    assert.ok(!result.warnings.some((w) => w.code === "UPSTREAM_LOSSES_NOT_INCLUDED"));
    assert.deepEqual(cut({ kind: "organization", id: "ORG-1" }).sections, [{ kind: "substation", id: "SS-1" }]);
  });

  it("has no sections for a region that holds nothing, and is not computable for one that does not exist", () => {
    const empty = cut({ kind: "region", id: "R-2" });
    assert.equal(empty.status, "insufficient_data");
    assert.deepEqual(empty.sections, []);
    assert.equal(cut({ kind: "region", id: "nope" }).status, "not_computable");
  });

  it("cuts below the substation when a transformer belongs to another region, and says upstream losses are left out", () => {
    // DT-2 moves to R-2. FD-1 still supplies SP-4 directly in R-1, so it cannot be cut.
    const blocked = cut(REGION, moveTransformer("DT-2"));
    assert.equal(blocked.status, "not_computable");
    assert.ok(blocked.warnings.some((w) => w.code === "CUT_NOT_POSSIBLE" && w.ref === "FD-1"));

    // With SP-4 also in R-2, R-1 is exactly transformer DT-1.
    const both = (r: Registry) => {
      moveTransformer("DT-2")(r);
      moveServicePoint("SP-4")(r);
    };
    const region1 = cut(REGION, both);
    assert.equal(region1.status, "ok");
    assert.deepEqual(region1.sections, [{ kind: "distribution_transformer", id: "DT-1" }]);
    assert.ok(region1.warnings.some((w) => w.code === "UPSTREAM_LOSSES_NOT_INCLUDED"));
    // And R-2 is DT-2 only: SP-4 is supplied directly by the divided feeder, which cannot be cut.
    assert.equal(cut({ kind: "region", id: "R-2" }, both).status, "not_computable");
  });

  it("refuses to divide a transformer that serves two regions", () => {
    const result = cut(REGION, moveServicePoint("SP-2"));
    assert.equal(result.status, "not_computable");
    assert.deepEqual(result.sections, []);
    assert.ok(result.warnings.some((w) => w.code === "CUT_NOT_POSSIBLE" && w.ref === "DT-1"));
  });

  it("puts every service point of the region in exactly one section", () => {
    const index = buildTopologyIndex(registry());
    const sections = sectionsForScope(index, REGION).sections;
    assert.equal(sections.length, 1);
  });
});

describe("aggregated energy account", () => {
  const index = buildTopologyIndex(buildRegistry());
  const energy = (value: number, extra: Partial<InputValue> = {}): InputValue => ({ value, unit: "kWh", origin: "observed", quality: "measured", ...extra });
  const money = (value: number): MonetaryInput => ({ value, unit: "currency", currency: "NGN", scale: 1, origin: "observed", quality: "measured" });
  const account = (id: string, inputs: Parameters<typeof computeEnergyAccount>[0]["inputs"]) =>
    computeEnergyAccount({
      index,
      scope: { kind: "distribution_transformer", id },
      period: PERIOD,
      intervals: buildIntervals(),
      inputs,
      computedAt: CONTEXT.computedAt,
    });
  const aggregate = (accounts: ReturnType<typeof account>[], revenue = true) =>
    aggregateEnergyAccounts({
      scope: REGION,
      period: PERIOD,
      accounts,
      ...(revenue ? { revenueBilled: money(1000), revenueCollected: money(800) } : {}),
      computedAt: CONTEXT.computedAt,
    });

  const dt1 = account("DT-1", { technicalLoss: energy(20), energyBilled: energy(150) });
  const dt2 = account("DT-2", { technicalLoss: energy(10), energyBilled: energy(90) });

  it("equals the single section's account, figure for figure, when the scope is one section", () => {
    const total = aggregate([dt1]);
    for (const figure of ["received", "energyInput", "technicalLoss", "delivered", "energyBilled", "unbilled", "totalLoss", "downstreamMeasured", "recordedConsumption", "sectionResidual"] as const) {
      assert.equal(total[figure].value, dt1[figure].value, figure);
      assert.equal(total[figure].status, dt1[figure].status, figure);
      assert.equal(total[figure].quality, dt1[figure].quality, figure);
    }
    assert.equal(total.boundary.input.netKwh, dt1.boundary.input.netKwh);
  });

  it("sums the sections, each once", () => {
    const total = aggregate([dt1, dt2]);
    assert.equal(total.status, "ok");
    assert.equal(total.received.value, 200 + 120);
    assert.equal(total.technicalLoss.value, 30);
    assert.equal(total.delivered.value, 290);
    assert.equal(total.energyBilled.value, 240);
    assert.equal(total.unbilled.value, 50);
    assert.equal(total.scope, REGION);
    assert.equal(total.revenueBilled?.value, 1000);
  });

  it("has no total for a figure one section lacks, rather than a partial sum", () => {
    const partial = aggregate([dt1, account("DT-2", { energyBilled: energy(90) })]);
    assert.equal(partial.status, "insufficient_data");
    assert.equal(partial.technicalLoss.value, null);
    assert.equal(partial.delivered.value, null);
    // Figures every section has are still summed.
    assert.equal(partial.received.value, 320);
    assert.equal(partial.energyBilled.value, 240);
    assert.ok(partial.missingInputs.includes("technical loss"));
  });

  it("carries estimates up, with the energy-weighted share", () => {
    const total = aggregate([
      account("DT-1", { technicalLoss: energy(20, { quality: "estimated", estimatedShare: 1 }), energyBilled: energy(150, { quality: "estimated", estimatedShare: 0.4 }) }),
      account("DT-2", { technicalLoss: energy(10, { quality: "estimated", estimatedShare: 1 }), energyBilled: energy(90) }),
    ]);
    assert.equal(total.status, "calculated_with_estimates");
    assert.deepEqual(total.estimatedInputs, [
      { name: "technical loss", quality: "estimated", share: 1 },
      { name: "energy billed", quality: "estimated", share: (150 * 0.4) / 240 },
    ]);
  });

  it("is insufficient_data with no sections, and with no revenue", () => {
    const none = aggregate([]);
    assert.equal(none.status, "insufficient_data");
    assert.equal(none.received.value, null);
    assert.ok(aggregate([dt1], false).missingInputs.includes("revenue billed"));
  });
});
