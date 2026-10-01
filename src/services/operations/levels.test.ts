import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "./levels.ts";
import type { MetricView, NetworkLevelView } from "./views.ts";
import { DEMO_CLOCK, DEMO_PERIOD, DEMO_REGION_ID, createDemoRepositories } from "../../repositories/demo/index.ts";
import { feederView, overviewView, regionView, servicePointView, substationView, transformerView } from "./levels.ts";

const CAVEAT = "feeder loading caveat";
const runtime: OperationsRuntime = {
  repos: createDemoRepositories(),
  now: DEMO_CLOCK,
  period: DEMO_PERIOD,
  caveats: { feederLoading: CAVEAT },
};

function everyMetric(view: NetworkLevelView): MetricView[] {
  const losses = view.losses;
  return [
    ...(losses
      ? [
          ...losses.chain,
          ...losses.crossChecks.metrics,
          losses.atcc,
          losses.parts.technical,
          losses.parts.commercial,
          losses.parts.collection,
          losses.billingEfficiency,
          losses.collectionEfficiency,
          losses.revenueBilled,
          losses.revenueCollected,
        ]
      : []),
    view.reliability.saidi,
    view.reliability.saifi,
    view.reliability.caidi,
    view.reliability.asai,
    view.reliability.supply.averageHours,
    ...(view.loading ? [view.loading.peak, view.loading.asOf] : []),
    ...view.children.flatMap((table) => table.rows.flatMap((row) => Object.values(row.cells))),
  ];
}

