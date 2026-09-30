import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ReportedKpi } from "@/domain";
import type { CalculatedKpi } from "../core/result.ts";
import { compareKpi } from "./compare.ts";
import { CONTEXT, PERIOD, PROVENANCE, approx } from "../__fixtures__/network.ts";

const SCOPE = { kind: "distribution_transformer" as const, id: "DT-1" };

const reported = (extra: Partial<ReportedKpi> = {}): ReportedKpi => ({
  id: "RK-1",
  metric: "atcc",
  scope: SCOPE,
  period: PERIOD,
  asOf: null,
  value: 17.2,
  unit: "percent",
  source: { name: "test", kind: "gridintel_mock" },
  document: null,
  methodology: { name: "source's stated method" },
  reportedAt: null,
  provenance: PROVENANCE,
  ...extra,
});

const calculated = (extra: Partial<CalculatedKpi> = {}): CalculatedKpi => ({
  kind: "calculated",
  metric: "atcc",
  scope: SCOPE,
  period: PERIOD,
  asOf: null,
  status: "ok",
  value: 0.4,
  unit: "fraction",
  methodology: { id: "gridintel.atcc.reference", version: "0.1.0" },
  inputs: {},
  missingInputs: [],
  coverage: null,
  quality: "measured",
  warnings: [],
  computedAt: CONTEXT.computedAt,
  ...extra,
});

describe("reported vs calculated KPI", () => {
  it("shows both values, the variance in percentage points and the relative variance", () => {
    const comparison = compareKpi(reported(), calculated());
    assert.equal(comparison.reported.value, 17.2);
    assert.equal(comparison.calculated.value, 0.4);
    assert.ok(approx(comparison.calculatedInReportedUnit, 40));
    assert.ok(approx(comparison.variance.absolute, 22.8));
    assert.equal(comparison.variance.absoluteUnit, "percentage_points");
    assert.ok(approx(comparison.variance.relative, 22.8 / 17.2));
    assert.equal(comparison.comparable, true);
    assert.ok(comparison.issues.some((i) => i.code === "METHODOLOGY_NOT_VERIFIED" && !i.blocking));
  });

  it("never overwrites or mutates the reported record", () => {
    const record = reported();
    const snapshot = structuredClone(record);
    const comparison = compareKpi(record, calculated());
    assert.equal(comparison.reported, record);
    assert.deepEqual(record, snapshot);
  });

  it("is not comparable when the reported period or methodology is unstated", () => {
    const comparison = compareKpi(reported({ period: null, methodology: null }), calculated());
    assert.equal(comparison.comparable, false);
    const codes = comparison.issues.map((i) => i.code);
    assert.ok(codes.includes("PERIOD_UNSPECIFIED"));
    assert.ok(codes.includes("METHODOLOGY_UNSPECIFIED"));
    // The variance is still shown, with the caveats.
    assert.ok(approx(comparison.variance.absolute, 22.8));
  });

  it("flags scope and period mismatches and unresolved scopes", () => {
    assert.ok(
      compareKpi(reported({ scope: { kind: "feeder", id: "FD-1" } }), calculated()).issues.some((i) => i.code === "SCOPE_MISMATCH"),
    );
    assert.ok(
      compareKpi(reported({ scope: { kind: "region", label: "Adamawa" } }), calculated()).issues.some(
        (i) => i.code === "SCOPE_UNRESOLVED",
      ),
    );
    assert.ok(
      compareKpi(reported({ period: { start: PERIOD.start, end: "2026-02-01T00:00:00Z" } }), calculated()).issues.some(
        (i) => i.code === "PERIOD_MISMATCH",
      ),
    );
  });

  it("treats the same instants written differently as the same period", () => {
    const comparison = compareKpi(
      reported({ period: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-01T02:00:00+01:00" } }),
      calculated(),
    );
    assert.ok(!comparison.issues.some((i) => i.code === "PERIOD_MISMATCH"));
  });

  it("has no relative variance when the reported value is zero", () => {
    const comparison = compareKpi(reported({ value: 0 }), calculated());
    assert.equal(comparison.variance.relative, null);
    assert.ok(approx(comparison.variance.absolute, 40));
  });

  it("does not compute a variance across different unit dimensions", () => {
    const comparison = compareKpi(reported({ unit: "kWh", value: 100 }), calculated());
    assert.equal(comparison.variance.absolute, null);
    assert.equal(comparison.comparable, false);
    assert.ok(comparison.issues.some((i) => i.code === "UNIT_DIMENSION_MISMATCH"));
  });

  it("does not produce a variance when the calculation was insufficient", () => {
    const comparison = compareKpi(reported(), calculated({ status: "insufficient_data", value: null }));
    assert.equal(comparison.variance.absolute, null);
    assert.equal(comparison.comparable, false);
  });

  it("notes reported inputs and limited quality without blocking", () => {
    const comparison = compareKpi(
      reported(),
      calculated({
        quality: "estimated",
        inputs: { energyBilled: { value: 150, unit: "kWh", origin: "reported", quality: "measured" } },
      }),
    );
    assert.equal(comparison.comparable, true);
    const codes = comparison.issues.map((i) => i.code);
    assert.ok(codes.includes("INPUTS_FROM_REPORTED"));
    assert.ok(codes.includes("CALCULATION_QUALITY_LIMITED"));
  });

  it("compares point-in-time values by as-of time", () => {
    const loadingReported = reported({ metric: "transformer_loading", period: null, asOf: "2026-01-01T12:00:00Z", value: 68 });
    const loadingCalculated = calculated({ metric: "transformer_loading", period: null, asOf: "2026-01-01T12:00:00Z", value: 1 });
    const comparison = compareKpi(loadingReported, loadingCalculated);
    assert.ok(approx(comparison.variance.absolute, 32));
    assert.ok(!comparison.issues.some((i) => i.code === "AS_OF_MISMATCH"));
    assert.ok(
      compareKpi({ ...loadingReported, asOf: null }, loadingCalculated).issues.some((i) => i.code === "AS_OF_MISMATCH"),
    );
  });
});
