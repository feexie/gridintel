
/* ==========================================================
   DEMO ADAPTER

   Serves the synthetic demonstration dataset through the
   repository ports. Every record's provenance names a DataSource
   of kind "synthetic".
========================================================== */

/**
 * What anyone looking at this data must be told. The label is shown on every
 * screen; a caveat is shown beside the figures it concerns.
 */
export const DEMO_NOTICE = {
  label: "SYNTHETIC DATA",
  summary:
    "A designed demonstration dataset for September 2026. It describes no real network, customer, " +
    "meter reading, outage, bill or payment.",
  // Feeder loading needs no caveat any more: each feeder now carries ten to fourteen
  // transformers and peaks at 54–81% of its rating.
  caveats: {
    tariffs: "Tariffs are assumptions, not current published rates.",
  } as { feederLoading?: string; tariffs?: string },
} as const;

export { buildDemoDataset, demoDataset, demoDatasetIsBuilt } from "./buildDemoDataset.ts";
export { createDemoRepositories } from "./onDemand.ts";
export { DEMO_CLOCK, DEMO_PERIOD } from "./clock.ts";
export { DEMO_REGION_ID, DEMO_SUBSTATION_ID } from "./network.ts";
export { DEMO_ORGANIZATION_ID } from "./sources.ts";
