import type { AreaKind } from "@/domain";
import type { SpatialContext } from "../services/spatial/queries.ts";
import type { ViewerContext } from "../services/spatial/viewer.ts";
import { holdsSector } from "../constants/access.ts";
import { mapView } from "../services/spatial/map.ts";
import { createSpatialRegistry } from "../services/spatial/module.ts";
import { minigridSpatialModule } from "../services/minigrid/spatial.ts";
import { areaOutlines, incidentsNow, totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "../services/spatial/queries.ts";
import { REFERENCE_SPATIAL_MODULE } from "../services/spatial/reference.ts";
import { UTILITY_SPATIAL_MODULE } from "../services/utility/spatial.ts";
import { deploymentMode } from "./mode.ts";
import { getMinigridRuntime, getMinigridSpatialRuntime, getRuntime, getViewer, refuse, utilityRuntime } from "./runtime.ts";
import { publicViewer } from "./viewer.ts";

/* ==========================================================
   COMPOSITION — SPATIAL

   The spatial platform bound to the running adapter, clock, result
   cache and viewer, with every module's registration. A module is
   added to the platform by adding it to the list below; the map and
   the spatial questions then cover it with no other change.

   Every call is made for the current viewer (`getViewer`). Results
   are cached by the services themselves, keyed by the viewer's
   scope, so nothing here caches.

   In a tenant deployment (Phase 8A, ADR 0020) an organization's map
   is built from its own records only: the modules of the sectors
   it holds, the layers of those modules, and as its ground its own
   repositories with the states and LGAs added. A person of the
   mini-grid operator is never given the utility's repositories,
   even for their areas.
========================================================== */

const MINIGRID_MODULE = minigridSpatialModule(getMinigridRuntime);
export const SPATIAL_REGISTRY = createSpatialRegistry([UTILITY_SPATIAL_MODULE, MINIGRID_MODULE, REFERENCE_SPATIAL_MODULE]);
const UTILITY_REGISTRY = createSpatialRegistry([UTILITY_SPATIAL_MODULE, REFERENCE_SPATIAL_MODULE]);
const MINIGRID_REGISTRY = createSpatialRegistry([MINIGRID_MODULE, REFERENCE_SPATIAL_MODULE]);
const REFERENCE_REGISTRY = createSpatialRegistry([REFERENCE_SPATIAL_MODULE]);

/** The layers every sector's map carries beside its own: reference geography, for orientation. */
const REFERENCE_LAYERS = REFERENCE_SPATIAL_MODULE.layers.map((layer) => layer.id);

/**
 * A sector's GIS Map (ADR 0017): the one shared map, given that sector's layers and the reference
 * geography. `open` names the layers that are on when it opens; they also set its opening view,
 * so a layer that starts switched off does not pull the map out to the whole country.
 */
const SECTOR_MAPS = {
  // Every Utility layer but the service points, which are drawn for one transformer at a time.
  utility: {
    layers: [...UTILITY_SPATIAL_MODULE.layers.map((layer) => layer.id).filter((id) => id !== "utility.service_points"), ...REFERENCE_LAYERS],
    open: [...UTILITY_SPATIAL_MODULE.layers.filter((layer) => layer.onByDefault).map((layer) => layer.id), ...REFERENCE_SPATIAL_MODULE.layers.filter((layer) => layer.onByDefault).map((layer) => layer.id)],
  },
  // The sites are the sector: they are on when its map opens, with the states to say where they are.
  minigrid: { layers: ["minigrid.sites", ...REFERENCE_LAYERS], open: ["minigrid.sites", "reference.states"] },
} as const;

export type SectorId = keyof typeof SECTOR_MAPS;

/** The small map of the Platform Overview: where each sector's assets are, among the states. */
const PLATFORM_LAYERS = ["utility.substations", "minigrid.sites", "reference.states"];

/** What a map embedded in another screen shows: the network, its loading, and what is wrong now. */
const EMBEDDED_LAYERS = ["utility.substations", "utility.feeders", "utility.transformers", "utility.transformers.loading", "utility.open_outages", "utility.standing_alarms"];

async function context(): Promise<SpatialContext> {
  const viewer = await getViewer();
  if (deploymentMode() === "demo") return { runtime: await getRuntime(), registry: SPATIAL_REGISTRY, viewer };
  const utility = holdsSector(viewer.screens, "utility");
  const sites = holdsSector(viewer.screens, "minigrid");
  if (utility) return { runtime: await getRuntime(), registry: sites ? SPATIAL_REGISTRY : UTILITY_REGISTRY, viewer };
  if (sites) return { runtime: await getMinigridSpatialRuntime(), registry: MINIGRID_REGISTRY, viewer };
  return refuse();
}

/** The layers asked for that belong to the viewer's sectors, with the reference geography. */
function ours(layers: readonly string[], viewer: ViewerContext): string[] {
  return layers.filter((id) => {
    const owner = id.split(".")[0];
    return owner === "reference" || holdsSector(viewer.screens, owner);
  });
}

export const spatial = {
  /** The map: every registered layer, and the features of those asked for (each module's default layers when none are). */
  map: async (layers?: readonly string[]) => mapView(await context(), { layers }),
  /**
   * A sector's GIS Map: its layers on the shared map, the layers that are on when it opens, and
   * what that sector holds as in progress with what is behind it.
   */
  sector: async (sector: SectorId) => ({
    map: await mapView(await context(), { layers: SECTOR_MAPS[sector].layers, frame: SECTOR_MAPS[sector].open }),
    open: SECTOR_MAPS[sector].open as readonly string[],
    incidents: await incidentsNow(await context(), { modules: [sector] }),
  }),
  /** The Platform Overview's map: every sector's assets, with no figure layer. */
  platform: async () => {
    const at = await context();
    return mapView(at, { layers: ours(PLATFORM_LAYERS, at.viewer) });
  },
  /**
   * The map for another screen: the whole network, or with `focus` one asset with what supplies
   * it and what it supplies. A transformer or a service point is drawn with its service points.
   */
  embedded: async (focus?: { kind: string; id: string }) =>
    focus?.kind === "service_point"
      ? // One connection: where it is and what supplies it, and no figure. A figure for its feeder or
        // substation needs every record under them, and this screen is computed from one transformer's.
        mapView(await context(), { layers: ["utility.substations", "utility.feeders", "utility.transformers", "utility.service_points"], focus, figures: false })
      : mapView(await context(), { layers: focus?.kind === "distribution_transformer" ? [...EMBEDDED_LAYERS, "utility.service_points"] : EMBEDDED_LAYERS, focus }),
  /**
   * The map for a mini-grid site's screen: every site, with the state outlines for orientation.
   * A site hangs from nothing, so a map of it alone would be one mark on an empty ground; among
   * the other sites and the states it says where it is. The screen selects its own site.
   */
  sites: async () => mapView(await context(), { layers: ["minigrid.sites", "reference.states"] }),
  incidents: async () => incidentsNow(await context()),
  here: async (point: { latitude: number; longitude: number }, withinMetres: number, kinds?: readonly string[]) => whatIsHere(await context(), { point, withinMetres, kinds }),
  inside: async (areaId: string, list?: readonly string[]) => whatIsInside(await context(), areaId, { list }),
  behind: async (kind: string, id: string, list?: readonly string[]) => whatIsBehind(await context(), { kind, id }, { list }),
  totalsByArea: async (measureId: string, areaKind?: AreaKind) => totalsByArea(await context(), measureId, { areaKind }),
  /**
   * The outlines of the states or the LGAs, for drawing as orientation, with their credit. Public
   * reference geography, the same for everyone: read with the reference module alone and the
   * public viewer, and built with the application. No organization's records are asked for.
   */
  outlines: (kind: "state" | "lga") => areaOutlines({ runtime: utilityRuntime(), registry: REFERENCE_REGISTRY, viewer: publicViewer() }, kind),
};

export { isPreparing } from "./runtime.ts";
