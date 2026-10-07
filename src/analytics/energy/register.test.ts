import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DataQuality, TelemetryPoint } from "@/domain";
import { buildTopologyIndex } from "../topology/registry.ts";
import { computeEnergyAccount } from "./account.ts";
import { sumMeterEnergy } from "./intervals.ts";
import { registerAdvance, registerAdvanceAround, registerConsumption, registerReadingSpan } from "./register.ts";
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

describe("a register advance as consumption recorded in a period", () => {
  // September 2026 in West Africa Time, and a three-day reading window.
  const MONTH = { start: "2026-09-01T00:00:00+01:00", end: "2026-10-01T00:00:00+01:00" };
  const on = (readings: TelemetryPoint[], windowDays = 3) => registerConsumption(METER, readings, MONTH, windowDays);

  it("counts when both readings are within the window of the period's ends, and is taken exactly as read", () => {
    const result = on([reading("2026-09-01T09:00:00+01:00", 1000), reading("2026-09-30T23:00:00+01:00", 1250)]);
    assert.equal(result.counted, true);
    assert.equal(result.advanceKwh, 250);
    assert.equal(result.exclusion, null);
    assert.equal(result.reason, null);
    assert.deepEqual(result.opening, { at: "2026-09-01T09:00:00+01:00", kwh: 1000 });
    assert.deepEqual(result.closing, { at: "2026-09-30T23:00:00+01:00", kwh: 1250 });
  });

  it("does not pro-rate: readings two days short of the month give the advance between them and nothing more", () => {
    const short = on([reading("2026-09-03T00:00:00+01:00", 0), reading("2026-09-29T00:00:00+01:00", 260)]);
    assert.equal(short.counted, true);
    // 26 days at 10 kWh a day. Stretching it to 30 days would give 300; it stays 260.
    assert.equal(short.advanceKwh, 260);
  });

  it("accepts a reading on either side of an end: last month's closing reading opens this month", () => {
    const result = on([reading("2026-08-30T10:00:00+01:00", 500), reading("2026-10-02T10:00:00+01:00", 900)]);
    assert.equal(result.counted, true);
    assert.equal(result.advanceKwh, 400);
  });

  it("counts a reading exactly on the edge of the window, and excludes one a minute beyond it", () => {
    assert.equal(on([reading("2026-09-04T00:00:00+01:00", 0), reading("2026-09-28T00:00:00+01:00", 10)]).counted, true);
    const late = on([reading("2026-09-04T00:01:00+01:00", 0), reading("2026-09-28T00:00:00+01:00", 10)]);
    assert.equal(late.counted, false);
    assert.equal(late.exclusion, "opening_outside_window");
    assert.equal(late.reason, "no register reading within 3 days of the start of the period");
    assert.equal(late.advanceKwh, null);
  });

  it("excludes an advance whose closing reading is outside the window, with the reason, and never substitutes for it", () => {
    const early = on([reading("2026-09-01T00:00:00+01:00", 100), reading("2026-09-25T12:00:00+01:00", 300)]);
    assert.equal(early.counted, false);
    assert.equal(early.exclusion, "closing_outside_window");
    assert.equal(early.reason, "no register reading within 3 days of the end of the period");
    assert.equal(early.advanceKwh, null);
    assert.deepEqual(early.opening, { at: "2026-09-01T00:00:00+01:00", kwh: 100 });
    assert.equal(early.closing, null);
  });

  it("uses the reading nearest each end when there are several", () => {
    const result = on([
      reading("2026-08-31T00:00:00+01:00", 90),
      reading("2026-09-01T06:00:00+01:00", 100),
      reading("2026-09-15T00:00:00+01:00", 180),
      reading("2026-09-30T20:00:00+01:00", 300),
      reading("2026-10-03T00:00:00+01:00", 330),
    ]);
    assert.equal(result.opening?.kwh, 100);
    assert.equal(result.closing?.kwh, 300);
    assert.equal(result.advanceKwh, 200);
  });

  it("excludes an advance that rests on an estimated reading: an estimate is not a measured source", () => {
    const result = on([reading("2026-09-01T00:00:00+01:00", 100), reading("2026-09-30T23:00:00+01:00", 400, "estimated")]);
    assert.equal(result.counted, false);
    assert.equal(result.exclusion, "estimated_reading");
    assert.equal(result.reason, "the closing reading is an estimate, not a reading of the meter");
    assert.equal(result.advanceKwh, null);
    assert.equal(on([reading("2026-09-01T00:00:00+01:00", 100, "substituted"), reading("2026-09-30T23:00:00+01:00", 400, "estimated")]).reason, "both readings are estimates, not a reading of the meter");
  });

  it("says when no reading is held, when only one is, and when the register went backwards", () => {
    assert.equal(on([]).exclusion, "no_readings");
    assert.equal(on([reading("2026-09-01T00:00:00+01:00", null, "missing")]).exclusion, "no_readings");
    assert.equal(on([reading("2026-09-01T00:00:00+01:00", 100)]).exclusion, "closing_outside_window");
    // A period shorter than the window: the one reading is nearest both ends.
    assert.equal(registerConsumption(METER, [reading("2026-01-01T00:10:00Z", 5)], PERIOD, 3).exclusion, "one_reading");
    assert.equal(on([reading("2026-09-01T00:00:00+01:00", 900), reading("2026-09-30T23:00:00+01:00", 20)]).exclusion, "register_went_backwards");
    assert.equal(registerConsumption(METER, [reading("2026-01-01T00:00:00Z", 1)], { start: PERIOD.end, end: PERIOD.start }, 3).exclusion, "invalid_period");
  });

  it("takes its window from the caller: a wider window admits what a narrower one excludes", () => {
    const readings = [reading("2026-09-01T00:00:00+01:00", 100), reading("2026-09-25T12:00:00+01:00", 300)];
    assert.equal(on(readings, 3).counted, false);
    assert.equal(on(readings, 7).counted, true);
    assert.equal(on(readings, 7).windowDays, 7);
  });

  it("gives the span in which a reading can open or close the period", () => {
    assert.deepEqual(registerReadingSpan(MONTH, 3), { from: "2026-08-28T23:00:00.000Z", to: "2026-10-03T23:00:00.000Z" });
    assert.equal(registerReadingSpan({ start: MONTH.end, end: MONTH.start }, 3), null);
  });
});

