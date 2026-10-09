import type { Sourcing } from "../analytics/sourcing.ts";
import type { LayerDefinition, SpatialEntity, SpatialModule } from "./module.ts";
import type { SpatialContext } from "./queries.ts";
import type { LayerSummaryView, MapLayerView, MapView } from "./views.ts";
import { boundsOf } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { sourcingView } from "../operations/metric.ts";
import { entityView, scopeModel } from "./model.ts";
import { entityKey } from "./module.ts";
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
   an exclusive group, and one of them is shown at a time.
========================================================== */

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

/**
 * The map for one viewer. `layers` are layer ids; the layers each module marks as on by default
 * when none are given. An unknown id, or two layers of one exclusive group, is a caller's error.
 */
export function mapView(context: SpatialContext, options: { layers?: readonly string[] } = {}): Promise<MapView> {
  const { runtime, registry, viewer } = context;
  const wanted = options.layers ?? registry.modules.flatMap((spatialModule) => spatialModule.layers.filter((layer) => layer.onByDefault).map((layer) => layer.id));
  const chosen = [...new Set(wanted)].map((id) => {
    const registered = registry.layer(id);
    if (registered === null) throw new RangeError(`No layer "${id}" is registered.`);
    return registered;
  });
  const groups = chosen.flatMap(({ layer }) => layer.exclusiveGroup ?? []);
  const twice = groups.find((group, i) => groups.indexOf(group) !== i);
  if (twice !== undefined) throw new RangeError(`Layers of the group "${twice}" are shown one at a time.`);

  const key = `spatial:map|${chosen.map(({ layer }) => layer.id).join(",")}|${viewerScopeKey(viewer)}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, async () => {
    const scoped = await scopeModel(runtime, registry, viewer);
    const layers: MapLayerView[] = [];
    const used: Sourcing[] = [];

    for (const { module: spatialModule, layer } of chosen) {
      const held = scoped.modules.find((candidate) => candidate.module.id === spatialModule.id);
      const entities: SpatialEntity[] = (held?.entities ?? []).filter((entity) => entity.ref.kind === layer.entityKind);
      const drawn = entities.filter((entity) => entity.location !== null);
      const trail = new SourceTrail();
      if (held !== undefined) trail.addSourcing(held.sourcing);
      // The module is given only the entities this viewer sees, so it can return a figure for no other.
      const figures = layer.figures === undefined ? null : await layer.figures(runtime, drawn);
      if (figures !== null) trail.addSourcing(figures.sourcing);
      const sourcing = await trail.resolve(runtime.repos.sources);
      used.push(sourcing);
      layers.push({
        ...summary(spatialModule, layer),
        features: drawn.map((entity) => {
          const figure = figures?.result.get(entityKey(entity.ref));
          return { entity: entityView(spatialModule, entity), metric: figure?.metric ?? null, classKey: figure?.classKey ?? null };
        }),
        notLocated: entities.filter((entity) => entity.location === null).map((entity) => entityView(spatialModule, entity)),
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
      bounds: boundsOf([...scoped.byKey].flatMap(([entity, held]) => (shown.has(entity) && held.entity.location !== null ? [held.entity.location.geometry] : []))),
      period: runtime.period,
      asOf: runtime.now,
      scopeLimited: scoped.limited,
      sourcing: sourcingView(await all.resolve(runtime.repos.sources)),
    };
  });
}
