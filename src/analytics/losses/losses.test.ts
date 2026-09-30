import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue, MonetaryInput } from "../core/result.ts";
import { computeEnergyAccount } from "../energy/account.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { atccInputsFromAccount, calculateAtcc, calculateBillingEfficiency, calculateLossSplit } from "./atcc.ts";
import { aggregateCollectionEfficiency, calculateCollectionEfficiency } from "./collection.ts";
import { CONTEXT, PERIOD, approx, buildIntervals, buildRegistry } from "../__fixtures__/network.ts";

const SCOPE = { kind: "distribution_transformer" as const, id: "DT-1" };

const energy = (value: number | null, unit: InputValue["unit"] = "kWh", origin: InputValue["origin"] = "observed"): InputValue => ({
  value,
  unit,
  origin,
  quality: "measured",
});
const money = (value: number | null, currency = "NGN", scale = 1, origin: InputValue["origin"] = "observed"): MonetaryInput => ({
  value,
  unit: "currency",
  currency,
  scale,
  origin,
  quality: "measured",
});

function dt1Account(technicalLoss: InputValue = energy(10, "kWh", "calculated")) {
  return computeEnergyAccount({
    index: buildTopologyIndex(buildRegistry()),
    scope: SCOPE,
    period: PERIOD,
    intervals: buildIntervals(),
    inputs: { technicalLoss, energyBilled: energy(150), revenueBilled: money(1500), revenueCollected: money(1200) },
    computedAt: CONTEXT.computedAt,
  });
}

describe("ATC&C", () => {
  it("ATC&C = 1 − BE × CE from an energy account", () => {
    const account = dt1Account();
    const result = calculateAtcc({
      scope: SCOPE,
      period: PERIOD,
      inputs: atccInputsFromAccount(account),
      context: CONTEXT,
    });
    assert.equal(result.billingEfficiency.value, 0.75); // 150 / 200
    assert.equal(result.collectionEfficiency.value, 0.8); // 1200 / 1500
    assert.ok(approx(result.atcc.value, 0.4)); // 1 − 0.75 × 0.8
    assert.equal(result.atcc.status, "ok");
    assert.equal(result.atcc.kind, "calculated");
    assert.equal(result.atcc.unit, "fraction");
    assert.deepEqual(result.atcc.methodology, { id: "gridintel.atcc.reference", version: "0.1.0" });
  });

  it("is insufficient_data, not zero, when an input is missing", () => {
    const result = calculateAtcc({
      scope: SCOPE,
      period: PERIOD,
      inputs: {
        energyInput: energy(200),
        energyBilled: energy(150),
        revenueBilled: money(1500),
        revenueCollected: money(null),
      },
      context: CONTEXT,
    });
    assert.equal(result.atcc.status, "insufficient_data");
    assert.equal(result.atcc.value, null);
    assert.ok(result.atcc.missingInputs.includes("revenue collected"));
    assert.equal(result.billingEfficiency.value, 0.75);
  });

  it("converts energy units and flags reported inputs", () => {
    const result = calculateAtcc({
      scope: SCOPE,
      period: PERIOD,
      inputs: {
        energyInput: energy(0.2, "MWh", "reported"),
        energyBilled: energy(150, "kWh", "reported"),
        revenueBilled: money(1.5, "NGN", 1000, "reported"),
        revenueCollected: money(1.2, "NGN", 1000, "reported"),
      },
      context: CONTEXT,
    });
    assert.equal(result.billingEfficiency.value, 0.75);
    assert.ok(approx(result.atcc.value, 0.4));
    assert.ok(result.atcc.warnings.some((w) => w.code === "INPUTS_FROM_REPORTED"));
  });

  it("flags reported inputs even when only the revenue side is reported", () => {
    const result = calculateAtcc({
      scope: SCOPE,
      period: PERIOD,
      inputs: {
        energyInput: energy(200),
        energyBilled: energy(150),
        revenueBilled: money(1500, "NGN", 1, "reported"),
        revenueCollected: money(1200, "NGN", 1, "reported"),
      },
      context: CONTEXT,
    });
    const reportedWarnings = result.atcc.warnings.filter((w) => w.code === "INPUTS_FROM_REPORTED");
    assert.equal(reportedWarnings.length, 1);
    assert.match(reportedWarnings[0].message, /revenueBilled, revenueCollected/);
  });

  it("rejects an energy input in a non-energy unit", () => {
    const result = calculateBillingEfficiency({
      scope: SCOPE,
      period: PERIOD,
      energyInput: energy(200, "kW"),
      energyBilled: energy(150),
      context: CONTEXT,
    });
    assert.equal(result.status, "not_computable");
    assert.ok(result.warnings.some((w) => w.code === "UNIT_MISMATCH"));
  });

  it("is not_computable when energy input is zero", () => {
    const result = calculateAtcc({
      scope: SCOPE,
      period: PERIOD,
      inputs: { energyInput: energy(0), energyBilled: energy(0), revenueBilled: money(10), revenueCollected: money(5) },
      context: CONTEXT,
    });
    assert.equal(result.billingEfficiency.status, "not_computable");
    assert.equal(result.atcc.status, "not_computable");
    assert.equal(result.atcc.value, null);
  });
});

