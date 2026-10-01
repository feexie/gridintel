import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_DATA } from "./legacy.ts";
import { mapObservations } from "./mapObservations.ts";

const { telemetry, heartbeats, issues } = mapObservations(LEGACY_DATA);

describe("observation mapping: meter readings", () => {
  it("maps each meter's seven readings at its lastReading time", () => {
    assert.equal(telemetry.length, 3 * 7);
    const mtr1 = telemetry.filter((point) => point.source.id === "ADM-MTR-001");
    assert.deepEqual(
      mtr1.map((point) => [point.metric, point.value]),
      [
        ["voltage_v", 233.8],
        ["current_a", 14.6],
        ["frequency_hz", 50.02],
        ["power_factor", 0.98],
        ["active_power_kw", 3.4],
        ["reactive_power_kvar", 0.62],
        ["apparent_power_kva", 3.46],
      ],
    );
    assert.ok(mtr1.every((point) =>
      point.source.kind === "meter" &&
      point.observedAt === "2026-07-10T09:10:00Z" &&
      point.quality === "measured" &&
      point.phase === undefined &&
      point.provenance.sourceSystem === "mock-operations"));
  });

  it("creates no telemetry for substations, feeders or transformers (D3)", () => {
    assert.ok(telemetry.every((point) => point.source.kind === "meter"));
  });

  it("does not map the ambiguous energyKwh as a register", () => {
    assert.equal(telemetry.some((point) => point.metric.startsWith("energy_")), false);
  });

  it("leaves out a meter's readings when its reading time cannot be read, with an error", () => {
    const legacy = structuredClone(LEGACY_DATA);
    const broken = { ...legacy, meters: [{ ...legacy.meters[0], lastReading: "yesterday" }] };
    const mapped = mapObservations(broken);
    assert.equal(mapped.telemetry.length, 0);
    assert.ok(mapped.issues.some((issue) =>
      issue.code === "UNPARSEABLE_TIME" && issue.severity === "error" && issue.source.field === "lastReading"));
  });
});

describe("observation mapping: heartbeats", () => {
  it("records one heartbeat per meter and edge device, at the stated times", () => {
    assert.deepEqual(
      heartbeats.map((beat) => [beat.device.kind, beat.device.id, beat.receivedAt]),
      [
        ["meter", "ADM-MTR-001", "2026-07-10T09:10:05Z"],
        ["meter", "ADM-MTR-002", "2026-07-10T09:11:08Z"],
        ["meter", "ADM-MTR-003", "2026-07-10T09:00:11Z"],
        ["edge_device", "EDGE-001", "2026-07-11T09:45:12Z"],
        ["edge_device", "EDGE-002", "2026-07-11T09:44:58Z"],
        ["edge_device", "EDGE-003", "2026-07-11T09:37:10Z"],
      ],
    );
  });

  it("keeps an absent battery voltage absent, never 0", () => {
    const edge2 = heartbeats.find((beat) => beat.device.id === "EDGE-002");
    const edge1 = heartbeats.find((beat) => beat.device.id === "EDGE-001");
    assert.equal(edge2 !== undefined && "batteryVoltageV" in edge2, false);
    assert.equal(edge1?.batteryVoltageV, 12.4);
    assert.equal(edge1?.latencyMs, 18);
  });

  it("does not map signal strength, whose unit is not stated", () => {
    assert.ok(heartbeats.every((beat) => beat.signalStrengthPct === undefined));
    const signal = issues.filter((issue) => issue.source.field === "signalStrength");
    assert.equal(signal.length, 6);
    assert.ok(signal.every((issue) => issue.code === "UNMAPPED_FIELD" && issue.severity === "warning"));
  });
});
