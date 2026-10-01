import type {
  BillingRecord,
  DataSource,
  DeviceHeartbeat,
  IntervalEnergy,
  Outage,
  Payment,
  ReportedKpi,
  TelemetryPoint,
} from "@/domain";
import type { Completeness, NetworkRegistrySnapshot, RegistryCoverage } from "../ports/index.ts";

/* ==========================================================
   IN-MEMORY DATASET

   A complete set of canonical domain records held in memory. The
   demo adapter generates one; tests build their own. Records are
   served as stored.
========================================================== */

export interface DomainDataset {
  registry: NetworkRegistrySnapshot;
  registryCoverage: RegistryCoverage;
  intervalEnergy: readonly IntervalEnergy[];
  telemetry: readonly TelemetryPoint[];
  /** Held for a later consumer; no port reads heartbeats yet. */
  heartbeats: readonly DeviceHeartbeat[];
  outages: readonly Outage[];
  reportedKpis: readonly ReportedKpi[];
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  dataSources: readonly DataSource[];
  completeness: {
    intervalEnergy: Completeness;
    telemetry: Completeness;
    heartbeats: Completeness;
    outages: Completeness;
    reportedKpis: Completeness;
    billing: Completeness;
  };
}
