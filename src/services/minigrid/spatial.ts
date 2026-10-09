import type { SpatialModule } from "../spatial/module.ts";

/* ==========================================================
   SERVICES — MINI-GRID: ITS PLACE ON THE SPATIAL PLATFORM

   The Mini-grid module does not exist yet (Phase 10). This is its
   registration and nothing more: one layer, for sites, and NO DATA.
   It is here to show that a second module joins the map by
   registering, with no change to the map, the spatial services or
   the viewer scope.

   It holds no site and invents none. Its list of entities is empty
   and is said to be "not available", not "complete": no source for
   mini-grid sites is connected, so the empty layer means "nothing
   is known", never "there are no sites".
========================================================== */

export const MINIGRID_SPATIAL_MODULE: SpatialModule = {
  id: "minigrid",
  title: "Mini-grid Intelligence",
  entities: async () => ({ entities: [], completeness: "not_available", sourcing: { sources: [], synthetic: false, unknownSources: [] } }),
  trace: async () => null,
  measures: [],
  layers: [
    {
      id: "minigrid.sites",
      title: "Mini-grid sites",
      description: "No source of mini-grid sites is connected, so there is nothing to show. Sites appear here when one is.",
      shape: "point",
      entityKinds: ["minigrid_site"],
      legend: [],
      onByDefault: false,
    },
  ],
};
