import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Area, AreaGeometry, Coordinates, EntityLocation, PowerTransformer } from "@/domain";
import { CONTEXT, PROVENANCE, buildRegistry } from "../__fixtures__/network.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { traceAsset } from "../topology/trace.ts";
import { SPATIAL_REFERENCE, allocateToAreas, areaMembership } from "./allocation.ts";
import { boundsOf, distanceMetres, distanceToGeometryMetres, geometryTouchesArea, geometryWithinArea, isUsableGeometry, pointInArea } from "./geometry.ts";
import { registryLocations } from "./locations.ts";

const at = (latitude: number, longitude: number): Coordinates => ({ latitude, longitude });
const box = (south: number, west: number, north: number, east: number): Coordinates[] => [at(south, west), at(south, east), at(north, east), at(north, west)];
const region = (id: string, outer: Coordinates[], holes?: Coordinates[][]): Area => ({
  id,
  kind: "other",
  name: id,
  geometry: { type: "area", polygons: [{ outer, ...(holes ? { holes } : {}) }] },
  provenance: PROVENANCE,
});
const point = (kind: string, id: string, latitude: number, longitude: number): EntityLocation => ({
  entity: { kind, id },
  geometry: { type: "point", point: at(latitude, longitude) },
  basis: "unspecified",
  provenance: PROVENANCE,
});

describe("geometry", () => {
  const square: AreaGeometry = { type: "area", polygons: [{ outer: box(0, 0, 10, 10), holes: [box(4, 4, 6, 6)] }, { outer: box(20, 20, 21, 21) }] };

  it("says whether a point is inside an area, with holes and several pieces", () => {
    assert.equal(pointInArea(at(1, 1), square), true);
    assert.equal(pointInArea(at(5, 5), square), false, "in the hole");
    assert.equal(pointInArea(at(20.5, 20.5), square), true, "in the second piece");
    assert.equal(pointInArea(at(11, 5), square), false);
    assert.equal(pointInArea(at(-1, -1), square), false);
  });

  it("counts a line as inside only when every vertex is, and as touching when any is", () => {
    const inside = { type: "line" as const, path: [at(1, 1), at(2, 2), at(3, 1)] };
    const leaving = { type: "line" as const, path: [at(1, 1), at(2, 2), at(12, 2)] };
    const elsewhere = { type: "line" as const, path: [at(30, 30), at(31, 31)] };
    assert.equal(geometryWithinArea(inside, square), true);
    assert.equal(geometryWithinArea(leaving, square), false);
    assert.equal(geometryTouchesArea(leaving, square), true);
    assert.equal(geometryTouchesArea(elsewhere, square), false);
  });

  it("measures distance in metres: to a point, to the nearest part of a line, and zero inside an area", () => {
    // One degree of latitude is about 111.2 km.
    assert.ok(Math.abs(distanceMetres(at(9, 12), at(10, 12)) - 111_195) < 50);
    assert.equal(distanceMetres(at(9, 12), at(9, 12)), 0);
    const line = { type: "line" as const, path: [at(9, 12), at(9, 13)] };
    // Above the middle of an east–west line: the distance is the gap in latitude, not to either end.
    assert.ok(Math.abs(distanceToGeometryMetres(at(9.01, 12.5), line) - 1_112) < 5);
    // Beyond its end: the distance is to the end.
    assert.ok(Math.abs(distanceToGeometryMetres(at(9, 13.01), line) - distanceMetres(at(9, 13.01), at(9, 13))) < 1);
    assert.equal(distanceToGeometryMetres(at(1, 1), square), 0);
    assert.ok(Math.abs(distanceToGeometryMetres(at(10.01, 5), square) - 1_112) < 5);
  });

  it("gives the box that holds a set of shapes, and none for nothing", () => {
    assert.deepEqual(boundsOf([{ type: "point", point: at(9.2, 12.4) }, { type: "line", path: [at(9.1, 12.5), at(9.3, 12.45)] }]), { south: 9.1, north: 9.3, west: 12.4, east: 12.5 });
    assert.equal(boundsOf([]), null);
  });

  it("rejects a shape that cannot be drawn", () => {
    assert.equal(isUsableGeometry({ type: "point", point: at(9, 12) }), true);
    assert.equal(isUsableGeometry({ type: "point", point: at(Number.NaN, 12) }), false);
    assert.equal(isUsableGeometry({ type: "point", point: at(95, 12) }), false);
    assert.equal(isUsableGeometry({ type: "line", path: [at(9, 12)] }), false);
    assert.equal(isUsableGeometry({ type: "area", polygons: [{ outer: [at(0, 0), at(1, 1)] }] }), false);
  });
});

