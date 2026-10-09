import type { SpatialModule } from "./module.ts";

/* ==========================================================
   SERVICES — REFERENCE GEOGRAPHY

   Administrative boundaries as layers of the map: states and local
   government areas, for orientation. They belong to no product
   module, so the platform registers them itself.

   They are outlines only. No entity is listed inside them and no
   figure is totalled by them here; whether that may ever be done is
   decided by the spatial services, which never relate synthetic data
   to a real area.

   The outlines are fetched by the map when a layer is switched on:
   the states with the map, the LGAs only when asked for. The credit
   their licence requires and the words that must be shown with them
   travel with the layer, from the source the areas name.
========================================================== */

export const REFERENCE_SPATIAL_MODULE: SpatialModule = {
  id: "reference",
  title: "Reference geography",
  entities: async () => ({ entities: [], completeness: "complete", sourcing: { sources: [], synthetic: false, unknownSources: [] } }),
  trace: async () => null,
  measures: [],
  layers: [
    {
      id: "reference.states",
      title: "States",
      description: "State boundaries, for orientation only.",
      shape: "area",
      entityKinds: [],
      areas: { kind: "state", delivery: "on_request" },
      legend: [],
      onByDefault: true,
    },
    {
      id: "reference.lgas",
      title: "Local government areas",
      description: "LGA boundaries, for orientation only. Loaded when switched on.",
      shape: "area",
      entityKinds: [],
      areas: { kind: "lga", delivery: "on_request" },
      legend: [],
      onByDefault: false,
    },
  ],
};
