import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Alarm, ScopeRef } from "@/domain";
import { DEMO_CLOCK, DEMO_ORGANIZATION_ID, DEMO_PERIOD, DEMO_REGION_ID, createDemoRepositories, demoDataset } from "../../repositories/demo/index.ts";
import { createInMemoryRepositories } from "../../repositories/memory/inMemoryRepositories.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "./__fixtures__/sparse.ts";
import { scopeAlarms } from "./alarms.ts";
import { createMemoryCache } from "./cache.ts";

const repos = createDemoRepositories();
const cache = createMemoryCache();
const context = { computedAt: DEMO_CLOCK };
const at = (scope: ScopeRef) => scopeAlarms({ repos, scope, period: DEMO_PERIOD, asOf: DEMO_CLOCK, context, cache });
const ids = (alarms: { alarm: Alarm }[]) => alarms.map((entry) => entry.alarm.id);

describe("alarms and derived conditions for a scope", () => {
  it("returns recorded alarms and derived conditions as two separate results, each from its own source", async () => {
    const { result, sourcing } = await at({ kind: "organization", id: DEMO_ORGANIZATION_ID });
    // Recorded: records from the alarm list, each with its state at the as-of time.
    assert.equal(result.recorded.completeness, "complete");
    assert.equal(result.recorded.alarms.length, 29);
    assert.ok(result.recorded.alarms.every((entry) => entry.alarm.provenance.sourceSystem === "synthetic-alarms"));
    assert.deepEqual(ids(result.recorded.alarms.filter((entry) => entry.state === "active")), ["ALM-2026-09-30-SS-HIL-DC", "ALM-2026-09-26-PT-RIV-1-OIL"]);
    assert.deepEqual(ids(result.recorded.alarms.filter((entry) => entry.state === "time_not_recorded")), ["ALM-SS-RIV-DOOR"]);
    assert.equal(result.recorded.alarms.filter((entry) => entry.state === "cleared").length, 26);
    assert.equal(result.recorded.unplaced, 0);

    // Derived: calculated by rule, never a record of the alarm list.
    assert.deepEqual(result.derived.conditions.map((condition) => [condition.rule, condition.subject.id, condition.activeAtAsOf]), [
      ["monitor_quiet", "ED-DT-OLD-3", true],
      ["loading_above_rating", "DT-OLD-2", false],
      ["loading_above_rating", "DT-GOV-3", false],
    ]);
    assert.ok(result.derived.conditions.every((condition) => condition.kind === "derived_condition" && condition.methodology.id.startsWith("gridintel.")));
    assert.deepEqual(result.derived.rules.map((rule) => rule.id), ["loading_above_rating", "monitor_quiet"]);
    // 3 power transformers, 4 feeders and 48 distribution transformers; 2 substation units and 48 monitors.
    assert.equal(result.derived.assetsChecked, 55);
    assert.equal(result.derived.devicesChecked, 50);
    assert.equal(sourcing.synthetic, true);
    assert.deepEqual(sourcing.sources.map((source) => source.id), ["synthetic-alarms", "synthetic-registry", "synthetic-scada"]);
  });

  it("never mixes the two: no condition is in the alarm list, and neither removes the other", async () => {
    // Riverbank has both: a recorded alarm for its blown fuses, and a derived loading condition.
    const { result } = await at({ kind: "distribution_transformer", id: "DT-OLD-2" });
    assert.deepEqual(ids(result.recorded.alarms), ["ALM-2026-09-23-DT-OLD-2-FAULT"]);
    assert.deepEqual(result.derived.conditions.map((condition) => condition.rule), ["loading_above_rating"]);
    assert.equal(result.derived.conditions[0].occurrences, 69);
    // No source system raised an overload alarm or a communications alarm: those are derived only.
    const all = (await at({ kind: "organization", id: DEMO_ORGANIZATION_ID })).result.recorded.alarms;
    assert.ok(!all.some((entry) => /overload|above rating|communication|check-in/i.test(`${entry.alarm.code} ${entry.alarm.message}`)));
    // South Gate's monitor went quiet; its alarm list has only the storm.
    const southGate = (await at({ kind: "distribution_transformer", id: "DT-OLD-3" })).result;
    assert.deepEqual(ids(southGate.recorded.alarms), ["ALM-2026-09-27-DT-OLD-3-STORM"]);
    assert.deepEqual(southGate.derived.conditions.map((condition) => [condition.rule, condition.lastAt, condition.value]), [["monitor_quiet", "2026-09-30T14:55:00+01:00", 545]]);
  });

  it("gives each scope the alarms of the assets under it, and no others", async () => {
    const riverside = (await at({ kind: "substation", id: "SS-RIV" })).result;
    const hillcrest = (await at({ kind: "substation", id: "SS-HIL" })).result;
    const region = (await at({ kind: "region", id: DEMO_REGION_ID })).result;
    assert.equal(riverside.recorded.alarms.length + hillcrest.recorded.alarms.length, region.recorded.alarms.length);
    assert.ok(!ids(riverside.recorded.alarms).some((id) => ids(hillcrest.recorded.alarms).includes(id)));
    // A substation's own alarms and its power transformer's are under the substation, and under none of its feeders.
    assert.ok(ids(riverside.recorded.alarms).includes("ALM-2026-09-26-PT-RIV-1-OIL"));
    assert.ok(ids(riverside.recorded.alarms).includes("ALM-2026-09-18-SS-RIV-33KV"));
    const oldTown = (await at({ kind: "feeder", id: "FD-OLD" })).result;
    assert.deepEqual(ids(oldTown.recorded.alarms).sort(), ["ALM-2026-09-06-FD-OLD-FAULT", "ALM-2026-09-23-DT-OLD-2-FAULT", "ALM-2026-09-27-DT-OLD-3-STORM"]);
    // The feeder's conditions are those of its transformers and their monitors.
    assert.deepEqual(oldTown.derived.conditions.map((condition) => condition.subject.id), ["ED-DT-OLD-3", "DT-OLD-2"]);
    assert.equal(oldTown.derived.assetsChecked, 15);
    // A transformer with neither has two empty lists, which mean "none": both records are complete.
    const quiet = (await at({ kind: "distribution_transformer", id: "DT-MKT-1" })).result;
    assert.deepEqual([quiet.recorded.alarms.length, quiet.derived.conditions.length, quiet.recorded.completeness, quiet.derived.heartbeatCompleteness], [0, 0, "complete", "complete"]);
  });

  it("gives the same result with and without the cache", async () => {
    const scope: ScopeRef = { kind: "feeder", id: "FD-GOV" };
    const uncached = await scopeAlarms({ repos, scope, period: DEMO_PERIOD, asOf: DEMO_CLOCK, context });
    assert.deepEqual(uncached, await at(scope));
  });

  it("lists an alarm on a name not matched to the registry at organization scope only, and counts it as unplaced", async () => {
    const dataset = demoDataset();
    const stray: Alarm = {
      id: "ALM-STRAY",
      subject: { kind: "feeder", label: "Feeder 9 (old naming)" },
      code: "FDR-TRIP-LOCKOUT",
      severity: "high",
      message: "Feeder breaker tripped.",
      raisedAt: "2026-09-10T10:00:00+01:00",
      quality: "measured",
      provenance: dataset.alarms[0].provenance,
    };
    const withStray = createInMemoryRepositories({ ...dataset, alarms: [...dataset.alarms, stray] });
    const ask = (scope: ScopeRef) => scopeAlarms({ repos: withStray, scope, period: DEMO_PERIOD, asOf: DEMO_CLOCK, context, cache: createMemoryCache() });
    const organization = (await ask({ kind: "organization", id: DEMO_ORGANIZATION_ID })).result;
    assert.ok(ids(organization.recorded.alarms).includes("ALM-STRAY"));
    assert.equal(organization.recorded.unplaced, 1);
    for (const scope of [{ kind: "region", id: DEMO_REGION_ID }, { kind: "substation", id: "SS-RIV" }, { kind: "feeder", id: "FD-MKT" }] as ScopeRef[]) {
      const result = (await ask(scope)).result;
      assert.ok(!ids(result.recorded.alarms).includes("ALM-STRAY"), scope.id);
      assert.equal(result.recorded.unplaced, 1, scope.id);
    }
  });

  it("says a source holds no alarms rather than implying there are none, and derives no quiet monitor from an incomplete record", async () => {
    const { result } = await scopeAlarms({ repos: sparseRepositories(), scope: { kind: "region", id: "R-1" }, period: SPARSE_PERIOD, asOf: SPARSE_AS_OF, context });
    assert.equal(result.recorded.completeness, "not_available");
    assert.deepEqual(result.recorded.alarms, []);
    assert.equal(result.derived.heartbeatCompleteness, "not_available");
    assert.equal(result.derived.devicesChecked, 0);
    assert.ok(!result.derived.conditions.some((condition) => condition.rule === "monitor_quiet"));
  });
});
