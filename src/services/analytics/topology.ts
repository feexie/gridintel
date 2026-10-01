import type { IsoTimestamp } from "@/domain";
import type { RegistryCoverage, RegistryRepository } from "../../repositories/ports/index.ts";
import type { Registry, TopologyIndex } from "../../analytics/index.ts";
import { buildTopologyIndex } from "../../analytics/index.ts";

/* ==========================================================
   SERVICES — TOPOLOGY

   Loads the registry through its repository and hands it to the
   analytics topology index. The coverage is passed on so callers
   know when counts derived from the registry are not totals (for
   example, customer accounts are not available from the mock).
========================================================== */

export interface LoadedTopology {
  index: TopologyIndex;
  topologyBasis: "current_only";
  coverage: RegistryCoverage;
}

export async function loadTopology(registry: RegistryRepository, asOf: IsoTimestamp): Promise<LoadedTopology> {
  const result = await registry.getSnapshot({ asOf });
  // The repository snapshot must stay usable as an analytics Registry.
  const records: Registry = result.snapshot;
  return {
    index: buildTopologyIndex(records),
    topologyBasis: result.topologyBasis,
    coverage: result.coverage,
  };
}
