import type { GridIntelRepositories, RepositoryResult } from "../ports/index.ts";
import type { DomainDataset } from "../memory/dataset.ts";
import { createInMemoryRepositories } from "../memory/inMemoryRepositories.ts";
import { DEMO_PARTS, demoDataset, demoDatasetIsBuilt } from "./buildDemoDataset.ts";
import { buildDemoAreas } from "./areas.ts";
import { buildDemoBilling } from "./billing.ts";
import { SUPPLY_KEYS, buildDemoHeartbeats, connectionsOf } from "./energy.ts";
import { CONNECTIONS } from "./network.ts";
import { DEMO_DATA_SOURCES } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — REPOSITORIES THAT BUILD WHAT IS ASKED FOR

   The whole dataset takes most of a second to generate, almost all
   of it the month of hourly energy of 6,448 connections. A screen
   about one service point needs the registry and that connection's
   own records, so the adapter answers such a question from the one
   supply (transformer) the connection hangs from, and builds the
   whole dataset only when a question needs it:

     registry, outages, alarms,      built on their own; none of them
     heartbeats, sources, areas      needs the energy model
     interval energy, register       of customer meters only: from
     readings, charges, payments     the supplies those belong to
     anything else (a boundary       the whole dataset
     meter, asset telemetry,
     reported figures, every
     account's charges)

   WHAT IS RETURNED DOES NOT DEPEND ON THE ROUTE. A supply's records
   are the same objects whether it was generated alone or as part of
   the whole (`DEMO_PARTS`), and a test compares the two answers for
   every supply. Once the whole dataset exists, every question is
   answered from it.
========================================================== */

const COMPLETE = {
  intervalEnergy: "complete",
  telemetry: "complete",
  heartbeats: "complete",
  outages: "complete",
  alarms: "complete",
  reportedKpis: "complete",
  billing: "complete",
  areas: "complete",
  territories: "complete",
} as const;

const REGISTRY_COMPLETE = {
  organizations: "complete",
  regions: "complete",
  substations: "complete",
  powerTransformers: "complete",
  feeders: "complete",
  distributionTransformers: "complete",
  servicePoints: "complete",
  meters: "complete",
  customers: "complete",
  edgeDevices: "complete",
} as const;

/** A dataset holding only some kinds of record; it is asked only for those kinds. */
function partialDataset(records: Partial<DomainDataset>): DomainDataset {
  return {
    registry: DEMO_PARTS.registry(),
    registryCoverage: REGISTRY_COMPLETE,
    intervalEnergy: [],
    telemetry: [],
    heartbeats: [],
    outages: [],
    alarms: [],
    reportedKpis: [],
    billingRecords: [],
    payments: [],
    dataSources: DEMO_DATA_SOURCES,
    completeness: COMPLETE,
    ...records,
  };
}

const SUPPLY_OF_METER = new Map<string, string>();
const SUPPLY_OF_CUSTOMER = new Map<string, string>();
for (const connection of CONNECTIONS) {
  SUPPLY_OF_CUSTOMER.set(connection.customerId, connection.supplyKey);
  if (connection.meterId !== undefined) SUPPLY_OF_METER.set(connection.meterId, connection.supplyKey);
}

/** The supply each id belongs to, in the order given; null when any id is not a connection's. */
function suppliesOf(ids: readonly string[], lookup: ReadonlyMap<string, string>): string[] | null {
  const keys: string[] = [];
  for (const id of ids) {
    const key = lookup.get(id);
    if (key === undefined) return null;
    keys.push(key);
  }
  return keys;
}

export function createDemoRepositories(): GridIntelRepositories {
  let whole: GridIntelRepositories | null = null;
  const all = (): GridIntelRepositories => (whole ??= createInMemoryRepositories(demoDataset()));
  /** The whole dataset's repositories once it exists, whoever built it; otherwise null. */
  const built = (): GridIntelRepositories | null => (whole !== null || demoDatasetIsBuilt() ? all() : null);

  // The records that need no energy model.
  let standing: GridIntelRepositories | null = null;
  const standingRecords = (): GridIntelRepositories =>
    built() ??
    (standing ??= createInMemoryRepositories(
      partialDataset({ outages: DEMO_PARTS.outages(), alarms: DEMO_PARTS.alarms(), heartbeats: buildDemoHeartbeats(), areas: buildDemoAreas(), territories: [] }),
    ));

  // One supply's customer records.
  const supplies = new Map<string, GridIntelRepositories>();
  const supply = (supplyKey: string): GridIntelRepositories => {
    let repos = supplies.get(supplyKey);
    if (repos === undefined) {
      const energy = DEMO_PARTS.supply(supplyKey);
      const billing = buildDemoBilling(energy, connectionsOf(supplyKey));
      repos = createInMemoryRepositories(
        partialDataset({ intervalEnergy: energy.intervalEnergy, telemetry: energy.telemetry, billingRecords: billing.billingRecords, payments: billing.payments }),
      );
      supplies.set(supplyKey, repos);
    }
    return repos;
  };

  /** One answer per id, each from its own supply, joined in the order the ids were given. */
  async function each<T>(ids: readonly string[], keys: readonly string[], ask: (repos: GridIntelRepositories, id: string) => Promise<RepositoryResult<T>>): Promise<RepositoryResult<T>> {
    const records: T[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      if (seen.has(ids[i])) continue;
      seen.add(ids[i]);
      for (const record of (await ask(supply(keys[i]), ids[i])).records) records.push(record);
    }
    return { records, completeness: "complete" };
  }

  /** The accounts' records in the dataset's own order: supply by supply, as the whole dataset holds them. */
  async function accounts<T>(keys: readonly string[], ask: (repos: GridIntelRepositories) => Promise<RepositoryResult<T>>): Promise<RepositoryResult<T>> {
    const wanted = new Set(keys);
    const records: T[] = [];
    for (const key of SUPPLY_KEYS) {
      if (!wanted.has(key)) continue;
      for (const record of (await ask(supply(key))).records) records.push(record);
    }
    return { records, completeness: "complete" };
  }

  return {
    registry: { getSnapshot: (query) => standingRecords().registry.getSnapshot(query) },

    observations: {
      async listIntervalEnergy(query) {
        const keys = built() === null ? suppliesOf(query.meterIds, SUPPLY_OF_METER) : null;
        if (keys === null) return all().observations.listIntervalEnergy(query);
        return each(query.meterIds, keys, (repos, meterId) => repos.observations.listIntervalEnergy({ ...query, meterIds: [meterId] }));
      },
      async listTelemetry(query) {
        const meters = query.sources.every((source) => source.kind === "meter");
        const keys = built() === null && meters ? suppliesOf(query.sources.map((source) => source.id), SUPPLY_OF_METER) : null;
        if (keys === null) return all().observations.listTelemetry(query);
        return each(query.sources.map((source) => source.id), keys, (repos, meterId) => repos.observations.listTelemetry({ ...query, sources: [{ kind: "meter", id: meterId }] }));
      },
      listHeartbeats: (query) => standingRecords().observations.listHeartbeats(query),
    },

    events: {
      listOutages: (query) => standingRecords().events.listOutages(query),
      listAlarms: (query) => standingRecords().events.listAlarms(query),
    },

    reported: { listReportedKpis: (query) => all().reported.listReportedKpis(query) },

    billing: {
      async listBillingRecords(query) {
        const keys = built() === null && query.customerIds !== undefined ? suppliesOf(query.customerIds, SUPPLY_OF_CUSTOMER) : null;
        if (keys === null || query.customerIds === undefined) return all().billing.listBillingRecords(query);
        return accounts(keys, (repos) => repos.billing.listBillingRecords(query));
      },
      async listPayments(query) {
        const keys = built() === null && query.customerIds !== undefined ? suppliesOf(query.customerIds, SUPPLY_OF_CUSTOMER) : null;
        if (keys === null || query.customerIds === undefined) return all().billing.listPayments(query);
        return accounts(keys, (repos) => repos.billing.listPayments(query));
      },
    },

    sources: { listDataSources: () => standingRecords().sources.listDataSources() },

    spatial: {
      listAreas: (query) => standingRecords().spatial.listAreas(query),
      listTerritories: (query) => standingRecords().spatial.listTerritories(query),
    },
  };
}
