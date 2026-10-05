import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { NetworkLevelView } from "../operations/views.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { feederView } from "../operations/levels.ts";
import { revenueWorkspaceView } from "../revenue/view.ts";
import { reliabilityWorkspaceView } from "./view.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const close = (a: number | null, b: number | null, epsilon = 1e-6) => a !== null && b !== null && Math.abs(a - b) < epsilon;
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

describe("reliability workspace", async () => {
  const view = await reliabilityWorkspaceView(runtime);

  it("ranks every feeder by the SAIDI attributed to the network, not by its total", () => {
    assert.deepEqual(view.feeders.map((feeder) => [feeder.rank, feeder.id]), [[1, "FD-FRM"], [2, "FD-OLD"], [3, "FD-MKT"], [4, "FD-GOV"]]);
    const network = view.feeders.map((feeder) => feeder.networkSaidi.value as number);
    assert.deepEqual(network, [...network].sort((a, b) => b - a));
    // Old Town has the second-highest network figure and a far larger total than Market Road: totals do not set the rank.
    const total = (id: string) => view.feeders.find((feeder) => feeder.id === id)?.totalSaidi.value as number;
    assert.ok(total("FD-GOV") > total("FD-MKT"));
    for (const feeder of view.feeders) {
      assert.equal(feeder.networkSaidi.origin, "calculated");
      assert.equal(feeder.networkSaidi.method?.id, "gridintel.reliability.reference");
      assert.match(feeder.networkSaidi.derivation ?? "", /attributed to the distribution network/);
    }
  });

  it("shows the figures of the Operations drill-down, feeder by feeder", async () => {
    for (const row of view.feeders) {
      const feeder = (await feederView(runtime, row.id)) as NetworkLevelView;
      const part = (key: string) => feeder.reliability.attribution.find((entry) => entry.key === key);
      assert.equal(row.networkSaidi.value, part("network")?.saidiHours, row.id);
      assert.equal(row.networkSaifi.value, part("network")?.saifi, row.id);
      assert.equal(row.loadSheddingSaidiHours, part("load_management")?.saidiHours, row.id);
      assert.equal(row.totalSaidi.value, feeder.reliability.saidi.value, row.id);
      assert.deepEqual(row.supply, feeder.reliability.supply, row.id);
      // The parts shown add up to the total.
      assert.ok(close(sum([row.networkSaidi.value, row.upstreamSaidiHours, row.loadSheddingSaidiHours, part("other")?.saidiHours ?? 0]), row.totalSaidi.value), row.id);
    }
  });

  it("breaks the portfolio's interruptions down by cause and by where they began, each adding up to the total", () => {
    const total = view.portfolio.saidi.value as number;
    assert.ok(close(sum(view.byCause.map((row) => row.saidiHours)), total));
    assert.ok(close(sum(view.byOriginPoint.map((row) => row.saidiHours)), total));
    assert.ok(close(sum(view.byCause.map((row) => row.saifi)), view.portfolio.saifi.value));
    assert.ok(close(sum(view.byCause.map((row) => row.share)), 1));
    assert.deepEqual(view.byCause.map((row) => row.label), ["Load shedding", "Fault", "Loss of upstream supply", "Planned maintenance", "Weather"]);
    assert.deepEqual(view.byOriginPoint.slice(0, 2).map((row) => [row.key, row.note]), [
      ["grid", "Load management or upstream"],
      ["subtransmission_line", "The distribution network"],
    ]);
    // The 33 kV lines are the network's: their SAIDI is part of the network class, with the feeders and transformers.
    const network = view.portfolio.attribution.find((row) => row.key === "network")?.saidiHours as number;
    const own = view.byOriginPoint.filter((row) => row.note === "The distribution network");
    assert.ok(close(sum(own.map((row) => row.saidiHours)), network));
  });

  it("lists the elements interruptions began at, most interruptions first, without load shedding", () => {
    assert.deepEqual(view.origins.slice(0, 3).map((origin) => [origin.subject.label, origin.attributionLabel, origin.interruptions]), [
      ["Hillcrest rural 33 kV line", "Network", 16],
      ["132/33 kV transmission station", "Upstream supply", 3],
      ["Riverside 33 kV line", "Network", 1],
    ]);
    assert.ok(view.origins.every((origin) => origin.attribution !== "load_management"));
    // A 33 kV line is not a registry asset: it keeps its name and has no screen. A feeder has one.
    assert.equal(view.origins[0].subject.link, null);
    assert.match(view.origins[0].subject.kindLabel, /not a registry asset/);
    assert.deepEqual(view.origins.find((origin) => origin.subject.id === "FD-OLD")?.subject.link, { kind: "feeder", id: "FD-OLD" });
    // Together they are everything that is not load shedding.
    const shedding = view.portfolio.attribution.find((row) => row.key === "load_management")?.saidiHours as number;
    assert.ok(close(sum(view.origins.map((origin) => origin.saidiHours)), (view.portfolio.saidi.value as number) - shedding));
  });

  it("sets every reported figure beside its calculation, naming the scope, and lists what each report's rule changes", () => {
    assert.equal(view.comparisons.length, 12);
    assert.ok(view.comparisons.every((row) => typeof row.statedFor === "string" && row.statedFor.length > 0));
    assert.deepEqual(
      view.ruleFindings.filter((found) => found.figure === "SAIDI").map((found) => [found.statedFor.id, Math.round((found.difference.value as number) * 10) / 10]),
      [["FD-MKT", 3.6], ["FD-OLD", 3.6], ["FD-FRM", 56.7], ["FD-GOV", 0]],
    );
    assert.equal(view.sourcing.synthetic, true);
  });
});