describe("locations from the registry", () => {
  const registry = buildRegistry();
  const powerTransformer = (id: string, substationId: string): PowerTransformer => ({
    id,
    substationId,
    name: id,
    ratingMva: 5,
    primaryVoltageKv: 33,
    secondaryVoltageKv: 11,
    lifecycle: "in_service",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    provenance: PROVENANCE,
  });

  it("places nothing by guessing: an asset with no location is returned as not located", () => {
    const { located, notLocated } = registryLocations({ ...registry, powerTransformers: [powerTransformer("PT-1", "SS-1")] });
    // The fixture holds no coordinates at all.
    assert.equal(located.length, 0);
    assert.ok(notLocated.some((missing) => missing.entity.kind === "substation" && missing.reason === "no_location_recorded"));
    assert.deepEqual(notLocated.find((missing) => missing.entity.kind === "power_transformer"), { entity: { kind: "power_transformer", id: "PT-1" }, reason: "parent_not_located" });
    const assets = registry.substations.length + 1 + registry.feeders.length + registry.distributionTransformers.length + registry.servicePoints.length;
    assert.equal(notLocated.length, assets, "every asset is accounted for");
  });

  it("reads each asset's own location, shows a power transformer at its substation, and keeps how a route was obtained", () => {
    const withPlaces = {
      ...registry,
      substations: registry.substations.map((substation) => ({ ...substation, location: at(9.2, 12.4) })),
      feeders: registry.feeders.map((feeder, i) => (i === 0 ? { ...feeder, route: [at(9.2, 12.4), at(9.21, 12.41)], routeBasis: "schematic" as const } : feeder)),
      distributionTransformers: registry.distributionTransformers.map((dt, i) => (i === 0 ? { ...dt, location: at(9.21, 12.41), locationBasis: "surveyed" as const } : { ...dt, location: at(200, 12) })),
      powerTransformers: [powerTransformer("PT-1", "SS-1"), { ...powerTransformer("PT-OLD", "SS-1"), lifecycle: "decommissioned" as const }],
    };
    const { located, notLocated } = registryLocations(withPlaces);
    const of = (kind: string, id: string) => located.find((location) => location.entity.kind === kind && location.entity.id === id);
    assert.equal(of("substation", "SS-1")?.basis, "unspecified");
    assert.deepEqual(of("power_transformer", "PT-1")?.inheritedFrom, { kind: "substation", id: "SS-1" });
    assert.equal(of("power_transformer", "PT-1")?.basis, "inherited");
    assert.equal(of("power_transformer", "PT-OLD"), undefined, "not in service");
    assert.equal(of("feeder", "FD-1")?.basis, "schematic");
    assert.equal(of("feeder", "FD-1")?.geometry.type, "line");
    assert.equal(of("distribution_transformer", "DT-1")?.basis, "surveyed");
    assert.deepEqual(notLocated.find((missing) => missing.entity.id === "DT-2"), { entity: { kind: "distribution_transformer", id: "DT-2" }, reason: "location_not_usable" });
    assert.deepEqual(notLocated.find((missing) => missing.entity.id === "FD-2"), { entity: { kind: "feeder", id: "FD-2" }, reason: "no_location_recorded" });
  });
});

