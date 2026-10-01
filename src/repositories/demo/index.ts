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

export { buildDemoDataset, demoDataset } from "./buildDemoDataset.ts";
export { DEMO_CLOCK, DEMO_PERIOD } from "./clock.ts";
export { DEMO_REGION_ID, DEMO_SUBSTATION_ID } from "./network.ts";
export { DEMO_ORGANIZATION_ID } from "./sources.ts";