describe("loss split", () => {
  it("technical and commercial loss as fractions of energy input", () => {
    const split = calculateLossSplit({ account: dt1Account(), context: CONTEXT });
    assert.equal(split.technicalLoss.value, 0.05); // 10 / 200
    assert.equal(split.commercialLoss.value, 0.2); // 40 / 200
  });

  it("commercial loss is unavailable when technical loss is unknown", () => {
    const split = calculateLossSplit({ account: dt1Account(energy(null)), context: CONTEXT });
    assert.equal(split.technicalLoss.status, "insufficient_data");
    assert.equal(split.commercialLoss.status, "insufficient_data");
    assert.equal(split.commercialLoss.value, null);
    assert.ok(split.commercialLoss.warnings.some((w) => w.code === "SPLIT_UNAVAILABLE"));
  });
});

describe("collection efficiency", () => {
  const ce = (billed: MonetaryInput, collected: MonetaryInput) =>
    calculateCollectionEfficiency({ scope: SCOPE, period: PERIOD, revenueBilled: billed, revenueCollected: collected, context: CONTEXT });

  it("revenue collected ÷ revenue billed", () => {
    const result = ce(money(1500), money(1200));
    assert.equal(result.value, 0.8);
    assert.equal(result.metric, "collection_efficiency");
  });

  it("a zero collection is a real zero; a zero billing is not computable", () => {
    assert.equal(ce(money(1500), money(0)).value, 0);
    assert.equal(ce(money(1500), money(0)).status, "ok");
    assert.equal(ce(money(0), money(10)).status, "not_computable");
  });

  it("missing revenue is insufficient_data, even alongside a present value in another currency", () => {
    const result = ce(money(1500), money(null, "USD"));
    assert.equal(result.status, "insufficient_data");
    assert.deepEqual(result.missingInputs, ["revenue collected"]);
  });

  it("requires matching currency and scale", () => {
    assert.equal(ce(money(1500, "NGN"), money(1200, "USD")).status, "not_computable");
    assert.equal(ce(money(1500, "NGN", 1), money(1.2, "NGN", 1000)).status, "not_computable");
  });

  it("aggregates as Σ collected ÷ Σ billed, never the mean of percentages", () => {
    const result = aggregateCollectionEfficiency({
      scope: { kind: "region", id: "R-1" },
      period: PERIOD,
      parts: [
        { label: "A", revenueBilled: money(1000), revenueCollected: money(900) }, // 90%
        { label: "B", revenueBilled: money(100), revenueCollected: money(50) }, // 50%
      ],
      context: CONTEXT,
    });
    assert.ok(approx(result.value, 950 / 1100));
    assert.notEqual(result.value, 0.7); // the unweighted mean of 90% and 50%
  });

  it("names the parts whose revenue is missing instead of aggregating the rest", () => {
    const result = aggregateCollectionEfficiency({
      scope: { kind: "region", id: "R-1" },
      period: PERIOD,
      parts: [
        { label: "A", revenueBilled: money(1000), revenueCollected: money(900) },
        { label: "B", revenueBilled: money(100), revenueCollected: money(null) },
      ],
      context: CONTEXT,
    });
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.value, null);
    assert.deepEqual(result.missingInputs, ["B: revenue collected"]);
  });
});
