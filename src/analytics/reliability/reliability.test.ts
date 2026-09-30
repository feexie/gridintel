import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Outage, OutageExposure, Period } from "@/domain";
import type { InputValue } from "../core/result.ts";
import { RELIABILITY_REFERENCE } from "../core/methodology.ts";
import { calculateReliability } from "./indices.ts";
import { CONTEXT, PROVENANCE, approx } from "../__fixtures__/network.ts";

const DAY_1: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };
const DAY_2: Period = { start: "2026-01-02T00:00:00Z", end: "2026-01-03T00:00:00Z" };
const SCOPE = { kind: "feeder" as const, id: "FD-1" };

const exposure = (
  customersAffected: number | null,
  interruptedAt?: string,
  restoredAt?: string,
): OutageExposure => ({
  affected: { kind: "distribution_transformer", id: "DT-1" },
  customersAffected,
  customerCountBasis: "recorded",
  interruptedAt,
  restoredAt,
  quality: "measured",
});

const outage = (id: string, planned: boolean | null, exposures: OutageExposure[], extra: Partial<Outage> = {}): Outage => ({
  id,
  origin: { kind: "feeder", id: "FD-1" },
  planned,
  cause: planned ? "planned_maintenance" : "fault",
  responsibleParty: "distribution",
  exposures,
  provenance: PROVENANCE,
  ...extra,
});

