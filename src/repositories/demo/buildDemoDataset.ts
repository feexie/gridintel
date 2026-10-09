import type { Alarm, Outage } from "@/domain";
import type { NetworkRegistrySnapshot } from "../ports/index.ts";
import type { DomainDataset } from "../memory/dataset.ts";
import type { SupplyEnergy } from "./energy.ts";
import { buildDemoAlarms } from "./alarms.ts";
import { buildDemoAreas } from "./areas.ts";
import { buildDemoBilling } from "./billing.ts";
import { buildEnergyModel, buildSupplyEnergy } from "./energy.ts";
import { buildDemoRegistry } from "./network.ts";
import { buildDemoOutages } from "./outages.ts";
import { buildDemoReportedKpis } from "./reported.ts";
import { DEMO_DATA_SOURCES } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — DATASET

   One complete, internally consistent, SYNTHETIC network for
   September 2026, written directly as canonical domain records.
   It is a pure function of the design in this folder: the same
   records on every build, with no clock and no Math.random.

   The dataset is complete in its own world: it holds every asset,
   account, interval, outage and charge of the network it describes,
   so an empty result here does mean "none".

   The dataset is made of parts that do not depend on one another:
   the registry, the outage log, the alarm list, and the energy of
   each supply. A part is built once and kept, so whoever needs one
   part (a service-point screen needs one supply) does not pay for
   the rest, and the whole dataset reuses what was already built.
========================================================== */

/** The independent parts of the dataset, each built on first use and kept. */
export interface DemoParts {
  registry(): NetworkRegistrySnapshot;
  outages(): Outage[];
  alarms(): Alarm[];
  /** The energy of one supply's connections (a transformer's, or the 11 kV customer's). */
  supply(supplyKey: string): SupplyEnergy;
}

function once<T>(build: () => T): () => T {
  let built: { value: T } | null = null;
  return () => (built ??= { value: build() }).value;
}

export function createDemoParts(): DemoParts {
  const supplies = new Map<string, SupplyEnergy>();
  return {
    registry: once(buildDemoRegistry),
    outages: once(buildDemoOutages),
    alarms: once(buildDemoAlarms),
    supply(supplyKey) {
      let part = supplies.get(supplyKey);
      if (part === undefined) {
        part = buildSupplyEnergy(supplyKey);
        supplies.set(supplyKey, part);
      }
      return part;
    },
  };
}

/** The whole dataset. Built from nothing unless `parts` already holds some of it. */
export function buildDemoDataset(parts: DemoParts = createDemoParts()): DomainDataset {
  const energy = buildEnergyModel(parts.supply);
  const billing = buildDemoBilling(energy);
  return {
    registry: parts.registry(),
    registryCoverage: {
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
    },
    intervalEnergy: energy.intervalEnergy,
    telemetry: energy.telemetry,
    heartbeats: energy.heartbeats,
    outages: parts.outages(),
    alarms: parts.alarms(),
    reportedKpis: buildDemoReportedKpis(energy.technicalLossKwh),
    billingRecords: billing.billingRecords,
    payments: billing.payments,
    dataSources: DEMO_DATA_SOURCES,
    areas: buildDemoAreas(),
    // No organization in the demonstration has a territory: its only viewer sees everything.
    territories: [],
    completeness: {
      intervalEnergy: "complete",
      telemetry: "complete",
      heartbeats: "complete",
      outages: "complete",
      alarms: "complete",
      reportedKpis: "complete",
      billing: "complete",
      areas: "complete",
      territories: "complete",
    },
  };
}

/** The parts this process holds: shared by the whole dataset and by whoever asks for one part. */
export const DEMO_PARTS: DemoParts = createDemoParts();

let cached: DomainDataset | null = null;

/** The synthetic dataset, built once on first use. */
export function demoDataset(): DomainDataset {
  cached ??= buildDemoDataset(DEMO_PARTS);
  return cached;
}

/** Whether this process has built the whole dataset yet. */
export function demoDatasetIsBuilt(): boolean {
  return cached !== null;
}
