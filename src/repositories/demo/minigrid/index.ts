import type { GridIntelRepositories, SiteRegistryCoverage } from "../../ports/index.ts";
import type { DomainDataset } from "../../memory/dataset.ts";
import { createInMemoryRepositories } from "../../memory/inMemoryRepositories.ts";
import { buildSiteBilling } from "./billing.ts";
import { MINIGRID_DATA_SOURCES, SITES } from "./design.ts";
import { buildMinigridRegistry } from "./registry.ts";
import { buildSiteReportedKpis } from "./reported.ts";
import { simulateSite } from "./simulate.ts";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES

   The synthetic records of an invented mini-grid operator, served
   through the same repository ports as any organization's. They are
   a SEPARATE set of repositories from the demonstration utility's:
   another organization's records, which the utility's screens never
   read and are never mixed into (ADR 0015).

   This set holds no distribution network: its network registry is
   empty and says "not available". Its sites are in the site
   registry. Its dataset is complete in its own world: every site,
   asset, account, interval, interruption and charge of the four
   sites it describes.

   The register is built from the design alone. The month of energy
   is simulated only when a question needs it.
========================================================== */

const SITES_COMPLETE: SiteRegistryCoverage = { organizations: "complete", sites: "complete", generationAssets: "complete", servicePoints: "complete", meters: "complete", customers: "complete" };

const NO_NETWORK = {
  registry: { organizations: [], regions: [], substations: [], powerTransformers: [], feeders: [], distributionTransformers: [], servicePoints: [], meters: [], customers: [], edgeDevices: [] },
  registryCoverage: {
    organizations: "not_available",
    regions: "not_available",
    substations: "not_available",
    powerTransformers: "not_available",
    feeders: "not_available",
    distributionTransformers: "not_available",
    servicePoints: "not_available",
    meters: "not_available",
    customers: "not_available",
    edgeDevices: "not_available",
  },
} as const;

function dataset(records: Partial<DomainDataset>, held: "complete" | "not_available"): DomainDataset {
  return {
    ...NO_NETWORK,
    intervalEnergy: [],
    telemetry: [],
    heartbeats: [],
    outages: [],
    alarms: [],
    reportedKpis: [],
    billingRecords: [],
    payments: [],
    dataSources: MINIGRID_DATA_SOURCES,
    sites: buildMinigridRegistry(),
    siteCoverage: SITES_COMPLETE,
    // The sites keep no alarm list and no device check-ins in this dataset.
    completeness: { intervalEnergy: held, telemetry: held, heartbeats: "not_available", outages: held, alarms: "not_available", reportedKpis: held, billing: held },
    ...records,
  };
}

let whole: DomainDataset | null = null;

/** The whole mini-grid dataset, simulated once on first use. */
export function minigridDataset(): DomainDataset {
  if (whole !== null) return whole;
  const months = SITES.map(simulateSite);
  const billing = months.map(buildSiteBilling);
  whole = dataset(
    {
      intervalEnergy: months.flatMap((month) => month.intervalEnergy),
      telemetry: months.flatMap((month) => month.telemetry),
      outages: months.flatMap((month) => month.outages),
      reportedKpis: buildSiteReportedKpis(),
      billingRecords: billing.flatMap((records) => records.billingRecords),
      payments: billing.flatMap((records) => records.payments),
    },
    "complete",
  );
  return whole;
}

export function minigridDatasetIsBuilt(): boolean {
  return whole !== null;
}

export function createMinigridDemoRepositories(): GridIntelRepositories {
  // The register alone answers what needs no energy; nothing else is ever asked of it.
  const register = createInMemoryRepositories(dataset({}, "not_available"));
  let all: GridIntelRepositories | null = null;
  const records = (): GridIntelRepositories => (all ??= createInMemoryRepositories(minigridDataset()));
  return {
    registry: register.registry,
    sites: register.sites,
    sources: register.sources,
    spatial: register.spatial,
    observations: {
      listIntervalEnergy: (query) => records().observations.listIntervalEnergy(query),
      listTelemetry: (query) => records().observations.listTelemetry(query),
      listHeartbeats: (query) => records().observations.listHeartbeats(query),
    },
    events: { listOutages: (query) => records().events.listOutages(query), listAlarms: (query) => records().events.listAlarms(query) },
    reported: { listReportedKpis: (query) => records().reported.listReportedKpis(query) },
    billing: { listBillingRecords: (query) => records().billing.listBillingRecords(query), listPayments: (query) => records().billing.listPayments(query) },
  };
}

export { SITES as MINIGRID_SITE_DESIGNS, MINIGRID_DATA_SOURCES, MINIGRID_ORGANIZATION_ID, MINIGRID_CURRENCY } from "./design.ts";
