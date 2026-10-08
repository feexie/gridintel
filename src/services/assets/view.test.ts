import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { NetworkLevelView } from "../operations/views.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "../analytics/__fixtures__/sparse.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { feederView, substationView, transformerView } from "../operations/levels.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { TRANSFORMER_LIMIT, assetsWorkspaceView } from "./view.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };

describe("assets workspace", async () => {
  const view = await assetsWorkspaceView(runtime, "all");
  const asset = (id: string) => view.classes.flatMap((table) => table.rows).find((row) => row.id === id)!;

  it("looks at every in-service power transformer, feeder and distribution transformer", () => {
    assert.deepEqual(view.classes.map((table) => [table.assetClass, table.total, table.rows.length, table.coverage]), [
      ["power_transformer", 3, 3, "complete"],
      ["feeder", 4, 4, "complete"],
      ["distribution_transformer", 48, 48, "complete"],
    ]);
    assert.equal(view.assetsChecked, 55);
    assert.equal(view.sourcing.synthetic, true);
  });

  it("lists an asset for attention only for a fact that is on it, and orders the list by the stated rule", () => {
    assert.deepEqual(view.attention.map((row) => row.id), ["DT-OLD-3", "FD-FRM", "PT-RIV-1", "DT-OLD-2", "DT-GOV-3", "DT-FRM-3", "DT-GOV-4", "DT-MKT-2", "FD-GOV", "FD-OLD"]);
    for (const row of view.attention) assert.ok(row.alarms.length > 0 || row.conditions.length > 0 || (row.interruptionsBegan ?? 0) > 0, row.id);
    // Every other asset has none of the three.
    const listed = new Set(view.attention.map((row) => row.id));
    for (const row of view.classes.flatMap((table) => table.rows)) {
      if (!listed.has(row.id)) assert.deepEqual([row.alarms.length, row.conditions.length, row.interruptionsBegan], [0, 0, 0], row.id);
    }
    assert.match(view.attentionRule, /not a score/);
  });

  it("keeps a source alarm and a derived condition in separate lists on the same asset, and says when either is on its monitor", () => {
    // South Gate: its monitor stopped reporting. The source raised a communications alarm; GridIntel derived "monitor quiet"; they agree.
    const southGate = asset("DT-OLD-3");
    assert.deepEqual(southGate.alarms.map((alarm) => [alarm.code, alarm.onMonitor]), [["RTU-COMMS-FAIL", true]]);
    assert.deepEqual(southGate.conditions.map((condition) => [condition.ruleName, condition.onMonitor, condition.activeNow, condition.sourceAlarm]), [["Monitor quiet", true, true, "agrees"]]);
    // Riverbank and Government Avenue 3: loaded above rating, and no source raised an overload alarm.
    for (const [id, readings] of [["DT-OLD-2", 69], ["DT-GOV-3", 53]] as const) {
      const row = asset(id);
      assert.equal(row.readingsOverRating, readings);
      assert.equal(row.alarms.length, 0);
      assert.deepEqual(row.conditions.map((condition) => [condition.ruleName, condition.onMonitor, condition.activeNow, condition.sourceAlarm]), [["Loaded above rating", false, false, "none_raised"]]);
    }
    // Riverside T1: a standing source alarm and nothing derived.
    assert.deepEqual(asset("PT-RIV-1").alarms.map((alarm) => alarm.code), ["PT-OIL-TEMP-HIGH"]);
    assert.equal(asset("PT-RIV-1").conditions.length, 0);
    // The standing alarm on Hillcrest substation names no listed asset: it is counted as elsewhere, not dropped.
    assert.equal(view.alarmsElsewhere, 1);
  });

  it("shows the loading the Operations drill-down shows for the same asset", async () => {
    const transformer = (await transformerView(runtime, "DT-OLD-2")) as NetworkLevelView;
    assert.deepEqual(asset("DT-OLD-2").peak, transformer.loading?.peak);
    assert.deepEqual(asset("DT-OLD-2").now, transformer.loading?.asOf);
    assert.equal(asset("DT-OLD-2").ratedKva, 100);
    const feeder = (await feederView(runtime, "FD-OLD")) as NetworkLevelView;
    assert.deepEqual(asset("FD-OLD").peak, feeder.loading?.peak);
    const substation = (await substationView(runtime, "SS-RIV")) as NetworkLevelView;
    assert.deepEqual(asset("PT-RIV-1").peak, substation.powerTransformers?.find((pt) => pt.id === "PT-RIV-1")?.loading?.peak);
    for (const table of view.classes) {
      const peaks = table.rows.map((row) => row.peak.value as number);
      assert.deepEqual(peaks, [...peaks].sort((a, b) => b - a), table.assetClass);
      for (const row of table.rows) assert.equal(row.peak.origin, "calculated");
    }
  });

  it("takes the interruptions that began at an asset from the reliability result, network-attributed only", async () => {
    const reliability = await reliabilityWorkspaceView(runtime);
    for (const origin of reliability.origins.filter((row) => row.attribution === "network" && row.subject.link !== null)) {
      const row = asset(origin.subject.id);
      assert.equal(row.interruptionsBegan, origin.interruptions, origin.subject.id);
      assert.equal(row.saidiAddedHours, origin.saidiHours, origin.subject.id);
    }
    // Load shedding opens a feeder on purpose; it is not an interruption that began at the feeder. The one that did
    // is the fault still open at the demo clock, counted to the end of the period.
    assert.equal(asset("FD-FRM").interruptionsBegan, 1);
    assert.deepEqual(asset("FD-FRM").alarms.map((alarm) => alarm.code), ["FDR-EF-TRIP"]);
    assert.equal(view.outageLog, "complete");
  });

  it("cuts the transformer table to the most loaded few unless every one is asked for, and nothing else", async () => {
    const top = await assetsWorkspaceView(runtime);
    const table = top.classes.find((entry) => entry.assetClass === "distribution_transformer")!;
    assert.deepEqual([table.rows.length, table.total, table.limit, table.complete], [TRANSFORMER_LIMIT, 48, TRANSFORMER_LIMIT, false]);
    assert.deepEqual(table.rows.map((row) => row.id).slice(0, 2), ["DT-OLD-2", "DT-GOV-3"]);
    assert.deepEqual(top.attention, view.attention);
    assert.equal(view.classes.find((entry) => entry.assetClass === "distribution_transformer")?.complete, true);
  });

  it("says outright what it holds no source for", () => {
    assert.deepEqual(view.notHeld.map((item) => item.name), ["Maintenance records", "Age and condition"]);
    for (const item of view.notHeld) assert.match(item.note, /^Not available\./);
    assert.deepEqual([view.monitoring.devices.value, view.monitoring.checked, view.monitoring.note], [50, 50, null]);
  });
});

describe("assets workspace on a sparse source", async () => {
  const sparse: OperationsRuntime = { repos: sparseRepositories(), now: SPARSE_AS_OF, period: SPARSE_PERIOD, caveats: {} };
  const view = await assetsWorkspaceView(sparse, "all");

  it("invents no loading, no alarm and no zero", () => {
    const rows = view.classes.flatMap((table) => table.rows);
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.equal(row.peak.value, null, row.id);
      assert.notEqual(row.peak.status, "ok", row.id);
      assert.equal(row.readingsOverRating === null || row.readingsOverRating === 0, true, row.id);
      assert.deepEqual(row.alarms, []);
    }
    // With no alarm record, "none" cannot be said; with a partial outage log, no asset is given a zero.
    assert.notEqual(view.alarmRecord, "complete");
    if (view.outageLog !== "complete") for (const row of rows) assert.equal(row.interruptionsBegan, null, row.id);
  });
});
