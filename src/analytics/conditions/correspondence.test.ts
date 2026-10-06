import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Alarm, AlarmKind, EntityRef } from "@/domain";
import type { DerivedCondition } from "./conditions.ts";
import { CONTEXT, PROVENANCE } from "../__fixtures__/network.ts";
import { classifyAlarms, conditionKey } from "./conditions.ts";
import { RULE_ALARM_KIND, alarmCorrespondence, alarmKindName, relateToSourceAlarms } from "./correspondence.ts";

const AS_OF = "2026-01-02T00:00:00Z";
const DEVICE: EntityRef = { kind: "edge_device", id: "ED-1" };
const TRANSFORMER: EntityRef = { kind: "distribution_transformer", id: "DT-1" };

const alarm = (id: string, subject: EntityRef, kind: AlarmKind | undefined, raisedAt?: string, clearedAt?: string): Alarm => ({
  id,
  subject,
  code: id,
  ...(kind === undefined ? {} : { kind }),
  severity: "medium",
  message: id,
  ...(raisedAt === undefined ? {} : { raisedAt }),
  ...(clearedAt === undefined ? {} : { clearedAt }),
  quality: "measured",
  provenance: PROVENANCE,
});

const base = { kind: "derived_condition" as const, asOf: AS_OF, quality: null, methodology: { id: "m", version: "1" }, computedAt: CONTEXT.computedAt };
const QUIET: DerivedCondition = { ...base, rule: "monitor_quiet", subject: { kind: "edge_device", id: "ED-1" }, activeAtAsOf: true, firstAt: "2026-01-01T14:55:00Z", lastAt: "2026-01-01T14:55:00Z", occurrences: null, value: 545, unit: "minutes", threshold: 120 };
const LOADED: DerivedCondition = { ...base, rule: "loading_above_rating", subject: { kind: "distribution_transformer", id: "DT-1" }, activeAtAsOf: false, firstAt: "2026-01-01T10:00:00Z", lastAt: "2026-01-01T12:00:00Z", occurrences: 3, value: 1.1, unit: "fraction", threshold: 1 };

const relate = (condition: DerivedCondition, alarms: Alarm[], alarmRecordComplete = true) =>
  relateToSourceAlarms({ condition, alarms: classifyAlarms(alarms, AS_OF), alarmRecordComplete });

