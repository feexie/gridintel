/* ==========================================================
   REPOSITORY PORTS

   Read-only interfaces that return canonical domain records. An
   adapter (synthetic demo data today; a database or API later) implements them,
   and analytics never depends on which adapter is in use. This
   module re-exports types only.
========================================================== */

import type { BillingRepository } from "./billing.ts";
import type { EventRepository } from "./events.ts";
import type { ObservationRepository } from "./observations.ts";
import type { RegistryRepository } from "./registry.ts";
import type { ReportedKpiRepository } from "./reporting.ts";
import type { SourceRepository } from "./sources.ts";
import type { SpatialRepository } from "./spatial.ts";

export type * from "./common.ts";
export type * from "./registry.ts";
export type * from "./observations.ts";
export type * from "./events.ts";
export type * from "./reporting.ts";
export type * from "./billing.ts";
export type * from "./sources.ts";
export type * from "./spatial.ts";

export interface GridIntelRepositories {
  registry: RegistryRepository;
  observations: ObservationRepository;
  events: EventRepository;
  reported: ReportedKpiRepository;
  billing: BillingRepository;
  sources: SourceRepository;
  spatial: SpatialRepository;
}
