import type { GridIntelRepositories } from "../ports/index.ts";
import { createInMemoryRepositories } from "../memory/inMemoryRepositories.ts";
import { demoDataset } from "./buildDemoDataset.ts";

/* ==========================================================
   DEMO ADAPTER

   Serves the synthetic demonstration dataset through the
   repository ports. Every record's provenance names a DataSource
   of kind "synthetic".
========================================================== */

export function createDemoRepositories(): GridIntelRepositories {
  return createInMemoryRepositories(demoDataset());
}

/**
 * What anyone looking at this data must be told. The label is shown on every
 * screen; a caveat is shown beside the figures it concerns.
 */
export const DEMO_NOTICE = {
  label: "SYNTHETIC DATA",
  summary:
    "A designed demonstration dataset for September 2026. It describes no real network, customer, " +
    "meter reading, outage, bill or payment.",
  caveats: {
    feederLoading:
      "Each feeder in this dataset carries only three transformers, so feeder loading is far below " +
      "what a real 11 kV feeder carries. It is an artefact of the small model.",
    tariffs: "Tariffs are assumptions, not current published rates.",
  },
} as const;

export { buildDemoDataset, demoDataset } from "./buildDemoDataset.ts";
export { DEMO_CLOCK, DEMO_PERIOD } from "./clock.ts";
export { DEMO_REGION_ID, DEMO_SUBSTATION_ID } from "./network.ts";
export { DEMO_ORGANIZATION_ID } from "./sources.ts";
