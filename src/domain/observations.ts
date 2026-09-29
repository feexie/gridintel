import type { Audit, DataQuality, IsoTimestamp, LifecycleStatus } from "./primitives";
import type { Provenance } from "./provenance";
import type { AssetRef } from "./refs";

/* ==========================================================
   GRIDINTEL DOMAIN — DEVICES AND OBSERVATIONS

   Observations are append-only history. A correction is a new
   record with its own provenance; existing records are never
   edited.

   Current state is always derived, never stored: whether a device
   is online comes from its heartbeats and an as-of time, and the
   "latest" reading is the most recent non-missing observation.
========================================================== */

/** A monitoring or communication device attached to an asset. */
export interface EdgeDevice extends Audit {
  id: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  /** The asset this device monitors. */
  attachedTo: AssetRef;
  protocol?: string;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}

/** One check-in from a device. Communication state is derived from these. */
export interface DeviceHeartbeat {
  /** An edge device or a meter. */
  device: AssetRef;
  receivedAt: IsoTimestamp;
  signalStrengthPct?: number;
  latencyMs?: number;
  batteryVoltageV?: number;
  provenance: Provenance;
}

/**
 * Measured quantities. Units are in the key. Voltage is in volts, so a
 * 33 kV reading is 33000. Register metrics are cumulative meter
 * registers, not energy for a period.
 */
export type MetricKey =
  | "voltage_v"
  | "current_a"
  | "active_power_kw"
  | "reactive_power_kvar"
  | "apparent_power_kva"
  | "power_factor"
  | "frequency_hz"
  | "temperature_c"
  | "energy_import_register_kwh"
  | "energy_export_register_kwh";

/** An instantaneous reading, or a register reading, at one moment. */
export interface TelemetryPoint {
  source: AssetRef;
  metric: MetricKey;
  /** When the value was measured (not when it was received or stored). */
  observedAt: IsoTimestamp;
  /** null only together with quality "missing". Never 0 as a placeholder. */
  value: number | null;
  phase?: "A" | "B" | "C" | "total";
  quality: DataQuality;
  /** The edge device that relayed the reading, if any. */
  deviceId?: string;
  provenance: Provenance;
}

/**
 * Energy through a meter over one interval,
 * [intervalStart, intervalStart + intervalMinutes).
 *
 * Import/export direction follows the meter's installation role (see
 * metering.ts). A missing interval is null with quality "missing", or
 * absent altogether; it is never 0.
 */
export interface IntervalEnergy {
  meterId: string;
  intervalStart: IsoTimestamp;
  intervalMinutes: number;
  importKwh: number | null;
  exportKwh: number | null;
  quality: DataQuality;
  provenance: Provenance;
}
