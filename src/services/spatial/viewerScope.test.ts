import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TerritoryPart } from "@/domain";
import type { LayerDefinition } from "./module.ts";
import type { SpatialContext } from "./queries.ts";
import type { ViewerContext } from "./viewer.ts";
import { geometryWithinArea, registryLocations } from "../../analytics/index.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { UTILITY_SPATIAL_MODULE } from "../utility/spatial.ts";
import * as mapServices from "./map.ts";
import * as queryServices from "./queries.ts";
import { createSpatialRegistry } from "./module.ts";
import { mapView } from "./map.ts";
import { MAX_SEARCH_METRES, areaOutlines, incidentsNow, totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "./queries.ts";
import { isLimited, viewerScopeKey } from "./viewer.ts";

/* ==========================================================
   A RESTRICTED VIEWER CANNOT SEE AN ASSET OUTSIDE ITS TERRITORY

   For each way a territory can be stated (listed assets, a named
   area, a drawn boundary, and nothing at all), every spatial
   service and the map are asked everything they can be asked, and
   the answers are searched for any trace of an entity outside the
   territory: its id anywhere in the result, or its name.

   What is inside a territory is worked out here independently of
   the services, from the registry and the geometry alone.

   If a spatial service is added and this file is not taught to ask
   it, the first test fails.
========================================================== */

const repos = createDemoRepositories();
// One cache for every viewer, as the running application has: a leak through the cache would show.
const cache = createMemoryCache();
const runtime = { repos, now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache };

/** A layer that colours by a figure, recording which entities its module was asked about. */
const askedAbout: string[] = [];
const FIGURE_LAYER: LayerDefinition = {
  id: "utility.test_figure",
  title: "Test figure",
  description: "",
  shape: "point",
  entityKinds: ["distribution_transformer"],
  legend: [{ key: "any", label: "Any", tone: "neutral" }],
  onByDefault: false,
  async figures(_runtime, entities) {
    for (const entity of entities) askedAbout.push(entity.ref.id);
    const metric = { label: "Test", value: 1, unit: "count" as const, currency: null, status: "ok" as const, origin: "calculated" as const, derivation: null, method: null, inputs: [], estimatedInputs: [], missingInputs: [], warnings: [], note: null };
    return { result: new Map(entities.map((entity) => [`${entity.ref.kind}:${entity.ref.id}`, { metric, classKey: "any" }])), sourcing: { sources: [], synthetic: false, unknownSources: [] } };
  },
};
const registry = createSpatialRegistry([{ ...UTILITY_SPATIAL_MODULE, layers: [...UTILITY_SPATIAL_MODULE.layers, FIGURE_LAYER] }]);
const ALL_LAYERS = registry.modules.flatMap((spatialModule) => spatialModule.layers.map((layer) => layer.id));
const DISTRICTS = ["demo-district-south", "demo-district-north-west", "demo-district-north-east"];

const PUBLIC: ViewerContext = { viewerId: "public-demo", organizationId: null, access: { kind: "everything" } };
const restricted = (name: string, parts: TerritoryPart[]): ViewerContext => ({ viewerId: `user@${name}`, organizationId: name, access: { kind: "territory", parts } });

const { snapshot } = await repos.registry.getSnapshot({ asOf: DEMO_CLOCK });
const { located } = registryLocations(snapshot);
const areas = (await repos.spatial.listAreas({})).records;
const key = (kind: string, id: string) => `${kind}:${id}`;
const EVERY = new Map<string, { kind: string; id: string; name: string }>();
for (const [kind, records] of [
  ["substation", snapshot.substations],
  ["power_transformer", snapshot.powerTransformers],
  ["feeder", snapshot.feeders],
  ["distribution_transformer", snapshot.distributionTransformers],
  ["service_point", snapshot.servicePoints.map((point) => ({ id: point.id, name: point.id }))],
] as const) {
  for (const record of records) EVERY.set(key(kind, record.id), { kind, id: record.id, name: record.name });
}

/** What a boundary or an area holds, from the geometry alone. */
function within(outline: (typeof areas)[number]["geometry"]): Set<string> {
  return new Set(located.filter((location) => geometryWithinArea(location.geometry, outline)).map((location) => key(location.entity.kind, location.entity.id)));
}

/** What listing the Old Town feeder holds, from the registry alone: the feeder, its transformers, their service points. */
function oldTown(): Set<string> {
  const transformers = snapshot.distributionTransformers.filter((dt) => dt.feederId === "FD-OLD").map((dt) => dt.id);
  const points = snapshot.servicePoints.filter((point) => point.supply.kind === "distribution_transformer" && transformers.includes(point.supply.transformerId)).map((point) => point.id);
  return new Set([key("feeder", "FD-OLD"), ...transformers.map((id) => key("distribution_transformer", id)), ...points.map((id) => key("service_point", id))]);
}

const HILLCREST_TOWN = { type: "area" as const, polygons: [{ outer: [{ latitude: 9.27, longitude: 12.41 }, { latitude: 9.27, longitude: 12.51 }, { latitude: 9.33, longitude: 12.51 }, { latitude: 9.33, longitude: 12.41 }] }] };
const NORTH_EAST = areas.find((area) => area.id === "demo-district-north-east") as (typeof areas)[number];

const CASES: { name: string; viewer: ViewerContext; visible: Set<string>; visibleAreas: string[] }[] = [
  { name: "listed assets: the Old Town feeder", viewer: restricted("old-town-co", [{ kind: "assets", assets: [{ kind: "feeder", id: "FD-OLD" }] }]), visible: oldTown(), visibleAreas: [] },
  { name: "a named area: the north-east district", viewer: restricted("north-east-co", [{ kind: "areas", areaIds: ["demo-district-north-east"] }]), visible: within(NORTH_EAST.geometry), visibleAreas: ["demo-district-north-east"] },
  { name: "a drawn boundary: around Hillcrest and Government Avenue", viewer: restricted("hillcrest-co", [{ kind: "boundary", geometry: HILLCREST_TOWN }]), visible: within(HILLCREST_TOWN), visibleAreas: [] },
  { name: "an empty territory", viewer: restricted("nobody", []), visible: new Set(), visibleAreas: [] },
  { name: "an area the source does not hold, and an asset that does not exist", viewer: restricted("ghost", [{ kind: "areas", areaIds: ["no-such-area"] }, { kind: "assets", assets: [{ kind: "feeder", id: "FD-NOWHERE" }] }]), visible: new Set(), visibleAreas: [] },
];

/** Every spatial service, asked everything it can be asked. Returns the answers by service. */
async function askEverything(viewer: ViewerContext): Promise<Record<string, unknown>> {
  const context: SpatialContext = { runtime, registry, viewer };
  const assets = [...EVERY.values()].filter((entity) => entity.kind !== "service_point");
  const somePoints = ["SP-OLD2-001", "SP-FRM3-010", "SP-GOV3-004", "SP-MKT2-005", "SP-MKT-MV-001"].map((id) => ({ kind: "service_point", id }));
  const behind = [];
  for (const entity of [...assets, ...somePoints]) behind.push(await whatIsBehind(context, { kind: entity.kind, id: entity.id }, { list: ["service_point"] }));
  const inside = [];
  for (const id of DISTRICTS) inside.push(await whatIsInside(context, id, { list: ["service_point"] }));
  return {
    mapView: [await mapView(context, { layers: ALL_LAYERS }), await mapView(context)],
    // From the middle of the network, as far as a search may reach: everything there is.
    whatIsHere: await whatIsHere(context, { point: { latitude: 9.26, longitude: 12.47 }, withinMetres: MAX_SEARCH_METRES }),
    whatIsInside: inside,
    whatIsBehind: behind,
    totalsByArea: [await totalsByArea(context, "utility.revenue_not_realised"), await totalsByArea(context, "utility.revenue_not_realised", { areaKind: "other" })],
    areaOutlines: [await areaOutlines(context, "other"), await areaOutlines(context, "state"), await areaOutlines(context, "lga")],
    incidentsNow: await incidentsNow(context),
    // A map focused on each asset: what supplies it and what it supplies.
    focusedMaps: await Promise.all(assets.map((entity) => mapView(context, { layers: ALL_LAYERS, focus: { kind: entity.kind, id: entity.id } }))),
  };
}

/** The ids and names found anywhere in an answer. */
function mentions(answer: unknown): { tokens: Set<string>; text: string } {
  const text = JSON.stringify(answer);
  return { tokens: new Set(text.match(/[A-Za-z0-9_-]+/g) ?? []), text };
}

describe("every spatial service is covered by the leak test", () => {
  it("asks every function the spatial services export", () => {
    const exported = [...Object.entries(queryServices), ...Object.entries(mapServices)].filter(([, value]) => typeof value === "function").map(([name]) => name).sort();
    assert.deepEqual(exported, ["areaOutlines", "incidentsNow", "mapView", "totalsByArea", "whatIsBehind", "whatIsHere", "whatIsInside"]);
  });

  it("is not vacuous: the public viewer's answers do mention every asset", async () => {
    const answers = await askEverything(PUBLIC);
    const { tokens } = mentions(answers);
    for (const entity of EVERY.values()) assert.ok(tokens.has(entity.id), `${entity.id} is in no answer to the public viewer`);
    assert.equal(isLimited(PUBLIC), false);
  });
});

for (const { name, viewer, visible, visibleAreas } of CASES) {
  describe(`a viewer restricted to ${name}`, () => {
    const outside = [...EVERY].filter(([entity]) => !visible.has(entity)).map(([, entity]) => entity);
    const inside = [...EVERY].filter(([entity]) => visible.has(entity)).map(([, entity]) => entity);

    it("is given no id and no name of anything outside its territory, by any service or by the map", async () => {
      assert.ok(outside.length > 1000, "the territory leaves most of the network out");
      askedAbout.length = 0;
      const answers = await askEverything(viewer);
      for (const [service, answer] of Object.entries(answers)) {
        const { tokens, text } = mentions(answer);
        const leakedIds = outside.filter((entity) => tokens.has(entity.id)).map((entity) => entity.id);
        assert.deepEqual(leakedIds, [], `${service} names ids outside the territory`);
        const leakedNames = outside.filter((entity) => entity.kind !== "service_point" && text.includes(JSON.stringify(entity.name))).map((entity) => entity.name);
        assert.deepEqual(leakedNames, [], `${service} names assets outside the territory`);
        const hiddenAreas = areas.filter((area) => !visibleAreas.includes(area.id) && (tokens.has(area.id) || text.includes(JSON.stringify(area.name)))).map((area) => area.id);
        assert.deepEqual(hiddenAreas, [], `${service} names areas the territory does not name`);
      }
      // A module asked for a layer's figures is asked about visible entities only.
      assert.deepEqual(askedAbout.filter((id) => !visible.has(key("distribution_transformer", id))), []);
    });

    it("is given everything inside its territory, marked as limited to it", async () => {
      const context: SpatialContext = { runtime, registry, viewer };
      const map = await mapView(context, { layers: ALL_LAYERS });
      assert.equal(map.scopeLimited, true);
      const drawn = new Set(map.layers.flatMap((layer) => layer.features.map((feature) => key(feature.entity.kind, feature.entity.id))));
      // Every layer is asked for, the service points among them; power transformers are no layer.
      const expected = inside.filter((entity) => entity.kind !== "power_transformer").map((entity) => key(entity.kind, entity.id));
      assert.deepEqual([...drawn].sort(), expected.sort());
      const here = await whatIsHere(context, { point: { latitude: 9.26, longitude: 12.47 }, withinMetres: MAX_SEARCH_METRES });
      assert.equal(here.scopeLimited, true);
      // Power transformers are not a layer; a search finds them at their substation.
      assert.equal(here.entities.length, inside.length);
    });

    it("gets, for an asset outside its territory, the answer it would get for one that does not exist", async () => {
      const context: SpatialContext = { runtime, registry, viewer };
      const nothing = await whatIsBehind(context, { kind: "distribution_transformer", id: "DT-NOWHERE" });
      for (const entity of outside.filter((candidate) => candidate.kind !== "service_point").slice(0, 12)) {
        assert.deepEqual(await whatIsBehind(context, { kind: entity.kind, id: entity.id }), nothing, entity.id);
      }
      for (const id of DISTRICTS.filter((district) => !visibleAreas.includes(district))) assert.equal(await whatIsInside(context, id), await whatIsInside(context, "no-such-area"), id);
    });
  });
}

describe("what a restricted viewer's figures cover", () => {
  const [oldTownCase, northEastCase, hillcrestCase] = CASES;

  it("stops a trace at the edge of the territory: no substation above a feeder the viewer was given alone", async () => {
    const context: SpatialContext = { runtime, registry, viewer: oldTownCase.viewer };
    const feeder = await whatIsBehind(context, { kind: "feeder", id: "FD-OLD" });
    assert.deepEqual(feeder?.upstream, []);
    assert.equal(feeder?.downstream.find((group) => group.kind === "distribution_transformer")?.count, 14);
    const everyone = await whatIsBehind({ runtime, registry, viewer: PUBLIC }, { kind: "feeder", id: "FD-OLD" });
    assert.deepEqual(everyone?.upstream.map((entity) => entity.id), ["PT-RIV-1", "SS-RIV"]);
    // The whole feeder is the viewer's, so the accounts behind it are all counted.
    assert.deepEqual(feeder?.facts.map((fact) => fact.value), everyone?.facts.map((fact) => fact.value));
  });

  it("counts only the connections it sees behind an asset", async () => {
    const context: SpatialContext = { runtime, registry, viewer: hillcrestCase.viewer };
    const substation = await whatIsBehind(context, { kind: "substation", id: "SS-HIL" });
    // Government Avenue is inside the boundary; Farm Road is not, and is not counted or named.
    assert.deepEqual(substation?.downstream.find((group) => group.kind === "feeder")?.entities?.map((entity) => entity.id), ["FD-GOV"]);
    const seen = [...hillcrestCase.visible].filter((entity) => entity.startsWith("service_point:")).length;
    assert.equal(substation?.facts.find((fact) => fact.label === "Connections behind it")?.value, seen);
    const everyone = await whatIsBehind({ runtime, registry, viewer: PUBLIC }, { kind: "substation", id: "SS-HIL" });
    assert.ok((everyone?.facts[0].value as number) > seen);
  });

  it("totals by area only what it sees, in the areas it sees, and is never given the whole or what is left of it", async () => {
    const limited = await totalsByArea({ runtime, registry, viewer: northEastCase.viewer }, "utility.revenue_not_realised");
    const everyone = await totalsByArea({ runtime, registry, viewer: PUBLIC }, "utility.revenue_not_realised");
    assert.deepEqual(limited?.rows.map((row) => row.area.id), ["demo-district-north-east"]);
    assert.equal(limited?.rows[0].total.value, everyone?.rows.find((row) => row.area.id === "demo-district-north-east")?.total.value);
    assert.equal(limited?.remainder, null);
    assert.equal(limited?.remainderNote, null);
    assert.equal(limited?.scopeLimited, true);
    assert.ok(everyone?.remainder !== null && everyone?.scopeLimited === false);
    // A viewer whose territory names no area has none to total by: its transformers' figures are kept, as outside every area.
    const byAssets = await totalsByArea({ runtime, registry, viewer: oldTownCase.viewer }, "utility.revenue_not_realised");
    assert.deepEqual(byAssets?.rows, []);
    assert.ok((byAssets?.outsideEveryArea.value as number) > 0);
    assert.equal(byAssets?.remainder, null);
  });
});

describe("the cache never serves one viewer's result to another", () => {
  it("keys a result by the viewer's whole territory", () => {
    const [oldTownCase, northEastCase] = CASES;
    assert.equal(viewerScopeKey(PUBLIC), "viewer:everything");
    assert.notEqual(viewerScopeKey(oldTownCase.viewer), viewerScopeKey(northEastCase.viewer));
    assert.notEqual(viewerScopeKey(oldTownCase.viewer), viewerScopeKey(PUBLIC));
    // The same territory written with its fields in another order is the same territory.
    const reordered = restricted("old-town-co", [{ assets: [{ id: "FD-OLD", kind: "feeder" }], kind: "assets" }]);
    assert.equal(viewerScopeKey(reordered), viewerScopeKey(oldTownCase.viewer));
    // The same assets under another organization are another scope; so is one asset more.
    assert.notEqual(viewerScopeKey(restricted("other-co", [{ kind: "assets", assets: [{ kind: "feeder", id: "FD-OLD" }] }])), viewerScopeKey(oldTownCase.viewer));
    assert.notEqual(viewerScopeKey(restricted("old-town-co", [{ kind: "assets", assets: [{ kind: "feeder", id: "FD-OLD" }, { kind: "feeder", id: "FD-MKT" }] }])), viewerScopeKey(oldTownCase.viewer));
    // An empty territory is not "everything".
    assert.notEqual(viewerScopeKey(restricted("nobody", [])), viewerScopeKey(PUBLIC));
  });

  it("gives each viewer its own answer from one shared cache, whoever asked first", async () => {
    const shared = { ...runtime, cache: createMemoryCache() };
    const ask = (viewer: ViewerContext) => mapView({ runtime: shared, registry, viewer }, { layers: ["utility.transformers"] });
    const [oldTownCase, northEastCase] = CASES;
    const first = await ask(oldTownCase.viewer);
    const everyone = await ask(PUBLIC);
    const second = await ask(northEastCase.viewer);
    const again = await ask(oldTownCase.viewer);
    assert.equal(first.layers[0].features.length, 14);
    assert.equal(everyone.layers[0].features.length, 48);
    assert.equal(second.layers[0].features.length, 16);
    assert.equal(again, first, "the same viewer's second request is served from the cache");
    assert.ok(second.layers[0].features.every((feature) => !first.layers[0].features.some((other) => other.entity.id === feature.entity.id)));
  });
});
