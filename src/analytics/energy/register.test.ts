import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DataQuality, TelemetryPoint } from "@/domain";
import { buildTopologyIndex } from "../topology/registry.ts";
import { computeEnergyAccount } from "./account.ts";
import { sumMeterEnergy } from "./intervals.ts";
import { registerAdvance } from "./register.ts";
import { CONTEXT, PERIOD, PROVENANCE, buildIntervals, buildRegistry, meter } from "../__fixtures__/network.ts";

const METER = meter("M-SP1", { role: "service_point", servicePointId: "SP-1" }, { meterType: "conventional" });

function reading(at: string, value: number | null, quality: DataQuality = "measured", meterId = "M-SP1"): TelemetryPoint {
  return { source: { kind: "meter", id: meterId }, metric: "energy_import_register_kwh", observedAt: at, value, quality, provenance: PROVENANCE };
}

describe("register advance", () => {
  it("is the last reading less the first, and says which two readings it lies between", () => {
    const result = registerAdvance(METER, [reading("2026-01-01T00:50:00Z", 1042.5), reading("2026-01-01T00:00:00Z", 1000)], PERIOD);
    assert.equal(result.status, "ok");
    assert.equal(result.advanceKwh, 42.5);
    assert.deepEqual(result.opening, { at: "2026-01-01T00:00:00Z", kwh: 1000 });
    assert.deepEqual(result.closing, { at: "2026-01-01T00:50:00Z", kwh: 1042.5 });
    assert.equal(result.quality, "measured");
    assert.equal(result.readings, 2);
  });

  it("uses the first and the last of several readings, and counts a reading at the very end of the period", () => {
    const result = registerAdvance(METER, [reading("2026-01-01T00:10:00Z", 5), reading("2026-01-01T00:30:00Z", 9), reading("2026-01-01T01:00:00Z", 20)], PERIOD);
    assert.equal(result.advanceKwh, 15);
    assert.equal(result.closing?.at, "2026-01-01T01:00:00Z");
    assert.equal(result.readings, 3);
  });

  it("is an estimate when either reading is one", () => {
    const result = registerAdvance(METER, [reading("2026-01-01T00:00:00Z", 100), reading("2026-01-01T00:50:00Z", 130, "estimated")], PERIOD);
    assert.equal(result.status, "ok");
    assert.equal(result.advanceKwh, 30);
    assert.equal(result.quality, "estimated");
  });

  it("is missing, never zero, with fewer than two usable readings in the period", () => {
    const none = registerAdvance(METER, [], PERIOD);
    assert.equal(none.status, "insufficient_data");
    assert.equal(none.advanceKwh, null);
    assert.equal(none.readings, 0);
    assert.deepEqual(none.missingInputs, ["two register readings of meter M-SP1 in the period"]);

    const one = registerAdvance(
      METER,
      [reading("2026-01-01T00:00:00Z", 100), reading("2026-01-01T00:30:00Z", null, "missing"), reading("2025-12-31T23:00:00Z", 50), reading("2026-01-01T02:00:00Z", 300)],
      PERIOD,
    );
    assert.equal(one.status, "insufficient_data");
    assert.equal(one.advanceKwh, null);
    assert.equal(one.readings, 1);
  });

  it("ignores another meter's readings and other metrics", () => {
    const other: TelemetryPoint = { ...reading("2026-01-01T00:40:00Z", 999), metric: "energy_export_register_kwh" };
    const result = registerAdvance(METER, [reading("2026-01-01T00:00:00Z", 10), reading("2026-01-01T00:20:00Z", 12), reading("2026-01-01T00:50:00Z", 700, "measured", "M-SP2"), other], PERIOD);
    assert.equal(result.advanceKwh, 2);
  });

  it("gives no advance when the register goes backwards, and says so", () => {
    const result = registerAdvance(METER, [reading("2026-01-01T00:00:00Z", 500), reading("2026-01-01T00:50:00Z", 20)], PERIOD);
    assert.equal(result.status, "not_computable");
    assert.equal(result.advanceKwh, null);
    assert.deepEqual(result.warnings.map((warning) => warning.code), ["REGISTER_WENT_BACKWARDS"]);
  });

  it("gives no advance for an invalid period", () => {
    const result = registerAdvance(METER, [reading("2026-01-01T00:00:00Z", 1), reading("2026-01-01T00:50:00Z", 2)], { start: PERIOD.end, end: PERIOD.start });
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.advanceKwh, null);
  });
});

describe("a meter that is not read on intervals", () => {
  it("has no interval total, is named as missing, and raises no warning when it is a conventional meter", () => {
    const total = sumMeterEnergy(METER, [], PERIOD);
    assert.equal(total.status, "insufficient_data");
    assert.equal(total.importKwh, null);
    assert.equal(total.recordsInPeriod, 0);
    assert.deepEqual(total.missingInputs, ["interval energy for meter M-SP1 (conventional meter, not read on intervals)"]);
    assert.deepEqual(total.warnings, []);
  });

  it("still raises a warning when a meter that should report intervals has none", () => {
    const total = sumMeterEnergy({ ...METER, meterType: "smart" }, [], PERIOD);
    assert.equal(total.importKwh, null);
    assert.deepEqual(total.warnings.map((warning) => warning.code), ["NO_INTERVAL_DATA"]);
  });

  it("makes recorded consumption unavailable rather than smaller, and is counted apart from an unmetered connection", () => {
    const registry = buildRegistry();
    // SP-1's meter is read by hand; SP-2 has no meter at all.
    registry.meters = registry.meters
      .filter((m) => m.id !== "M-SP2")
      .map((m) => (m.id === "M-SP1" ? { ...m, meterType: "conventional" as const } : m));
    const account = computeEnergyAccount({
      index: buildTopologyIndex(registry),
      scope: { kind: "distribution_transformer", id: "DT-1" },
      period: PERIOD,
      intervals: buildIntervals().filter((interval) => interval.meterId !== "M-SP1" && interval.meterId !== "M-SP2"),
      inputs: { technicalLoss: { value: 10, unit: "kWh", origin: "calculated", quality: "measured" }, energyBilled: { value: 150, unit: "kWh", origin: "observed", quality: "measured" } },
      computedAt: CONTEXT.computedAt,
    });
    assert.equal(account.recordedConsumption.value, null);
    assert.equal(account.recordedConsumption.status, "insufficient_data");
    assert.deepEqual(account.consumptionCoverage, { servicePoints: 2, recorded: 0, incomplete: 0, withoutIntervalData: 1, unmetered: 1 });
    assert.deepEqual(account.recordedConsumption.missingInputs, [
      "interval energy for meter M-SP1 (conventional meter, not read on intervals)",
      "service_point meter for service_point SP-2",
    ]);
    // The chain does not read customer meters: it is whole.
    assert.equal(account.unbilled.value, 40);
    assert.equal(account.unbilled.status, "ok");
    // No energy figure of the chain is missing (this test supplies no revenue, which is all that is).
    assert.deepEqual(account.missingInputs, ["revenue billed", "revenue collected"]);
    assert.equal(account.crossChecks.status, "insufficient_data");
  });

  it("counts every connection as recorded where each has complete intervals", () => {
    const account = computeEnergyAccount({
      index: buildTopologyIndex(buildRegistry()),
      scope: { kind: "feeder", id: "FD-1" },
      period: PERIOD,
      intervals: buildIntervals(),
      computedAt: CONTEXT.computedAt,
    });
    assert.deepEqual(account.consumptionCoverage, { servicePoints: 4, recorded: 4, incomplete: 0, withoutIntervalData: 0, unmetered: 0 });
  });
});