describe("tracing the network from an asset", () => {
  const registry = buildRegistry();
  const index = buildTopologyIndex(registry);
  const none = { powerTransformers: [], edgeDevices: [] };

  it("gives what supplies a transformer, nearest first, and what it supplies", () => {
    const trace = traceAsset(index, none, { kind: "distribution_transformer", id: "DT-1" });
    assert.deepEqual(trace?.upstream, [{ kind: "feeder", id: "FD-1" }, { kind: "substation", id: "SS-1" }]);
    assert.deepEqual(trace?.downstream, { feeders: [], distributionTransformers: [], servicePoints: ["SP-1", "SP-2"] });
    assert.equal(trace?.regionId, "R-1");
  });

  it("gives a feeder its transformers and every service point on them or directly on it", () => {
    const trace = traceAsset(index, none, { kind: "feeder", id: "FD-1" });
    assert.deepEqual(trace?.upstream, [{ kind: "substation", id: "SS-1" }]);
    assert.deepEqual(trace?.downstream, { feeders: [], distributionTransformers: ["DT-1", "DT-2"], servicePoints: ["SP-1", "SP-2", "SP-3", "SP-4"] });
  });

  it("gives a substation its feeders and everything on them, and a service point nothing below it", () => {
    const substation = traceAsset(index, none, { kind: "substation", id: "SS-1" });
    assert.deepEqual(substation?.downstream.feeders, ["FD-1", "FD-2"]);
    assert.equal(substation?.downstream.servicePoints.length, 4);
    assert.deepEqual(substation?.upstream, []);
    const point = traceAsset(index, none, { kind: "service_point", id: "SP-4" });
    assert.deepEqual(point?.upstream, [{ kind: "feeder", id: "FD-1" }, { kind: "substation", id: "SS-1" }]);
    assert.deepEqual(point?.downstream, { feeders: [], distributionTransformers: [], servicePoints: [] });
  });

  it("names the power transformer a feeder's origin names, and says when what a power transformer supplies is not recorded", () => {
    const transformers = [
      { id: "PT-A", substationId: "SS-1" },
      { id: "PT-B", substationId: "SS-1" },
    ] as PowerTransformer[];
    const records = { powerTransformers: transformers, edgeDevices: [] };
    // No feeder names a transformer: which feeders hang from PT-A is not recorded.
    const unknown = traceAsset(index, records, { kind: "power_transformer", id: "PT-A" });
    assert.equal(unknown?.downstreamKnown, false);
    assert.deepEqual(unknown?.downstream.feeders, []);

    const named = buildTopologyIndex({
      ...registry,
      feeders: registry.feeders.map((feeder) => ({ ...feeder, origin: { ...feeder.origin, powerTransformerId: feeder.id === "FD-1" ? "PT-A" : "PT-B" } })),
    });
    const known = traceAsset(named, records, { kind: "power_transformer", id: "PT-A" });
    assert.equal(known?.downstreamKnown, true);
    assert.deepEqual(known?.downstream.feeders, ["FD-1"]);
    assert.deepEqual(known?.downstream.distributionTransformers, ["DT-1", "DT-2"]);
    assert.deepEqual(known?.upstream, [{ kind: "substation", id: "SS-1" }]);
    assert.deepEqual(traceAsset(named, records, { kind: "distribution_transformer", id: "DT-2" })?.upstream, [
      { kind: "feeder", id: "FD-1" },
      { kind: "power_transformer", id: "PT-A" },
      { kind: "substation", id: "SS-1" },
    ]);
  });

  it("has no trace for an asset that is not in the registry", () => {
    assert.equal(traceAsset(index, none, { kind: "feeder", id: "FD-NOWHERE" }), null);
  });
});

