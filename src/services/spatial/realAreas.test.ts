import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntityLocation } from "@/domain";
import type { SpatialModule } from "./module.ts";
import type { SpatialContext } from "./queries.ts";
import type { ViewerContext } from "./viewer.ts";
import { pointInArea } from "../../analytics/index.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { BOUNDARY_CREDIT, BOUNDARY_NOTE, GEOBOUNDARIES_SOURCES, withGeoBoundaries } from "../../repositories/geoboundaries/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { UTILITY_SPATIAL_MODULE } from "../utility/spatial.ts";
import { mapView } from "./map.ts";
import { createSpatialRegistry } from "./module.ts";
import { areaOutlines, totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "./queries.ts";

/* Real administrative boundaries beside a synthetic network (ADR 0014): the boundaries are held
   with where they came from, and the spatial services never relate a synthetic entity or a
   synthetic figure to a real area. */

const repos = withGeoBoundaries(createDemoRepositories());
const runtime = { repos, now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const PUBLIC: ViewerContext = { viewerId: "public-demo", organizationId: null, access: { kind: "everything" } };
const context: SpatialContext = { runtime, registry: createSpatialRegistry([UTILITY_SPATIAL_MODULE]), viewer: PUBLIC };

const states = (await repos.spatial.listAreas({ kinds: ["state"] })).records;
const lgas = (await repos.spatial.listAreas({ kinds: ["lga"] })).records;
// Where the synthetic network's first substation is drawn.
const RIVERSIDE = { latitude: 9.23, longitude: 12.46 };
const stateThere = states.find((area) => pointInArea(RIVERSIDE, area.geometry));
const lgaThere = lgas.find((area) => pointInArea(RIVERSIDE, area.geometry));

describe("geoBoundaries: Nigeria's states and LGAs, with where they came from", () => {
  it("holds 37 states and 774 LGAs, each naming its source record", async () => {
    assert.equal(states.length, 37);
    assert.equal(lgas.length, 774);
    assert.equal(new Set([...states, ...lgas].map((area) => area.id)).size, 811);
    assert.ok(states.every((area) => area.kind === "state" && area.provenance.sourceSystem === "geoboundaries-gbopen-nga-adm1" && area.provenance.sourceRecordId !== undefined));
    assert.ok(lgas.every((area) => area.kind === "lga" && area.provenance.sourceSystem === "geoboundaries-gbopen-nga-adm2"));
    assert.ok([...states, ...lgas].every((area) => area.provenance.methodologyVersion === "9469f09" && area.provenance.ingestedAt === "2026-10-09T00:00:00Z"));
    assert.equal(states.find((area) => area.name === "Adamawa")?.code, "NG-AD");
  });

  it("records the licence, the credit, the URL, the release, the date and the original file's hash on each source", async () => {
    const sources = (await repos.sources.listDataSources()).filter((source) => source.id.startsWith("geoboundaries-"));
    assert.deepEqual(sources, [...GEOBOUNDARIES_SOURCES]);
    assert.equal(sources.length, 2);
    for (const source of sources) {
      assert.equal(source.kind, "gis");
      assert.equal(source.licence, "Creative Commons Attribution 4.0 International (CC BY 4.0)");
      assert.equal(source.attribution, BOUNDARY_CREDIT);
      assert.equal(source.release, "9469f09");
      assert.equal(source.notice, BOUNDARY_NOTE);
      assert.match(source.url ?? "", /^https:\/\/github\.com\/wmgeolab\/geoBoundaries\/raw\/9469f09\/releaseData\/gbOpen\/NGA\/ADM[12]\/geoBoundaries-NGA-ADM[12]_simplified\.geojson$/);
      assert.match(source.description ?? "", /from GRID3/);
      assert.match(source.description ?? "", /SHA-256 [0-9a-f]{64}/);
      assert.match(source.dated ?? "", /Represents 2022; retrieved 2026-10-09/);
    }
    assert.match(sources[0].description ?? "", /edd28050c7f1ae40471424605f74e4d2df83502e4f301089761ae18f8ae2fbbf/);
    assert.match(sources[1].description ?? "", /daac9ba2c98f0d8984085c8a5b3a5301fca362f3ca37e6ac7dfcc7633719fc1d/);
    // The synthetic sources are still there, and still synthetic.
    assert.equal((await repos.sources.listDataSources()).filter((source) => source.kind === "synthetic").length, 7);
  });

  it("gives every LGA a state, worked out from the geometry and marked as derived, matching the official counts", () => {
    assert.ok(lgas.every((area) => area.parentBasis === "derived" && states.some((state) => state.id === area.parentAreaId)));
    assert.ok(states.every((area) => area.parentAreaId === undefined));
    const count = (name: string) => lgas.filter((area) => area.parentAreaId === states.find((state) => state.name === name)?.id).length;
    // The numbers of LGAs the constitution lists for these states.
    assert.deepEqual(["Adamawa", "Kano", "Lagos", "Bayelsa", "Edo", "Ondo", "Kebbi", "Kwara", "Abuja Federal Capital Territory"].map(count), [21, 44, 20, 8, 18, 18, 21, 16, 6]);
    assert.match(lgas[0].provenance.method ?? "", /Parent area derived/);
  });

  it("keeps the synthetic districts beside them, and is complete for what it adds", async () => {
    const all = await repos.spatial.listAreas({});
    assert.equal(all.records.length, 3 + 37 + 774);
    assert.equal(all.completeness, "complete");
    assert.equal((await repos.spatial.listAreas({ kinds: ["other"] })).records.length, 3);
  });
});

describe("area outlines, for orientation", () => {
  it("gives the states with the credit the licence requires and the words that must be shown with them", async () => {
    const outlines = await areaOutlines(context, "state");
    assert.equal(outlines.areas.length, 37);
    assert.deepEqual(outlines.credits, ["Boundaries: geoBoundaries (CC BY 4.0), Runfola et al. 2020"]);
    assert.deepEqual(outlines.notes, ["Administrative boundaries from geoBoundaries, not survey-grade."]);
    assert.equal(outlines.sourcing.synthetic, false);
    assert.equal(outlines.sourcing.sources[0].licence, "Creative Commons Attribution 4.0 International (CC BY 4.0)");
    const adamawa = outlines.areas.find((area) => area.name === "Adamawa");
    // Compact rings of [latitude, longitude]: Adamawa is between 7 and 11 degrees north.
    assert.ok(adamawa !== undefined && adamawa.polygons[0][0].every(([latitude, longitude]) => latitude > 7 && latitude < 11 && longitude > 11 && longitude < 14));
    assert.equal(adamawa.parent, null);
  });

  it("gives the LGAs with the state each lies in, said to be derived", async () => {
    const outlines = await areaOutlines(context, "lga");
    assert.equal(outlines.areas.length, 774);
    assert.deepEqual(outlines.areas.find((area) => area.name === "Yola North")?.parent, { id: stateThere?.id, name: "Adamawa", basis: "derived" });
    assert.deepEqual(outlines.credits, [BOUNDARY_CREDIT]);
  });

  it("says the demonstration's districts are synthetic and no administrative boundary, with no credit owed", async () => {
    const outlines = await areaOutlines(context, "other");
    assert.equal(outlines.areas.length, 3);
    assert.deepEqual(outlines.credits, []);
    assert.deepEqual(outlines.notes, ["Synthetic areas, drawn for the demonstration. They are no administrative boundary."]);
    assert.equal(outlines.sourcing.synthetic, true);
  });
});

describe("a synthetic network is never related to a real area", () => {
  it("is drawn where a real state and a real LGA are, which is what makes the rule necessary", () => {
    assert.equal(stateThere?.name, "Adamawa");
    assert.ok(lgaThere !== undefined);
  });

  it("totals a synthetic figure by the synthetic districts only, and says the real areas were left out", async () => {
    const totals = await totalsByArea(context, "utility.revenue_not_realised");
    assert.deepEqual(totals?.rows.map((row) => row.area.id), ["demo-district-north-east", "demo-district-north-west", "demo-district-south"]);
    assert.match(totals?.areasNotTotalled ?? "", /^37 real area\(s\) are not totalled/);
    // Asked for by state or by LGA outright, it totals by none, and keeps every figure as outside every area.
    for (const [areaKind, count] of [["state", 37], ["lga", 774]] as const) {
      const real = await totalsByArea(context, "utility.revenue_not_realised", { areaKind });
      assert.deepEqual(real?.rows, []);
      assert.match(real?.areasNotTotalled ?? "", new RegExp(`^${count} real area`));
      assert.ok((real?.outsideEveryArea.value as number) > 45_000_000);
    }
    const districts = await totalsByArea(context, "utility.revenue_not_realised", { areaKind: "other" });
    assert.equal(districts?.rows.length, 3);
    assert.equal(districts?.areasNotTotalled, null);
  });

  it("lists no synthetic entity as inside a real state or LGA, and says why", async () => {
    for (const area of [stateThere, lgaThere]) {
      const inside = await whatIsInside(context, area?.id as string, { list: ["service_point"] });
      assert.equal(inside?.area.name, area?.name);
      assert.deepEqual(inside?.inside, []);
      assert.deepEqual(inside?.crossing, []);
      assert.match(inside?.withheld ?? "", /synthetic demonstration data and this is a real area/);
    }
    // A synthetic district still lists them, with nothing withheld.
    const district = await whatIsInside(context, "demo-district-south");
    assert.equal(district?.inside.find((group) => group.kind === "distribution_transformer")?.count, 18);
    assert.equal(district?.withheld, null);
  });

  it("names no real area as the place a synthetic asset is in", async () => {
    const behind = await whatIsBehind(context, { kind: "distribution_transformer", id: "DT-OLD-2" });
    assert.deepEqual(behind?.areas.map((area) => area.id), ["demo-district-south"]);
    // A bare point is a place, not an entity: asking what areas a point is in still answers with the real state.
    const here = await whatIsHere(context, { point: RIVERSIDE, withinMetres: 50, kinds: ["substation"] });
    assert.deepEqual(here.areas.map((area) => area.name).sort(), ["Adamawa", "Demonstration district South (synthetic)"]);
  });

  it("gives a viewer whose territory is a real state none of the synthetic network", async () => {
    const viewer: ViewerContext = { viewerId: "user@adamawa", organizationId: "adamawa-co", access: { kind: "territory", parts: [{ kind: "areas", areaIds: [stateThere?.id as string, lgaThere?.id as string] }] } };
    const map = await mapView({ ...context, viewer });
    assert.ok(map.layers.length > 3 && map.layers.every((layer) => layer.features.length === 0 && layer.areaFeatures.length === 0));
    assert.equal(map.scopeLimited, true);
  });

  it("does relate an entity from a real source to a real area: the rule is about synthetic data, not about areas", async () => {
    const location: EntityLocation = { entity: { kind: "site", id: "SITE-REAL" }, geometry: { type: "point", point: RIVERSIDE }, basis: "surveyed", provenance: { sourceSystem: "a-real-register", ingestedAt: DEMO_CLOCK } };
    const real: SpatialModule = {
      id: "sites",
      title: "Sites",
      entities: async () => ({ entities: [{ ref: location.entity, name: "A real site", kindLabel: "Site", location, notLocatedReason: null }], completeness: "complete", sourcing: { sources: [], synthetic: false, unknownSources: ["a-real-register"] } }),
      trace: async () => ({ upstream: [], downstream: [], downstreamKnown: true, facts: [] }),
      measures: [],
      layers: [],
    };
    const mixed: SpatialContext = { runtime: { ...runtime, cache: createMemoryCache() }, registry: createSpatialRegistry([UTILITY_SPATIAL_MODULE, real]), viewer: PUBLIC };
    const inside = await whatIsInside(mixed, lgaThere?.id as string);
    assert.deepEqual(inside?.inside.map((group) => [group.kind, group.entities?.map((entity) => entity.id)]), [["site", ["SITE-REAL"]]]);
    // The synthetic network at the same place is still withheld.
    assert.ok(inside?.withheld !== null);
    const behind = await whatIsBehind(mixed, { kind: "site", id: "SITE-REAL" });
    assert.deepEqual(behind?.areas.map((area) => area.name), ["Adamawa"]);
  });
});
