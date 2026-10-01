import type { DeviceHeartbeat, MetricKey, TelemetryPoint } from "@/domain";
import type { LegacyData, LegacyMeter } from "./legacy.ts";
import type { MappingIssue } from "./issues.ts";
import { LEGACY_DATASETS } from "./legacy.ts";
import { mappingIssue } from "./issues.ts";
import { OPERATIONS_SOURCE, isZonedTimestamp, mockProvenance } from "./sources.ts";

/* ==========================================================
   MOCK ADAPTER — OBSERVATION MAPPING

   Only values with a stated observation time become observations:
   - meter readings, observed at the meter's `lastReading`;
   - heartbeats, at an edge device's `lastHeartbeat` or a meter's
     `lastCommunication`.
   Asset-level live values have no observation time and are not
   mapped (D3; noted by mapRegistry). No interval energy exists in
   the legacy data, and none is created.

   The legacy readings are not labelled by phase, so no phase is
   set. A reading's quality is "measured": it is presented as a
   device reading, and its mock origin is carried by provenance.
========================================================== */

export interface ObservationMapping {
  telemetry: TelemetryPoint[];
  heartbeats: DeviceHeartbeat[];
  issues: MappingIssue[];
}

/** Legacy meter field → metric. Units already match the metric keys (V, A, Hz, kW, kvar, kVA). */
const METER_METRICS: readonly [keyof LegacyMeter & string, MetricKey][] = [
  ["voltage", "voltage_v"],
  ["current", "current_a"],
  ["frequency", "frequency_hz"],
  ["powerFactor", "power_factor"],
  ["powerKw", "active_power_kw"],
  ["reactivePowerKvar", "reactive_power_kvar"],
  ["apparentPowerKva", "apparent_power_kva"],
];

const SIGNAL_UNIT_UNKNOWN = "Signal strength with no stated unit; not mapped.";

export function mapObservations(legacy: LegacyData): ObservationMapping {
  const issues: MappingIssue[] = [];
  const telemetry: TelemetryPoint[] = [];
  const heartbeats: DeviceHeartbeat[] = [];

  for (const meter of legacy.meters) {
    const dataset = LEGACY_DATASETS.meters;
    const id = meter.id;
    const source = { kind: "meter" as const, id };

    if (isZonedTimestamp(meter.lastReading)) {
      for (const [field, metric] of METER_METRICS) {
        telemetry.push({
          source,
          metric,
          observedAt: meter.lastReading,
          value: meter[field] as number,
          quality: "measured",
          provenance: mockProvenance(OPERATIONS_SOURCE, id),
        });
      }
    } else {
      issues.push(mappingIssue("UNPARSEABLE_TIME",
        `lastReading "${meter.lastReading}" is not a zoned timestamp; the meter's readings are left out.`,
        { dataset, recordId: id, field: "lastReading" }, "error"));
    }

    if (isZonedTimestamp(meter.lastCommunication)) {
      heartbeats.push({
        device: source,
        receivedAt: meter.lastCommunication,
        provenance: mockProvenance(OPERATIONS_SOURCE, id),
      });
    } else {
      issues.push(mappingIssue("UNPARSEABLE_TIME",
        `lastCommunication "${meter.lastCommunication}" is not a zoned timestamp; no heartbeat is recorded.`,
        { dataset, recordId: id, field: "lastCommunication" }, "error"));
    }
    issues.push(mappingIssue("UNMAPPED_FIELD", SIGNAL_UNIT_UNKNOWN, { dataset, recordId: id, field: "signalStrength" }));
  }

  for (const device of legacy.edgeDevices) {
    const dataset = LEGACY_DATASETS.edgeDevices;
    const id = device.id;
    if (isZonedTimestamp(device.lastHeartbeat)) {
      heartbeats.push({
        device: { kind: "edge_device", id },
        receivedAt: device.lastHeartbeat,
        latencyMs: device.latencyMs,
        ...(device.batteryVoltage === undefined ? {} : { batteryVoltageV: device.batteryVoltage }),
        provenance: mockProvenance(OPERATIONS_SOURCE, id),
      });
    } else {
      issues.push(mappingIssue("UNPARSEABLE_TIME",
        `lastHeartbeat "${device.lastHeartbeat}" is not a zoned timestamp; no heartbeat is recorded.`,
        { dataset, recordId: id, field: "lastHeartbeat" }, "error"));
    }
    issues.push(mappingIssue("UNMAPPED_FIELD", SIGNAL_UNIT_UNKNOWN, { dataset, recordId: id, field: "signalStrength" }));
  }

  return { telemetry, heartbeats, issues };
}
