import type { AreaKind, EntityLocation, LocatedRef } from "@/domain";
import type { Completeness } from "../../repositories/ports/index.ts";
import type { AreaContribution } from "../../analytics/index.ts";
import type { Sourced, Sourcing } from "../analytics/sourcing.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { MetricView } from "../operations/views.ts";
import type { LegendEntryView } from "./views.ts";

/* ==========================================================
   SERVICES — WHAT A MODULE REGISTERS WITH THE SPATIAL PLATFORM

   GIS is one capability that every module uses. The map, the
   spatial questions, the viewer's scope and the cache are written
   once, in this folder. A module (Utility today; Mini-grid, DER and
   Planning later) adds itself by REGISTERING four things, and
   re-implements nothing:

     entities   what it holds that has a place, each with its
                location or the reason it has none;
     trace      what supplies one of its entities, and what that
                entity supplies;
     measures   its figures that can be totalled by area, each taken
                from one of its own services;
     layers     how its entities are drawn, and which of its services
                gives the figure a layer colours by.

   A module never filters for the viewer and never caches for the
   viewer: the platform does both, around whatever the module gives.
   The one exception is a count the module makes itself (accounts
   behind an asset), for which it is handed the viewer's `sees`.

   Nothing here is about substations or feeders. An entity kind is
   a string a module chooses, so a module whose entities hang from
   no substation registers exactly as Utility does.
========================================================== */

export type SpatialRuntime = OperationsRuntime;

/** One thing a module holds that has, or should have, a place. */
export interface SpatialEntity {
  ref: LocatedRef;
  name: string;
  /** The kind in words, e.g. "Distribution transformer". */
  kindLabel: string;
  /** null when the entity is not located. */
  location: EntityLocation | null;
  /** Why it is not located, in words; null when it is. */
  notLocatedReason: string | null;
}

export interface ModuleEntities {
  entities: SpatialEntity[];
  /** How complete the list is. Anything but "complete" means an entity may exist that is not listed. */
  completeness: Completeness;
  sourcing: Sourcing;
}

export interface ModuleTrace {
  /** What supplies the entity, nearest first. */
  upstream: LocatedRef[];
  /** Everything supplied through it. */
  downstream: LocatedRef[];
  downstreamKnown: boolean;
  /** Counts of what is behind the entity, made over the entities the viewer sees. */
  facts: MetricView[];
}

/** A figure of the module's that can be totalled by area: one value per entity, from one of its services. */
export interface AreaMeasure {
  id: string;
  label: string;
  /** What the figure is and is not; shown with every total. */
  definition: string;
  unit: MetricView["unit"];
  /** The kind of entity the figure is stated for. */
  entityKind: string;
  /** One figure for each of the given entities, from the service that owns the figure. */
  contributions(runtime: SpatialRuntime, entities: readonly SpatialEntity[]): Promise<Sourced<{ contributions: AreaContribution[]; currency: string | null }>>;
  /** The figure for everything the module holds, and what part of it no entity carries; absent when the measure has none. */
  whole?: { value(runtime: SpatialRuntime): Promise<number | null>; remainderNote: string };
}

export interface LayerFigure {
  metric: MetricView;
  /** One of the layer's legend keys. */
  classKey: string;
}

/** What an area layer draws: the areas of one kind, and optionally a registered measure totalled by them. */
export interface AreaLayer {
  kind: AreaKind;
  /**
   * A registered measure to total by these areas and colour them by. The legend class is
   * decided by `classify`, from the totals of all the areas together.
   */
  measureId?: string;
  classify?(values: readonly (number | null)[]): (string | null)[];
  /**
   * "inline": the outlines come with the map. "on_request": there are too many, or they are
   * not always wanted, so the map fetches them when the layer is switched on.
   */
  delivery: "inline" | "on_request";
}

export interface LayerDefinition {
  id: string;
  title: string;
  description: string;
  shape: "point" | "line" | "area" | "mixed";
  /** The kinds of entity the layer draws. Empty for an area layer. */
  entityKinds: readonly string[];
  /** Set for a layer that draws areas instead of entities. */
  areas?: AreaLayer;
  /** Layers that colour the same entities by different figures share a group; the map shows one of them at a time. */
  exclusiveGroup?: string;
  /** Empty for a layer that draws entities without a figure. */
  legend: LegendEntryView[];
  onByDefault: boolean;
  /** True for an overlay that marks only the entities it has a figure for (an open outage, a standing alarm). */
  onlyWithFigure?: boolean;
  /**
   * The key figures of each entity, keyed "<kind>:<id>", shown when the entity is selected.
   * Each is the MetricView of the service that owns it.
   */
  details?(runtime: SpatialRuntime, entities: readonly SpatialEntity[]): Promise<Sourced<Map<string, MetricView[]>>>;
  /**
   * The figure each entity is coloured by, keyed "<kind>:<id>", from the service that owns it.
   * The class is decided here, in the service layer, never by what draws the map. Absent for a
   * layer with no figure.
   */
  figures?(runtime: SpatialRuntime, entities: readonly SpatialEntity[]): Promise<Sourced<Map<string, LayerFigure>>>;
}

