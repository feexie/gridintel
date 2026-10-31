import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createSyntheticMonitoring } from "../../repositories/demo/monitoring.ts";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { readChangelog } from "./about.ts";
import { dtSequencingView } from "./dt.ts";
import { monitoringPlan, monitoringView } from "./monitoring.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
const published = nercPublishedFigures();

describe("DT sequencing on the synthetic network", () => {
  it("ranks every DT with unmetered customers, states the finding, and is marked synthetic", async () => {
    const view = await dtSequencingView(runtime, {});
    assert.equal(view.sourcing.synthetic, true);
    assert.match(view.headline, /^Metering the 5 highest-ranked DTs first recovers \d+% of the revenue for \d+% of the CAPEX\.$/);
    assert.match(view.revolvingLine, /the ranked order meters every DT (in month \d+|not within \d+ months); a random order (in month \d+|not within \d+ months)\./);
    assert.equal(view.rows[0].rank, "1");
    assert.ok(view.rows.some((row) => row.rank === "—" && row.capex === "Nothing to meter"));
    assert.match(view.headlineHow, /^How this is calculated:/);
    assert.equal(view.chart.base.values.length, 37);
    // The ranked order recovers at least as much as the random one by the end of year 1.
    assert.ok(view.chart.base.values[12] >= view.chart.stressed.values[12]);
  });

  it("takes the recovery shares and the budget from the address, and the default for anything out of range", async () => {
    const view = await dtSequencingView(runtime, { budget: "10000000", estRecovered: "500" });
    assert.equal(view.inputs.find((one) => one.key === "budget")?.value, 10_000_000);
    assert.equal(view.inputs.find((one) => one.key === "estRecovered")?.value, 15);
  });
});

describe("monitoring the metering programme", () => {
  it("plans the recommended first million over four quarters", async () => {
    const plan = await monitoringPlan(published);
    assert.equal(plan.length, 44);
    // Each DisCo's share is rounded to whole meters, so the total is within a meter a DisCo of the million.
    assert.ok(Math.abs(plan.reduce((sum, row) => sum + row.plannedMeters, 0) - 1_000_000) <= 11);
  });

  it("sets plan against synthetic actuals for the first quarter, with tranches against verified installs", async () => {
    const view = await monitoringView(published, createSyntheticMonitoring(await monitoringPlan(published)), {});
    assert.equal(view.sourcing.synthetic, true);
    assert.equal(view.rows?.length, 11);
    assert.match(view.headline, /2026 Q3/);
    assert.match(view.trancheLine, /^Fund money is released in tranches against verified installs/);
    assert.ok(view.totals.every((one) => one.origin === "synthetic"));
  });

  it("shows a quarter with no records as not reported, never as zero", async () => {
    const view = await monitoringView(published, createSyntheticMonitoring(await monitoringPlan(published)), { quarter: "2027-Q1" });
    assert.equal(view.rows, null);
    assert.match(view.notReported!, /not as zero/);
    assert.match(view.headline, /not yet reported/);
  });
});

describe("about this build", () => {
  const text = [
    "# Changelog",
    "",
    "## At the baseline",
    "",
    "- Utility Intelligence on a synthetic DisCo.",
    "- Planning: placeholder pages.",
    "",
    "| Time (WAT) | Commit | What was built |",
    "| --- | --- | --- |",
    "| Fri 18:07 | `6854f8a` | Design rewritten |",
    "| Fri 18:26 | broken row |",
  ].join("\n");

  it("reads the baseline list and every commit row, and counts a row it cannot read", () => {
    const view = readChangelog(text);
    assert.deepEqual(view.baseline.summary, ["Utility Intelligence on a synthetic DisCo.", "Planning: placeholder pages."]);
    assert.deepEqual(view.rows.map((row) => row.commit), ["6854f8a"]);
    assert.equal(view.rows[0].commitUrl, "https://github.com/feexie/gridintel/commit/6854f8a");
    assert.equal(view.unread, 1);
    assert.equal(view.sprint.compareUrl, "https://github.com/feexie/gridintel/compare/geh-baseline...geh-sprint");
  });

  it("says so when the changelog cannot be read", () => {
    const view = readChangelog(null);
    assert.equal(view.rows.length, 0);
    assert.match(view.how, /could not be read/);
  });
});