describe("recorded consumption from two measured sources", () => {
  const scope = { kind: "distribution_transformer", id: "DT-1" } as const;
  // SP-1's meter is read by hand; SP-2 keeps its interval meter.
  const registry = () => {
    const built = buildRegistry();
    built.meters = built.meters.map((m) => (m.id === "M-SP1" ? { ...m, meterType: "conventional" as const } : m));
    return built;
  };
  const account = (registerReadings: TelemetryPoint[]) =>
    computeEnergyAccount({
      index: buildTopologyIndex(registry()),
      scope,
      period: PERIOD,
      intervals: buildIntervals().filter((interval) => interval.meterId !== "M-SP1"),
      registerReadings,
      computedAt: CONTEXT.computedAt,
    });
  const sp2 = sumMeterEnergy(buildRegistry().meters.find((m) => m.id === "M-SP2")!, buildIntervals().filter((interval) => interval.meterId === "M-SP2"), PERIOD).importKwh as number;

  it("adds a counted register advance to interval energy for the total, and keeps each source's figure apart", () => {
    const result = account([reading("2026-01-01T00:00:00Z", 1000), reading("2026-01-01T01:00:00Z", 1042.5)]);
    assert.equal(result.consumptionCoverage.byIntervals, 1);
    assert.equal(result.consumptionCoverage.byRegister, 1);
    assert.equal(result.recordedBySource.intervals.value, sp2);
    assert.equal(result.recordedBySource.register.value, 42.5);
    assert.equal(result.recordedBySource.register.quality, "measured");
    assert.match(result.recordedBySource.register.derivation, /at 1 of 2 connection\(s\)/);
    assert.equal(result.recordedConsumption.status, "ok");
    assert.equal(result.recordedConsumption.value, sp2 + 42.5);
  });

  it("leaves the total unavailable when an advance is excluded, and keeps the other source's figure", () => {
    const result = account([reading("2026-01-01T00:00:00Z", 1000), reading("2026-01-01T01:00:00Z", 1042.5, "estimated")]);
    assert.equal(result.recordedConsumption.value, null);
    assert.equal(result.recordedConsumption.status, "insufficient_data");
    assert.deepEqual(result.recordedConsumption.missingInputs, ["register advance of meter M-SP1 (not counted: the closing reading is an estimate, not a reading of the meter)"]);
    assert.equal(result.consumptionCoverage.registerExcluded, 1);
    assert.deepEqual(result.consumptionCoverage.registerExclusions, { estimated_reading: 1 });
    assert.equal(result.recordedBySource.intervals.value, sp2);
    // No connection is covered by the register source: it has no figure, not a zero.
    assert.equal(result.recordedBySource.register.value, null);
    assert.equal(result.recordedBySource.register.status, "insufficient_data");
  });

  it("counts no register advance when no reading is supplied", () => {
    const result = account([]);
    assert.equal(result.consumptionCoverage.notRead, 1);
    assert.equal(result.consumptionCoverage.byRegister, 0);
    assert.equal(result.recordedConsumption.value, null);
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
    assert.deepEqual(account.consumptionCoverage, { servicePoints: 2, byIntervals: 0, intervalsIncomplete: 0, byRegister: 0, registerExcluded: 0, notRead: 1, unmetered: 1, registerExclusions: {} });
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
    assert.deepEqual(account.consumptionCoverage, { servicePoints: 4, byIntervals: 4, intervalsIncomplete: 0, byRegister: 0, registerExcluded: 0, notRead: 0, unmetered: 0, registerExclusions: {} });
  });
});

