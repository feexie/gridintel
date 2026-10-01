import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ReportedKpi } from "@/domain";
import { calculateCollectionEfficiency } from "../../analytics/index.ts";
import { sparseDataset, sparseRepositories } from "./__fixtures__/sparse.ts";
import { reportedMoney } from "./inputs.ts";
import { regionCollectionEfficiency } from "./collection.ts";

const CONTEXT = { computedAt: "2026-10-01T00:00:00Z" };

describe("regional collection efficiency from reported revenue", () => {
  it("calculates a region's collection efficiency from its reported revenue", async () => {
    const result = await regionCollectionEfficiency({ reported: sparseRepositories().reported, regionId: "R-1", context: CONTEXT });
    assert.equal(result.calculations.length, 1);
    const [{ sourceSystem, calculated }] = result.calculations;
    assert.equal(sourceSystem, "sparse-executive");
    assert.equal(calculated.status, "ok");
    assert.equal(calculated.value, 710000000 / 820000000);
    assert.equal(calculated.unit, "fraction");
    assert.equal(calculated.period, null);
    assert.ok(Object.values(calculated.inputs).every((input) => input.origin === "reported"));
    assert.ok(calculated.warnings.some((warning) => warning.code === "INPUTS_FROM_REPORTED"));
    assert.deepEqual(result.skipped, []);
  });

  it("compares the calculation with every reported figure, and neither is changed", async () => {
    const result = await regionCollectionEfficiency({ reported: sparseRepositories().reported, regionId: "R-1", context: CONTEXT });
    const comparisons = result.calculations[0].comparisons;
    assert.deepEqual(
      comparisons.map((comparison) => [comparison.reported.provenance.sourceSystem, comparison.reported.value]),
      [["sparse-operations", 91.8], ["sparse-executive", 86.6]],
    );
    for (const comparison of comparisons) {
      assert.equal(comparison.comparable, false);
      const codes = comparison.issues.map((issue) => issue.code);
      assert.ok(codes.includes("METHODOLOGY_UNSPECIFIED"));
      assert.ok(codes.includes("INPUTS_FROM_REPORTED"));
      // These figures state no basis, so there is nothing like for like to compare with,
      // and no difference is given.
      assert.ok(codes.includes("BASIS_UNSPECIFIED"));
      assert.equal(comparison.sameBasis, false);
      assert.equal(comparison.variance.absolute, null);
    }
    // The calculated value itself is unaffected.
    assert.ok(Math.abs((comparisons[1].calculated.value as number) - 710000000 / 820000000) < 1e-12);
  });

  it("gives the same result as calling analytics directly with the same inputs", async () => {
    const find = (metric: ReportedKpi["metric"]) =>
      sparseDataset().reportedKpis.find((kpi) => kpi.id === `rk:sparse-executive:region:R-2:${metric}`) as ReportedKpi;
    const billed = reportedMoney(find("revenue_billed"));
    const collected = reportedMoney(find("revenue_collected"));
    assert.ok(billed.ok && collected.ok);
    const direct = calculateCollectionEfficiency({
      scope: { kind: "region", id: "R-2" },
      period: null,
      revenueBilled: billed.input,
      revenueCollected: collected.input,
      context: CONTEXT,
    });
    const result = await regionCollectionEfficiency({ reported: sparseRepositories().reported, regionId: "R-2", context: CONTEXT });
    assert.deepEqual(result.calculations[0].calculated, direct);
  });
});

describe("regional collection efficiency with missing revenue", () => {
  it("is insufficient_data, never 0, when revenue collected is missing", async () => {
    const result = await regionCollectionEfficiency({ reported: sparseRepositories().reported, regionId: "R-3", context: CONTEXT });
    const [{ calculated }] = result.calculations;
    assert.equal(calculated.status, "insufficient_data");
    assert.equal(calculated.value, null);
    assert.deepEqual(calculated.missingInputs, ["revenue collected"]);
  });

  it("makes no calculation for a region with no reported revenue", async () => {
    const result = await regionCollectionEfficiency({ reported: sparseRepositories().reported, regionId: "no-such-region", context: CONTEXT });
    assert.deepEqual(result.calculations, []);
  });
});