/** Something in progress that a module holds, which the map can show with what is behind it: an open interruption. */
export interface ModuleIncident {
  id: string;
  /** What it is, in words, e.g. "Fault". */
  title: string;
  /** When it began. */
  since: string;
  /** Where the module's record says it began, in words. */
  beganAt: string;
  /** The entity it began at; null when that is not an entity the module holds. */
  origin: LocatedRef | null;
  /** What the module's own records say about it, each with its origin, e.g. customers affected. */
  facts: MetricView[];
}

export interface SpatialModule {
  /** e.g. "utility". Layer and measure ids begin with it. */
  id: string;
  title: string;
  /** What is in progress now. Absent for a module that holds nothing of the kind. */
  incidents?(runtime: SpatialRuntime): Promise<Sourced<{ incidents: ModuleIncident[]; completeness: Completeness }>>;
  entities(runtime: SpatialRuntime): Promise<ModuleEntities>;
  /** null when the entity is not one of this module's. `sees` says which entities the viewer may see. */
  trace(runtime: SpatialRuntime, ref: LocatedRef, sees: (ref: LocatedRef) => boolean): Promise<ModuleTrace | null>;
  measures: readonly AreaMeasure[];
  layers: readonly LayerDefinition[];
}

/** The modules registered with the platform, in the order registered. */
export interface SpatialRegistry {
  modules: readonly SpatialModule[];
  layer(id: string): { module: SpatialModule; layer: LayerDefinition } | null;
  measure(id: string): { module: SpatialModule; measure: AreaMeasure } | null;
}

export const entityKey = (ref: LocatedRef): string => `${ref.kind}:${ref.id}`;

/**
 * Registers modules. A module, layer or measure id used twice is an error at start-up, and so is
 * a layer or measure whose id does not begin with its module's: ids are how screens and, later,
 * AI tools name what they ask for, so they must be unambiguous.
 */
export function createSpatialRegistry(modules: readonly SpatialModule[]): SpatialRegistry {
  const layers = new Map<string, { module: SpatialModule; layer: LayerDefinition }>();
  const measures = new Map<string, { module: SpatialModule; measure: AreaMeasure }>();
  const seen = new Set<string>();
  for (const spatialModule of modules) {
    if (seen.has(spatialModule.id)) throw new Error(`Spatial module "${spatialModule.id}" is registered twice.`);
    seen.add(spatialModule.id);
    for (const layer of spatialModule.layers) {
      if (!layer.id.startsWith(`${spatialModule.id}.`)) throw new Error(`Layer "${layer.id}" must be named "${spatialModule.id}.<name>".`);
      if (layers.has(layer.id)) throw new Error(`Layer "${layer.id}" is registered twice.`);
      const keys = new Set(layer.legend.map((entry) => entry.key));
      if (keys.size !== layer.legend.length) throw new Error(`Layer "${layer.id}" has a legend key twice.`);
      if ((layer.figures !== undefined || layer.areas?.measureId !== undefined) && layer.legend.length === 0) throw new Error(`Layer "${layer.id}" colours by a figure and has no legend.`);
      if (layer.areas === undefined && layer.entityKinds.length === 0) throw new Error(`Layer "${layer.id}" draws neither entities nor areas.`);
      layers.set(layer.id, { module: spatialModule, layer });
    }
    for (const measure of spatialModule.measures) {
      if (!measure.id.startsWith(`${spatialModule.id}.`)) throw new Error(`Measure "${measure.id}" must be named "${spatialModule.id}.<name>".`);
      if (measures.has(measure.id)) throw new Error(`Measure "${measure.id}" is registered twice.`);
      measures.set(measure.id, { module: spatialModule, measure });
    }
  }
  return { modules, layer: (id) => layers.get(id) ?? null, measure: (id) => measures.get(id) ?? null };
}