describe("the register advance a period's bill rests on", () => {
  const MONTH = { start: "2026-09-01T00:00:00+01:00", end: "2026-10-01T00:00:00+01:00" };
  const around = (readings: TelemetryPoint[]) => registerAdvanceAround(METER, readings, MONTH);

  it("is between the reading nearest the period's start and the reading nearest its end, however far they are", () => {
    // A round read this meter four days before each end of the month: outside any reading window, and still the bill's two readings.
    const result = around([reading("2026-08-28T10:00:00+01:00", 1000), reading("2026-09-27T10:00:00+01:00", 1180)]);
    assert.equal(result.status, "ok");
    assert.equal(result.advanceKwh, 180);
    assert.deepEqual(result.opening, { at: "2026-08-28T10:00:00+01:00", kwh: 1000 });
    assert.deepEqual(result.closing, { at: "2026-09-27T10:00:00+01:00", kwh: 1180 });
    assert.equal(result.quality, "measured");
    // The same two readings do not count toward the month's recorded consumption: that is a separate question.
    assert.equal(registerConsumption(METER, [reading("2026-08-28T10:00:00+01:00", 1000), reading("2026-09-27T10:00:00+01:00", 1180)], MONTH, 3).counted, false);
  });

  it("picks the round nearest each end when earlier and later rounds are held too", () => {
    const result = around([
      reading("2026-07-30T10:00:00+01:00", 800),
      reading("2026-08-30T10:00:00+01:00", 1000),
      reading("2026-09-29T10:00:00+01:00", 1200),
      reading("2026-10-30T10:00:00+01:00", 1400),
    ]);
    assert.deepEqual([result.opening?.kwh, result.closing?.kwh, result.advanceKwh, result.readings], [1000, 1200, 200, 4]);
  });

  it("is an estimate when either reading is one", () => {
    assert.equal(around([reading("2026-08-30T10:00:00+01:00", 1000), reading("2026-09-29T10:00:00+01:00", 1200, "estimated")]).quality, "estimated");
  });

  it("gives no advance from one reading, from none, or from a register that went backwards", () => {
    const one = around([reading("2026-09-29T10:00:00+01:00", 1200)]);
    assert.deepEqual([one.status, one.advanceKwh, one.readings], ["insufficient_data", null, 1]);
    assert.deepEqual(one.missingInputs, ["two register readings of meter M-SP1 around the period"]);
    assert.deepEqual([around([]).status, around([]).readings], ["insufficient_data", 0]);
    const backwards = around([reading("2026-08-30T10:00:00+01:00", 1000), reading("2026-09-29T10:00:00+01:00", 20)]);
    assert.equal(backwards.status, "not_computable");
    assert.equal(backwards.warnings[0].code, "REGISTER_WENT_BACKWARDS");
    assert.equal(registerAdvanceAround(METER, [reading("2026-08-30T10:00:00+01:00", 1)], { start: MONTH.end, end: MONTH.start }).warnings[0].code, "INVALID_PERIOD");
  });

  it("ignores other meters and other metrics", () => {
    const other: TelemetryPoint = { ...reading("2026-09-30T10:00:00+01:00", 9999), metric: "energy_export_register_kwh" };
    const result = around([reading("2026-08-30T10:00:00+01:00", 10), reading("2026-09-29T10:00:00+01:00", 12), reading("2026-09-30T12:00:00+01:00", 700, "measured", "M-SP2"), other]);
    assert.equal(result.advanceKwh, 2);
  });
});
