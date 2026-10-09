import type { Area, AreaGeometry, Geometry, LocatedRef } from "@/domain";
import type { Completeness } from "../../repositories/ports/index.ts";
import type { Sourcing } from "../analytics/sourcing.ts";
import type { SpatialEntity, SpatialModule, SpatialRegistry, SpatialRuntime } from "./module.ts";
import type { ViewerContext } from "./viewer.ts";
import type { AreaView, EntityView, GeometryView } from "./views.ts";
import { geometryWithinArea } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { entityKey } from "./module.ts";
import { isLimited, viewerScopeKey } from "./viewer.ts";

/* ==========================================================
   SERVICES — THE SPATIAL MODEL, AND WHAT A VIEWER SEES OF IT

   The model is everything the registered modules hold that has a
   place, and the named areas, loaded once while the records do not
   change. It is the same for every viewer and is never handed out.

   What IS handed out is a view of it for one viewer (`ScopedModel`):
   the same lists with everything outside the viewer's territory
   removed. Every spatial service starts from a scoped model, so
   none of them can reach an entity its viewer may not see.

   WHAT A TERRITORY HOLDS. An entity is in a territory when any part
   of the territory holds it:
     areas / boundary   its whole geometry lies inside (a point
                        inside; every vertex of a line inside);
     assets             it is listed, or it is supplied through a
                        listed entity.
   An entity with no location can be held only by the asset list.
   Seeing an entity means seeing the figures stated for it.

   AREAS. Administrative areas (country, state, LGA, ward) are
   public geography and every viewer sees them. Any other area, such
   as another organization's service territory, is seen only by a
   viewer whose territory names it.
========================================================== */

export interface ModuleModel {
  module: SpatialModule;
  entities: SpatialEntity[];
  completeness: Completeness;
  sourcing: Sourcing;
}

export interface SpatialModel {
  modules: ModuleModel[];
  byKey: ReadonlyMap<string, { module: SpatialModule; entity: SpatialEntity }>;
  areas: readonly Area[];
  areaCompleteness: Completeness;
  areaSourcing: Sourcing;
}

export function loadSpatialModel(runtime: SpatialRuntime, registry: SpatialRegistry): Promise<SpatialModel> {
  // Viewer-independent: this is the whole model, and only `scopeModel` gives any of it out.
  return (runtime.cache ?? NO_CACHE).get(`spatial-model|${registry.modules.map((spatialModule) => spatialModule.id).join(",")}|${runtime.now}`, async () => {
    const modules: ModuleModel[] = [];
    const byKey = new Map<string, { module: SpatialModule; entity: SpatialEntity }>();
    for (const spatialModule of registry.modules) {
      const held = await spatialModule.entities(runtime);
      modules.push({ module: spatialModule, ...held });
      for (const entity of held.entities) byKey.set(entityKey(entity.ref), { module: spatialModule, entity });
    }
    const areas = await runtime.repos.spatial.listAreas({});
    return {
      modules,
      byKey,
      areas: areas.records,
      areaCompleteness: areas.completeness,
      areaSourcing: await new SourceTrail().add(areas.records).resolve(runtime.repos.sources),
    };
  });
}

/** The spatial model as one viewer may see it. */
export interface ScopedModel {
  viewer: ViewerContext;
  /** True when the model is limited to a territory. */
  limited: boolean;
  sees(ref: LocatedRef): boolean;
  modules: ModuleModel[];
  byKey: ReadonlyMap<string, { module: SpatialModule; entity: SpatialEntity }>;
  areas: readonly Area[];
  areaCompleteness: Completeness;
  areaSourcing: Sourcing;
}

const PUBLIC_AREA_KINDS = new Set(["country", "state", "lga", "ward"]);

