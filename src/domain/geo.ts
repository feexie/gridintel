import type { Provenance } from "./provenance";

/* ==========================================================
   GRIDINTEL DOMAIN — GEOGRAPHY

   Where things are. Location is a fact about ANY entity the
   platform holds, not about network assets only: a substation, a
   feeder route, a service point, and later a mini-grid site or a
   DER asset are located the same way. Nothing here names a
   substation, a feeder or any other parent, so a new kind of entity
   is located without changing this model.

   Three shapes: a point, a line and an area. Areas are also records
   in their own right (a state, an LGA, a service territory), because
   figures are totalled by them and access is granted by them.

   Geometry is WGS84 decimal degrees throughout. How a geometry was
   obtained is stated beside it (`LocationBasis`): a straight line
   drawn between two transformers is not a surveyed route, and must
   never pass for one.
========================================================== */

/** A point in WGS84 decimal degrees. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** One closed outline, with any holes cut out of it. The first point need not be repeated at the end. */
export interface Polygon {
  outer: readonly Coordinates[];
  holes?: readonly (readonly Coordinates[])[];
}

export interface PointGeometry {
  type: "point";
  point: Coordinates;
}

/** An ordered path, e.g. a feeder route from its source outward. */
export interface LineGeometry {
  type: "line";
  path: readonly Coordinates[];
}

/** One or more polygons: an area may be in several pieces (a state with an island, an LGA with an exclave). */
export interface AreaGeometry {
  type: "area";
  polygons: readonly Polygon[];
}

export type Geometry = PointGeometry | LineGeometry | AreaGeometry;

/**
 * A pointer at any located entity. The kind is open on purpose: the asset
 * kinds of the network registry today ("substation", "feeder", ...), and
 * whatever a later module holds ("minigrid_site", "der_asset") without a
 * change here. Two entities are the same when kind and id both match.
 */
export interface LocatedRef {
  kind: string;
  id: string;
}

/**
 * How a geometry was obtained.
 * - surveyed: measured in the field (GPS survey, as-built drawing).
 * - digitised: traced from imagery or a map.
 * - schematic: drawn to show connection, not position, e.g. straight lines
 *   between the points a line connects. Lengths and crossings mean nothing.
 * - inherited: the entity has no location of its own and is shown at
 *   another's (`inheritedFrom`), e.g. a power transformer at its substation.
 * - unspecified: the source does not say.
 */
export type LocationBasis = "surveyed" | "digitised" | "schematic" | "inherited" | "unspecified";

/** Where one entity is. An entity with no known location has no record; it is never placed by guessing. */
export interface EntityLocation {
  entity: LocatedRef;
  geometry: Geometry;
  basis: LocationBasis;
  /** Set with basis "inherited": the entity whose location this is. */
  inheritedFrom?: LocatedRef;
  provenance: Provenance;
}

/* ==========================================================
   AREAS
========================================================== */

/**
 * Kinds of area. The administrative ones follow Nigeria's hierarchy
 * (state, local government area, ward). "service_territory" is the area an
 * organization is licensed or contracted to serve. "other" is any other
 * named area; its name says what it is.
 */
export type AreaKind = "country" | "state" | "lga" | "ward" | "service_territory" | "other";

/**
 * A named area. It holds identity and shape only: any figure for an area is
 * calculated from what lies inside it, never stored on it.
 */
export interface Area {
  id: string;
  kind: AreaKind;
  name: string;
  code?: string;
  /** The area this one is part of, e.g. an LGA's state. */
  parentAreaId?: string;
  geometry: AreaGeometry;
  provenance: Provenance;
}

/* ==========================================================
   TERRITORIES

   What an organization operates, as the extent of what its people
   may see. A territory is stated in one or more of three ways, and
   an entity is in the territory when ANY part holds it:
   - areas: named areas (states, LGAs, a service territory);
   - boundary: an outline drawn for the purpose;
   - assets: listed entities, each with whatever is supplied
     through it.
========================================================== */

export type TerritoryPart =
  | { kind: "areas"; areaIds: readonly string[] }
  | { kind: "boundary"; geometry: AreaGeometry }
  | { kind: "assets"; assets: readonly LocatedRef[] };

export interface Territory {
  organizationId: string;
  parts: readonly TerritoryPart[];
  provenance: Provenance;
}
