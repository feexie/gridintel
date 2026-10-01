import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ReportedKpi } from "@/domain";
import { reportedInput, reportedMoney } from "./inputs.ts";

function kpi(overrides: Partial<ReportedKpi>): ReportedKpi {
  return {
    id: "rk:test",
    metric: "collection_efficiency",
    scope: { kind: "region", id: "R-1" },
    period: null,
    asOf: null,
    value: 86.6,
    unit: "percent",
    source: { name: "Test", kind: "gridintel_mock" },
    document: null,
    basis: null,
    methodology: null,
    reportedAt: null,
    provenance: { sourceSystem: "test", ingestedAt: "2026-01-01T00:00:00Z" },
    ...overrides,
  };
}

describe("reported figures as inputs", () => {
  it("passes the value and unit on unchanged, tagged as reported", () => {
    assert.deepEqual(reportedInput(kpi({}), "ratio"), {
      ok: true,
      input: { value: 86.6, unit: "percent", origin: "reported", quality: "measured", ref: "rk:test" },
    });
  });

  it("refuses a unit of a different dimension", () => {
    const result = reportedInput(kpi({ unit: "kWh" }), "ratio");
    assert.equal(result.ok, false);
  });

  it("refuses a monetary figure as a plain input", () => {
    assert.equal(reportedInput(kpi({ unit: "currency", currency: "NGN" }), "currency").ok, false);
  });

  it("converts a monetary figure with its currency, at scale 1", () => {
    assert.deepEqual(reportedMoney(kpi({ unit: "currency", currency: "NGN", value: 820000000 })), {
      ok: true,
      input: {
        value: 820000000,
        unit: "currency",
        currency: "NGN",
        scale: 1,
        origin: "reported",
        quality: "measured",
        ref: "rk:test",
      },
    });
  });

  it("refuses money without a currency code, and a non-monetary figure as money", () => {
    assert.equal(reportedMoney(kpi({ unit: "currency" })).ok, false);
    assert.equal(reportedMoney(kpi({})).ok, false);
  });
});
