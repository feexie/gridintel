import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { qualityRank, worstQuality } from "./quality.ts";
import { ratio } from "./result.ts";
import { toEpochMs } from "./time.ts";
import { convertUnit, dimensionOf } from "./units.ts";
import { ATCC_REFERENCE, REFERENCE_DISCLAIMER } from "./methodology.ts";

describe("units (unit consistency)", () => {
  it("converts within a dimension", () => {
    assert.equal(convertUnit(1.5, "MWh", "kWh"), 1500);
    assert.equal(convertUnit(250, "kW", "MW"), 0.25);
    assert.equal(convertUnit(2, "MVA", "kVA"), 2000);
    assert.equal(convertUnit(17.2, "percent", "fraction"), 0.172);
    assert.equal(convertUnit(1.5, "hours", "minutes"), 90);
  });

  it("refuses to convert across dimensions", () => {
    assert.equal(convertUnit(100, "kWh", "kW"), null);
    assert.equal(convertUnit(100, "kW", "kVA"), null);
    assert.equal(convertUnit(1, "percent", "count"), null);
    assert.equal(dimensionOf("MWh"), "energy");
  });
});

describe("quality ranking", () => {
  it("ranks through an explicit function, not string order", () => {
    // Alphabetically "estimated" < "measured", but measured is the better quality.
    assert.ok(qualityRank("measured") < qualityRank("estimated"));
    assert.ok(qualityRank("estimated") < qualityRank("substituted"));
    assert.ok(qualityRank("substituted") < qualityRank("suspect"));
    assert.ok(qualityRank("suspect") < qualityRank("missing"));
  });

  it("picks the worst quality, and null for no inputs", () => {
    assert.equal(worstQuality(["measured", "suspect", "estimated"]), "suspect");
    assert.equal(worstQuality([]), null);
  });
});

describe("ratio (zero-denominator handling)", () => {
  it("returns a real zero for a zero numerator", () => {
    assert.deepEqual(ratio("n", 0, "d", 10), { status: "ok", value: 0, missingInputs: [], warnings: [] });
  });

  it("is not_computable for a zero denominator", () => {
    const outcome = ratio("n", 5, "d", 0);
    assert.equal(outcome.status, "not_computable");
    assert.equal(outcome.value, null);
    assert.equal(outcome.warnings[0].code, "ZERO_DENOMINATOR");
  });

  it("is insufficient_data for a missing input, never zero", () => {
    const outcome = ratio("n", null, "d", 10);
    assert.equal(outcome.status, "insufficient_data");
    assert.equal(outcome.value, null);
    assert.deepEqual(outcome.missingInputs, ["n"]);
  });
});

describe("time", () => {
  it("rejects timestamps without an explicit zone, so results do not depend on the machine", () => {
    assert.equal(toEpochMs("2026-01-01T00:00:00"), null);
    assert.equal(toEpochMs("2026-01-01T00:00:00Z"), Date.UTC(2026, 0, 1));
    assert.equal(toEpochMs("2026-01-01T01:00:00+01:00"), Date.UTC(2026, 0, 1));
  });
});

describe("reference methodology", () => {
  it("is a GridIntel draft reference, not a regulatory method", () => {
    assert.equal(ATCC_REFERENCE.id, "gridintel.atcc.reference");
    assert.equal(ATCC_REFERENCE.version, "0.1.0");
    assert.equal(ATCC_REFERENCE.authority, "gridintel_reference");
    assert.equal(ATCC_REFERENCE.status, "draft");
    assert.equal(ATCC_REFERENCE.disclaimer, REFERENCE_DISCLAIMER);
    assert.match(REFERENCE_DISCLAIMER, /not a regulatory figure/);
  });
});
