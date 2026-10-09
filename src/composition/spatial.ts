import type { AreaKind } from "@/domain";
import type { SpatialContext } from "../services/spatial/queries.ts";
import { mapView } from "../services/spatial/map.ts";
import { createSpatialRegistry } from "../services/spatial/module.ts";
import { totalsByArea, whatIsBehind, whatIsHere, whatIsInside } from "../services/spatial/queries.ts";
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

export const SPATIAL_REGISTRY = createSpatialRegistry([UTILITY_SPATIAL_MODULE]);

function context(): SpatialContext {
  return { runtime: getRuntime(), registry: SPATIAL_REGISTRY, viewer: getViewer() };
}

export const spatial = {
  /** The map: every registered layer, and the features of those asked for (each module's default layers when none are). */
  map: (layers?: readonly string[]) => mapView(context(), { layers }),
  here: (point: { latitude: number; longitude: number }, withinMetres: number, kinds?: readonly string[]) => whatIsHere(context(), { point, withinMetres, kinds }),
  inside: (areaId: string, list?: readonly string[]) => whatIsInside(context(), areaId, { list }),
  behind: (kind: string, id: string, list?: readonly string[]) => whatIsBehind(context(), { kind, id }, { list }),
  totalsByArea: (measureId: string, areaKind?: AreaKind) => totalsByArea(context(), measureId, { areaKind }),
};

export { isPreparing } from "./runtime.ts";
