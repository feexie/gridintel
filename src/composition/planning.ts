import { createSyntheticMarketplace } from "../repositories/demo/marketplace.ts";
import { createSyntheticMonitoring } from "../repositories/demo/monitoring.ts";
import { nercPublishedFigures } from "../repositories/published/nerc.ts";
import { sprintChangelog } from "../repositories/sprint/changelog.ts";
import { aboutBuildView } from "../services/planning/about.ts";
import { allocationView } from "../services/planning/allocation.ts";
import { dtSequencingView } from "../services/planning/dt.ts";
import { journeyView } from "../services/planning/journey.ts";
import { marketplaceView } from "../services/planning/marketplace.ts";
import { meteringFundView } from "../services/planning/metering.ts";
import { monitoringPlan, monitoringView } from "../services/planning/monitoring.ts";
import { meteringPlanReportView } from "../services/planning/report.ts";
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

/* The metering marketplace's pledges and applications are synthetic today: designed records, once per process. */
const marketplace = createSyntheticMarketplace();

export const planning = {
  meteringFund: (query: Record<string, string | string[] | undefined>) => meteringFundView(published, query),
  allocation: (query: Record<string, string | string[] | undefined>) => allocationView(published, query),
  /** On the running network (synthetic today); its per-DT figures are cached with the dataset's results. */
  dtSequencing: async (query: Record<string, string | string[] | undefined>) => dtSequencingView(await getRuntime(), query),
  monitoring: async (query: Record<string, string | string[] | undefined>) => monitoringView(published, await monitoringRecords(), query),
  /** The Metering Marketplace: synthetic pledges matched to synthetic approved applications. */
  marketplace: () => marketplaceView(marketplace),
  /** One meter's journey: one synthetic household, with the Marketplace's terms and match. */
  journey: () => journeyView(marketplace),
  aboutBuild: () => aboutBuildView(sprintChangelog()),
  /** The Metering Plan report, from the same three views the screens show, for the assumptions in the address (Nigeria reference case by default). */
  meteringPlanReport: async (query: Record<string, string | string[] | undefined>) => {
    const fundQuery = { case: "nigeria", ...query };
    const [fund, allocation, monitoring] = await Promise.all([meteringFundView(published, fundQuery), allocationView(published, query), monitoringView(published, await monitoringRecords(), {})]);
    return meteringPlanReportView(fund, allocation, monitoring);
  },
};
