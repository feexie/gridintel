import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ReportedKpi } from "@/domain";
import type { DomainDataset } from "../../repositories/memory/dataset.ts";
import { calculateCollectionEfficiency } from "../../analytics/index.ts";
import { createInMemoryRepositories } from "../../repositories/memory/inMemoryRepositories.ts";
import { buildMockDataset, createMockRepositories } from "../../repositories/mock/index.ts";
import { reportedMoney } from "./inputs.ts";
import { regionCollectionEfficiency } from "./collection.ts";

const CONTEXT = { computedAt: "2026-10-01T00:00:00Z" };

describe("regional collection efficiency from the mock data", () => {
  it("calculates Adamawa's collection efficiency from its reported revenue", async () => {
    const result = await regionCollectionEfficiency({
      reported: createMockRepositories().reported,
      regionId: "adamawa",
      context: CONTEXT,
    });
    assert.equal(result.calculations.length, 1);
    const [{ sourceSystem, calculated }] = result.calculations;
    assert.equal(sourceSystem, "mock-executive");
    assert.equal(calculated.status, "ok");
    assert.equal(calculated.value, 710000000 / 820000000);
    assert.equal(calculated.unit, "fraction");
    assert.equal(calculated.period, null);
    assert.ok(Object.values(calculated.inputs).every((input) => input.origin === "reported"));
    assert.ok(calculated.warnings.some((warning) => warning.code === "INPUTS_FROM_REPORTED"));
    assert.deepEqual(result.skipped, []);
  });

  it("compares the calculation with every reported figure, and neither is changed", async () => {
    const result = await regionCollectionEfficiency({
      reported: createMockRepositories().reported,
      regionId: "adamawa",
      context: CONTEXT,
    });
    const comparisons = result.calculations[0].comparisons;
    assert.deepEqual(
      comparisons.map((comparison) => [comparison.reported.provenance.sourceSystem, comparison.reported.value]),
      [["mock-operations", 91.8], ["mock-executive", 86.6]],
    );
    for (const comparison of comparisons) {
      assert.equal(comparison.comparable, false);
      const codes = comparison.issues.map((issue) => issue.code);
      assert.ok(codes.includes("METHODOLOGY_UNSPECIFIED"));
      assert.ok(codes.includes("INPUTS_FROM_REPORTED"));
    }
    const executive = comparisons[1];
    assert.ok(Math.abs((executive.variance.absolute as number) - ((710000000 / 820000000) * 100 - 86.6)) < 1e-9);
  });

  it("gives the same result as calling analytics directly with the same inputs", async () => {
    const { dataset } = buildMockDataset();
    const find = (metric: ReportedKpi["metric"]) =>
      dataset.reportedKpis.find((kpi) => kpi.id === `rk:mock-executive:region:borno:${metric}`) as ReportedKpi;
    const billed = reportedMoney(find("revenue_billed"));
    const collected = reportedMoney(find("revenue_collected"));
    assert.ok(billed.ok && collected.ok);
    const direct = calculateCollectionEfficiency({
      scope: { kind: "region", id: "borno" },
      period: null,
      revenueBilled: billed.input,
      revenueCollected: collected.input,
      context: CONTEXT,
    });
    const result = await regionCollectionEfficiency({
      reported: createMockRepositories().reported,
      regionId: "borno",
      context: CONTEXT,
    });
    assert.deepEqual(result.calculations[0].calculated, direct);
  });
});

describe("regional collection efficiency with missing revenue", () => {
  const { dataset } = buildMockDataset();
  const withoutCollected: DomainDataset = {
    ...dataset,
    reportedKpis: dataset.reportedKpis.filter((kpi) => kpi.id !== "rk:mock-executive:region:yobe:revenue_collected"),
  };

  it("is insufficient_data, never 0, when revenue collected is missing", async () => {
    const result = await regionCollectionEfficiency({
      reported: createInMemoryRepositories(withoutCollected).reported,
      regionId: "yobe",
      context: CONTEXT,
    });
    const [{ calculated }] = result.calculations;
    assert.equal(calculated.status, "insufficient_data");
    assert.equal(calculated.value, null);
    assert.deepEqual(calculated.missingInputs, ["revenue collected"]);
  });

  it("makes no calculation for a region with no reported revenue", async () => {
    const result = await regionCollectionEfficiency({
      reported: createMockRepositories().reported,
      regionId: "no-such-region",
      context: CONTEXT,
    });
    assert.deepEqual(result.calculations, []);
  });
});
