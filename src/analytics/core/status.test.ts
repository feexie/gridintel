import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue, MonetaryInput, UnfinalizedKpi } from "./result.ts";
import { CONTEXT, PERIOD, buildIntervals, buildRegistry } from "../__fixtures__/network.ts";
import { computeEnergyAccount } from "../energy/account.ts";
import { calculateBillingEfficiency } from "../losses/atcc.ts";
import { compareKpi } from "../reconciliation/compare.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { estimatedInputsOf, finalizeKpi, isComputed, resultStatus } from "./result.ts";

const input = (value: number | null, extra: Partial<InputValue> = {}): InputValue => ({
  value,
  unit: "kWh",
  origin: "observed",
  quality: value === null ? "missing" : "measured",
  ...extra,
});
const money = (value: number): MonetaryInput => ({ value, unit: "currency", currency: "NGN", scale: 1, origin: "observed", quality: "measured" });

const kpi = (status: UnfinalizedKpi["status"], inputs: Record<string, InputValue>): UnfinalizedKpi => ({
  kind: "calculated",
  metric: "billing_efficiency",
  scope: { kind: "feeder", id: "FD-1" },
  period: PERIOD,
  asOf: null,
  status,
  value: status === "ok" ? 0.5 : null,
  unit: "fraction",
  methodology: { id: "test", version: "1" },
  inputs,
  missingInputs: [],
  coverage: null,
  quality: null,
  warnings: [],
  computedAt: CONTEXT.computedAt,
});

describe("calculated_with_estimates", () => {
  it("is the status of a computed result with an estimated input, which it lists with its share", () => {
    const result = finalizeKpi(
      kpi("ok", { a: input(10), b: input(4, { quality: "estimated", estimatedShare: 0.25, ref: "r" }), c: input(1, { quality: "substituted" }) }),
    );
    assert.equal(result.status, "calculated_with_estimates");
    assert.deepEqual(result.estimatedInputs, [
      { name: "b", quality: "estimated", share: 0.25, ref: "r" },
      { name: "c", quality: "substituted", share: null },
    ]);
    assert.equal(isComputed(result.status), true);
  });

  it("leaves a fully measured result as ok", () => {
    const result = finalizeKpi(kpi("ok", { a: input(10), b: input(4) }));
    assert.equal(result.status, "ok");
    assert.deepEqual(result.estimatedInputs, []);
  });

  it("never turns missing data into an estimate", () => {
    const result = finalizeKpi(kpi("insufficient_data", { a: input(null), b: input(4, { quality: "estimated" }) }));
    assert.equal(result.status, "insufficient_data");
    assert.deepEqual(result.estimatedInputs, []);
    assert.equal(isComputed(result.status), false);
    assert.deepEqual(estimatedInputsOf({ a: input(null, { quality: "estimated" }) }), []);
  });

  it("applies to a single figure through its quality", () => {
    assert.equal(resultStatus("ok", "estimated"), "calculated_with_estimates");
    assert.equal(resultStatus("ok", "substituted"), "calculated_with_estimates");
    assert.equal(resultStatus("ok", "measured"), "ok");
    assert.equal(resultStatus("ok", "suspect"), "ok");
    assert.equal(resultStatus("insufficient_data", "estimated"), "insufficient_data");
  });

  it("flows from an estimated input into the KPI calculated from it", () => {
    const billing = calculateBillingEfficiency({
      scope: { kind: "feeder", id: "FD-1" },
      period: PERIOD,
      energyInput: input(400),
      energyBilled: input(300, { quality: "estimated", estimatedShare: 0.4 }),
      context: CONTEXT,
    });
    assert.equal(billing.status, "calculated_with_estimates");
    assert.equal(billing.value, 0.75);
    assert.deepEqual(billing.estimatedInputs.map((e) => [e.name, e.share]), [["energyBilled", 0.4]]);
  });

  it("can still be compared with a reported figure", () => {
    const calculated = finalizeKpi({ ...kpi("ok", { a: input(4, { quality: "estimated" }) }), metric: "atcc" });
    const comparison = compareKpi(
      {
        id: "r",
        metric: "atcc",
        scope: { kind: "feeder", id: "FD-1" },
        period: PERIOD,
        asOf: null,
        value: 40,
        unit: "percent",
        source: { name: "t", kind: "utility" },
        document: null,
        methodology: null,
        reportedAt: null,
        provenance: { sourceSystem: "t", ingestedAt: CONTEXT.computedAt },
      },
      calculated,
    );
    assert.ok(!comparison.issues.some((issue) => issue.code === "CALCULATION_NOT_OK"));
    assert.equal(comparison.variance.absolute, 10);
  });
});

describe("energy account status", () => {
  const account = (inputs: Parameters<typeof computeEnergyAccount>[0]["inputs"], dropMeter?: string) => {
    const registry = buildRegistry();
    if (dropMeter) registry.meters = registry.meters.filter((meter) => meter.id !== dropMeter);
    return computeEnergyAccount({
      index: buildTopologyIndex(registry),
      scope: { kind: "feeder", id: "FD-1" },
      period: PERIOD,
      intervals: buildIntervals(),
      inputs,
      computedAt: CONTEXT.computedAt,
    });
  };
  const full = { technicalLoss: input(40), energyBilled: input(300), revenueBilled: money(1000), revenueCollected: money(800) };

  it("is ok when every chain input is present and measured", () => {
    const result = account(full);
    assert.equal(result.status, "ok");
    assert.deepEqual(result.estimatedInputs, []);
    assert.equal(result.crossChecks.status, "ok");
  });

  it("is calculated_with_estimates when a chain input is estimated, naming it and its share", () => {
    const result = account({
      ...full,
      technicalLoss: input(40, { quality: "estimated", estimatedShare: 1 }),
      energyBilled: input(300, { quality: "estimated", estimatedShare: 0.2 }),
    });
    assert.equal(result.status, "calculated_with_estimates");
    assert.deepEqual(result.estimatedInputs, [
      { name: "technical loss", quality: "estimated", share: 1 },
      { name: "energy billed", quality: "estimated", share: 0.2 },
    ]);
    assert.equal(result.unbilled.value, 60);
  });

  it("stays insufficient_data when a chain input is genuinely missing", () => {
    const result = account({ ...full, energyBilled: undefined, technicalLoss: input(40, { quality: "estimated" }) });
    assert.equal(result.status, "insufficient_data");
    assert.ok(result.missingInputs.includes("energy billed"));
  });

  it("keeps an unavailable cross-check out of the chain status", () => {
    const result = account(full, "M-SP1");
    assert.equal(result.status, "ok");
    assert.deepEqual(result.missingInputs, []);
    assert.equal(result.crossChecks.status, "insufficient_data");
    assert.deepEqual(result.crossChecks.missingInputs, ["service_point meter for service_point SP-1"]);
    assert.equal(result.recordedConsumption.value, null);
  });
});
