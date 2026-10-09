import type { LocatedRef } from "@/domain";
import type { Sourcing } from "../analytics/sourcing.ts";
import type { MetricView } from "../operations/views.ts";
import type { ScopedModel } from "./model.ts";
import type { LayerDefinition, SpatialEntity, SpatialModule } from "./module.ts";
import type { SpatialContext } from "./queries.ts";
import type { AreaFeatureView, FeatureTraceView, FeatureView, LayerSummaryView, MapLayerView, MapView } from "./views.ts";
import { boundsOf } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { sourcingView } from "../operations/metric.ts";
import { areaView, areasOfKind, entityView, scopeModel } from "./model.ts";
import { entityKey } from "./module.ts";
import { totalsByArea, whatIsBehind } from "./queries.ts";
import { viewerScopeKey } from "./viewer.ts";

/* ==========================================================
   SERVICES — THE MAP READ MODEL

   What the one shared map component is given: the layers every
   module has registered, and the features of the layers asked for.

   A feature is an entity the viewer may see, with its geometry and,
   on a layer that colours by a figure, that figure and the legend
   class it falls in. The figure is the MetricView of the service
   that owns it, so it arrives with its status and its origin; the
   class is decided by the layer's own rule in the service layer.
   The map draws what it is given and computes nothing.

   An entity with no location cannot be drawn. It is listed on its
   layer as not located, never left out.

   Layers that colour the same entities by different figures share
   an exclusive group. All of them can be asked for at once, so that
   the map can change from one to another without asking again; the
   map shows one of a group at a time.

   An AREA LAYER draws areas, not entities: a module's figure
   totalled by them (through `totalsByArea`, with everything that
   service keeps apart), or outlines for orientation only. Outlines
   that are many are not sent with the map; the layer says they are
   fetched on request.

   WHAT MUST BE SAID ON THE MAP travels with the layer: the credit a
   licence requires, and notes such as that routes are schematic.

   A map can be given a FOCUS: one entity. It then holds that entity,
   what supplies it and what it supplies, and nothing else.
========================================================== */

const SCHEMATIC_NOTE = "Schematic: straight lines between the points a route connects. They show what is connected, not where the line runs.";

function summary(spatialModule: SpatialModule, layer: LayerDefinition): LayerSummaryView {
  return {
    id: layer.id,
    module: spatialModule.id,
    title: layer.title,
    description: layer.description,
    shape: layer.shape,
    exclusiveGroup: layer.exclusiveGroup ?? null,
    legend: layer.legend.map((entry) => ({ ...entry })),
    onByDefault: layer.onByDefault,
  };
}

/** A figure for the map: the service's MetricView without its inputs, which the drill-down shows in full. */
function slim(metric: MetricView): MetricView {
  return metric.inputs.length === 0 ? metric : { ...metric, inputs: [] };
}

/** The entities a focused map holds: the focus, what supplies it and what it supplies. null when the viewer cannot see the focus. */
async function focusKeys(context: SpatialContext, scoped: ScopedModel, focus: LocatedRef): Promise<Set<string> | null> {
  const subject = scoped.byKey.get(entityKey(focus));
  if (subject === undefined) return null;
  const trace = await subject.module.trace(context.runtime, focus, scoped.sees);
  return new Set([entityKey(focus), ...(trace?.upstream ?? []).map(entityKey), ...(trace?.downstream ?? []).map(entityKey)]);
}

/** Where an entity sits, as this viewer may see it. */
async function traceOf(context: SpatialContext, entity: SpatialEntity): Promise<FeatureTraceView | null> {
  const behind = await whatIsBehind(context, entity.ref);
  if (behind === null) return null;
  return {
    upstream: behind.upstream.map((above) => ({ kind: above.kind, id: above.id, name: above.name, kindLabel: above.kindLabel })),
    downstream: behind.downstream.map((group) => ({ kind: group.kind, kindLabel: group.kindLabel, count: group.count })),
    downstreamKnown: behind.downstreamKnown,
    areas: behind.areas.map((area) => ({ id: area.id, name: area.name })),
    facts: behind.facts,
  };
}

async function areaLayer(context: SpatialContext, scoped: ScopedModel, layer: LayerDefinition, trail: SourceTrail): Promise<Pick<MapLayerView, "areaFeatures" | "outlinesOnRequest" | "unallocated" | "credits" | "notes" | "coverage">> {
  const drawn = layer.areas as NonNullable<LayerDefinition["areas"]>;
  const { records, completeness } = await areasOfKind(context.runtime, scoped, drawn.kind);
  const sourcing = await new SourceTrail().add(records).resolve(context.runtime.repos.sources);
  trail.addSourcing(sourcing);
  const credits = [...new Set(sourcing.sources.flatMap((source) => source.attribution ?? []))];
  const notes = [...new Set(sourcing.sources.flatMap((source) => source.notice ?? (source.kind === "synthetic" ? ["Synthetic areas, drawn for the demonstration. They are no administrative boundary."] : [])))];
  if (drawn.delivery === "on_request") return { areaFeatures: [], outlinesOnRequest: drawn.kind, unallocated: [], credits, notes, coverage: completeness };

  let areaFeatures: AreaFeatureView[] = records.map((area) => ({ area: areaView(area), metric: null, classKey: null, entities: null }));
  let unallocated: MetricView[] = [];
  if (drawn.measureId !== undefined) {
    const totals = await totalsByArea(context, drawn.measureId, { areaKind: drawn.kind });
    if (totals !== null) {
      const classes = drawn.classify?.(totals.rows.map((row) => row.total.value)) ?? totals.rows.map(() => null);
      // Only the areas the figure may be totalled by are drawn with it; the service has left the others out.
      areaFeatures = totals.rows.map((row, i) => ({ area: row.area, metric: row.total, classKey: classes[i], entities: row.entities }));
      unallocated = [totals.outsideEveryArea, totals.notLocated, ...(totals.remainder === null ? [] : [totals.remainder])];
      if (totals.areasNotTotalled !== null) notes.push(totals.areasNotTotalled);
      notes.push(totals.definition);
    }
  }
  return { areaFeatures, outlinesOnRequest: null, unallocated, credits, notes, coverage: completeness };
}

