import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "../analytics/__fixtures__/sparse.ts";
import { substationView } from "../operations/levels.ts";
import { executiveView } from "./view.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
const view = await executiveView(runtime);

describe("executive read model", () => {
  it("shows the same figures as the Operations drill-down, and says whose they are", async () => {
    const substation = await substationView(runtime, "SS-RIV");
    assert.equal(view.losses?.atcc.value, substation?.losses?.atcc.value);
    assert.equal(view.losses?.collectionEfficiency.value, substation?.losses?.collectionEfficiency.value);
    assert.match(view.losses?.scopeNote ?? "", /only substation in the portfolio/);
    assert.equal(view.losses?.collectionBasis, "cash");
    assert.equal(view.losses?.sourcing.synthetic, true);
    assert.equal(view.reliability.sourcing.synthetic, true);
  });

  it("splits ATC&C and reliability, and compares reported figures on their own basis", () => {
    const losses = view.losses;
    assert.ok(losses);
    const sum = (losses.parts.technical.value as number) + (losses.parts.commercial.value as number) + (losses.parts.collection.value as number);
    assert.ok(Math.abs(sum - (losses.atcc.value as number)) < 1e-9);
    assert.equal(view.reliability.attribution.length, 4);
    assert.ok(losses.reported.every((row) => row.sameBasis));
    // Reported SAIDI counts network interruptions only, and is set beside the network-only figure.
    const saidi = view.reliability.reported.find((row) => row.label === "SAIDI");
    assert.equal(saidi?.sameBasis, true);
    assert.ok((saidi?.calculated.value as number) < 10);
    assert.ok((view.reliability.saidi.value as number) > 200);
    assert.match(view.reliability.scopeNote ?? "", /only substation in the portfolio/);
  });

  it("summarises band compliance per feeder and transformer loading, highest peak first", () => {
    assert.deepEqual(view.bandCompliance.map((row) => [row.feederId, row.band, row.minimumHours, row.daysObserved]), [
      ["FD-MKT", "A", 20, 30],
      ["FD-OLD", "C", 12, 30],
    ]);
    assert.ok(view.bandCompliance.every((row) => (row.daysFailed as number) > 0 && row.compliantOnAverage === true));
    assert.equal(view.transformerLoading.length, 6);
    assert.equal(view.transformerLoading[0].transformerId, "DT-OLD-2");
    assert.equal(view.transformerLoading[0].overloaded, true);
    const peaks = view.transformerLoading.map((row) => row.peak.value as number);
    assert.deepEqual(peaks, [...peaks].sort((a, b) => b - a));
  });

  it("lists where to look from fixed rules, in a fixed order, each with a figure that has a value", () => {
    assert.deepEqual(
      view.whereToLook.map((item) => [item.rank, item.rule, item.subject.id]),
      [
        [1, "Transformer loaded above its rating", "DT-OLD-2"],
        [2, "Feeder with the highest ATC&C", "FD-OLD"],
        [3, "Feeder below its service-band minimum on at least one day", "FD-MKT"],
        [4, "Feeder below its service-band minimum on at least one day", "FD-OLD"],
        [5, "Feeder with the lowest collection efficiency", "FD-OLD"],
        [6, "Transformer with the highest commercial loss", "DT-OLD-2"],
        [7, "Feeder with the highest network-attributable SAIDI", "FD-OLD"],
      ],
    );
    for (const item of view.whereToLook) {
      assert.ok(item.metric.value !== null, item.title);
      assert.ok(item.metric.status === "ok" || item.metric.status === "calculated_with_estimates", item.title);
    }
    assert.deepEqual(view.whereToLook[0].detail?.label, "hours over rating");
    assert.ok((view.whereToLook[2].detail?.value as number) > (view.whereToLook[3].detail?.value as number));
  });

  it("is the same list every time", async () => {
    const again = await executiveView(runtime);
    assert.deepEqual(again.whereToLook, view.whereToLook);
  });

  it("ranks nothing it has no value for", async () => {
    const sparse = await executiveView({ repos: sparseRepositories(), now: SPARSE_AS_OF, period: SPARSE_PERIOD, caveats: {} });
    assert.deepEqual(sparse.whereToLook, []);
    assert.equal(sparse.reliability.saidi.value, null);
    assert.equal(sparse.reliability.saidi.status, "insufficient_data");
  });
});
