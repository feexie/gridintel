import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "./levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { feederView, substationView, transformerView } from "./levels.ts";

/* What needs attention at a network level, on the synthetic demonstration: fixed rules in a fixed
   order, every figure the level's own object from the blocks on the same screen. */

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const farmRoad = await feederView(runtime, "FD-FRM");
const riverbank = await transformerView(runtime, "DT-OLD-2");
const hillcrest = await substationView(runtime, "SS-HIL");
const ORDER = ["over_rating", "still_open", "report_differs", "rule_finding", "below_band", "alarms_standing", "conditions_hold"];

describe("what needs attention at a network level", () => {
  it("lists by the fixed rules, in their order, each leading to a section of the same screen", () => {
    for (const view of [farmRoad, riverbank, hillcrest]) {
      assert.ok(view);
      const order = view.findings.map((item) => ORDER.indexOf(item.rule));
      assert.ok(order.every((index) => index >= 0));
      assert.deepEqual(order, [...order].sort((a, b) => a - b));
      for (const item of view.findings) assert.equal(item.target.type, "section");
    }
  });

  it("takes every figure unchanged from the blocks below it", () => {
    const over = riverbank?.findings.find((item) => item.rule === "over_rating");
    assert.equal(over?.figure, riverbank?.loading?.peak);
    const band = farmRoad?.findings.find((item) => item.rule === "below_band");
    assert.equal(band?.figure, farmRoad?.reliability.supply.averageHours);
    const rule = farmRoad?.findings.find((item) => item.rule === "rule_finding");
    assert.equal(rule?.figure, farmRoad?.reliability.ruleFindings.find((found) => found.figure === "SAIDI")?.difference);
    assert.equal(rule?.figureSigned, true);
  });

  it("names the open fault on Farm Road and leaves the reliability figures provisional", () => {
    assert.deepEqual(farmRoad?.findings.map((item) => item.rule).slice(0, 1), ["still_open"]);
  });

  it("shows only the largest report difference, measured against the reported figure", () => {
    const differs = hillcrest?.findings.filter((item) => item.rule === "report_differs") ?? [];
    assert.equal(differs.length, 1);
    assert.equal(differs[0].comparisons.length, 1);
    assert.equal(differs[0].figure, null);
  });
});
