import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Alarm, DeviceHeartbeat, Severity, TelemetryPoint } from "@/domain";
import { CONDITIONS_REFERENCE, LOADING_REFERENCE } from "../core/methodology.ts";
import { calculateLoading } from "../loading/loading.ts";
import { peakLoading } from "../loading/peak.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { placeInScope, placeOfAsset } from "../topology/place.ts";
import { CONTEXT, PROVENANCE, buildRegistry } from "../__fixtures__/network.ts";
import { alarmState, classifyAlarms, conditionRules, loadingCondition, quietMonitorCondition, severityRank, sortConditions } from "./conditions.ts";

const alarm = (id: string, severity: Severity, raisedAt?: string, clearedAt?: string): Alarm => ({
  id,
  subject: { kind: "feeder", id: "FD-1" },
  code: "TEST",
  severity,
  message: id,
  ...(raisedAt === undefined ? {} : { raisedAt }),
  ...(clearedAt === undefined ? {} : { clearedAt }),
  quality: "measured",
  provenance: PROVENANCE,
});

describe("an alarm's state at a time", () => {
  const NOON = "2026-01-01T12:00:00Z";

  it("is active from the moment it is raised until it is cleared, by the times the source recorded", () => {
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T10:00:00Z"), NOON), "active");
    assert.equal(alarmState(alarm("a", "high", NOON), NOON), "active");
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"), NOON), "cleared");
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T10:00:00Z", NOON), NOON), "cleared");
    // Cleared later than the time asked about: it was still standing then.
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T10:00:00Z", "2026-01-01T13:00:00Z"), NOON), "active");
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T13:00:00Z"), NOON), "not_yet_raised");
  });

  it("is not assumed when the source did not record when it was raised", () => {
    assert.equal(alarmState(alarm("a", "critical"), NOON), "time_not_recorded");
    assert.equal(alarmState(alarm("a", "critical", "not a time"), NOON), "time_not_recorded");
    // A clear time that cannot be read is not a clear.
    assert.equal(alarmState(alarm("a", "high", "2026-01-01T10:00:00Z", "not a time"), NOON), "active");
  });

  it("ranks severity explicitly, never by spelling", () => {
    assert.deepEqual((["info", "critical", "low", "high", "medium"] as const).map(severityRank), [4, 0, 3, 1, 2]);
  });

  it("lists active alarms first, then undated, then cleared; most severe first, then most recent", () => {
    const listed = classifyAlarms(
      [
        alarm("cleared-critical", "critical", "2026-01-01T08:00:00Z", "2026-01-01T09:00:00Z"),
        alarm("active-medium", "medium", "2026-01-01T11:00:00Z"),
        alarm("undated-critical", "critical"),
        alarm("active-high-old", "high", "2026-01-01T07:00:00Z"),
        alarm("active-high-new", "high", "2026-01-01T10:00:00Z"),
      ],
      NOON,
    );
    assert.deepEqual(listed.map((entry) => [entry.alarm.id, entry.state]), [
      ["active-high-new", "active"],
      ["active-high-old", "active"],
      ["active-medium", "active"],
      ["undated-critical", "time_not_recorded"],
      ["cleared-critical", "cleared"],
    ]);
  });
});

describe("derived condition: loaded above rating", () => {
  const registry = buildRegistry();
  const dt = registry.distributionTransformers.find((candidate) => candidate.id === "DT-1")!;
  const target = { kind: "distribution_transformer" as const, asset: dt };
  // DT-1 is rated 500 kVA.
  const reading = (at: string, kva: number): TelemetryPoint => ({
    source: { kind: "distribution_transformer", id: "DT-1" },
    metric: "apparent_power_kva",
    observedAt: at,
    value: kva,
    phase: "total",
    quality: "measured",
    provenance: PROVENANCE,
  });
  const WINDOW = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };
  const derive = (telemetry: TelemetryPoint[], asOf: string) =>
    loadingCondition({
      peak: peakLoading({ target, telemetry, window: WINDOW, overloadThreshold: LOADING_REFERENCE.parameters.overloadThreshold, context: CONTEXT }),
      now: calculateLoading({ target, telemetry, asOf, context: CONTEXT }),
      context: CONTEXT,
    });

  it("is found when a reading in the period was above rating, with how often, when first and last, and the peak", () => {
    const telemetry = [reading("2026-01-01T09:00:00Z", 400), reading("2026-01-01T10:00:00Z", 520), reading("2026-01-01T11:00:00Z", 560), reading("2026-01-01T12:00:00Z", 450), reading("2026-01-01T23:30:00Z", 300)];
    const condition = derive(telemetry, "2026-01-02T00:00:00Z");
    assert.equal(condition?.rule, "loading_above_rating");
    assert.deepEqual(condition?.subject, { kind: "distribution_transformer", id: "DT-1" });
    assert.equal(condition?.occurrences, 2);
    assert.equal(condition?.firstAt, "2026-01-01T10:00:00Z");
    assert.equal(condition?.lastAt, "2026-01-01T11:00:00Z");
    assert.equal(condition?.value, 1.12);
    assert.equal(condition?.unit, "fraction");
    assert.equal(condition?.threshold, 1);
    // At the as-of time the latest reading is within rating: the condition occurred, and does not hold now.
    assert.equal(condition?.activeAtAsOf, false);
    assert.equal(condition?.methodology.id, "gridintel.loading.reference");
  });

  it("holds at the as-of time when the latest reading is above rating", () => {
    assert.equal(derive([reading("2026-01-01T23:30:00Z", 510)], "2026-01-02T00:00:00Z")?.activeAtAsOf, true);
  });

  it("cannot say whether it holds now when no reading is recent enough", () => {
    assert.equal(derive([reading("2026-01-01T10:00:00Z", 510)], "2026-01-02T00:00:00Z")?.activeAtAsOf, null);
  });

  it("is not a condition at all when no reading was above rating, or exactly at it", () => {
    assert.equal(derive([reading("2026-01-01T10:00:00Z", 499), reading("2026-01-01T11:00:00Z", 500)], "2026-01-02T00:00:00Z"), null);
    assert.equal(derive([], "2026-01-02T00:00:00Z"), null);
  });
});