describe("operations read models", () => {
  it("follow the drill path region > substation > feeder > transformer > service point", async () => {
    const overview = await overviewView(runtime);
    assert.deepEqual(overview.regions.rows.map((row) => row.id), [DEMO_REGION_ID]);

    const region = (await regionView(runtime, DEMO_REGION_ID)) as NetworkLevelView;
    assert.deepEqual(region.children[0].rows.map((row) => [row.kind, row.id]), [["substation", "SS-RIV"]]);

    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.deepEqual(substation.children[0].rows.map((row) => row.id), ["FD-MKT", "FD-OLD"]);

    const feeder = (await feederView(runtime, "FD-MKT")) as NetworkLevelView;
    assert.deepEqual(feeder.children[0].rows.map((row) => row.id), ["DT-MKT-1", "DT-MKT-2", "DT-MKT-3"]);
    assert.deepEqual(feeder.children[1].rows.map((row) => row.id), ["SP-MKT-MV-001"]);

    const transformer = (await transformerView(runtime, "DT-MKT-3")) as NetworkLevelView;
    assert.equal(transformer.children[0].rows.length, 30);
    assert.deepEqual(
      transformer.header.crumbs.map((crumb) => crumb.kind),
      ["region", "substation", "feeder", "distribution_transformer"],
    );

    const servicePoint = await servicePointView(runtime, transformer.children[0].rows[0].id);
    assert.equal(servicePoint?.header.crumbs.length, 5);
  });

  it("return null for anything not in the registry", async () => {
    assert.equal(await regionView(runtime, "nope"), null);
    assert.equal(await substationView(runtime, "nope"), null);
    assert.equal(await feederView(runtime, "nope"), null);
    assert.equal(await transformerView(runtime, "nope"), null);
    assert.equal(await servicePointView(runtime, "nope"), null);
  });

  it("give every number a status, an origin and a trail, and mark every block synthetic", async () => {
    const view = (await feederView(runtime, "FD-OLD")) as NetworkLevelView;
    for (const metric of everyMetric(view)) {
      assert.ok(metric.status, metric.label);
      assert.ok(metric.origin, metric.label);
      // A number with a value says how it was obtained.
      if (metric.value !== null) assert.ok(metric.derivation !== null || metric.method !== null, metric.label);
    }
    assert.equal(view.losses?.sourcing.synthetic, true);
    assert.equal(view.reliability.sourcing.synthetic, true);
    assert.equal(view.loading?.sourcing.synthetic, true);
  });

  it("label technical loss as estimated and commercial loss as derived", async () => {
    const { losses } = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.equal(losses?.parts.technical.origin, "estimated");
    assert.equal(losses?.parts.commercial.origin, "derived");
    assert.equal(losses?.parts.commercial.status, "calculated_with_estimates");
    assert.equal(losses?.chain[0].origin, "measured");
    assert.equal(losses?.chain[1].origin, "estimated");
    assert.equal(losses?.chain[4].origin, "derived");
    assert.equal(losses?.status, "calculated_with_estimates");
    assert.equal(losses?.collectionBasis, "cash");
  });

  it("show the substation's figures at region level, and say so", async () => {
    const region = (await regionView(runtime, DEMO_REGION_ID)) as NetworkLevelView;
    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.equal(region.losses?.atcc.value, substation.losses?.atcc.value);
    assert.match(region.losses?.scopeNote ?? "", /only substation in this region/);
    assert.equal(substation.losses?.scopeNote, null);
  });

  it("split reliability by attribution and test the band at feeder level only", async () => {
    const feeder = (await feederView(runtime, "FD-MKT")) as NetworkLevelView;
    assert.deepEqual(feeder.reliability.attribution.map((row) => row.key), ["network", "upstream_supply", "load_management", "other"]);
    assert.equal(feeder.reliability.supply.band, "A");
    assert.equal(feeder.reliability.supply.days.length, 30);
    assert.equal(feeder.reliability.supply.days[0].date, "2026-09-01");
    assert.ok((feeder.reliability.supply.daysNonCompliant as number) > 0);
    assert.equal(feeder.reliability.reported.length, 2);
    // The report counts network interruptions only, so it is set beside the network-only figure.
    const saidi = feeder.reliability.reported[0];
    assert.equal(saidi.sameBasis, true);
    assert.match(saidi.reportedBasis ?? "", /network interruptions only/);
    assert.ok((saidi.calculated.value as number) < 5);
    assert.ok((feeder.reliability.saidi.value as number) > 50);

    const transformer = (await transformerView(runtime, "DT-MKT-1")) as NetworkLevelView;
    assert.equal(transformer.reliability.supply.band, null);
  });

  it("carry the feeder-loading caveat on feeders and nowhere else", async () => {
    const feeder = (await feederView(runtime, "FD-MKT")) as NetworkLevelView;
    assert.equal(feeder.loading?.caveat, CAVEAT);
    assert.equal(feeder.loading?.peak.note, CAVEAT);
    const transformer = (await transformerView(runtime, "DT-OLD-2")) as NetworkLevelView;
    assert.equal(transformer.loading?.caveat, null);
    assert.equal(transformer.loading?.overloaded, true);
    assert.ok((transformer.loading?.hoursOverRating as number) > 0);
    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.equal(substation.loading, null);
  });

  it("say that an unmetered connection has no measured consumption, and that its bill is an estimate", async () => {
    const transformer = (await transformerView(runtime, "DT-OLD-2")) as NetworkLevelView;
    const unmetered = transformer.children[0].rows.find((row) => row.facts.includes("unmetered"));
    assert.ok(unmetered);
    assert.equal(unmetered.cells.recorded.status, "not_available");
    assert.equal(unmetered.cells.recorded.value, null);
    assert.equal(unmetered.cells.billedEnergy.origin, "estimated");
    assert.equal(unmetered.cells.billedEnergy.status, "calculated_with_estimates");

    const view = await servicePointView(runtime, unmetered.id);
    assert.equal(view?.metering, "unmetered");
    assert.equal(view?.meter, null);
    assert.equal(view?.charges[0].estimated, true);
    assert.equal(view?.sourcing.synthetic, true);
  });

  it("mark a comparison across different bases as not comparable, with the reason and no difference", async () => {
    const oldTown = (await feederView(runtime, "FD-OLD")) as NetworkLevelView;
    const collection = oldTown.losses?.reported.find((row) => row.label === "Collection efficiency");
    assert.equal(collection?.comparable, false);
    assert.equal(collection?.sameBasis, false);
    assert.equal(collection?.variance, null);
    assert.match(collection?.reasons.join(" ") ?? "", /reported "accrual", calculated "cash"/);
    const atcc = oldTown.losses?.reported.find((row) => row.label === "ATC&C");
    assert.equal(atcc?.sameBasis, true);
  });

  it("always present alarms as not available", async () => {
    const view = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.match(view.alarms.reason, /^Not available/);
  });
});
