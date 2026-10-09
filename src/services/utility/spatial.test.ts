import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SpatialContext } from "../spatial/queries.ts";
import type { MapLayerView } from "../spatial/views.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { BOUNDARY_CREDIT, BOUNDARY_NOTE, withGeoBoundaries } from "../../repositories/geoboundaries/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { MINIGRID_SPATIAL_MODULE } from "../minigrid/spatial.ts";
import { loadRegistry, loadingBlock, lossesBlock, revenueGapBlock } from "../operations/levels.ts";
import { mapView } from "../spatial/map.ts";
import { createSpatialRegistry } from "../spatial/module.ts";
import { incidentsNow } from "../spatial/queries.ts";
import { REFERENCE_SPATIAL_MODULE } from "../spatial/reference.ts";
import { UTILITY_SPATIAL_MODULE } from "./spatial.ts";

/* The layers the modules register, on the demonstration network as the application composes
   it: the synthetic network, with the real boundaries beside it. Every figure on a layer is
   checked against the read-model block the drill-down screens show. */

const runtime = { repos: withGeoBoundaries(createDemoRepositories()), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const registry = createSpatialRegistry([UTILITY_SPATIAL_MODULE, MINIGRID_SPATIAL_MODULE, REFERENCE_SPATIAL_MODULE]);
const context: SpatialContext = { runtime, registry, viewer: { viewerId: "public-demo", organizationId: null, access: { kind: "everything" } } };
const EVERY_LAYER = registry.modules.flatMap((spatialModule) => spatialModule.layers.map((layer) => layer.id));

const map = await mapView(context, { layers: EVERY_LAYER.filter((id) => id !== "utility.service_points") });
const layer = (id: string) => map.layers.find((candidate) => candidate.id === id) as MapLayerView;
const feature = (layerId: string, entityId: string) => layer(layerId).features.find((candidate) => candidate.entity.id === entityId);
const classes = (id: string) => {
  const counts: Record<string, number> = {};
  for (const one of layer(id).features) counts[one.classKey ?? "none"] = (counts[one.classKey ?? "none"] ?? 0) + 1;
  return counts;
};

describe("what the modules register", () => {
  it("is three modules: the utility network, an empty place for mini-grid sites, and reference geography", () => {
    assert.deepEqual(map.modules.map((spatialModule) => [spatialModule.id, spatialModule.layers.map((one) => one.id)]), [
      ["utility", ["utility.substations", "utility.feeders", "utility.transformers", "utility.service_points", "utility.transformers.loading", "utility.transformers.atcc", "utility.transformers.revenue", "utility.transformers.band", "utility.open_outages", "utility.standing_alarms", "utility.districts"]],
      ["minigrid", ["minigrid.sites"]],
      ["reference", ["reference.states", "reference.lgas"]],
    ]);
  });

  it("puts the four transformer themes in one group, with one of them on when the map opens", () => {
    const themes = map.layers.filter((one) => one.exclusiveGroup === "utility.transformer_theme");
    assert.deepEqual(themes.map((one) => [one.id, one.onByDefault]), [
      ["utility.transformers.loading", true],
      ["utility.transformers.atcc", false],
      ["utility.transformers.revenue", false],
      ["utility.transformers.band", false],
    ]);
    // Every theme states its classes, and says in so many words what an asset with no figure looks like.
    assert.ok(themes.every((one) => one.legend.length === 4 && one.legend.at(-1)?.tone === "no_data"));
  });

  it("holds an empty place for mini-grid sites: no site, and said to be not available, not none", () => {
    const sites = layer("minigrid.sites");
    assert.deepEqual([sites.features.length, sites.areaFeatures.length, sites.notLocated.length], [0, 0, 0]);
    assert.equal(sites.coverage, "not_available");
    assert.match(sites.description, /No source of mini-grid sites is connected/);
    assert.equal(sites.onByDefault, false);
  });
});

describe("transformers coloured by a figure of the service that owns it", () => {
  it("by peak loading: the loading block's own figure, with the two designed overloads above rating", async () => {
    assert.deepEqual(classes("utility.transformers.loading"), { normal: 33, high: 13, over: 2 });
    assert.deepEqual(layer("utility.transformers.loading").features.filter((one) => one.classKey === "over").map((one) => one.entity.id).sort(), ["DT-GOV-3", "DT-OLD-2"]);
    const block = await loadingBlock(runtime, { kind: "distribution_transformer", id: "DT-OLD-2" });
    const shown = feature("utility.transformers.loading", "DT-OLD-2")?.metric;
    assert.equal(shown?.value, block?.peak.value);
    assert.equal(shown?.status, "ok");
    assert.equal(shown?.origin, "calculated");
    assert.equal(shown?.method?.id, "gridintel.loading.reference");
    assert.equal(shown?.derivation, block?.peak.derivation);
    // The readings behind it stay with the drill-down; the figure, its status, origin and method come with the map.
    assert.deepEqual(shown?.inputs, []);
    assert.ok((block?.peak.inputs.length ?? 0) > 0);
  });

  it("by ATC&C: the losses block's own figure, calculated with estimates and said to be", async () => {
    assert.deepEqual(classes("utility.transformers.atcc"), { low: 12, middle: 12, high: 24 });
    const block = await lossesBlock(runtime, { kind: "distribution_transformer", id: "DT-OLD-2" });
    const shown = feature("utility.transformers.atcc", "DT-OLD-2");
    assert.equal(shown?.metric?.value, block.atcc.value);
    assert.equal(shown?.metric?.status, "calculated_with_estimates");
    assert.equal(shown?.classKey, "high");
  });

  it("by revenue not realised: the revenue gap block's own figure, ranked in thirds among those shown", async () => {
    assert.deepEqual(classes("utility.transformers.revenue"), { highest: 16, middle: 16, lowest: 16 });
    const block = await revenueGapBlock(runtime, await loadRegistry(runtime), { kind: "distribution_transformer", id: "DT-GOV-3" });
    const shown = feature("utility.transformers.revenue", "DT-GOV-3");
    assert.equal(shown?.metric?.value, block.notRealised.value);
    assert.equal(shown?.metric?.currency, "NGN");
    assert.equal(shown?.classKey, "highest");
  });

  it("by band compliance: its feeder's days below the band minimum, said to be the feeder's", () => {
    assert.deepEqual(classes("utility.transformers.band"), { some: 14, often: 34 });
    const farm = feature("utility.transformers.band", "DT-FRM-3")?.metric;
    assert.equal(farm?.label, "Days its feeder was below the band minimum");
    assert.equal(farm?.value, 10);
    assert.match(farm?.derivation ?? "", /Band D minimum of 8 h, of 30 days\. The band is the feeder's/);
    // Farm Road's figures include an interruption still open, and the map says so with them.
    assert.match(farm?.note ?? "", /Provisional/);
    // Every transformer on a feeder shows that feeder's figure.
    assert.deepEqual([...new Set(layer("utility.transformers.band").features.filter((one) => one.entity.id.startsWith("DT-OLD-")).map((one) => one.metric?.value))], [2]);
  });

  it("gives DT-OLD-3, whose monitor is quiet, its peak from the readings held, and no loading now", () => {
    const details = feature("utility.transformers", "DT-OLD-3")?.details ?? [];
    assert.deepEqual(details.map((metric) => [metric.label, metric.status]).slice(0, 2), [["Peak loading", "ok"], ["Loading now", "insufficient_data"]]);
    assert.equal(details[1].value, null);
  });
});

describe("the key figures of an asset, for when it is selected", () => {
  it("are the figures its drill-down screen shows, each with status, origin and method", () => {
    assert.deepEqual(feature("utility.transformers", "DT-OLD-2")?.details.map((metric) => metric.label), ["Peak loading", "Loading now", "ATC&C", "Revenue not realised", "SAIDI", "Days its feeder was below the band minimum"]);
    assert.deepEqual(feature("utility.feeders", "FD-FRM")?.details.map((metric) => metric.label), ["Peak loading", "Loading now", "ATC&C", "Revenue not realised", "SAIDI", "Days below the band minimum"]);
    assert.deepEqual(feature("utility.substations", "SS-HIL")?.details.map((metric) => metric.label), ["ATC&C", "Revenue not realised", "SAIDI"]);
    for (const metric of feature("utility.feeders", "FD-FRM")?.details ?? []) {
      assert.ok(["ok", "calculated_with_estimates"].includes(metric.status), metric.label);
      assert.ok(["calculated", "derived", "estimated"].includes(metric.origin), metric.label);
      assert.deepEqual(metric.inputs, []);
    }
    // Farm Road tripped and is not restored: zero now, and its SAIDI is provisional.
    const farm = feature("utility.feeders", "FD-FRM")?.details ?? [];
    assert.equal(farm[1].value, 0);
    assert.match(farm[4].note ?? "", /Provisional/);
  });
});

describe("where a selected asset sits", () => {
  it("traces DT-OLD-2 to its feeder, power transformer, substation, district and customers, on the map itself", () => {
    const trace = feature("utility.transformers", "DT-OLD-2")?.trace;
    assert.deepEqual(trace?.upstream.map((above) => [above.kindLabel, above.id]), [["Feeder", "FD-OLD"], ["Power transformer", "PT-RIV-1"], ["Substation", "SS-RIV"]]);
    // A synthetic transformer is in a synthetic district, and in no real state.
    assert.deepEqual(trace?.areas, [{ id: "demo-district-south", name: "Demonstration district South (synthetic)" }]);
    assert.deepEqual(trace?.downstream, [{ kind: "service_point", kindLabel: "Service point", count: 135 }]);
    assert.deepEqual(trace?.facts.map((fact) => [fact.label, fact.value]), [["Connections behind it", 135], ["Active accounts behind it", 132]]);
    // A theme only colours; where an asset sits comes with the network's own layer.
    assert.equal(feature("utility.transformers.loading", "DT-OLD-2")?.trace, null);
    assert.equal(feature("utility.feeders", "FD-FRM")?.trace?.facts[1].value, 1015);
  });
});

describe("what is wrong now, on the map", () => {
  it("marks the ten Farm Road transformers without supply, with the customers the outage record gives for each", () => {
    const off = layer("utility.open_outages");
    assert.equal(off.features.length, 10);
    assert.ok(off.features.every((one) => one.entity.id.startsWith("DT-FRM-") && one.classKey === "off" && one.metric?.origin === "calculated"));
    assert.equal(off.features.reduce((sum, one) => sum + (one.metric?.value as number), 0), 1015);
    assert.match(off.features[0].metric?.note ?? "", /Interruption OUT-2026-09-30-FD-FRM-FAULT, since 2026-09-30T23:20:00\+01:00\. Not restored/);
    // An overlay marks what it concerns; the other 38 transformers are not "missing" from it.
    assert.deepEqual(off.notLocated, []);
  });

  it("marks the four assets a source alarm is standing on, an alarm on a monitor on the asset it monitors", () => {
    const alarms = layer("utility.standing_alarms");
    assert.deepEqual(alarms.features.map((one) => [one.entity.kind, one.entity.id, one.metric?.value, one.metric?.origin]), [
      ["substation", "SS-RIV", 1, "measured"],
      ["substation", "SS-HIL", 1, "measured"],
      ["feeder", "FD-FRM", 1, "measured"],
      ["distribution_transformer", "DT-OLD-3", 1, "measured"],
    ]);
    assert.match(feature("utility.standing_alarms", "DT-OLD-3")?.metric?.note ?? "", /RTU-COMMS-FAIL.*\(on its monitor\)/);
    assert.match(feature("utility.standing_alarms", "SS-RIV")?.metric?.note ?? "", /\(on Riverside T1\)/);
  });

  it("gives the Farm Road fault with what is behind where it began: ten transformers and 1,015 accounts", async () => {
    const now = await incidentsNow(context);
    assert.equal(now.coverage, "complete");
    assert.equal(now.incidents.length, 1);
    const [fault] = now.incidents;
    assert.deepEqual([fault.id, fault.module, fault.title, fault.since, fault.beganAt], ["OUT-2026-09-30-FD-FRM-FAULT", "utility", "Fault", "2026-09-30T23:20:00+01:00", "Feeder: Farm Road 11 kV feeder"]);
    // The outage record's own count, and the registry's count of accounts behind the feeder: two figures, two origins, and they agree.
    assert.deepEqual(fault.facts.map((fact) => [fact.label, fact.value]), [["Customers affected", 1015]]);
    assert.equal(fault.behind?.subject.id, "FD-FRM");
    assert.deepEqual(fault.behind?.upstream.map((entity) => entity.id), ["PT-HIL-2", "SS-HIL"]);
    assert.equal(fault.behind?.downstream.find((group) => group.kind === "distribution_transformer")?.count, 10);
    assert.equal(fault.behind?.facts.find((fact) => fact.label === "Active accounts behind it")?.value, 1015);
  });
});

describe("areas on the map", () => {
  it("totals revenue not realised by the three synthetic districts, and keeps what belongs to none apart", async () => {
    const districts = layer("utility.districts");
    assert.deepEqual(districts.areaFeatures.map((one) => [one.area.id, one.classKey, one.entities]), [
      ["demo-district-north-east", "lowest", 16],
      ["demo-district-north-west", "highest", 14],
      ["demo-district-south", "middle", 18],
    ]);
    assert.deepEqual(districts.unallocated.map((metric) => metric.label), ["Revenue not realised, outside every area", "Revenue not realised, not located", "Revenue not realised, carried by no distribution transformer"]);
    const portfolio = await scopeRevenueGap({ repos: runtime.repos, scope: { kind: "organization", id: "demo-disco" }, period: DEMO_PERIOD, context: { computedAt: DEMO_CLOCK }, cache: runtime.cache });
    const drawn = districts.areaFeatures.reduce((sum, one) => sum + (one.metric?.value as number), 0) + districts.unallocated.reduce((sum, metric) => sum + (metric.value as number), 0);
    assert.ok(Math.abs(drawn - (portfolio.result.notRealised as number)) < 0.01);
    assert.ok(districts.notes.includes("Synthetic areas, drawn for the demonstration. They are no administrative boundary."));
    assert.ok(districts.notes.some((note) => note.includes("It follows where transformers are, not where customers live")));
    assert.deepEqual(districts.credits, []);
    assert.equal(districts.onByDefault, false);
  });

  it("offers states and LGAs for orientation only: outlines fetched on request, with their credit, and no figure", () => {
    for (const [id, kind, on] of [["reference.states", "state", true], ["reference.lgas", "lga", false]] as const) {
      const outlines = layer(id);
      assert.equal(outlines.outlinesOnRequest, kind);
      assert.equal(outlines.onByDefault, on);
      assert.deepEqual(outlines.credits, [BOUNDARY_CREDIT]);
      assert.deepEqual(outlines.notes, [BOUNDARY_NOTE]);
      assert.deepEqual([outlines.features, outlines.areaFeatures, outlines.unallocated, outlines.legend], [[], [], [], []]);
      assert.equal(outlines.sourcing.synthetic, false);
    }
    // The map as a whole still says it holds synthetic data, and names the real source beside the synthetic ones.
    assert.equal(map.sourcing.synthetic, true);
    assert.ok(map.sourcing.sources.some((source) => source.kind === "gis" && source.licence !== undefined));
  });

  it("fits the view to the network drawn, not to the country the boundaries cover", () => {
    assert.ok(map.bounds !== null && map.bounds.north - map.bounds.south < 0.3 && map.bounds.east - map.bounds.west < 0.3);
  });
});

describe("a map focused on one asset", () => {
  const EMBEDDED = ["utility.substations", "utility.feeders", "utility.transformers", "utility.transformers.loading", "utility.open_outages", "utility.standing_alarms", "utility.service_points"];
  const count = (view: Awaited<ReturnType<typeof mapView>>) => Object.fromEntries(view.layers.map((one) => [one.id.replace("utility.", ""), one.features.length]));

  it("holds the asset, what supplies it and what it supplies, and nothing else", async () => {
    const feeder = await mapView(context, { layers: EMBEDDED, focus: { kind: "feeder", id: "FD-FRM" } });
    assert.deepEqual(count(feeder), { substations: 1, feeders: 1, transformers: 10, "transformers.loading": 10, open_outages: 10, standing_alarms: 2, service_points: 1064 });
    assert.ok(feeder.layers.flatMap((one) => one.features).every((one) => /FRM|SS-HIL/.test(one.entity.id)));
    const transformer = await mapView(context, { layers: EMBEDDED, focus: { kind: "distribution_transformer", id: "DT-OLD-2" } });
    assert.deepEqual(count(transformer), { substations: 1, feeders: 1, transformers: 1, "transformers.loading": 1, open_outages: 0, standing_alarms: 1, service_points: 135 });
    // The view takes in the transformer and the route back to its substation.
    assert.ok(transformer.bounds !== null && transformer.bounds.north >= 9.23 && transformer.bounds.south < 9.22);
  });

  it("is empty for an asset that does not exist", async () => {
    const nothing = await mapView(context, { layers: EMBEDDED, focus: { kind: "feeder", id: "FD-NOWHERE" } });
    assert.ok(nothing.layers.every((one) => one.features.length === 0));
    assert.equal(nothing.bounds, null);
  });
});