async function visibleKeys(runtime: SpatialRuntime, model: SpatialModel, viewer: ViewerContext): Promise<{ entities: Set<string>; areas: Set<string> }> {
  const entities = new Set<string>();
  const areas = new Set<string>(model.areas.filter((area) => PUBLIC_AREA_KINDS.has(area.kind)).map((area) => area.id));
  if (viewer.access.kind !== "territory") return { entities, areas };

  const holdWithin = (geometry: AreaGeometry) => {
    for (const [key, { entity }] of model.byKey) {
      if (entity.location !== null && geometryWithinArea(entity.location.geometry, geometry)) entities.add(key);
    }
  };
  const everything = () => true;
  for (const part of viewer.access.parts) {
    switch (part.kind) {
      case "areas":
        for (const areaId of part.areaIds) {
          const area = model.areas.find((candidate) => candidate.id === areaId);
          // An area the source does not hold gives nothing: a territory is never widened by a name.
          if (area === undefined) continue;
          areas.add(area.id);
          holdWithin(area.geometry);
        }
        break;
      case "boundary":
        holdWithin(part.geometry);
        break;
      case "assets":
        for (const asset of part.assets) {
          const held = model.byKey.get(entityKey(asset));
          if (held === undefined) continue;
          entities.add(entityKey(asset));
          // Whatever is supplied through a listed asset comes with it. The module is asked for all
          // of it: this is the territory being worked out, not a result being given to anyone.
          const trace = await held.module.trace(runtime, asset, everything);
          for (const below of trace?.downstream ?? []) if (model.byKey.has(entityKey(below))) entities.add(entityKey(below));
        }
        break;
    }
  }
  return { entities, areas };
}

export async function scopeModel(runtime: SpatialRuntime, registry: SpatialRegistry, viewer: ViewerContext): Promise<ScopedModel> {
  const model = await loadSpatialModel(runtime, registry);
  if (!isLimited(viewer)) {
    return { viewer, limited: false, sees: (ref) => model.byKey.has(entityKey(ref)), ...model };
  }
  return (runtime.cache ?? NO_CACHE).get(`spatial-scope|${viewerScopeKey(viewer)}|${runtime.now}`, async () => {
    const visible = await visibleKeys(runtime, model, viewer);
    const modules = model.modules.map((held) => ({ ...held, entities: held.entities.filter((entity) => visible.entities.has(entityKey(entity.ref))) }));
    const byKey = new Map([...model.byKey].filter(([key]) => visible.entities.has(key)));
    return {
      viewer,
      limited: true,
      sees: (ref: LocatedRef) => byKey.has(entityKey(ref)),
      modules,
      byKey,
      areas: model.areas.filter((area) => visible.areas.has(area.id)),
      areaCompleteness: model.areaCompleteness,
      areaSourcing: model.areaSourcing,
    };
  });
}

/* ---------------- Views ---------------- */

export function geometryView(geometry: Geometry): GeometryView {
  const point = (c: { latitude: number; longitude: number }) => ({ latitude: c.latitude, longitude: c.longitude });
  switch (geometry.type) {
    case "point":
      return { type: "point", point: point(geometry.point) };
    case "line":
      return { type: "line", path: geometry.path.map(point) };
    case "area":
      return { type: "area", polygons: geometry.polygons.map((polygon) => ({ outer: polygon.outer.map(point), holes: (polygon.holes ?? []).map((hole) => hole.map(point)) })) };
  }
}

export function entityView(spatialModule: SpatialModule, entity: SpatialEntity): EntityView {
  return {
    kind: entity.ref.kind,
    id: entity.ref.id,
    name: entity.name,
    kindLabel: entity.kindLabel,
    module: spatialModule.id,
    geometry: entity.location === null ? null : geometryView(entity.location.geometry),
    basis: entity.location?.basis ?? null,
    inheritedFrom: entity.location?.inheritedFrom ? { kind: entity.location.inheritedFrom.kind, id: entity.location.inheritedFrom.id } : null,
    notLocatedReason: entity.notLocatedReason,
  };
}

export function areaView(area: Area): AreaView {
  return { id: area.id, kind: area.kind, name: area.name, geometry: geometryView(area.geometry) };
}
