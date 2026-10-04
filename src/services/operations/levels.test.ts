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
    assert.deepEqual(region.children[0].rows.map((row) => [row.kind, row.id]), [["substation", "SS-RIV"], ["substation", "SS-HIL"]]);

    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.deepEqual(substation.children[0].rows.map((row) => row.id), ["FD-MKT", "FD-OLD"]);

    const feeder = (await feederView(runtime, "FD-MKT")) as NetworkLevelView;
    const transformers = feeder.children[0].rows.map((row) => row.id);
    assert.equal(transformers.length, 12);
    for (const id of ["DT-MKT-1", "DT-MKT-2", "DT-MKT-3", "DT-MKT-12"]) assert.ok(transformers.includes(id), id);
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

  it("account for a region as the sum of its sections, and say which", async () => {
    const region = (await regionView(runtime, DEMO_REGION_ID)) as NetworkLevelView;
    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    const hillcrest = (await substationView(runtime, "SS-HIL")) as NetworkLevelView;
    // Energy received is the two incomers added together; ATC&C is of the whole, so it lies between the two.
    const received = (view: NetworkLevelView) => view.losses?.chain[0].value as number;
    assert.ok(Math.abs(received(region) - (received(substation) + received(hillcrest))) < 1e-6);
    const [low, high] = [substation.losses?.atcc.value as number, hillcrest.losses?.atcc.value as number].sort((a, b) => a - b);
    assert.ok((region.losses?.atcc.value as number) > low && (region.losses?.atcc.value as number) < high);
    assert.deepEqual(region.losses?.sections, [{ kind: "substation", id: "SS-HIL" }, { kind: "substation", id: "SS-RIV" }]);
    assert.match(region.losses?.scopeNote ?? "", /Summed over 2 electrical section\(s\): SS-HIL, SS-RIV\. A region is not an electrical boundary/);
    assert.equal(substation.losses?.scopeNote, null);
    // The figure reported for the region can now be set beside a calculated one.
    assert.deepEqual(region.losses?.reported.map((row) => [row.label, row.sameBasis]), [["ATC&C", true], ["Collection efficiency", true]]);
  });

  it("give the same view model with and without the cache, and compute a block once with it", async () => {
    const { createMemoryCache } = await import("../analytics/cache.ts");
    const cache = createMemoryCache();
    const cached = { ...runtime, cache };
    const first = await feederView(cached, "FD-OLD");
    const entries = cache.size();
    const second = await feederView(cached, "FD-OLD");
    assert.equal(cache.size(), entries);
    assert.deepEqual(second, first);
    assert.deepEqual(first, await feederView(runtime, "FD-OLD"));
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

  it("show for each kind of meter only what that meter can report", async () => {
    // Riverbank: an ordinary prepaid meter, a postpaid meter read on the round, and one the round missed.
    const prepaid = await servicePointView(runtime, "SP-OLD2-004");
    assert.equal(prepaid?.recordedFrom, "not_read");
    assert.equal(prepaid?.recorded.status, "not_available");
    assert.equal(prepaid?.recorded.value, null);
    assert.equal(prepaid?.intervals, null);
    assert.equal(prepaid?.meter?.type, "conventional");
    assert.equal(prepaid?.purchased?.label, "Energy purchased");
    assert.equal(prepaid?.purchased?.origin, "measured");
    assert.match(prepaid?.purchased?.note ?? "", /not consumption/);
    const vended = prepaid?.charges.reduce((total, charge) => total + (charge.energyKwh as number), 0) as number;
    assert.ok(Math.abs((prepaid?.purchased?.value as number) - vended) < 1e-6);

    const read = await servicePointView(runtime, "SP-OLD2-001");
    assert.equal(read?.recordedFrom, "register_readings");
    assert.equal(read?.recorded.status, "ok");
    assert.equal(read?.recorded.origin, "measured");
    assert.match(read?.recorded.note ?? "", /One register reading for the month, not interval data/);
    assert.equal(read?.register?.estimated, false);
    assert.ok(Math.abs((read?.recorded.value as number) - ((read?.register?.closingKwh as number) - (read?.register?.openingKwh as number))) < 1e-6);
    assert.ok(Math.abs((read?.recorded.value as number) - (read?.charges[0].energyKwh as number)) < 1e-6);
    assert.equal(read?.purchased, null);

    const missed = await servicePointView(runtime, "SP-OLD2-005");
    assert.equal(missed?.recordedFrom, "register_readings");
    assert.equal(missed?.recorded.status, "calculated_with_estimates");
    assert.equal(missed?.recorded.origin, "estimated");
    assert.equal(missed?.register?.estimated, true);
    assert.equal(missed?.charges[0].estimated, true);
    assert.equal(missed?.charges[0].basisLabel, "Estimated bills (meter not read)");

    // Garden Estate: an AMI meter, whose intervals are summed as before.
    const ami = await servicePointView(runtime, "SP-MKT2-005");
    assert.equal(ami?.recordedFrom, "intervals");
    assert.equal(ami?.meter?.type, "smart");
    assert.equal(ami?.intervals?.expected, 720);
    assert.equal(ami?.recorded.status, "ok");
    assert.equal(ami?.register, null);
  });

  it("show energy purchased beside the cross-checks, and say why recorded consumption is not available", async () => {
    const feeder = (await feederView(runtime, "FD-OLD")) as NetworkLevelView;
    const checks = feeder.losses?.crossChecks;
    assert.equal(checks?.status, "insufficient_data");
    const recorded = checks?.metrics.find((metric) => metric.label === "Recorded consumption");
    assert.equal(recorded?.value, null);
    assert.equal(recorded?.status, "insufficient_data");
    assert.equal(checks?.energyPurchased.status, "ok");
    assert.equal(checks?.energyPurchased.origin, "measured");
    assert.ok((checks?.energyPurchased.value as number) > 0);
    assert.match(checks?.energyPurchased.note ?? "", /never added to recorded consumption/);
    const coverage = checks?.coverage;
    assert.equal((coverage?.recorded ?? 0) + (coverage?.incomplete ?? 0) + (coverage?.withoutIntervalData ?? 0) + (coverage?.unmetered ?? 0), coverage?.servicePoints);
    assert.match(checks?.note ?? "", /Of 2141 connection\(s\): 5 with interval data for the whole period; 934 with a meter that records no intervals/);
    assert.match(checks?.note ?? "", /1202 with no meter/);
    // The chain above it is untouched by what customer meters report.
    assert.equal(feeder.losses?.status, "calculated_with_estimates");
    assert.ok(feeder.losses?.chain.every((metric) => metric.value !== null));

    // Where every meter is AMI the cross-check is made, and nothing is missing.
    const hilltop = (await transformerView(runtime, "DT-MKT-3")) as NetworkLevelView;
    assert.equal(hilltop.losses?.crossChecks.status, "ok");
    assert.equal(hilltop.losses?.crossChecks.note, null);
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
