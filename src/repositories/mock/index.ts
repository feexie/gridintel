import type { GridIntelRepositories } from "../ports/index.ts";
import { createInMemoryRepositories } from "../memory/inMemoryRepositories.ts";
import { mockDataset } from "./buildMockDataset.ts";

/* ==========================================================
   MOCK ADAPTER

   Serves the legacy mock data, mapped into canonical domain
   records, through the repository ports. Every record's provenance
   names a DataSource of kind "mock".
========================================================== */

export function createMockRepositories(): GridIntelRepositories {
  return createInMemoryRepositories(mockDataset().dataset);
}

export { buildMockDataset, mockDataset } from "./buildMockDataset.ts";
export type { MockDatasetBuild } from "./buildMockDataset.ts";
export type { MappingIssue, MappingIssueCode, MappingIssueSeverity, MappingReport } from "./issues.ts";
