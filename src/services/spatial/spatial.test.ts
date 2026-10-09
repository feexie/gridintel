import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SpatialContext } from "./queries.ts";
import type { LayerDefinition, SpatialModule } from "./module.ts";
import type { ViewerContext } from "./viewer.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { UTILITY_SPATIAL_MODULE } from "../utility/spatial.ts";
import { mapView } from "./map.ts";
import { createSpatialRegistry } from "./module.ts";
import { LIST_LIMIT, MAX_SEARCH_METRES, totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "./queries.ts";

/* The spatial services on the synthetic demonstration network, for the public viewer, who sees
   everything. What a restricted viewer sees is in viewerScope.test.ts. */

const PUBLIC: ViewerContext = { viewerId: "public-demo", organizationId: null, access: { kind: "everything" } };
const runtime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const registry = createSpatialRegistry([UTILITY_SPATIAL_MODULE]);
const context: SpatialContext = { runtime, registry, viewer: PUBLIC };

describe("layer registry", () => {
  const layer = (id: string, extra: Partial<LayerDefinition> = {}): LayerDefinition => ({ id, title: id, description: "", shape: "point", entityKinds: ["site"], legend: [], onByDefault: true, ...extra });
  const module_ = (id: string, layers: LayerDefinition[]): SpatialModule => ({
    id,
    title: id,
    entities: async () => ({ entities: [], completeness: "complete", sourcing: { sources: [], synthetic: false, unknownSources: [] } }),
    trace: async () => null,
    measures: [],
    layers,
  });

  it("finds a layer and a measure by id, across modules", () => {
    const two = createSpatialRegistry([UTILITY_SPATIAL_MODULE, module_("minigrid", [layer("minigrid.sites")])]);
    assert.equal(two.layer("utility.feeders")?.module.id, "utility");
    assert.equal(two.layer("minigrid.sites")?.module.id, "minigrid");
    assert.equal(two.measure("utility.revenue_not_realised")?.measure.entityKind, "distribution_transformer");
    assert.equal(two.layer("utility.nothing"), null);
    assert.equal(two.measure("minigrid.nothing"), null);
  });

  it("refuses ambiguous or misnamed registrations at start-up", () => {
    assert.throws(() => createSpatialRegistry([UTILITY_SPATIAL_MODULE, UTILITY_SPATIAL_MODULE]), /registered twice/);
    assert.throws(() => createSpatialRegistry([module_("der", [layer("utility.feeders")])]), /must be named "der\.<name>"/);
    assert.throws(() => createSpatialRegistry([module_("der", [layer("der.a"), layer("der.a")])]), /registered twice/);
    assert.throws(() => createSpatialRegistry([module_("der", [layer("der.a", { figures: async () => ({ result: new Map(), sourcing: { sources: [], synthetic: false, unknownSources: [] } }) })])]), /no legend/);
    assert.throws(() => createSpatialRegistry([module_("der", [layer("der.a", { legend: [{ key: "x", label: "X", tone: "good" }, { key: "x", label: "Y", tone: "alert" }] })])]), /legend key twice/);
  });
});

const NETWORK = { layers: ["utility.substations", "utility.feeders", "utility.transformers"] };

describe("the map read model, on the demonstration network", () => {
  it("draws the utility network from the registry: two substations, four feeder routes, 48 transformers", async () => {
    const map = await mapView(context, NETWORK);
    assert.deepEqual(map.layers.map((layer) => [layer.id, layer.features.length, layer.notLocated.length]), [
      ["utility.substations", 2, 0],
      ["utility.feeders", 4, 0],
      ["utility.transformers", 48, 0],
    ]);
    assert.deepEqual(map.modules.map((spatialModule) => [spatialModule.id, spatialModule.layers.length]), [["utility", 11]]);
    assert.equal(map.scopeLimited, false);
    assert.equal(map.asOf, DEMO_CLOCK);
    // The box holds every transformer: the feeders run out from the two substations.
    assert.ok(map.bounds !== null && map.bounds.south < 9.17 && map.bounds.north > 9.35 && map.bounds.west < 12.37 && map.bounds.east > 12.56);
    assert.ok(map.layers.every((layer) => layer.coverage === "complete"));
  });

  it("marks the data synthetic, and says a feeder route is schematic, not surveyed", async () => {
    const map = await mapView(context, NETWORK);
    assert.equal(map.sourcing.synthetic, true);
    assert.ok(map.layers.every((layer) => layer.sourcing.synthetic));
    const feeders = map.layers.find((layer) => layer.id === "utility.feeders");
    assert.ok(feeders?.features.every((feature) => feature.entity.basis === "schematic" && feature.entity.geometry?.type === "line"));
    const marketRoad = feeders?.features.find((feature) => feature.entity.id === "FD-MKT")?.entity;
    // From the substation through each of its twelve transformers.
    assert.equal(marketRoad?.geometry?.type === "line" && marketRoad.geometry.path.length, 13);
    // The words that must be on the map while routes are drawn travel with the layer.
    assert.match(feeders?.notes[0] ?? "", /^Schematic: straight lines/);
    assert.deepEqual(map.layers.filter((layer) => layer.id !== "utility.feeders").flatMap((layer) => layer.notes), []);
    // A layer that only draws the network colours by no figure, so the map has none to show or invent as a class.
    assert.ok(map.layers.every((layer) => layer.legend.length === 0 && layer.features.every((feature) => feature.metric === null && feature.classKey === null)));
  });

  it("gives only the layers asked for, in the order asked, and refuses one that is not registered", async () => {
    const map = await mapView(context, { layers: ["utility.transformers", "utility.substations"] });
    assert.deepEqual(map.layers.map((layer) => layer.id), ["utility.transformers", "utility.substations"]);
    assert.throws(() => mapView(context, { layers: ["utility.nothing"] }), /No layer "utility.nothing"/);
  });
});

describe("a layer coloured by a figure, and layers shown one at a time", () => {
  // A stand-in for the layers of Phase 7b: the figure comes from a service result, with its class.
  const asked: string[][] = [];
  const themed = (id: string): LayerDefinition => ({
    id,
    title: id,
    description: "",
    shape: "point",
    entityKinds: ["substation"],
    exclusiveGroup: "substation-theme",
    legend: [
      { key: "high", label: "High", tone: "alert" },
      { key: "none", label: "No figure", tone: "no_data" },
    ],
    onByDefault: false,
    async figures(_runtime, entities) {
      asked.push(entities.map((entity) => entity.ref.id));
      const metric = { label: "Test", value: 1, unit: "count" as const, currency: null, status: "ok" as const, origin: "calculated" as const, derivation: null, method: null, inputs: [], estimatedInputs: [], missingInputs: [], warnings: [], note: null };
      // Hillcrest has no figure: it must arrive without one, not with a made-up class.
      return { result: new Map(entities.filter((entity) => entity.ref.id === "SS-RIV").map((entity) => [`substation:${entity.ref.id}`, { metric, classKey: "high" }])), sourcing: { sources: [], synthetic: false, unknownSources: [] } };
    },
  });
  const themedRegistry = createSpatialRegistry([{ ...UTILITY_SPATIAL_MODULE, layers: [...UTILITY_SPATIAL_MODULE.layers, themed("utility.theme_a"), themed("utility.theme_b")] }]);
  const themedContext: SpatialContext = { runtime: { ...runtime, cache: createMemoryCache() }, registry: themedRegistry, viewer: PUBLIC };

  it("carries the service's figure and its legend class on each feature, and nothing where there is no figure", async () => {
    const map = await mapView(themedContext, { layers: ["utility.theme_a"] });
    const features = map.layers[0].features;
    assert.deepEqual(features.map((feature) => [feature.entity.id, feature.metric?.value ?? null, feature.classKey]), [["SS-RIV", 1, "high"], ["SS-HIL", null, null]]);
    assert.deepEqual(asked, [["SS-RIV", "SS-HIL"]]);
    assert.equal(map.layers[0].exclusiveGroup, "substation-theme");
    // Not on by default: it is not among the layers the map opens with.
    assert.ok(!(await mapView(themedContext)).layers.some((layer) => layer.id.startsWith("utility.theme_")));
  });

  it("gives every layer of a group when asked, each naming the group, so that the map can show one at a time", async () => {
    const map = await mapView(themedContext, { layers: ["utility.theme_a", "utility.theme_b"] });
    assert.deepEqual(map.layers.map((layer) => [layer.id, layer.exclusiveGroup]), [["utility.theme_a", "substation-theme"], ["utility.theme_b", "substation-theme"]]);
  });
});

describe("what is here", () => {
  it("finds what lies within a distance of a point, nearest first, with the area the point is in", async () => {
    // Riverbank transformer, DT-OLD-2.
    const here = await whatIsHere(context, { point: { latitude: 9.2205, longitude: 12.4465 }, withinMetres: 300, kinds: ["distribution_transformer", "feeder", "substation"] });
    assert.deepEqual(here.entities.map((entity) => entity.id), ["DT-OLD-2", "FD-OLD"]);
    assert.ok(here.entities.every((entity) => entity.distanceMetres < 1));
    assert.deepEqual(here.areas.map((area) => area.id), ["demo-district-south"]);
    assert.equal(here.coverage, "complete");
    assert.equal(here.sourcing.synthetic, true);
  });

  it("finds a line by its nearest part, not by its ends", async () => {
    // Midway between DT-OLD-1 and DT-OLD-2: no transformer within 200 m, but the route passes through.
    const here = await whatIsHere(context, { point: { latitude: 9.223, longitude: 12.44975 }, withinMetres: 200, kinds: ["distribution_transformer", "feeder"] });
    assert.deepEqual(here.entities.map((entity) => entity.id), ["FD-OLD"]);
  });

  it("returns service points too when no kind is named, and nothing far from the network", async () => {
    const near = await whatIsHere(context, { point: { latitude: 9.2205, longitude: 12.4465 }, withinMetres: 150 });
    assert.ok(near.entities.some((entity) => entity.kind === "service_point"));
    const far = await whatIsHere(context, { point: { latitude: 6.5, longitude: 3.4 }, withinMetres: 5_000 });
    assert.deepEqual(far.entities, []);
    assert.deepEqual(far.areas, []);
    // The lists searched are complete, so nothing found here does mean nothing is there.
    assert.equal(far.coverage, "complete");
  });

  it("refuses a point off the globe or a distance it will not search", () => {
    assert.throws(() => whatIsHere(context, { point: { latitude: 99, longitude: 12 }, withinMetres: 100 }), RangeError);
    assert.throws(() => whatIsHere(context, { point: { latitude: 9, longitude: 12 }, withinMetres: 0 }), RangeError);
    assert.throws(() => whatIsHere(context, { point: { latitude: 9, longitude: 12 }, withinMetres: MAX_SEARCH_METRES + 1 }), RangeError);
  });
});

describe("what is inside an area", () => {
  it("lists what lies wholly inside, by kind, and a route that crosses the boundary as crossing, in neither side", async () => {
    const south = await whatIsInside(context, "demo-district-south");
    assert.deepEqual(south?.inside.map((group) => [group.kind, group.count]), [["substation", 1], ["power_transformer", 1], ["feeder", 1], ["distribution_transformer", 18], ["service_point", 2383]]);
    assert.deepEqual(south?.inside.find((group) => group.kind === "feeder")?.entities?.map((entity) => entity.id), ["FD-OLD"]);
    assert.deepEqual(south?.crossing.map((entity) => entity.id), ["FD-MKT"]);
    assert.equal(south?.method.id, "gridintel.spatial.reference");
    const northEast = await whatIsInside(context, "demo-district-north-east");
    // Farm Road's transformers are all here, but its route starts at Hillcrest, in the next district.
    assert.deepEqual(northEast?.crossing.map((entity) => entity.id), ["FD-MKT", "FD-FRM"]);
    assert.equal(northEast?.inside.find((group) => group.kind === "feeder"), undefined);
  });

  it("puts every service point in exactly one district, and counts a long list without listing it unless asked", async () => {
    const districts = ["demo-district-south", "demo-district-north-west", "demo-district-north-east"];
    let points = 0;
    for (const id of districts) {
      const group = (await whatIsInside(context, id))?.inside.find((candidate) => candidate.kind === "service_point");
      assert.ok(group !== undefined && group.count > LIST_LIMIT && group.entities === null, id);
      points += group.count;
    }
    assert.equal(points, 6448);
    const listed = await whatIsInside(context, "demo-district-south", { list: ["service_point"] });
    assert.equal(listed?.inside.find((group) => group.kind === "service_point")?.entities?.length, 2383);
  });

  it("has no answer for an area that does not exist", async () => {
    assert.equal(await whatIsInside(context, "no-such-area"), null);
  });
});

describe("what is behind an asset", () => {
  it("traces the overloaded transformer DT-OLD-2 to its feeder, power transformer, substation, area and customers", async () => {
    const behind = await whatIsBehind(context, { kind: "distribution_transformer", id: "DT-OLD-2" });
    assert.equal(behind?.subject.name, "Riverbank transformer");
    assert.deepEqual(behind?.upstream.map((entity) => [entity.kind, entity.id]), [["feeder", "FD-OLD"], ["power_transformer", "PT-RIV-1"], ["substation", "SS-RIV"]]);
    assert.deepEqual(behind?.areas.map((area) => area.id), ["demo-district-south"]);
    assert.deepEqual(behind?.downstream.map((group) => [group.kind, group.count, group.entities?.length]), [["service_point", 135, 135]]);
    assert.deepEqual(behind?.facts.map((fact) => [fact.label, fact.value, fact.status, fact.origin]), [
      ["Connections behind it", 135, "ok", "calculated"],
      ["Active accounts behind it", 132, "ok", "calculated"],
    ]);
    assert.match(behind?.facts[1].note ?? "", /not a count of customers without supply/);
  });

  it("traces the Farm Road feeder, where the open fault is, to its ten transformers and the 1,015 customers behind it", async () => {
    const behind = await whatIsBehind(context, { kind: "feeder", id: "FD-FRM" });
    assert.deepEqual(behind?.upstream.map((entity) => entity.id), ["PT-HIL-2", "SS-HIL"]);
    const transformers = behind?.downstream.find((group) => group.kind === "distribution_transformer");
    assert.equal(transformers?.count, 10);
    assert.ok(transformers?.entities?.every((entity) => entity.id.startsWith("DT-FRM-") && entity.geometry?.type === "point"));
    assert.equal(behind?.facts.find((fact) => fact.label === "Active accounts behind it")?.value, 1015);
    // The route crosses a district boundary, so the feeder is in no single district.
    assert.deepEqual(behind?.areas, []);
    // The power transformer that carries Farm Road alone has the same customers behind it, and is shown at its substation.
    const transformer = await whatIsBehind(context, { kind: "power_transformer", id: "PT-HIL-2" });
    assert.equal(transformer?.subject.basis, "inherited");
    assert.deepEqual(transformer?.subject.inheritedFrom, { kind: "substation", id: "SS-HIL" });
    assert.deepEqual(transformer?.downstream.map((group) => [group.kind, group.count]), [["feeder", 1], ["distribution_transformer", 10], ["service_point", 1064]]);
    assert.equal(transformer?.facts.find((fact) => fact.label === "Active accounts behind it")?.value, 1015);
  });

  it("has no answer for an entity that does not exist or is of no registered kind", async () => {
    assert.equal(await whatIsBehind(context, { kind: "distribution_transformer", id: "DT-NOWHERE" }), null);
    assert.equal(await whatIsBehind(context, { kind: "minigrid_site", id: "SITE-1" }), null);
  });
});

describe("totals by area", () => {
  it("totals revenue not realised by district from each transformer's own figure, and accounts for the whole", async () => {
    const totals = await totalsByArea(context, "utility.revenue_not_realised");
    assert.ok(totals !== null);
    assert.deepEqual(totals.rows.map((row) => [row.area.id, row.entities, row.total.status, row.total.currency]), [
      ["demo-district-north-east", 16, "calculated_with_estimates", "NGN"],
      ["demo-district-north-west", 14, "calculated_with_estimates", "NGN"],
      ["demo-district-south", 18, "calculated_with_estimates", "NGN"],
    ]);
    assert.equal(totals.outsideEveryArea.value, 0);
    assert.equal(totals.notLocated.value, 0);
    assert.equal(totals.areaCoverage, "complete");
    assert.equal(totals.rows[0].total.method?.id, "gridintel.spatial.reference");
    assert.equal(totals.sourcing.synthetic, true);

    // Each district's total is the sum of the service's own figures for the transformers in it.
    const south = await whatIsInside(context, "demo-district-south");
    let expected = 0;
    for (const transformer of south?.inside.find((group) => group.kind === "distribution_transformer")?.entities ?? []) {
      const gap = await scopeRevenueGap({ repos: runtime.repos, scope: { kind: "distribution_transformer", id: transformer.id }, period: DEMO_PERIOD, context: { computedAt: DEMO_CLOCK }, cache: runtime.cache });
      expected += gap.result.notRealised as number;
    }
    assert.ok(Math.abs((totals.rows[2].total.value as number) - expected) < 0.01);

    // The districts and what no transformer carries add up to the portfolio's figure, as the Revenue screen has it.
    const portfolio = await scopeRevenueGap({ repos: runtime.repos, scope: { kind: "organization", id: "demo-disco" }, period: DEMO_PERIOD, context: { computedAt: DEMO_CLOCK }, cache: runtime.cache });
    const inAreas = totals.rows.reduce((sum, row) => sum + (row.total.value as number), 0);
    assert.ok(totals.remainder !== null && (totals.remainder.value as number) > 0);
    assert.ok(Math.abs(inAreas + (totals.remainder.value as number) - (portfolio.result.notRealised as number)) < 0.01);
    assert.equal(Math.round(portfolio.result.notRealised as number), 46_304_966);
    assert.equal(totals.remainder.origin, "derived");
    assert.match(totals.remainderNote ?? "", /customers supplied at 11 kV/);
  });

  it("has no areas to total by when none of the kind asked for is held, and no answer for a measure nobody registered", async () => {
    const lgas = await totalsByArea(context, "utility.revenue_not_realised", { areaKind: "lga" });
    assert.deepEqual(lgas?.rows, []);
    // Every transformer's figure is then outside every area: kept, not dropped.
    assert.ok((lgas?.outsideEveryArea.value as number) > 45_000_000);
    assert.equal(await totalsByArea(context, "utility.nothing"), null);
  });
});
