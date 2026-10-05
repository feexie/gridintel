import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue, MonetaryInput } from "../core/result.ts";
import type { EnergyAccountInputs } from "./account.ts";
import { ENERGY_REFERENCE } from "../core/methodology.ts";
import { buildTopologyIndex, customersServed } from "../topology/registry.ts";
import { computeEnergyAccount } from "./account.ts";
import { sectionBoundary } from "./boundary.ts";
import { sumMeterEnergy } from "./intervals.ts";
import { CONTEXT, PERIOD, buildIntervals, buildRegistry, halfHourly, meter } from "../__fixtures__/network.ts";

const kwh = (value: number | null, origin: InputValue["origin"] = "observed"): InputValue => ({
  value,
  unit: "kWh",
  origin,
  quality: "measured",
});
const ngn = (value: number | null): MonetaryInput => ({
  value,
  unit: "currency",
  currency: "NGN",
  scale: 1,
  origin: "observed",
  quality: "measured",
});

const DT1_INPUTS: EnergyAccountInputs = {
  technicalLoss: kwh(10, "calculated"),
  energyBilled: kwh(150),
  revenueBilled: ngn(1500),
  revenueCollected: ngn(1200),
};

function account(overrides: Partial<Parameters<typeof computeEnergyAccount>[0]> = {}) {
  return computeEnergyAccount({
    index: buildTopologyIndex(buildRegistry()),
    scope: { kind: "distribution_transformer", id: "DT-1" },
    period: PERIOD,
    intervals: buildIntervals(),
    inputs: DT1_INPUTS,
    computedAt: CONTEXT.computedAt,
    ...overrides,
  });
}

describe("energy accounting — known example (DT-1)", () => {
  it("follows the chain from received to billed", () => {
    const result = account();
    assert.equal(result.status, "ok");
    assert.equal(result.received.value, 200);
    assert.equal(result.energyInput.value, 200);
    assert.equal(result.downstreamMeasured.value, 170);
    assert.equal(result.sectionResidual.value, 30);
    assert.equal(result.technicalLoss.value, 10);
    assert.equal(result.delivered.value, 190);
    assert.equal(result.energyBilled.value, 150);
    assert.equal(result.unbilled.value, 40);
    assert.equal(result.totalLoss.value, 50);
    assert.equal(result.recordedConsumption.value, 170);
    assert.equal(result.revenueCollected?.value, 1200);
    assert.equal(result.lossBasis, "energy_input_net_of_transfers_out");
    assert.deepEqual(result.methodology, { id: "gridintel.energy.reference", version: "0.2.0" });
    assert.equal(result.computedAt, CONTEXT.computedAt);
  });

  it("traces every figure to its measurement boundary and direction", () => {
    const { input, downstream } = account().boundary;
    assert.equal(input.direction, "downstream_positive");
    assert.deepEqual(
      input.requirements.map((r) => [r.role, r.assetId, r.meterIds]),
      [["dt_totalizer", "DT-1", ["M-DT1"]]],
    );
    assert.deepEqual(
      downstream.requirements.map((r) => [r.role, r.assetId, r.netKwh]),
      [
        ["service_point", "SP-1", 90],
        ["service_point", "SP-2", 80],
      ],
    );
  });

  it("warns that topology is resolved as it is now", () => {
    assert.ok(account().warnings.some((w) => w.code === "TOPOLOGY_CURRENT_ONLY"));
  });

  it("does not mutate its inputs", () => {
    const registry = buildRegistry();
    const intervals = buildIntervals();
    const before = structuredClone({ registry, intervals, DT1_INPUTS });
    account({ index: buildTopologyIndex(registry), intervals });
    assert.deepEqual({ registry, intervals, DT1_INPUTS }, before);
  });
});