describe("whether a source alarm agrees with a derived condition", () => {
  it("names the kind of source alarm each rule corresponds to", () => {
    assert.deepEqual(RULE_ALARM_KIND, { loading_above_rating: "overload", monitor_quiet: "communications_failure" });
    assert.equal(alarmKindName("communications_failure"), "communications failure");
    assert.equal(conditionKey(QUIET), "monitor_quiet:ED-1");
  });

  it("agrees when an alarm of the matching kind stands on the same subject while the condition holds", () => {
    assert.deepEqual(relate(QUIET, [alarm("comms", DEVICE, "communications_failure", "2026-01-01T16:55:00Z")]), {
      status: "agrees",
      kind: "communications_failure",
      alarmIds: ["comms"],
    });
    // A loading condition held between its first and last reading above rating; the alarm stood at some time between.
    assert.equal(relate(LOADED, [alarm("ovl", TRANSFORMER, "overload", "2026-01-01T11:30:00Z", "2026-01-01T13:00:00Z")]).status, "agrees");
    assert.equal(relate(LOADED, [alarm("ovl", TRANSFORMER, "overload", "2026-01-01T09:00:00Z")]).status, "agrees");
    // Raised at the last reading, or cleared at the first: it stood at that instant.
    assert.equal(relate(LOADED, [alarm("ovl", TRANSFORMER, "overload", "2026-01-01T12:00:00Z")]).status, "agrees");
    assert.equal(relate(LOADED, [alarm("ovl", TRANSFORMER, "overload", "2026-01-01T08:00:00Z", "2026-01-01T10:00:00Z")]).status, "agrees");
  });

  it("says none was raised when the record is complete and holds no such alarm", () => {
    assert.deepEqual(relate(LOADED, []), { status: "none_raised", kind: "overload" });
    // An alarm of another kind on the same asset is not the alarm asked about.
    assert.equal(relate(LOADED, [alarm("fuse", TRANSFORMER, "loss_of_supply", "2026-01-01T11:00:00Z")]).status, "none_raised");
    // Nor is an alarm of the right kind on another subject, even the asset the device is attached to.
    assert.equal(relate(QUIET, [alarm("other", { kind: "edge_device", id: "ED-2" }, "communications_failure", "2026-01-01T16:00:00Z")]).status, "none_raised");
    assert.equal(relate(QUIET, [alarm("on-asset", TRANSFORMER, "communications_failure", "2026-01-01T16:00:00Z")]).status, "none_raised");
    assert.equal(relate(QUIET, [alarm("label", { kind: "edge_device", label: "ED-1" }, "communications_failure", "2026-01-01T16:00:00Z")]).status, "none_raised");
  });

  it("does not count an alarm that was not standing while the condition held", () => {
    // Cleared before the as-of time: the monitor is quiet now, and no alarm stands now.
    assert.equal(relate(QUIET, [alarm("old", DEVICE, "communications_failure", "2026-01-01T03:00:00Z", "2026-01-01T03:30:00Z")]).status, "none_raised");
    // Raised after the last reading above rating, or cleared before the first.
    assert.equal(relate(LOADED, [alarm("late", TRANSFORMER, "overload", "2026-01-01T12:00:01Z")]).status, "none_raised");
    assert.equal(relate(LOADED, [alarm("early", TRANSFORMER, "overload", "2026-01-01T08:00:00Z", "2026-01-01T09:59:59Z")]).status, "none_raised");
  });

  it("cannot tell, and says why, rather than report that none was raised", () => {
    assert.deepEqual(relate(LOADED, [], false), { status: "cannot_tell", kind: "overload", reason: "alarm_record_incomplete", alarmIds: [] });
    assert.deepEqual(relate(QUIET, [alarm("undated", DEVICE, "communications_failure")]), { status: "cannot_tell", kind: "communications_failure", reason: "undated_alarm", alarmIds: ["undated"] });
    // A code the adapter could not map may or may not be the alarm asked about.
    assert.deepEqual(relate(LOADED, [alarm("unmapped", TRANSFORMER, undefined, "2026-01-01T11:00:00Z")]), { status: "cannot_tell", kind: "overload", reason: "unclassified_alarm", alarmIds: ["unmapped"] });
    assert.deepEqual(relate({ ...LOADED, firstAt: null, lastAt: null }, [alarm("ovl", TRANSFORMER, "overload", "2026-01-01T11:00:00Z")]), {
      status: "cannot_tell",
      kind: "overload",
      reason: "condition_time_unknown",
      alarmIds: ["ovl"],
    });
  });

  it("agrees on what it can see even when the record is incomplete", () => {
    assert.equal(relate(QUIET, [alarm("comms", DEVICE, "communications_failure", "2026-01-01T16:55:00Z")], false).status, "agrees");
  });

  it("relates every condition, and points each agreed alarm back at its condition, moving nothing", () => {
    const alarms = classifyAlarms([alarm("comms", DEVICE, "communications_failure", "2026-01-01T16:55:00Z"), alarm("fuse", TRANSFORMER, "loss_of_supply", "2026-01-01T11:00:00Z")], AS_OF);
    const conditions = [QUIET, LOADED];
    const result = alarmCorrespondence({ conditions, alarms, alarmRecordComplete: true });
    assert.deepEqual(result.byCondition, {
      "monitor_quiet:ED-1": { status: "agrees", kind: "communications_failure", alarmIds: ["comms"] },
      "loading_above_rating:DT-1": { status: "none_raised", kind: "overload" },
    });
    assert.deepEqual(result.agreedBy, { comms: ["monitor_quiet:ED-1"] });
    assert.equal(alarms.length, 2);
    assert.equal(conditions.length, 2);
  });
});
