import type { Area, EntityLocation, IsoTimestamp, LocatedRef, MethodologyRef } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import type { CalculationContext, ResultStatus, Warning } from "../core/result.ts";
import { REFERENCE_DISCLAIMER, methodologyRef } from "../core/methodology.ts";
import { geometryWithinArea } from "./geometry.ts";

/* ==========================================================
   ANALYTICS — AREAS: WHAT IS INSIDE, AND TOTALS BY AREA

   WHICH AREA AN ENTITY IS IN. A point is in the area that contains
   it. A line or an area is in an area only when all of it is: a
   feeder that crosses a boundary is in neither side, and is listed
   as such. Among areas that overlap (they should not, within one
   kind), an entity goes to the first that holds it, in id order,
   and the overlap is reported.

   TOTALS BY AREA. A figure stated for an entity (for example the
   revenue not realised at a transformer) is given WHOLE to the area
   the entity is in. Nothing is split, shared out or pro-rated
   between areas. What cannot be given to an area is kept, in three
   named groups, and never dropped:
     - entities outside every area;
     - entities with no location;
     - where the caller gives the figure for the whole, the part of
       it that no located entity carries (the remainder).

   A total is a sum of figures another calculation produced. If any
   figure in an area is missing, the area's total is missing, not a
   smaller number. A figure that is itself partly estimated makes
   the total "calculated with estimates".
========================================================== */

export interface SpatialParameters {
  /** A line or an area is inside an area only when every vertex is. */
  lineRule: "all_vertices_inside";
  /** A figure goes whole to one area; it is never divided between areas. */
  allocation: "whole_to_containing_area";
}

export const SPATIAL_REFERENCE: Methodology<SpatialParameters> = {
  id: "gridintel.spatial.reference",
  version: "0.1.0",
  name: "GridIntel reference allocation to areas",
  description:
    "An entity belongs to the area that contains its point, or all of its line. A figure stated for an entity is given whole to " +
    "that area and never divided. Entities outside every area or with no location, and any part of the whole that no located " +
    "entity carries, are reported separately.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: `${REFERENCE_DISCLAIMER} Totals by area follow where assets are recorded, not where customers live or where energy is used.`,
  parameters: { lineRule: "all_vertices_inside", allocation: "whole_to_containing_area" },
};

const key = (ref: LocatedRef) => `${ref.kind}:${ref.id}`;

export interface AreaMembership {
  /** Area id by "<kind>:<id>" of each entity that is in an area. */
  areaOf: ReadonlyMap<string, string>;
  /** Located entities that are in no area. */
  outside: LocatedRef[];
  warnings: Warning[];
}

/** Which of `areas` each located entity is in. */
export function areaMembership(areas: readonly Area[], locations: readonly EntityLocation[]): AreaMembership {
  const ordered = [...areas].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const areaOf = new Map<string, string>();
  const outside: LocatedRef[] = [];
  const overlapping = new Set<string>();
  for (const location of locations) {
    const holding = ordered.filter((area) => geometryWithinArea(location.geometry, area.geometry));
    if (holding.length === 0) outside.push(location.entity);
    else areaOf.set(key(location.entity), holding[0].id);
    if (holding.length > 1) overlapping.add(holding.map((area) => area.id).join(" and "));
  }
  return {
    areaOf,
    outside,
    warnings: [...overlapping].sort().map((pair) => ({
      code: "AREAS_OVERLAP",
      message: `Areas ${pair} overlap. Entities in the overlap were given to the first in id order.`,
    })),
  };
}

/** One entity's figure, as another calculation produced it. */
export interface AreaContribution {
  entity: LocatedRef;
  /** null when the figure could not be calculated. */
  value: number | null;
  /** True when the figure was calculated with estimated inputs. */
  estimated: boolean;
}

export interface AllocatedTotal {
  /** null when any figure in the group is missing. A group with no entity has a real 0. */
  value: number | null;
  status: ResultStatus;
  /** How many entities' figures are in the group. */
  entities: number;
  /** How many of them have no figure. */
  missing: number;
  estimated: number;
}

export interface AreaAllocation {
  kind: "area_allocation";
  totals: { areaId: string; total: AllocatedTotal }[];
  /** Figures of entities that are located but in none of the areas. */
  outsideEveryArea: AllocatedTotal;
  /** Figures of entities that have no location. */
  notLocated: AllocatedTotal;
  /**
   * The whole less every entity's figure, when the caller gave the whole: what no entity carries.
   * null when no whole was given or it cannot be formed.
   */
  remainder: number | null;
  warnings: Warning[];
  methodology: MethodologyRef;
  computedAt: IsoTimestamp;
}

function total(contributions: readonly AreaContribution[]): AllocatedTotal {
  const missing = contributions.filter((contribution) => contribution.value === null).length;
  const estimated = contributions.filter((contribution) => contribution.value !== null && contribution.estimated).length;
  const value = missing > 0 ? null : contributions.reduce((sum, contribution) => sum + (contribution.value as number), 0);
  return {
    value,
    status: missing > 0 ? "insufficient_data" : estimated > 0 ? "calculated_with_estimates" : "ok",
    entities: contributions.length,
    missing,
    estimated,
  };
}

export function allocateToAreas(params: {
  areas: readonly Area[];
  /** Locations of the entities that have one. An entity with a contribution and no location here is "not located". */
  locations: readonly EntityLocation[];
  contributions: readonly AreaContribution[];
  /** The figure for everything, from the calculation that owns it; used only to state the remainder. */
  whole?: number | null;
  context: CalculationContext;
}): AreaAllocation {
  const { areas, contributions, context } = params;
  const contributing = new Set(contributions.map((contribution) => key(contribution.entity)));
  const locations = params.locations.filter((location) => contributing.has(key(location.entity)));
  const located = new Set(locations.map((location) => key(location.entity)));
  const membership = areaMembership(areas, locations);

  const byArea = new Map<string, AreaContribution[]>(areas.map((area) => [area.id, []]));
  const outside: AreaContribution[] = [];
  const notLocated: AreaContribution[] = [];
  for (const contribution of contributions) {
    const entity = key(contribution.entity);
    const areaId = membership.areaOf.get(entity);
    if (areaId !== undefined) (byArea.get(areaId) as AreaContribution[]).push(contribution);
    else if (located.has(entity)) outside.push(contribution);
    else notLocated.push(contribution);
  }

  const everything = total(contributions);
  return {
    kind: "area_allocation",
    totals: [...byArea.keys()].sort().map((areaId) => ({ areaId, total: total(byArea.get(areaId) as AreaContribution[]) })),
    outsideEveryArea: total(outside),
    notLocated: total(notLocated),
    remainder: params.whole === undefined || params.whole === null || everything.value === null ? null : params.whole - everything.value,
    warnings: membership.warnings,
    methodology: methodologyRef(SPATIAL_REFERENCE),
    computedAt: context.computedAt,
  };
}
