import type { AlarmKind, EntityRef } from "@/domain";
import type { ClassifiedAlarm, ConditionRuleId, DerivedCondition } from "./conditions.ts";
import { toEpochMs } from "../core/time.ts";
import { conditionKey } from "./conditions.ts";

/* ==========================================================
   ANALYTICS — WHETHER A SOURCE ALARM AGREES WITH A CONDITION

   Alarms and derived conditions stay two lists. This says how an
   entry in one relates to entries in the other; it moves, merges and
   removes nothing.

   Each rule names the KIND of source alarm that is about the same
   thing: a quiet monitor and a communications failure; loading above
   rating and an overload alarm. For a condition, the source alarms
   of that kind ON THE SAME SUBJECT are looked for:

   - agrees: one was standing while the condition held;
   - none_raised: none was, and the source's alarm record is complete,
     so that can be said;
   - cannot_tell: it cannot be said, for the reason given.

   "None raised" is a fact about the record. It is not a finding that
   a source system failed: a source that has no alarm of that kind
   raises none. And an alarm with no condition beside it is not
   contradicted: GridIntel derives conditions under these rules only.
========================================================== */

/** The kind of source alarm that is about the same thing as each rule. */
export const RULE_ALARM_KIND: Record<ConditionRuleId, AlarmKind> = {
  loading_above_rating: "overload",
  monitor_quiet: "communications_failure",
};

const ALARM_KIND_NAME: Record<AlarmKind, string> = {
  communications_failure: "communications failure",
  overcurrent_trip: "overcurrent trip",
  earth_fault_trip: "earth-fault trip",
  loss_of_supply: "loss of supply",
  overload: "overload",
  equipment: "equipment condition",
};

/** An alarm kind in words, as a screen shows it. */
export function alarmKindName(kind: AlarmKind): string {
  return ALARM_KIND_NAME[kind];
}

/**
 * Why it cannot be said whether a source alarm was raised:
 * - alarm_record_incomplete: the source's alarm record is partial or not
 *   held, so an alarm that is not listed may still exist;
 * - undated_alarm: an alarm of the kind is on the subject, but the source
 *   did not record when it was raised;
 * - unclassified_alarm: an alarm on the subject carries a code that is not
 *   mapped to a kind, so it may or may not be of this kind;
 * - condition_time_unknown: when the condition held is not known.
 */
export type CannotTellReason = "alarm_record_incomplete" | "undated_alarm" | "unclassified_alarm" | "condition_time_unknown";

export type SourceAlarmRelation =
  | { status: "agrees"; kind: AlarmKind; alarmIds: string[] }
  | { status: "none_raised"; kind: AlarmKind }
  | { status: "cannot_tell"; kind: AlarmKind; reason: CannotTellReason; alarmIds: string[] };

function sameSubject(subject: EntityRef, condition: DerivedCondition): boolean {
  return "id" in subject && subject.kind === condition.subject.kind && subject.id === condition.subject.id;
}

/**
 * Whether an alarm was standing while the condition held; null when that
 * cannot be told. A quiet monitor holds at the as-of time, so the alarm
 * must be active then. A loading condition held between its first and last
 * reading above rating, so the alarm must have stood at some time between.
 */
function stoodWhileHeld({ alarm, state }: ClassifiedAlarm, condition: DerivedCondition): boolean | null {
  if (state === "time_not_recorded") return null;
  if (condition.rule === "monitor_quiet") return state === "active";
  const firstMs = condition.firstAt === null ? null : toEpochMs(condition.firstAt);
  const lastMs = condition.lastAt === null ? null : toEpochMs(condition.lastAt);
  const raisedMs = alarm.raisedAt === undefined ? null : toEpochMs(alarm.raisedAt);
  if (firstMs === null || lastMs === null || raisedMs === null) return null;
  const clearedMs = alarm.clearedAt === undefined ? null : toEpochMs(alarm.clearedAt);
  // A clear time that cannot be read is not a clear.
  return raisedMs <= lastMs && (clearedMs === null || clearedMs >= firstMs);
}

export function relateToSourceAlarms(params: {
  condition: DerivedCondition;
  /** Every alarm the source holds for the period, with its state at the condition's as-of time. */
  alarms: readonly ClassifiedAlarm[];
  /** Whether the source's alarm record is complete. Only then does finding no alarm mean none was raised. */
  alarmRecordComplete: boolean;
}): SourceAlarmRelation {
  const { condition, alarmRecordComplete } = params;
  const kind = RULE_ALARM_KIND[condition.rule];
  const onSubject = params.alarms.filter((entry) => sameSubject(entry.alarm.subject, condition));
  const ofKind = onSubject.filter((entry) => entry.alarm.kind === kind);
  const ids = (entries: readonly ClassifiedAlarm[]) => entries.map((entry) => entry.alarm.id).sort();

  const standing = ofKind.filter((entry) => stoodWhileHeld(entry, condition) === true);
  if (standing.length > 0) return { status: "agrees", kind, alarmIds: ids(standing) };

  const untimed = ofKind.filter((entry) => stoodWhileHeld(entry, condition) === null);
  if (untimed.length > 0) {
    const undated = untimed.filter((entry) => entry.state === "time_not_recorded");
    return undated.length > 0
      ? { status: "cannot_tell", kind, reason: "undated_alarm", alarmIds: ids(undated) }
      : { status: "cannot_tell", kind, reason: "condition_time_unknown", alarmIds: ids(untimed) };
  }

  const unclassified = onSubject.filter((entry) => entry.alarm.kind === undefined);
  if (unclassified.length > 0) return { status: "cannot_tell", kind, reason: "unclassified_alarm", alarmIds: ids(unclassified) };
  if (!alarmRecordComplete) return { status: "cannot_tell", kind, reason: "alarm_record_incomplete", alarmIds: [] };
  return { status: "none_raised", kind };
}

export interface AlarmCorrespondence {
  /** For each condition, by `conditionKey`: how the source's alarm record relates to it. */
  byCondition: Record<string, SourceAlarmRelation>;
  /** For each alarm a condition agrees with, by alarm id: the keys of those conditions. */
  agreedBy: Record<string, string[]>;
}

/** The relation of every condition to the alarms, and from each agreed alarm back to its conditions. */
export function alarmCorrespondence(params: {
  conditions: readonly DerivedCondition[];
  alarms: readonly ClassifiedAlarm[];
  alarmRecordComplete: boolean;
}): AlarmCorrespondence {
  const byCondition: Record<string, SourceAlarmRelation> = {};
  const agreedBy: Record<string, string[]> = {};
  for (const condition of params.conditions) {
    const key = conditionKey(condition);
    const relation = relateToSourceAlarms({ condition, alarms: params.alarms, alarmRecordComplete: params.alarmRecordComplete });
    byCondition[key] = relation;
    if (relation.status !== "agrees") continue;
    for (const id of relation.alarmIds) (agreedBy[id] ??= []).push(key);
  }
  return { byCondition, agreedBy };
}
