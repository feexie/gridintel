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

  it("compare a report on its own attribution rule where it states one, and state what the rule changes as a finding", async () => {
    const farm = (await feederView(runtime, "FD-FRM")) as NetworkLevelView;
    const saidi = farm.reliability.reported.find((row) => row.label === "SAIDI");
    assert.equal(saidi?.sameBasis, true);
    assert.match(saidi?.reportedBasis ?? "", /treating as upstream: the grid, transmission stations, sub-transmission lines/);
    assert.equal(saidi?.reportedBasis, saidi?.calculatedBasis);
    assert.ok((saidi?.calculated.value as number) < 1);
    assert.ok(Math.abs(saidi?.variance as number) < 0.1);
    // The reference figure, which puts the line faults on the network, is shown and is the screen's own network SAIDI.
    const network = farm.reliability.attribution.find((row) => row.key === "network");
    const found = saidi?.ruleFinding;
    assert.ok((found?.onReferenceRule.value as number) > 50);
    assert.ok(Math.abs((found?.onReferenceRule.value as number) - (network?.saidiHours as number)) < 1e-9);
    // The finding is the difference, with its size: 57.1 h on the reference rule less 0.4 h on the report's.
    assert.equal(found?.statement, "Rule treats sub-transmission lines as upstream");
    assert.equal(found?.figure, "SAIDI");
    assert.deepEqual(found?.statedFor, { kind: "feeder", id: "FD-FRM", name: "Farm Road 11 kV feeder" });
    assert.ok(Math.abs((found?.difference.value as number) - ((found?.onReferenceRule.value as number) - (found?.onReportedRule.value as number))) < 1e-9);
    assert.ok(Math.abs((found?.difference.value as number) - 56.7) < 0.05);
    assert.equal(found?.difference.unit, "hours");
    assert.equal(found?.difference.origin, "calculated");
    assert.equal(found?.difference.method?.id, "gridintel.reliability.reference");
    assert.equal(found?.difference.inputs.length, 2);
    // It is on the feeder's screen as a finding, for SAIDI and for SAIFI.
    assert.deepEqual(farm.reliability.ruleFindings.map((entry) => entry.figure), ["SAIDI", "SAIFI"]);
    assert.ok(Math.abs((farm.reliability.ruleFindings[1].difference.value as number) - 16) < 0.05);

    // A rule that differs and moved nothing is still stated, with a difference of exactly zero.
    const government = (await feederView(runtime, "FD-GOV")) as NetworkLevelView;
    assert.deepEqual(government.reliability.ruleFindings.map((entry) => entry.difference.value), [0, 0]);
    assert.ok(!saidi?.caveats.some((caveat) => /classification/.test(caveat)));
    // The headline indices and the attribution table stay on the reference rule.
    assert.equal(farm.reliability.saidi.method?.id, "gridintel.reliability.reference");
    assert.match(saidi?.calculated.method?.name ?? "", /on a reported attribution rule/);

    // A report that does not state its rule is compared with the reference figure, under a note.
    const hillcrest = (await substationView(runtime, "SS-HIL")) as NetworkLevelView;
    const summary = hillcrest.reliability.reported.find((row) => row.label === "SAIDI");
    assert.equal(summary?.sameBasis, true);
    assert.equal(summary?.ruleFinding, null);
    // The substation's screen carries the findings of the feeders below it, each naming its feeder.
    assert.deepEqual(
      hillcrest.reliability.ruleFindings.map((entry) => [entry.statedFor.id, entry.figure]),
      [["FD-FRM", "SAIDI"], ["FD-FRM", "SAIFI"], ["FD-GOV", "SAIDI"], ["FD-GOV", "SAIFI"]],
    );
    // A feeder's own screen has only its own.
    assert.ok(farm.reliability.ruleFindings.every((entry) => entry.statedFor.id === "FD-FRM"));
    assert.ok((summary?.variance as number) > 20);
    assert.ok(summary?.caveats.some((caveat) => /may reflect a difference in classification/.test(caveat)));
    assert.doesNotMatch(summary?.reportedBasis ?? "", /treating as upstream/);
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
    assert.equal(read?.registerCounts?.counted, true);
    assert.match(read?.registerCounts?.note ?? "", /both readings are within 3 days of the period's ends\. It is counted as read, not pro-rated/);

    const missed = await servicePointView(runtime, "SP-OLD2-005");
    assert.equal(missed?.recordedFrom, "register_readings");
    assert.equal(missed?.recorded.status, "calculated_with_estimates");
    assert.equal(missed?.recorded.origin, "estimated");
    assert.equal(missed?.register?.estimated, true);
    assert.equal(missed?.charges[0].estimated, true);
    assert.equal(missed?.charges[0].basisLabel, "Estimated bills (meter not read)");
    assert.equal(missed?.registerCounts?.counted, false);
    assert.match(missed?.registerCounts?.note ?? "", /Not counted toward recorded consumption at the levels above: a reading was estimated/);
    assert.equal(prepaid?.registerCounts, null);

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
    assert.equal(
      (coverage?.byIntervals ?? 0) + (coverage?.intervalsIncomplete ?? 0) + (coverage?.byRegister ?? 0) + (coverage?.registerExcluded ?? 0) + (coverage?.notRead ?? 0) + (coverage?.unmetered ?? 0),
      coverage?.servicePoints,
    );
    assert.match(checks?.note ?? "", /Of 2141 connection\(s\): 5 with interval data for the whole period; 279 with a register advance that counts; 67 with a register advance that does not count; 588 with a meter that is not read/);
    assert.match(checks?.note ?? "", /1202 with no meter/);
    // The two measured sources are shown apart, each with the connections it covers.
    assert.deepEqual(checks?.sources.map((source) => [source.key, source.connections, source.energy.status, source.energy.origin]), [
      ["intervals", 5, "ok", "measured"],
      ["register", 279, "ok", "measured"],
    ]);
    assert.match(checks?.sources[1].energy.note ?? "", /Covers 279 of 2141 connection\(s\)\. It is not the consumption of the whole scope\./);
    assert.match(checks?.registerRule ?? "", /within 3 days of the start of the period and its closing reading within 3 days of the end\. It is taken as read and never pro-rated/);
    assert.deepEqual(checks?.registerExclusions, [{ reason: "a reading was estimated, not read from the meter", connections: 67 }]);
    // The chain above it is untouched by what customer meters report.
    assert.equal(feeder.losses?.status, "calculated_with_estimates");
    assert.ok(feeder.losses?.chain.every((metric) => metric.value !== null));

    // Where every meter is AMI the cross-check is made, and nothing is missing.
    const hilltop = (await transformerView(runtime, "DT-MKT-3")) as NetworkLevelView;
    assert.equal(hilltop.losses?.crossChecks.status, "ok");
    assert.equal(hilltop.losses?.crossChecks.note, null);
    // A source that covers no connection has no figure, rather than a zero.
    assert.equal(hilltop.losses?.crossChecks.sources[1].energy.status, "not_available");
    assert.equal(hilltop.losses?.crossChecks.sources[1].energy.value, null);
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

  it("show recorded alarms and derived conditions as two lists, each naming its asset and the screen that shows it", async () => {
    const { alarms } = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.equal(alarms.asOf, DEMO_CLOCK);
    assert.equal(alarms.recorded.completeness, "complete");
    assert.equal(alarms.recorded.note, null);
    // Two alarms stand: the silent monitor's, and one on the power transformer, which is shown on its substation's screen.
    assert.deepEqual(alarms.recorded.active.map((row) => [row.id, row.severity, row.subject.label, row.subject.kindLabel, row.subject.link]), [
      ["ALM-2026-09-30-ED-DT-OLD-3-COMMS", "medium", "Monitor on South Gate transformer", "Monitoring device", { kind: "distribution_transformer", id: "DT-OLD-3" }],
      ["ALM-2026-09-26-PT-RIV-1-OIL", "medium", "Riverside T1", "Power transformer", { kind: "substation", id: "SS-RIV" }],
    ]);
    assert.equal(alarms.recorded.active[1].clearedAt, null);
    assert.ok(alarms.recorded.active[1].acknowledgedAt !== null);
    assert.deepEqual(alarms.recorded.active.map((row) => row.kindName), ["communications failure", "equipment condition"]);
    // One has no time: it is listed apart and is never called active.
    assert.deepEqual(alarms.recorded.undated.map((row) => [row.id, row.state, row.raisedAt]), [["ALM-SS-RIV-DOOR", "time_not_recorded", null]]);
    // Cleared alarms: the most recently raised first.
    assert.equal(alarms.recorded.clearedTotal, 6);
    assert.deepEqual(alarms.recorded.cleared.map((row) => row.id).slice(0, 2), ["ALM-2026-09-27-DT-OLD-3-STORM", "ALM-2026-09-23-DT-OLD-2-FAULT"]);

    // Derived conditions carry their rule and a figure with a method, like any calculated number.
    assert.deepEqual(alarms.derived.conditions.map((row) => [row.rule, row.ruleName, row.subject.label, row.activeNow]), [
      ["monitor_quiet", "Monitor quiet", "Monitor on South Gate transformer", true],
      ["loading_above_rating", "Loaded above rating", "Riverbank transformer", false],
    ]);
    const [quiet, loaded] = alarms.derived.conditions;
    assert.deepEqual(quiet.subject.link, { kind: "distribution_transformer", id: "DT-OLD-3" });
    assert.equal(quiet.figure.unit, "hours");
    assert.ok(Math.abs((quiet.figure.value as number) - 545 / 60) < 1e-9);
    assert.equal(quiet.figure.origin, "calculated");
    assert.equal(quiet.figure.method?.id, "gridintel.conditions.reference");
    assert.equal(loaded.figure.unit, "fraction");
    assert.equal(loaded.figure.method?.id, "gridintel.loading.reference");
    assert.equal(loaded.occurrences, 69);
    assert.match(loaded.figure.derivation ?? "", /above 100% of rating at one or more telemetry readings/);
    assert.deepEqual(alarms.derived.rules.map((rule) => rule.name), ["Loaded above rating", "Monitor quiet"]);
    assert.match(alarms.derived.method.disclaimer, /not an alarm recorded by a source system/);
    assert.equal(alarms.sourcing.synthetic, true);

    // The relation between the two lists: each side names the other and stays where it is.
    assert.deepEqual(quiet.sourceAlarm, {
      status: "agrees",
      kindName: "communications failure",
      alarms: [{ id: "ALM-2026-09-30-ED-DT-OLD-3-COMMS", code: "RTU-COMMS-FAIL", raisedAt: "2026-09-30T16:55:00+01:00" }],
      reason: null,
    });
    assert.deepEqual(alarms.recorded.active[0].agreedBy, [{ key: quiet.key, ruleName: "Monitor quiet" }]);
    assert.deepEqual(loaded.sourceAlarm, { status: "none_raised", kindName: "overload", alarms: [], reason: null });
    assert.deepEqual(alarms.recorded.active[1].agreedBy, []);
    assert.deepEqual(alarms.derived.agreement, { agrees: 1, noneRaised: 1, cannotTell: 0 });
    assert.deepEqual(alarms.derived.rules.map((rule) => rule.alarmKindName), ["overload", "communications failure"]);
    // The door alarm's code is not mapped to a kind, and the view says so with null, not a guess.
    assert.equal(alarms.recorded.undated[0].kindName, null);
  });

  it("list at most six cleared alarms and say how many there are", async () => {
    const { alarms } = (await substationView(runtime, "SS-HIL")) as NetworkLevelView;
    assert.equal(alarms.recorded.clearedTotal, 21);
    assert.equal(alarms.recorded.cleared.length, 6);
    // The alarm standing at Hillcrest has not been acknowledged.
    assert.deepEqual(alarms.recorded.active.map((row) => [row.id, row.acknowledgedAt]), [["ALM-2026-09-30-SS-HIL-DC", null]]);
  });

  it("give a substation's power transformers with what each carries and its loading", async () => {
    const hillcrest = (await substationView(runtime, "SS-HIL")) as NetworkLevelView;
    assert.deepEqual(
      hillcrest.powerTransformers?.map((pt) => [pt.id, pt.ratedKva, pt.busSection, pt.feeders.map((feeder) => feeder.id)]),
      [["PT-HIL-1", 5000, "A", ["FD-GOV"]], ["PT-HIL-2", 2500, "B", ["FD-FRM"]]],
    );
    const [t1, t2] = hillcrest.powerTransformers ?? [];
    assert.ok(Math.abs((t1.loading?.peak.value as number) - 0.557) < 0.001);
    assert.ok(Math.abs((t2.loading?.peak.value as number) - 0.248) < 0.001);
    assert.equal(t1.loading?.peak.status, "ok");
    assert.equal(t1.loading?.peak.method?.id, "gridintel.loading.reference");
    assert.equal(t1.loading?.hoursObserved, 720);
    assert.equal(t1.loading?.overloaded, false);
    assert.equal(t1.loading?.sourcing.synthetic, true);
    const riverside = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.deepEqual(riverside.powerTransformers?.map((pt) => [pt.id, pt.busSection, pt.feeders.length]), [["PT-RIV-1", null, 2]]);
    assert.ok(Math.abs((riverside.powerTransformers?.[0].loading?.peak.value as number) - 0.722) < 0.001);
    // Only a substation has them.
    assert.equal(((await feederView(runtime, "FD-GOV")) as NetworkLevelView).powerTransformers, null);
  });
});
