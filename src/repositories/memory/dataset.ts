import type {
  Alarm,
  Area,
  BillingRecord,
  DataSource,
  DeviceHeartbeat,
  IntervalEnergy,
  IsoTimestamp,
  Outage,
  Payment,
  ReportedKpi,
  TelemetryPoint,
  Territory,
} from "@/domain";
import type { Completeness, NetworkRegistrySnapshot, RegistryCoverage, SiteRegistryCoverage, SiteRegistrySnapshot } from "../ports/index.ts";

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
  heartbeats: readonly DeviceHeartbeat[];
  /**
   * The window the heartbeat record covers, when it covers less than every time. A query that
   * reaches outside it is answered as partial, whatever `completeness.heartbeats` says: a missing
   * check-in there may only be a missing record.
   */
  heartbeatsHeld?: { start: IsoTimestamp; end: IsoTimestamp };
  outages: readonly Outage[];
  /** Alarms as source systems recorded them. Derived conditions are never held here. */
  alarms: readonly Alarm[];
  reportedKpis: readonly ReportedKpi[];
  billingRecords: readonly BillingRecord[];
  payments: readonly Payment[];
  dataSources: readonly DataSource[];
  /**
   * Named areas and the territories of organizations. Absent when the source holds none, which is
   * then reported as "not available", never as an empty but complete list.
   */
  areas?: readonly Area[];
  territories?: readonly Territory[];
  /** Mini-grid sites, their assets, meters, connections and accounts. Absent when the source holds no sites: "not available". */
  sites?: SiteRegistrySnapshot;
  siteCoverage?: SiteRegistryCoverage;
  completeness: {
    intervalEnergy: Completeness;
    telemetry: Completeness;
    heartbeats: Completeness;
    outages: Completeness;
    alarms: Completeness;
    reportedKpis: Completeness;
    billing: Completeness;
    areas?: Completeness;
    territories?: Completeness;
  };
}
