import type { DomainDataset } from "../memory/dataset.ts";
import { buildDemoBilling } from "./billing.ts";
import { buildEnergyModel } from "./energy.ts";
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
========================================================== */

export function buildDemoDataset(): DomainDataset {
  const energy = buildEnergyModel();
  const billing = buildDemoBilling(energy);
  return {
    registry: buildDemoRegistry(),
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
    outages: buildDemoOutages(),
    reportedKpis: buildDemoReportedKpis(energy.technicalLossKwh),
    billingRecords: billing.billingRecords,
    payments: billing.payments,
    dataSources: DEMO_DATA_SOURCES,
    completeness: {
      intervalEnergy: "complete",
      telemetry: "complete",
      heartbeats: "complete",
      outages: "complete",
      reportedKpis: "complete",
      billing: "complete",
    },
  };
}

let cached: DomainDataset | null = null;

/** The synthetic dataset, built once on first use. */
export function demoDataset(): DomainDataset {
  cached ??= buildDemoDataset();
  return cached;
}
