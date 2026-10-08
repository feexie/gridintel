import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { NetworkLevelView } from "../operations/views.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "../analytics/__fixtures__/sparse.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { feederView, overviewView, substationView } from "../operations/levels.ts";
import { eventsWorkspaceView } from "./view.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };

describe("events / alarms workspace", async () => {
  const view = await eventsWorkspaceView(runtime);

  it("what is wrong now: the alarms standing, most severe first, each with where it is", () => {
    assert.deepEqual(
      view.now.alarms.map((row) => [row.alarm.code, row.alarm.severity, row.alarm.subject.label, row.place.path.map((step) => step.id).join(">"), row.alarm.acknowledgedAt !== null]),
      [
        ["FDR-EF-TRIP", "high", "Farm Road 11 kV feeder", "SS-HIL>FD-FRM", true],
        ["DC-SUPPLY-LOW", "high", "Hillcrest 33/11 kV injection substation", "SS-HIL", false],
        ["RTU-COMMS-FAIL", "medium", "Monitor on South Gate transformer", "SS-RIV>FD-OLD", true],
        ["PT-OIL-TEMP-HIGH", "medium", "Riverside T1", "SS-RIV", true],
      ],
    );
    for (const row of view.now.alarms) assert.equal(row.alarm.state, "active");
    // The alarm with no raise time is not called standing; it is counted apart and stays in the full list.
    assert.equal(view.now.undatedAlarms, 1);
    assert.deepEqual(view.alarms.recorded.undated.map((alarm) => alarm.code), ["DOOR-OPEN"]);
  });

  it("who is affected: accounts behind the asset, from the registry, never called customers without supply", () => {
    const behind = Object.fromEntries(view.now.alarms.map((row) => [row.alarm.code, row.accountsBehind]));
    assert.deepEqual([behind["FDR-EF-TRIP"].value, behind["DC-SUPPLY-LOW"].value, behind["RTU-COMMS-FAIL"].value, behind["PT-OIL-TEMP-HIGH"].value], [1015, 2781, 42, 3543]);
    for (const metric of Object.values(behind)) {
      assert.equal(metric.label, "Active accounts behind it");
      assert.match(metric.note ?? "", /Not a count of customers without supply/);
      assert.equal(metric.derivation, "Counted from the registry.");
    }
    // A monitor that is not reporting interrupts nobody, and the figure says so.
    assert.match(behind["RTU-COMMS-FAIL"].note ?? "", /does not interrupt supply/);
    // Riverside has one power transformer, so what is behind it is what is behind the substation.
    assert.equal(behind["PT-OIL-TEMP-HIGH"].value, view.places.find((place) => place.id === "SS-RIV")?.accounts.value);
  });

  it("keeps derived conditions in their own list: one holds at the as-of time, and a source alarm agrees with it", () => {
    assert.deepEqual(view.now.conditions.map((row) => [row.condition.key, row.condition.activeNow, row.condition.sourceAlarm.status, row.accountsBehind.value]), [
      ["monitor_quiet:ED-DT-OLD-3", true, "agrees", 42],
    ]);
    // The two loading conditions were found in the period and do not hold at midnight.
    assert.equal(view.now.conditionsNotHolding, 2);
    assert.equal(view.alarms.derived.conditions.length, 3);
    // No condition appears among the alarms, and no alarm among the conditions.
    const alarmIds = new Set([...view.alarms.recorded.active, ...view.alarms.recorded.undated, ...view.alarms.recorded.cleared].map((alarm) => alarm.id));
    for (const condition of view.alarms.derived.conditions) assert.equal(alarmIds.has(condition.key), false);
  });

  it("interruptions: the outage its source calls open is in progress, as one row with the customers of its parts", () => {
    const { interruptions } = view.now;
    assert.equal(interruptions.completeness, "complete");
    assert.equal(interruptions.note, null);
    assert.deepEqual(
      interruptions.inProgress.map((row) => [row.outageId, row.status, row.beganAt.label, row.affected.length, row.interruptedAt, row.restoredAt, row.customers.value, row.customers.origin]),
      [["OUT-2026-09-30-FD-FRM-FAULT", "open", "Farm Road 11 kV feeder", 10, "2026-09-30T23:20:00+01:00", null, 1015, "calculated"]],
    );
    assert.deepEqual(interruptions.inProgress[0].place.path.map((step) => step.id), ["SS-HIL", "FD-FRM"]);
    // Every account on Farm Road is behind one of the ten transformers still off.
    assert.equal(interruptions.inProgress[0].customers.value, view.places.find((place) => place.id === "FD-FRM")?.accounts.value);
    assert.deepEqual(view.places.map((place) => [place.id, place.interruptionsInProgress]), [["SS-RIV", 0], ["FD-MKT", 0], ["FD-OLD", 0], ["SS-HIL", 1], ["FD-FRM", 1], ["FD-GOV", 0]]);
  });

  it("interruptions: a record with no restoration time and no open status is a data-quality item, not in progress", () => {
    const { interruptions } = view.now;
    assert.deepEqual(
      interruptions.restorationNotRecorded.map((row) => [row.outageId, row.status, row.affected.map((subject) => subject.label).join(), row.restoredAt, row.customers.value, row.customers.origin, row.place.path.map((step) => step.id).join(">")]),
      [["OUT-2026-09-21-SP-COMPLAINT", null, "SP-MKT2-001", null, 1, "measured", "SS-RIV>FD-MKT"]],
    );
    assert.equal(interruptions.startNotRecorded, 0);
  });

  it("where: every substation and feeder, with the lengths of the lists its own screen shows", async () => {
    assert.deepEqual(view.places.map((place) => [place.kind, place.id]), [
      ["substation", "SS-RIV"],
      ["feeder", "FD-MKT"],
      ["feeder", "FD-OLD"],
      ["substation", "SS-HIL"],
      ["feeder", "FD-FRM"],
      ["feeder", "FD-GOV"],
    ]);
    for (const place of view.places) {
      const level = ((place.kind === "substation" ? await substationView(runtime, place.id) : await feederView(runtime, place.id)) as NetworkLevelView).alarms;
      assert.deepEqual(
        [place.activeAlarms, place.undatedAlarms, place.clearedAlarms, place.conditions],
        [level.recorded.active.length, level.recorded.undated.length, level.recorded.clearedTotal, level.derived.conditions.length],
        place.id,
      );
    }
    assert.deepEqual(view.places.map((place) => [place.id, place.activeAlarms, place.clearedAlarms, place.conditions, place.conditionsHolding]), [
      ["SS-RIV", 2, 6, 2, 1],
      ["FD-MKT", 0, 1, 0, 0],
      ["FD-OLD", 1, 3, 2, 1],
      ["SS-HIL", 2, 21, 1, 0],
      ["FD-FRM", 1, 1, 0, 0],
      ["FD-GOV", 0, 1, 1, 0],
    ]);
  });

  it("lists every cleared alarm, where the drill-down lists the most recent few, and is otherwise the same block", async () => {
    const overview = (await overviewView(runtime)).alarms;
    assert.equal(view.alarms.recorded.cleared.length, 27);
    assert.equal(view.alarms.recorded.clearedTotal, 27);
    assert.equal(overview.recorded.cleared.length, 6);
    assert.deepEqual(view.alarms.recorded.cleared.slice(0, 6), overview.recorded.cleared);
    assert.deepEqual(view.alarms.recorded.active, overview.recorded.active);
    assert.deepEqual(view.alarms.derived, overview.derived);
    assert.equal(view.sourcing.synthetic, true);
    assert.ok(view.sourcing.sources.some((source) => source.name === "Synthetic alarm list"));
  });
});

describe("events / alarms workspace on a sparse source", async () => {
  const sparse: OperationsRuntime = { repos: sparseRepositories(), now: SPARSE_AS_OF, period: SPARSE_PERIOD, caveats: {} };
  const view = await eventsWorkspaceView(sparse);

  it("shows no alarm and says the source holds none, rather than a quiet network", () => {
    assert.deepEqual(view.now.alarms, []);
    assert.equal(view.alarms.recorded.completeness, "not_available");
    assert.match(view.alarms.recorded.note ?? "", /^Not available\./);
  });

  it("does not call two outages nobody timed in progress", () => {
    assert.deepEqual(view.now.interruptions.inProgress, []);
    assert.deepEqual(view.now.interruptions.restorationNotRecorded, []);
    assert.equal(view.now.interruptions.startNotRecorded > 0, true);
  });
});