describe("derived condition: monitor quiet", () => {
  const device = { kind: "edge_device" as const, id: "ED-1" };
  const beat = (at: string, id = "ED-1"): DeviceHeartbeat => ({ device: { kind: "edge_device", id }, receivedAt: at, provenance: PROVENANCE });
  const AS_OF = "2026-01-02T00:00:00Z";
  const derive = (heartbeats: DeviceHeartbeat[]) => quietMonitorCondition({ device, heartbeats, asOf: AS_OF, context: CONTEXT });

  it("is found when the last check-in is older than the threshold, with how long ago it was", () => {
    const condition = derive([beat("2026-01-01T12:55:00Z"), beat("2026-01-01T14:55:00Z"), beat("2026-01-01T13:55:00Z"), beat("2026-01-01T23:55:00Z", "ED-2")]);
    assert.equal(condition?.rule, "monitor_quiet");
    assert.equal(condition?.activeAtAsOf, true);
    assert.equal(condition?.lastAt, "2026-01-01T14:55:00Z");
    assert.equal(condition?.value, 545);
    assert.equal(condition?.unit, "minutes");
    assert.equal(condition?.threshold, CONDITIONS_REFERENCE.parameters.quietAfterMinutes);
    assert.equal(condition?.occurrences, null);
    assert.equal(condition?.methodology.id, "gridintel.conditions.reference");
  });

  it("is not found when the device checked in recently, or exactly at the threshold", () => {
    assert.equal(derive([beat("2026-01-01T23:55:00Z")]), null);
    assert.equal(derive([beat("2026-01-01T22:00:00Z")]), null);
    assert.notEqual(derive([beat("2026-01-01T21:59:00Z")]), null);
  });

  it("ignores a check-in dated after the as-of time", () => {
    assert.equal(derive([beat("2026-01-01T10:00:00Z"), beat("2026-01-02T00:30:00Z")])?.lastAt, "2026-01-01T10:00:00Z");
  });

  it("reports a device with no check-in at all as quiet, with no last time and no figure", () => {
    const condition = derive([]);
    assert.equal(condition?.activeAtAsOf, true);
    assert.equal(condition?.lastAt, null);
    assert.equal(condition?.value, null);
  });

  it("takes its threshold from the methodology", () => {
    const strict = { ...CONDITIONS_REFERENCE, parameters: { quietAfterMinutes: 2 } };
    assert.notEqual(quietMonitorCondition({ device, heartbeats: [beat("2026-01-01T23:55:00Z")], asOf: AS_OF, methodology: strict, context: CONTEXT }), null);
  });
});

