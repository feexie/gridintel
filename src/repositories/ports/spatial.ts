import type { Area, AreaKind, Territory } from "@/domain";
import type { RepositoryResult } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — AREAS AND TERRITORIES

   Named areas (states, LGAs, service territories) and the
   territories organizations operate. Records only: which entity is
   inside which area is worked out by analytics, never here.

   Where an entity is comes with the entity's own record (the
   network registry holds a location on each asset), not from this
   port.
========================================================== */

export interface AreaQuery {
  /** Only areas of these kinds, when given. */
  kinds?: readonly AreaKind[];
}

export interface TerritoryQuery {
  /** Only the territories of these organizations, when given. */
  organizationIds?: readonly string[];
}

export interface SpatialRepository {
  listAreas(query: AreaQuery): Promise<RepositoryResult<Area>>;
  listTerritories(query: TerritoryQuery): Promise<RepositoryResult<Territory>>;
}