describe("energy accounting — boundaries by level", () => {
  const index = buildTopologyIndex(buildRegistry());

  it("feeder: feeder head in; DT totalizers and direct service points downstream", () => {
    const boundary = sectionBoundary(index, { kind: "feeder", id: "FD-1" });
    assert.deepEqual(boundary.input.map((r) => r.role), ["feeder_head"]);
    assert.deepEqual(
      boundary.downstream.map((r) => [r.role, r.assetId]),
      [
        ["dt_totalizer", "DT-1"],
        ["dt_totalizer", "DT-2"],
        ["service_point", "SP-4"],
      ],
    );
    assert.ok(![...boundary.input, ...boundary.downstream].some((r) => r.role === "substation_incomer"));

    const result = account({ scope: { kind: "feeder", id: "FD-1" }, inputs: {} });
    assert.equal(result.received.value, 400);
    assert.equal(result.downstreamMeasured.value, 380);
    assert.equal(result.sectionResidual.value, 20);
    assert.equal(result.recordedConsumption.value, 330);
  });

  it("substation: incomer in; feeder heads downstream", () => {
    const boundary = sectionBoundary(index, { kind: "substation", id: "SS-1" });
    assert.deepEqual(boundary.input.map((r) => r.role), ["substation_incomer"]);
    assert.deepEqual(
      boundary.downstream.map((r) => [r.role, r.assetId]),
      [
        ["feeder_head", "FD-1"],
        ["feeder_head", "FD-2"],
      ],
    );
    const result = account({ scope: { kind: "substation", id: "SS-1" }, inputs: {} });
    assert.equal(result.received.value, 520);
    assert.equal(result.downstreamMeasured.value, 500);
  });

  it("uses import − export, so reverse flow reduces energy received", () => {
    const intervals = [
      ...buildIntervals().filter((i) => i.meterId !== "M-DT1"),
      ...halfHourly("M-DT1", [[100, 10], [100, 10]]),
    ];
    assert.equal(account({ intervals }).received.value, 180);
  });

  it("does not assume a meter exists because an asset exists", () => {
    const registry = buildRegistry();
    registry.meters = registry.meters.filter((m) => m.id !== "M-DT2");
    const result = account({ index: buildTopologyIndex(registry), scope: { kind: "feeder", id: "FD-1" }, inputs: {} });
    assert.equal(result.downstreamMeasured.value, null);
    assert.ok(result.crossChecks.missingInputs.includes("dt_totalizer meter for distribution_transformer DT-2"));
    assert.equal(result.crossChecks.status, "insufficient_data");
    // The input boundary is still fully measured.
    assert.equal(result.received.value, 400);
  });

  it("rejects a feeder that supplies a substation rather than guessing its boundary", () => {
    const registry = buildRegistry();
    registry.substations = [...registry.substations, { ...registry.substations[0], id: "SS-2", supplyFeederIds: ["FD-2"] }];
    const result = account({ index: buildTopologyIndex(registry), scope: { kind: "feeder", id: "FD-2" }, inputs: {} });
    assert.equal(result.status, "not_computable");
    assert.equal(result.received.value, null);
    assert.ok(result.warnings.some((w) => w.code === "UNSUPPORTED_TOPOLOGY"));
  });

  it("does not account administrative scopes without cut-based aggregation", () => {
    const result = account({ scope: { kind: "region", id: "R-1" }, inputs: {} });
    assert.equal(result.status, "not_computable");
    assert.ok(result.warnings.some((w) => w.code === "UNSUPPORTED_SCOPE"));
  });
});