describe("derived conditions: rules and order", () => {
  it("states each rule in words, with the methodology's own thresholds", () => {
    const rules = conditionRules();
    assert.match(rules.loading_above_rating.statement, /above 100% of rating at one or more telemetry readings in the period/);
    assert.match(rules.monitor_quiet.statement, /more than 120 minutes before the as-of time/);
    assert.match(conditionRules({ ...CONDITIONS_REFERENCE, parameters: { quietAfterMinutes: 30 } }).monitor_quiet.statement, /more than 30 minutes/);
    assert.match(CONDITIONS_REFERENCE.disclaimer, /not an alarm recorded by a source system/);
  });

  it("lists conditions that hold now first, then the most recent", () => {
    const base = { kind: "derived_condition" as const, asOf: "2026-01-02T00:00:00Z", occurrences: 1, value: 1.1, unit: "fraction" as const, threshold: 1, quality: null, methodology: { id: "m", version: "1" }, computedAt: CONTEXT.computedAt };
    const sorted = sortConditions([
      { ...base, rule: "loading_above_rating", subject: { kind: "distribution_transformer", id: "B" }, activeAtAsOf: false, firstAt: "2026-01-01T10:00:00Z", lastAt: "2026-01-01T20:00:00Z" },
      { ...base, rule: "loading_above_rating", subject: { kind: "distribution_transformer", id: "A" }, activeAtAsOf: false, firstAt: "2026-01-01T10:00:00Z", lastAt: "2026-01-01T21:00:00Z" },
      { ...base, rule: "monitor_quiet", subject: { kind: "edge_device", id: "C" }, activeAtAsOf: true, firstAt: "2026-01-01T09:00:00Z", lastAt: "2026-01-01T09:00:00Z" },
    ]);
    assert.deepEqual(sorted.map((condition) => condition.subject.id), ["C", "A", "B"]);
  });
});

describe("where an asset sits", () => {
  const registry = buildRegistry();
  const index = buildTopologyIndex(registry);
  const AUDIT = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  const records = {
    powerTransformers: [{ ...AUDIT, id: "PT-1", substationId: "SS-1", name: "T1", ratingMva: 5, primaryVoltageKv: 33, secondaryVoltageKv: 11, lifecycle: "in_service" as const, provenance: PROVENANCE }],
    edgeDevices: [
      { ...AUDIT, id: "ED-DT1", attachedTo: { kind: "distribution_transformer" as const, id: "DT-1" }, lifecycle: "in_service" as const, provenance: PROVENANCE },
      { ...AUDIT, id: "ED-LOOP", attachedTo: { kind: "edge_device" as const, id: "ED-LOOP" }, lifecycle: "in_service" as const, provenance: PROVENANCE },
    ],
  };
  const place = (kind: Parameters<typeof placeOfAsset>[2]["kind"], id: string) => placeOfAsset(index, records, { kind, id });

  it("walks up the current topology from any kind of asset", () => {
    assert.deepEqual(place("distribution_transformer", "DT-1"), { organizationId: place("substation", "SS-1")?.organizationId ?? null, regionId: "R-1", substationId: "SS-1", feederId: "FD-1", transformerId: "DT-1" });
    assert.deepEqual([place("service_point", "SP-1")?.transformerId, place("service_point", "SP-4")?.feederId, place("service_point", "SP-4")?.transformerId], ["DT-1", "FD-1", null]);
    assert.deepEqual([place("feeder", "FD-2")?.substationId, place("feeder", "FD-2")?.feederId], ["SS-1", "FD-2"]);
    // A power transformer is in its substation and on no feeder; a device is where its asset is; a meter where it is installed.
    assert.deepEqual([place("power_transformer", "PT-1")?.substationId, place("power_transformer", "PT-1")?.feederId], ["SS-1", null]);
    assert.equal(place("edge_device", "ED-DT1")?.transformerId, "DT-1");
    assert.equal(place("meter", "M-FH1")?.feederId, "FD-1");
    assert.equal(place("meter", "M-SP3")?.transformerId, "DT-2");
  });

  it("places nothing it cannot find, and never guesses", () => {
    for (const [kind, id] of [["distribution_transformer", "nope"], ["feeder", "nope"], ["substation", "nope"], ["power_transformer", "nope"], ["edge_device", "nope"], ["meter", "nope"], ["service_point", "nope"], ["edge_device", "ED-LOOP"]] as const) {
      assert.equal(place(kind, id), null, `${kind} ${id}`);
    }
  });

  it("says whether a place is under a scope", () => {
    const dt1 = place("distribution_transformer", "DT-1")!;
    assert.equal(placeInScope(dt1, { kind: "distribution_transformer", id: "DT-1" }), true);
    assert.equal(placeInScope(dt1, { kind: "distribution_transformer", id: "DT-2" }), false);
    assert.equal(placeInScope(dt1, { kind: "feeder", id: "FD-1" }), true);
    assert.equal(placeInScope(dt1, { kind: "feeder", id: "FD-2" }), false);
    assert.equal(placeInScope(dt1, { kind: "substation", id: "SS-1" }), true);
    assert.equal(placeInScope(dt1, { kind: "region", id: "R-1" }), true);
    // The power transformer is under its substation, and under no feeder or transformer.
    const pt = place("power_transformer", "PT-1")!;
    assert.equal(placeInScope(pt, { kind: "substation", id: "SS-1" }), true);
    assert.equal(placeInScope(pt, { kind: "feeder", id: "FD-1" }), false);
  });
});