/**
 * The map for one viewer. `layers` are layer ids; the layers each module marks as on by default
 * when none are given. An unknown id is a caller's error. With a `focus`, only the focus, what
 * supplies it and what it supplies are drawn; a focus the viewer cannot see gives an empty map.
 */
export function mapView(context: SpatialContext, options: { layers?: readonly string[]; focus?: LocatedRef } = {}): Promise<MapView> {
  const { runtime, registry, viewer } = context;
  const wanted = options.layers ?? registry.modules.flatMap((spatialModule) => spatialModule.layers.filter((layer) => layer.onByDefault).map((layer) => layer.id));
  const chosen = [...new Set(wanted)].map((id) => {
    const registered = registry.layer(id);
    if (registered === null) throw new RangeError(`No layer "${id}" is registered.`);
    return registered;
  });

  const focus = options.focus === undefined ? "*" : entityKey(options.focus);
  const key = `spatial:map|${chosen.map(({ layer }) => layer.id).join(",")}|${focus}|${viewerScopeKey(viewer)}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, async () => {
    const scoped = await scopeModel(runtime, registry, viewer);
    const within = options.focus === undefined ? null : ((await focusKeys(context, scoped, options.focus)) ?? new Set<string>());
    const layers: MapLayerView[] = [];
    const used: Sourcing[] = [];

    for (const { module: spatialModule, layer } of chosen) {
      const held = scoped.modules.find((candidate) => candidate.module.id === spatialModule.id);
      const trail = new SourceTrail();
      const base = { ...summary(spatialModule, layer), features: [], notLocated: [], areaFeatures: [], outlinesOnRequest: null, unallocated: [], credits: [], notes: [] };

      if (layer.areas !== undefined) {
        // A focused map is about one entity's connections; areas are not part of it.
        const drawn = within === null ? await areaLayer(context, scoped, layer, trail) : { areaFeatures: [], outlinesOnRequest: null, unallocated: [], credits: [], notes: [], coverage: "complete" as const };
        const sourcing = await trail.resolve(runtime.repos.sources);
        used.push(sourcing);
        layers.push({ ...base, ...drawn, sourcing: sourcingView(sourcing) });
        continue;
      }

      const entities: SpatialEntity[] = (held?.entities ?? []).filter((entity) => layer.entityKinds.includes(entity.ref.kind) && (within === null || within.has(entityKey(entity.ref))));
      const located = entities.filter((entity) => entity.location !== null);
      if (held !== undefined) trail.addSourcing(held.sourcing);
      // The module is given only the entities this viewer sees, so it can return a figure for no other.
      const figures = layer.figures === undefined ? null : await layer.figures(runtime, located);
      if (figures !== null) trail.addSourcing(figures.sourcing);
      const drawn = layer.onlyWithFigure ? located.filter((entity) => figures?.result.has(entityKey(entity.ref))) : located;
      const details = layer.details === undefined ? null : await layer.details(runtime, drawn);
      if (details !== null) trail.addSourcing(details.sourcing);
      const sourcing = await trail.resolve(runtime.repos.sources);
      used.push(sourcing);
      const features: FeatureView[] = [];
      for (const entity of drawn) {
        const figure = figures?.result.get(entityKey(entity.ref));
        features.push({
          entity: entityView(spatialModule, entity),
          metric: figure === undefined ? null : slim(figure.metric),
          classKey: figure?.classKey ?? null,
          details: (details?.result.get(entityKey(entity.ref)) ?? []).map(slim),
          // A layer that gives key figures also says where each entity sits, through the same question anyone can ask.
          trace: details === null ? null : await traceOf(context, entity),
        });
      }
      layers.push({
        ...base,
        features,
        // An overlay marks what it has a figure for; what it does not mark is not "missing".
        notLocated: layer.onlyWithFigure ? [] : entities.filter((entity) => entity.location === null).map((entity) => entityView(spatialModule, entity)),
        notes: drawn.some((entity) => entity.location?.basis === "schematic") ? [SCHEMATIC_NOTE] : [],
        coverage: held?.completeness ?? "not_available",
        sourcing: sourcingView(sourcing),
      });
    }

    const all = new SourceTrail();
    for (const sourcing of used) all.addSourcing(sourcing);
    const shown = new Set(layers.flatMap((layer) => layer.features.map((feature) => `${feature.entity.kind}:${feature.entity.id}`)));
    return {
      modules: registry.modules.map((spatialModule) => ({ id: spatialModule.id, title: spatialModule.title, layers: spatialModule.layers.map((layer) => summary(spatialModule, layer)) })),
      layers,
      // The box holds the entities drawn. Areas are not in it: an orientation layer must not pull the view out to a whole country.
      bounds: boundsOf([...scoped.byKey].flatMap(([entity, held]) => (shown.has(entity) && held.entity.location !== null ? [held.entity.location.geometry] : []))),
      period: runtime.period,
      asOf: runtime.now,
      scopeLimited: scoped.limited,
      sourcing: sourcingView(await all.resolve(runtime.repos.sources)),
    };
  });
}
