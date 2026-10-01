import type {
  Customer,
  DistributionTransformer,
  EdgeDevice,
  Feeder,
  Meter,
  Organization,
  PowerTransformer,
  Region,
  ServicePoint,
  Substation,
} from "@/domain";
import type { AsOfQuery, Completeness } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — REGISTRY (ASSETS AND TOPOLOGY)

   The registry is returned as a snapshot of records. Walking the
   topology is done by the analytics topology index, never here.
========================================================== */

/** Registry records. Structurally a superset of the analytics `Registry`. */
export interface NetworkRegistrySnapshot {
  organizations: readonly Organization[];
  regions: readonly Region[];
  substations: readonly Substation[];
  powerTransformers: readonly PowerTransformer[];
  feeders: readonly Feeder[];
  distributionTransformers: readonly DistributionTransformer[];
  servicePoints: readonly ServicePoint[];
  meters: readonly Meter[];
  customers: readonly Customer[];
  edgeDevices: readonly EdgeDevice[];
}

export type RegistryCoverage = Record<keyof NetworkRegistrySnapshot, Completeness>;

export interface RegistrySnapshotResult {
  snapshot: NetworkRegistrySnapshot;
  /**
   * "current_only": each record holds its current parent, so the
   * snapshot is the same for every `asOf`. History is not modelled yet.
   */
  topologyBasis: "current_only";
  coverage: RegistryCoverage;
}

export interface RegistryRepository {
  getSnapshot(query: AsOfQuery): Promise<RegistrySnapshotResult>;
}
