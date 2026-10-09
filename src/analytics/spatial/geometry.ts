import type { AreaGeometry, Coordinates, Geometry, Polygon } from "@/domain";

/* ==========================================================
   ANALYTICS — GEOMETRY

   The few geometric questions the platform asks: is a point inside
   an area, is a shape inside an area, how far is a point from a
   shape, and what box holds a set of shapes.

   Coordinates are WGS84 degrees. Containment is tested on the
   coordinates as they are (a planar test in degrees), which is
   exact enough for areas the size of a state and wrong only for
   shapes that cross the antimeridian or a pole, which no area this
   platform holds does. Distances are in metres on a spherical earth.

   A point exactly on an outline may fall either side. Nothing here
   depends on which.
========================================================== */

const EARTH_RADIUS_M = 6_371_008.8;
const RADIANS = Math.PI / 180;

function valid(point: Coordinates): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

/** Every vertex of a geometry, outlines and holes included. */
export function verticesOf(geometry: Geometry): Coordinates[] {
  switch (geometry.type) {
    case "point":
      return [geometry.point];
    case "line":
      return [...geometry.path];
    case "area":
      return geometry.polygons.flatMap((polygon) => [...polygon.outer, ...(polygon.holes ?? []).flat()]);
  }
}

/** False for a geometry with no vertex, too few for its shape, or a coordinate that is not on the globe. */
export function isUsableGeometry(geometry: Geometry): boolean {
  const vertices = verticesOf(geometry);
  if (vertices.length === 0 || !vertices.every(valid)) return false;
  if (geometry.type === "line") return geometry.path.length >= 2;
  if (geometry.type === "area") return geometry.polygons.length > 0 && geometry.polygons.every((polygon) => polygon.outer.length >= 3);
  return true;
}

function inRing(point: Coordinates, ring: readonly Coordinates[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses = a.latitude > point.latitude !== b.latitude > point.latitude;
    if (crosses && point.longitude < ((b.longitude - a.longitude) * (point.latitude - a.latitude)) / (b.latitude - a.latitude) + a.longitude) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Coordinates, polygon: Polygon): boolean {
  return inRing(point, polygon.outer) && !(polygon.holes ?? []).some((hole) => inRing(point, hole));
}

export function pointInArea(point: Coordinates, area: AreaGeometry): boolean {
  return area.polygons.some((polygon) => pointInPolygon(point, polygon));
}

/**
 * Whether a geometry lies within an area: a point when it is inside; a line or an area when
 * EVERY vertex is inside. A line that leaves the area between two vertices that are inside it
 * would still count, which is accepted: lines are judged by the points they are recorded at.
 */
export function geometryWithinArea(geometry: Geometry, area: AreaGeometry): boolean {
  const vertices = geometry.type === "area" ? geometry.polygons.flatMap((polygon) => [...polygon.outer]) : verticesOf(geometry);
  return vertices.length > 0 && vertices.every((vertex) => pointInArea(vertex, area));
}

/** Whether any vertex of a geometry is inside an area. */
export function geometryTouchesArea(geometry: Geometry, area: AreaGeometry): boolean {
  return verticesOf(geometry).some((vertex) => pointInArea(vertex, area));
}

/** Great-circle distance in metres. */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const dLat = (b.latitude - a.latitude) * RADIANS;
  const dLon = (b.longitude - a.longitude) * RADIANS;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * RADIANS) * Math.cos(b.latitude * RADIANS) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance from a point to the segment a–b, in metres, on a flat projection centred on the point. */
function distanceToSegment(point: Coordinates, a: Coordinates, b: Coordinates): number {
  const scale = Math.cos(point.latitude * RADIANS);
  const ax = (a.longitude - point.longitude) * scale;
  const ay = a.latitude - point.latitude;
  const bx = (b.longitude - point.longitude) * scale;
  const by = b.latitude - point.latitude;
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
  return Math.hypot(ax + t * dx, ay + t * dy) * RADIANS * EARTH_RADIUS_M;
}

function distanceToPath(point: Coordinates, path: readonly Coordinates[], closed: boolean): number {
  if (path.length === 1) return distanceMetres(point, path[0]);
  let best = Number.POSITIVE_INFINITY;
  const segments = closed ? path.length : path.length - 1;
  for (let i = 0; i < segments; i++) best = Math.min(best, distanceToSegment(point, path[i], path[(i + 1) % path.length]));
  return best;
}

/** Distance from a point to a geometry, in metres: 0 inside an area; to the nearest part of a line or outline otherwise. */
export function distanceToGeometryMetres(point: Coordinates, geometry: Geometry): number {
  switch (geometry.type) {
    case "point":
      return distanceMetres(point, geometry.point);
    case "line":
      return distanceToPath(point, geometry.path, false);
    case "area":
      if (pointInArea(point, geometry)) return 0;
      return Math.min(...geometry.polygons.map((polygon) => distanceToPath(point, polygon.outer, true)));
  }
}

/** The box that holds a set of geometries. */
export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** null when there is nothing to hold. */
export function boundsOf(geometries: readonly Geometry[]): Bounds | null {
  let bounds: Bounds | null = null;
  for (const geometry of geometries) {
    for (const vertex of verticesOf(geometry)) {
      if (!valid(vertex)) continue;
      if (bounds === null) bounds = { south: vertex.latitude, north: vertex.latitude, west: vertex.longitude, east: vertex.longitude };
      else {
        bounds.south = Math.min(bounds.south, vertex.latitude);
        bounds.north = Math.max(bounds.north, vertex.latitude);
        bounds.west = Math.min(bounds.west, vertex.longitude);
        bounds.east = Math.max(bounds.east, vertex.longitude);
      }
    }
  }
  return bounds;
}