describe("areas: membership and totals", () => {
  const west = region("A-WEST", box(0, 0, 10, 10));
  const east = region("B-EAST", box(0, 10, 10, 20));
  const locations = [point("site", "S-1", 1, 1), point("site", "S-2", 2, 2), point("site", "S-3", 5, 15), point("site", "S-FAR", 50, 50)];

  it("puts a point in the area that contains it and a line in an area only when all of it is", () => {
    const crossing: EntityLocation = { entity: { kind: "line", id: "L-1" }, geometry: { type: "line", path: [at(1, 9), at(1, 11)] }, basis: "schematic", provenance: PROVENANCE };
    const membership = areaMembership([west, east], [...locations, crossing]);
    assert.equal(membership.areaOf.get("site:S-1"), "A-WEST");
    assert.equal(membership.areaOf.get("site:S-3"), "B-EAST");
    assert.deepEqual(membership.outside, [{ kind: "site", id: "S-FAR" }, { kind: "line", id: "L-1" }]);
    assert.deepEqual(membership.warnings, []);
  });

  it("gives each figure whole to one area, and keeps what belongs to none", () => {
    const allocation = allocateToAreas({
      areas: [east, west],
      locations,
      contributions: [
        { entity: { kind: "site", id: "S-1" }, value: 100, estimated: false },
        { entity: { kind: "site", id: "S-2" }, value: 50, estimated: true },
        { entity: { kind: "site", id: "S-3" }, value: 7, estimated: false },
        { entity: { kind: "site", id: "S-FAR" }, value: 3, estimated: false },
        { entity: { kind: "site", id: "S-NOWHERE" }, value: 11, estimated: false },
      ],
      whole: 200,
      context: CONTEXT,
    });
    assert.deepEqual(allocation.totals, [
      { areaId: "A-WEST", total: { value: 150, status: "calculated_with_estimates", entities: 2, missing: 0, estimated: 1 } },
      { areaId: "B-EAST", total: { value: 7, status: "ok", entities: 1, missing: 0, estimated: 0 } },
    ]);
    assert.equal(allocation.outsideEveryArea.value, 3);
    assert.equal(allocation.notLocated.value, 11);
    // 200 for the whole; the entities carry 171; 29 belongs to no entity.
    assert.equal(allocation.remainder, 29);
    assert.deepEqual(allocation.methodology, { id: SPATIAL_REFERENCE.id, version: SPATIAL_REFERENCE.version });
    assert.equal(allocation.computedAt, CONTEXT.computedAt);
  });

  it("never turns a missing figure into a smaller total, and an area with nothing in it has a real zero", () => {
    const empty = region("C-EMPTY", box(30, 30, 31, 31));
    const allocation = allocateToAreas({
      areas: [west, east, empty],
      locations,
      contributions: [
        { entity: { kind: "site", id: "S-1" }, value: 100, estimated: false },
        { entity: { kind: "site", id: "S-2" }, value: null, estimated: false },
        { entity: { kind: "site", id: "S-3" }, value: 7, estimated: false },
      ],
      whole: 500,
      context: CONTEXT,
    });
    const total = (areaId: string) => allocation.totals.find((row) => row.areaId === areaId)?.total;
    assert.deepEqual(total("A-WEST"), { value: null, status: "insufficient_data", entities: 2, missing: 1, estimated: 0 });
    assert.equal(total("B-EAST")?.value, 7);
    assert.deepEqual(total("C-EMPTY"), { value: 0, status: "ok", entities: 0, missing: 0, estimated: 0 });
    assert.equal(allocation.remainder, null, "the whole less a missing figure is not known");
    assert.deepEqual(allocateToAreas({ areas: [west], locations, contributions: [], context: CONTEXT }).remainder, null, "no whole given");
  });

  it("reports areas that overlap, and gives what is in the overlap to the first in id order", () => {
    const overlap = region("A-OVER", box(0, 0, 3, 3));
    const allocation = allocateToAreas({
      areas: [west, overlap],
      locations,
      contributions: [{ entity: { kind: "site", id: "S-1" }, value: 100, estimated: false }],
      context: CONTEXT,
    });
    assert.equal(allocation.totals.find((row) => row.areaId === "A-OVER")?.total.value, 100);
    assert.equal(allocation.totals.find((row) => row.areaId === "A-WEST")?.total.value, 0);
    assert.equal(allocation.warnings[0]?.code, "AREAS_OVERLAP");
  });
});