describe("revenue workspace", async () => {
  const view = await revenueWorkspaceView(runtime);

  it("shows government (MDA) accounts as their own class, first, with their share of what was not collected", () => {
    const [first] = view.byCustomerClass;
    assert.deepEqual([first.category, first.label, first.accounts], ["government", "Government (MDA)", 90]);
    assert.ok(close(first.collection.value, first.revenueCollected / first.revenueBilled));
    assert.ok((first.collection.value as number) < 0.25);
    assert.ok(close(first.notCollected, first.revenueBilled - first.revenueCollected));
    // 90 of 6,448 accounts left 45% of the shortfall.
    assert.ok(Math.abs((first.shareOfNotCollected as number) - 0.45) < 0.01);
    assert.ok(close(sum(view.byCustomerClass.map((row) => row.shareOfNotCollected)), 1));
    const shortfalls = view.byCustomerClass.map((row) => row.notCollected);
    assert.deepEqual(shortfalls, [...shortfalls].sort((a, b) => b - a));
    // The classes add up to the portfolio's billing and collection.
    assert.ok(close(sum(view.byCustomerClass.map((row) => row.revenueBilled)), view.revenueBilled.value, 1e-3));
    assert.ok(close(sum(view.byCustomerClass.map((row) => row.revenueCollected)), view.revenueCollected.value, 1e-3));
    assert.equal(view.collectionBasis, "cash");
  });

  it("shows the classes on each feeder, with MDA on Government Avenue only", () => {
    const withGovernment = view.feeders.filter((feeder) => feeder.byCustomerClass.some((row) => row.category === "government")).map((feeder) => feeder.id);
    assert.deepEqual(withGovernment, ["FD-GOV"]);
    const government = view.feeders.find((feeder) => feeder.id === "FD-GOV")?.byCustomerClass[0];
    assert.equal(government?.category, "government");
    assert.ok((government?.shareOfNotCollected as number) > 0.85);
  });

  it("sets commercial loss beside collection loss for each feeder, as the Operations drill-down has them", async () => {
    assert.deepEqual(view.feeders.map((feeder) => feeder.id), ["FD-MKT", "FD-OLD", "FD-FRM", "FD-GOV"]);
    for (const row of view.feeders) {
      const feeder = (await feederView(runtime, row.id)) as NetworkLevelView;
      assert.deepEqual(row.losses.parts, feeder.losses?.parts, row.id);
      assert.deepEqual(row.commercialGap, feeder.revenueGap.commercial, row.id);
      assert.deepEqual(row.collectionGap, feeder.revenueGap.collection, row.id);
      assert.equal(row.losses.parts.commercial.origin, "derived");
      assert.equal(row.losses.parts.collection.origin, "calculated");
    }
    // The two kinds of loss point at different feeders: Old Town loses most to unbilled energy, Government Avenue to unpaid bills.
    const part = (id: string, name: "commercial" | "collection") => view.feeders.find((feeder) => feeder.id === id)?.losses.parts[name].value as number;
    assert.ok(part("FD-OLD", "commercial") > part("FD-OLD", "collection"));
    assert.ok(part("FD-GOV", "collection") > 10 * part("FD-GOV", "commercial"));
    // The portfolio's gap is the one the Executive page shows, and the feeders' not-realised figures are its rows.
    assert.deepEqual(view.gapByFeeder.map((row) => row.notRealised.value), view.feeders.map((feeder) => feeder.notRealised.value));
    assert.equal(view.sourcing.synthetic, true);
  });
});
