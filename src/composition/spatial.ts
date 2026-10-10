import type { AreaKind } from "@/domain";
import type { SpatialContext } from "../services/spatial/queries.ts";
import { mapView } from "../services/spatial/map.ts";
import { createSpatialRegistry } from "../services/spatial/module.ts";
import { MINIGRID_SPATIAL_MODULE } from "../services/minigrid/spatial.ts";
import { areaOutlines, incidentsNow, totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "../services/spatial/queries.ts";
import { REFERENCE_SPATIAL_MODULE } from "../services/spatial/reference.ts";
import { UTILITY_SPATIAL_MODULE } from "../services/utility/spatial.ts";
import { getRuntime, getViewer } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — SPATIAL

   The spatial platform bound to the running adapter, clock, result
   cache and viewer, with every module's registration. A module is
   added to the platform by adding it to the list below; the map and
   the spatial questions then cover it with no other change.

   Every call is made for the current viewer (`getViewer`). Results
   are cached by the services themselves, keyed by the viewer's
   scope, so nothing here caches.
========================================================== */

export const SPATIAL_REGISTRY = createSpatialRegistry([UTILITY_SPATIAL_MODULE, MINIGRID_SPATIAL_MODULE, REFERENCE_SPATIAL_MODULE]);

/** What the Map workspace shows: every registered layer but the service points, which are drawn for one transformer at a time. */
const WORKSPACE_LAYERS = SPATIAL_REGISTRY.modules.flatMap((spatialModule) => spatialModule.layers.map((layer) => layer.id)).filter((id) => id !== "utility.service_points");

/** What a map embedded in another screen shows: the network, its loading, and what is wrong now. */
const EMBEDDED_LAYERS = ["utility.substations", "utility.feeders", "utility.transformers", "utility.transformers.loading", "utility.open_outages", "utility.standing_alarms"];

function context(): SpatialContext {
  return { runtime: getRuntime(), registry: SPATIAL_REGISTRY, viewer: getViewer() };
}

export const spatial = {
  /** The map: every registered layer, and the features of those asked for (each module's default layers when none are). */
  map: (layers?: readonly string[]) => mapView(context(), { layers }),
  /** The Map workspace: every layer, and what is in progress with what is behind it. */
  workspace: async () => ({ map: await mapView(context(), { layers: WORKSPACE_LAYERS }), incidents: await incidentsNow(context()) }),
  /**
   * The map for another screen: the whole network, or with `focus` one asset with what supplies
   * it and what it supplies. A transformer or a service point is drawn with its service points.
   */
  embedded: (focus?: { kind: string; id: string }) =>
    focus?.kind === "service_point"
      ? // One connection: where it is and what supplies it, and no figure. A figure for its feeder or
        // substation needs every record under them, and this screen is computed from one transformer's.
        mapView(context(), { layers: ["utility.substations", "utility.feeders", "utility.transformers", "utility.service_points"], focus, figures: false })
      : mapView(context(), { layers: focus?.kind === "distribution_transformer" ? [...EMBEDDED_LAYERS, "utility.service_points"] : EMBEDDED_LAYERS, focus }),
  incidents: () => incidentsNow(context()),
  here: (point: { latitude: number; longitude: number }, withinMetres: number, kinds?: readonly string[]) => whatIsHere(context(), { point, withinMetres, kinds }),
  inside: (areaId: string, list?: readonly string[]) => whatIsInside(context(), areaId, { list }),
  behind: (kind: string, id: string, list?: readonly string[]) => whatIsBehind(context(), { kind, id }, { list }),
  totalsByArea: (measureId: string, areaKind?: AreaKind) => totalsByArea(context(), measureId, { areaKind }),
  /** The outlines of every area of one kind, for drawing as orientation, with their credit. */
  outlines: (kind: AreaKind) => areaOutlines(context(), kind),
};

export { isPreparing } from "./runtime.ts";
