import type { Alarm, AssetRef, DataQuality, DeviceHeartbeat, IsoTimestamp, MethodologyRef, Severity } from "@/domain";
import type { ConditionParameters, Methodology } from "../core/methodology.ts";
import type { CalculationContext } from "../core/result.ts";
import type { LoadingResult } from "../loading/loading.ts";
import type { PeakLoadingResult } from "../loading/peak.ts";
import { CONDITIONS_REFERENCE, LOADING_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { MS_PER_MINUTE, toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — ALARMS AND DERIVED CONDITIONS

   Two different things, never mixed:

   - An ALARM is a record from a source system (a SCADA alarm list,
     a relay, a transformer monitor). It is OBSERVED. GridIntel does
     not decide whether it is true; it only says whether it was
     active at a given time, from the times the source recorded.

   - A DERIVED CONDITION is something GridIntel works out from
     telemetry under a named rule (loading above rating, a monitor
     gone quiet). It is CALCULATED. It names its rule and methodology
     and is never stored or shown as an alarm.

   One asset can have both at once. They are returned as separate
   lists, and nothing here merges, deduplicates or reconciles them:
   a derived condition is not evidence that an alarm was missed, and
   an alarm is not evidence that a condition holds.
========================================================== */

/* ---------------- Alarms: state at a time ---------------- */

/**
 * - active: raised at or before the time and not cleared by it;
 * - cleared: raised and cleared at or before the time;
 * - not_yet_raised: raised after the time;
 * - time_not_recorded: the source did not record when it was raised, so
 *   its state at any time cannot be told. It is never assumed active.
 */
export type AlarmState = "active" | "cleared" | "not_yet_raised" | "time_not_recorded";

export function alarmState(alarm: Alarm, at: IsoTimestamp): AlarmState {
  const atMs = toEpochMs(at);
  const raisedMs = alarm.raisedAt === undefined ? null : toEpochMs(alarm.raisedAt);
  if (atMs === null || raisedMs === null) return "time_not_recorded";
  if (raisedMs > atMs) return "not_yet_raised";
  if (alarm.clearedAt === undefined) return "active";
  const clearedMs = toEpochMs(alarm.clearedAt);
  // A clear time that cannot be read is not a clear: the alarm stays active.
  return clearedMs !== null && clearedMs <= atMs ? "cleared" : "active";
}

const SEVERITY_ORDER: readonly Severity[] = ["critical", "high", "medium", "low", "info"];

/** 0 for the most severe. An explicit ranking: severities are never compared as strings. */
export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

export interface ClassifiedAlarm {
  alarm: Alarm;
  state: AlarmState;
}

/**
 * Alarms with their state at `at`, in the order a list shows them: active
 * first, then those whose time is not recorded, then cleared; within each,
 * most severe first, then most recently raised, then by id.
 */
export function classifyAlarms(alarms: readonly Alarm[], at: IsoTimestamp): ClassifiedAlarm[] {
  const order: Record<AlarmState, number> = { active: 0, time_not_recorded: 1, cleared: 2, not_yet_raised: 3 };
  const raised = (alarm: Alarm) => (alarm.raisedAt === undefined ? null : toEpochMs(alarm.raisedAt)) ?? -Infinity;
  return alarms
    .map((alarm) => ({ alarm, state: alarmState(alarm, at) }))
    .sort(
      (a, b) =>
        order[a.state] - order[b.state] ||
        severityRank(a.alarm.severity) - severityRank(b.alarm.severity) ||
        raised(b.alarm) - raised(a.alarm) ||
        (a.alarm.id < b.alarm.id ? -1 : a.alarm.id > b.alarm.id ? 1 : 0),
    );
}

/* ---------------- Derived conditions ---------------- */

export type ConditionRuleId = "loading_above_rating" | "monitor_quiet";

export interface ConditionRule {
  id: ConditionRuleId;
  name: string;
  /** The rule in words, as it is shown wherever a condition is. */
  statement: string;
}

/** The rules, with the methodology's own parameters written into their statements. */
export function conditionRules(methodology: Methodology<ConditionParameters> = CONDITIONS_REFERENCE): Record<ConditionRuleId, ConditionRule> {
  const threshold = LOADING_REFERENCE.parameters.overloadThreshold * 100;
  return {
    loading_above_rating: {
      id: "loading_above_rating",
      name: "Loaded above rating",
      statement: `Loading (apparent power ÷ rated capacity, or highest phase current ÷ rated current) was above ${threshold}% of rating at one or more telemetry readings in the period.`,
    },
    monitor_quiet: {
      id: "monitor_quiet",
      name: "Monitor quiet",
      statement: `The device's last check-in is more than ${methodology.parameters.quietAfterMinutes} minutes before the as-of time, or no check-in from it is held.`,
    },
  };
}

export interface DerivedCondition {
  kind: "derived_condition";
  rule: ConditionRuleId;
  subject: AssetRef;
  asOf: IsoTimestamp;
  /** Whether the condition holds at the as-of time; null when that cannot be told. */
  activeAtAsOf: boolean | null;
  /** The first and last time the condition was seen to hold. For a quiet monitor, both are its last check-in. */
  firstAt: IsoTimestamp | null;
  lastAt: IsoTimestamp | null;
  /** Readings at which the condition held; null where the rule does not count readings. */
  occurrences: number | null;
  /** The rule's figure: the peak loading as a fraction of rating, or minutes since the last check-in. */
  value: number | null;
  unit: "fraction" | "minutes";
  /** What `value` is tested against, in the same unit. */
  threshold: number;
  quality: DataQuality | null;
  methodology: MethodologyRef;
  computedAt: IsoTimestamp;
}

/**
 * "Loaded above rating", from the loading already calculated over a period
 * and at the as-of time. Null when no reading in the period was above the
 * threshold: no condition, not a condition of zero.
 */
export function loadingCondition(params: { peak: PeakLoadingResult; now: LoadingResult; context: CalculationContext }): DerivedCondition | null {
  const { peak, now, context } = params;
  if (peak.peak === null || peak.instantsOverloaded <= 0) return null;
  const threshold = LOADING_REFERENCE.parameters.overloadThreshold;
  return {
    kind: "derived_condition",
    rule: "loading_above_rating",
    subject: peak.peak.asset,
    asOf: now.asOf,
    activeAtAsOf: now.status === "ok" && now.loadingFraction !== null ? now.loadingFraction > threshold : null,
    firstAt: peak.firstOverloadedAt,
    lastAt: peak.lastOverloadedAt,
    occurrences: peak.instantsOverloaded,
    value: peak.peak.loadingFraction,
    unit: "fraction",
    threshold,
    quality: peak.peak.quality,
    methodology: peak.peak.methodology,
    computedAt: context.computedAt,
  };
}

/**
 * "Monitor quiet", from a device's check-ins up to the as-of time. Null
 * when the last check-in is recent enough. The caller must pass every
 * check-in it holds for the device: with none, the device is reported as
 * quiet with no last check-in, which is only true if the heartbeat record
 * is complete.
 */
export function quietMonitorCondition(params: {
  device: AssetRef;
  heartbeats: readonly DeviceHeartbeat[];
  asOf: IsoTimestamp;
  methodology?: Methodology<ConditionParameters>;
  context: CalculationContext;
}): DerivedCondition | null {
  const { device, asOf, context } = params;
  const methodology = params.methodology ?? CONDITIONS_REFERENCE;
  const threshold = methodology.parameters.quietAfterMinutes;
  const asOfMs = toEpochMs(asOf);
  if (asOfMs === null) return null;

  let last: { ms: number; at: IsoTimestamp } | null = null;
  for (const heartbeat of params.heartbeats) {
    if (heartbeat.device.kind !== device.kind || heartbeat.device.id !== device.id) continue;
    const ms = toEpochMs(heartbeat.receivedAt);
    if (ms === null || ms > asOfMs) continue;
    if (last === null || ms > last.ms) last = { ms, at: heartbeat.receivedAt };
  }

  const minutes = last === null ? null : (asOfMs - last.ms) / MS_PER_MINUTE;
  if (minutes !== null && minutes <= threshold) return null;
  return {
    kind: "derived_condition",
    rule: "monitor_quiet",
    subject: device,
    asOf,
    activeAtAsOf: true,
    firstAt: last?.at ?? null,
    lastAt: last?.at ?? null,
    occurrences: null,
    value: minutes,
    unit: "minutes",
    threshold,
    quality: "measured",
    methodology: methodologyRef(methodology),
    computedAt: context.computedAt,
  };
}

/** Conditions in the order a list shows them: active at the as-of time first, then most recent, then by subject. */
export function sortConditions(conditions: readonly DerivedCondition[]): DerivedCondition[] {
  const last = (condition: DerivedCondition) => (condition.lastAt === null ? null : toEpochMs(condition.lastAt)) ?? -Infinity;
  return [...conditions].sort(
    (a, b) =>
      Number(b.activeAtAsOf === true) - Number(a.activeAtAsOf === true) ||
      last(b) - last(a) ||
      (a.subject.id < b.subject.id ? -1 : a.subject.id > b.subject.id ? 1 : 0) ||
      (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0),
  );
}