describe("energy accounting — missing data never becomes zero", () => {
  it("a gap interval makes energy received null, not a smaller sum", () => {
    const intervals = buildIntervals().filter(
      (i) => !(i.meterId === "M-DT1" && i.intervalStart !== "2026-01-01T00:00:00.000Z"),
    );
    const result = account({ intervals });
    assert.equal(result.received.value, null);
    assert.equal(result.received.status, "insufficient_data");
    assert.equal(result.energyInput.value, null);
    assert.equal(result.unbilled.value, null);
    assert.equal(result.status, "insufficient_data");
    assert.ok(result.missingInputs.includes("complete import channel for meter M-DT1"));
  });

  it("an interval with quality 'missing' makes the total null", () => {
    const intervals = buildIntervals().map((i) =>
      i.meterId === "M-DT1" && i.intervalStart === "2026-01-01T00:00:00.000Z" ? { ...i, quality: "missing" as const } : i,
    );
    const total = sumMeterEnergy(
      meter("M-DT1", { role: "dt_totalizer", transformerId: "DT-1" }),
      intervals,
      PERIOD,
    );
    assert.equal(total.importKwh, null);
    assert.equal(total.netKwh, null);
    assert.equal(total.coverage, 0.5);
    assert.equal(total.status, "insufficient_data");
  });

  it("a suspect interval is used and makes the result suspect", () => {
    const intervals = buildIntervals().map((i) =>
      i.meterId === "M-DT1" && i.intervalStart === "2026-01-01T00:00:00.000Z" ? { ...i, quality: "suspect" as const } : i,
    );
    const result = account({ intervals });
    assert.equal(result.received.value, 200);
    assert.equal(result.received.quality, "suspect");
    assert.equal(result.quality, "suspect");
  });

  it("missing billing inputs leave the billed side null, with the measured side intact", () => {
    const result = account({ inputs: {} });
    assert.equal(result.received.value, 200);
    assert.equal(result.energyBilled.value, null);
    assert.equal(result.unbilled.value, null);
    assert.equal(result.delivered.value, null);
    assert.ok(result.missingInputs.includes("technical loss"));
    assert.ok(result.missingInputs.includes("energy billed"));
    assert.ok(result.missingInputs.includes("revenue collected"));
  });
});

describe("energy accounting — DER/BESS is not double counted", () => {
  const der = { label: "rooftop PV", energy: kwh(20), measuredSeparately: false };

  it("ignores DER energy by default: the boundary meter already includes it", () => {
    const result = account({ inputs: { ...DT1_INPUTS, embeddedAdjustments: [der] } });
    assert.equal(result.received.value, 200);
    assert.equal(result.energyInput.value, 200);
    assert.equal(result.embeddedApplied.value, 0);
    assert.deepEqual(result.embeddedIgnored.map((i) => i.label), ["rooftop PV"]);
    assert.ok(result.warnings.some((w) => w.code === "DER_ADJUSTMENT_NOT_PERMITTED"));
  });

  it("ignores DER energy that is not separately measured, even if the methodology allows adjustments", () => {
    const methodology = { ...ENERGY_REFERENCE, parameters: { ...ENERGY_REFERENCE.parameters, embeddedAdjustment: "separately_measured_only" as const } };
    const result = account({ methodology, inputs: { ...DT1_INPUTS, embeddedAdjustments: [der] } });
    assert.equal(result.energyInput.value, 200);
    assert.ok(result.warnings.some((w) => w.code === "DER_ALREADY_IN_BOUNDARY"));
  });

  it("adds separately measured DER only when the methodology requires it", () => {
    const methodology = { ...ENERGY_REFERENCE, parameters: { ...ENERGY_REFERENCE.parameters, embeddedAdjustment: "separately_measured_only" as const } };
    const result = account({
      methodology,
      inputs: { ...DT1_INPUTS, embeddedAdjustments: [{ ...der, measuredSeparately: true }] },
    });
    assert.equal(result.received.value, 200);
    assert.equal(result.embeddedApplied.value, 20);
    assert.equal(result.energyInput.value, 220);
  });
});

describe("topology helper", () => {
  it("counts active customers under a scope, current topology only", () => {
    const index = buildTopologyIndex(buildRegistry());
    const feeder = customersServed(index, { kind: "feeder", id: "FD-1" });
    assert.equal(feeder.input.value, 4); // C-5 is closed
    assert.equal(feeder.input.origin, "calculated");
    assert.ok(feeder.warnings.some((w) => w.code === "TOPOLOGY_CURRENT_ONLY"));
    assert.equal(customersServed(index, { kind: "distribution_transformer", id: "DT-1" }).input.value, 2);
    // Region membership is inherited from the substation's adminRegionId.
    assert.equal(customersServed(index, { kind: "region", id: "R-1" }).input.value, 4);
    assert.equal(customersServed(index, { kind: "feeder", id: "NOPE" }).input.value, null);
  });
});
