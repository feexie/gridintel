import type { Citation, DataSource, PlannedCommunity } from "@/domain";
import type { PlannedCommunityRepository } from "../ports/minigridPlanning.ts";
import { DEMO_ORGANIZATION_ID } from "./sources.ts";

/* ==========================================================
   DEMO — A SYNTHETIC PLANNED MINI-GRID COMMUNITY (Phase MG-PLAN-A)

   One designed community for the mini-grid planner to plan, in
   southern Nigeria (near the synthetic Palm Landing site): 250
   customers, 232 residential and 18 non-residential, the counts of
   the plan's test community (docs/design/MG-PLAN.md 3.6). The
   community is synthetic; the benchmarks a plan for it takes come
   from real, published reference sites.

   The solar resource is reported: NASA POWER's climatology at the
   community's point, retrieved the way EMOB-A's was.
========================================================== */

export const SYNTHETIC_PLANNED_COMMUNITY_SOURCE: DataSource = {
  id: "synthetic-minigrid-planning",
  name: "Synthetic planned mini-grid community",
  kind: "synthetic",
  organizationId: DEMO_ORGANIZATION_ID,
  description: "One designed community a mini-grid is planned for: its point and its customers by class. No record is real.",
};

export const NASA_POWER_PLANNED_CITATION: Citation = {
  id: "nasa-power-climatology-5.45N-6.30E",
  title:
    "NASA POWER Climatology API v2.10.2, ALLSKY_SFC_SW_DWN (all-sky surface shortwave downward irradiance, kWh/m²/day), January 2001 to December 2025, at 5.45° N, 6.30° E; retrieved 24 November 2026",
  url: "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=6.30&latitude=5.45&format=JSON",
  published: null,
  standing: "primary",
  locator: "ANN 4.4318; JUL 3.6425 (the lowest month)",
};

const COMMUNITIES: PlannedCommunity[] = [
  {
    id: "PLAN-CSV",
    name: "Cassava Creek (synthetic, planned)",
    latitude: 5.45,
    longitude: 6.3,
    customers: { residential: 232, non_residential: 18 },
    solar: { averagePeakSunHours: 4.43, rainySeasonPeakSunHours: 3.64, rainySeasonMonth: "July", citationId: NASA_POWER_PLANNED_CITATION.id },
    sourceId: SYNTHETIC_PLANNED_COMMUNITY_SOURCE.id,
  },
];

export function createSyntheticPlannedCommunities(): PlannedCommunityRepository {
  return {
    communities: async () => COMMUNITIES,
    citations: async () => [NASA_POWER_PLANNED_CITATION],
    sources: async () => [SYNTHETIC_PLANNED_COMMUNITY_SOURCE],
  };
}