// One unplanned fault restored in two stages, a planned outage that crosses midnight,
// a momentary interruption, and two exposures without the data needed to use them.
const OUTAGES: Outage[] = [
  outage("O-1", false, [
    exposure(60, "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
    exposure(20, "2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z"),
  ]),
  outage("O-2", true, [exposure(30, "2026-01-01T23:00:00Z", "2026-01-02T01:00:00Z")]),
  outage("O-3", false, [exposure(50, "2026-01-01T14:00:00Z", "2026-01-01T14:02:00Z")]),
  outage("O-4", false, [exposure(null, "2026-01-01T15:00:00Z", "2026-01-01T16:00:00Z")]),
  outage("O-5", false, [exposure(40, "2026-01-01T17:00:00Z")]),
];

const served = (value: number | null): InputValue => ({ value, unit: "count", origin: "calculated", quality: "measured" });

function reliability(params: Partial<Parameters<typeof calculateReliability>[0]> = {}) {
  return calculateReliability({
    scope: SCOPE,
    period: DAY_1,
    outages: OUTAGES,
    customersServed: served(100),
    context: CONTEXT,
    ...params,
  });
}

describe("SAIDI / SAIFI from outage exposure", () => {
  it("computes indices from exposure segments, clipped to the period", () => {
    const result = reliability();
    // Customer-minutes: 60×60 + 20×120 + 30×60 (O-2 clipped at midnight) = 7800
    assert.equal(result.components.counted.saidi.customerMinutes, 7800);
    assert.equal(result.saidi.value, 78);
    assert.equal(result.saidi.unit, "minutes");
    // Interruptions starting in the period: 60 + 20 + 30 = 110
    assert.equal(result.saifi.value, 1.1);
    assert.ok(approx(result.caidi.value, 78 / 1.1));
    assert.ok(approx(result.asai.value, 1 - 7800 / (100 * 1440)));
  });

  it("does not assume a whole feeder was off for the whole outage", () => {
    // A feeder-duration approach would charge all 100 customers for O-1's 2 hours (12,000 minutes).
    const o1 = reliability({ outages: [OUTAGES[0]] });
    assert.equal(o1.components.counted.saidi.customerMinutes, 6000);
  });

  it("excludes momentary interruptions and exposures missing data, without inventing values", () => {
    const { components, saidi } = reliability();
    assert.equal(components.momentary.customerInterruptions, 50);
    assert.equal(components.excludedForData, 2);
    const reasons = components.exposures.map((e) => e.dataExclusion).filter((r) => r !== null);
    assert.deepEqual(reasons.sort(), ["CUSTOMERS_UNKNOWN", "RESTORATION_TIME_UNKNOWN"]);
    assert.ok(saidi.warnings.some((w) => w.code === "EXPOSURES_EXCLUDED"));
  });

  it("clips a period-crossing outage and counts only its in-period duration", () => {
    const result = reliability({ period: DAY_2 });
    assert.equal(result.components.counted.saidi.customerMinutes, 1800); // O-2: 30 × 60
    assert.equal(result.saidi.value, 18);
    // Under the reference rule the interruption belongs to the day it started.
    assert.equal(result.saifi.value, 0);

    const overlapping = { ...RELIABILITY_REFERENCE, parameters: { ...RELIABILITY_REFERENCE.parameters, saifiCounting: "overlaps_period" as const } };
    assert.equal(reliability({ period: DAY_2, methodology: overlapping }).saifi.value, 0.3);
  });

  it("keeps planned vs unplanned, cause and party visible, and lets the methodology choose", () => {
    const { components } = reliability();
    assert.equal(components.breakdown.byPlanned.planned.customerMinutes, 1800);
    assert.equal(components.breakdown.byPlanned.unplanned.customerMinutes, 6000);
    assert.equal(components.breakdown.byCause.fault?.customerInterruptions, 80);
    assert.equal(components.breakdown.byResponsibleParty.distribution?.exposures, 3);

    const noPlanned = {
      ...RELIABILITY_REFERENCE,
      parameters: { ...RELIABILITY_REFERENCE.parameters, include: { ...RELIABILITY_REFERENCE.parameters.include, planned: false } },
    };
    const result = reliability({ methodology: noPlanned });
    assert.equal(result.saidi.value, 60);
    assert.equal(result.saifi.value, 0.8);
  });

  it("classifies declared major events and excludes them only if the methodology says so", () => {
    const major = outage("O-6", false, [exposure(10, "2026-01-01T05:00:00Z", "2026-01-01T06:00:00Z")], {
      declarations: [{ kind: "major_event", declaredBy: "regulator" }],
    });
    const withMajor = reliability({ outages: [...OUTAGES, major] });
    assert.equal(withMajor.components.breakdown.majorEvent.major_event.customerMinutes, 600);
    assert.equal(withMajor.saidi.value, 84);

    const excludeMajor = {
      ...RELIABILITY_REFERENCE,
      parameters: { ...RELIABILITY_REFERENCE.parameters, include: { ...RELIABILITY_REFERENCE.parameters.include, majorEvents: false } },
    };
    assert.equal(reliability({ outages: [...OUTAGES, major], methodology: excludeMajor }).saidi.value, 78);
  });

  it("reports hours when the methodology asks for hours", () => {
    const hours = { ...RELIABILITY_REFERENCE, parameters: { ...RELIABILITY_REFERENCE.parameters, durationUnit: "hours" as const } };
    const result = reliability({ methodology: hours });
    assert.equal(result.saidi.unit, "hours");
    assert.ok(approx(result.saidi.value, 1.3));
  });

  it("handles missing and zero customer counts without dividing by zero", () => {
    assert.equal(reliability({ customersServed: served(null) }).saidi.status, "insufficient_data");
    const zero = reliability({ customersServed: served(0) });
    assert.equal(zero.saidi.status, "not_computable");
    assert.equal(zero.saifi.status, "not_computable");
    assert.equal(zero.asai.status, "not_computable");
  });

  it("is insufficient_data, not zero, for an invalid period", () => {
    const result = reliability({ period: { start: "2026-01-01T00:00:00", end: "2026-01-02T00:00:00Z" } });
    for (const kpi of [result.saidi, result.saifi, result.caidi, result.asai]) {
      assert.equal(kpi.status, "insufficient_data");
      assert.equal(kpi.value, null);
      assert.ok(kpi.missingInputs.includes("valid period"));
    }
  });

  it("does not report exposures from other periods as data problems", () => {
    const result = reliability({ period: DAY_2 });
    assert.equal(result.components.outsidePeriod, 3); // O-1 (×2) and O-3 happened on day 1
    assert.equal(result.components.excludedForData, 2); // O-4 (no customer count), O-5 (no restoration time)
  });

  it("gives a real zero, and a not-computable CAIDI, when there were no interruptions", () => {
    const result = reliability({ outages: [] });
    assert.equal(result.saidi.value, 0);
    assert.equal(result.saidi.status, "ok");
    assert.equal(result.asai.value, 1);
    assert.equal(result.caidi.status, "not_computable");
  });
});
