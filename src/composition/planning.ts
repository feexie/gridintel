import { createSyntheticMonitoring } from "../repositories/demo/monitoring.ts";
import { nercPublishedFigures } from "../repositories/published/nerc.ts";
import { sprintChangelog } from "../repositories/sprint/changelog.ts";
import { aboutBuildView } from "../services/planning/about.ts";
import { allocationView } from "../services/planning/allocation.ts";
import { dtSequencingView } from "../services/planning/dt.ts";
import { meteringFundView } from "../services/planning/metering.ts";
import { monitoringPlan, monitoringView } from "../services/planning/monitoring.ts";
import { getRuntime } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — PLANNING

   The Metering planner bound to the published-figures adapter. Its
   figures are published documents, not the running dataset, so the
   view is not cached with the dataset's results; it is built for the
   assumptions in each request's address.
========================================================== */

const published = nercPublishedFigures();

/* Monitoring records are synthetic today: designed against the plan, once per process. A real
   monitoring source replaces this adapter. */
let monitoring: ReturnType<typeof createSyntheticMonitoring> | null = null;
async function monitoringRecords() {
  return (monitoring ??= createSyntheticMonitoring(await monitoringPlan(published)));
}

export const planning = {
  meteringFund: (query: Record<string, string | string[] | undefined>) => meteringFundView(published, query),
  allocation: (query: Record<string, string | string[] | undefined>) => allocationView(published, query),
  /** On the running network (synthetic today); its per-DT figures are cached with the dataset's results. */
  dtSequencing: async (query: Record<string, string | string[] | undefined>) => dtSequencingView(await getRuntime(), query),
  monitoring: async (query: Record<string, string | string[] | undefined>) => monitoringView(published, await monitoringRecords(), query),
  aboutBuild: () => aboutBuildView(sprintChangelog()),
};
