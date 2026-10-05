# ADR 0011: Alarms from source systems and conditions derived by GridIntel

Date: 2026-10-05
Status: Accepted (Founder decision at the Phase 6c-1 checkpoint). Implemented
in Phase 6c-2.

## Context

The screens showed an explicit "alarms: not available" state, because the
platform held no alarm data. Before building an Events / Alarms workspace the
question was what an alarm is: a record from a source system, or something
GridIntel works out from telemetry (a transformer over its rating, a monitor
that has stopped reporting).

They are different kinds of thing under the data-truth rule. The first is
observed. The second is calculated. Shown as one list, a calculated condition
would pass for an alarm someone's system raised, and a missing source alarm
would look like a system that is quiet.

## Decision

Both, never mixed.

1. **An alarm is a record from a source system.** `Alarm` (domain) is held
   as the source wrote it. A new port method, `EventRepository.listAlarms`,
   returns alarms standing in or raised during a period, with the source's
   completeness. GridIntel reports an alarm's state at a time from the times
   the source recorded (`alarmState`); it does not decide whether the alarm
   is true. An alarm with no raise time is returned and listed as "time not
   recorded". It is never assumed to be active.
2. **A derived condition is calculated by GridIntel under a named rule**
   (`src/analytics/conditions`). It is a `DerivedCondition`, not an `Alarm`:
   a different type, with the rule and the methodology that produced it. It
   is never stored, and never returned by the alarm port.
3. **They are separate lists everywhere**: separate results from the service
   (`scopeAlarms`), separate parts of the view model, separate headings on
   the screen, each with its own origin (measured, calculated). Nothing
   merges, deduplicates or reconciles them. An asset can have both at once.
   A derived condition is not evidence that an alarm was missed, and an
   alarm is not evidence that a condition holds.
4. **Every derived condition is labelled with its rule**, and the rule is
   printed in words wherever conditions are listed, with its thresholds.

### The rules, version 0.1.0

| Rule | Statement | From |
| --- | --- | --- |
| Loaded above rating | Loading was above 100% of rating at one or more telemetry readings in the period | The reference loading methodology, over the period and at the as-of time |
| Monitor quiet | The device's last check-in is more than 120 minutes before the as-of time, or no check-in from it is held | Device heartbeats; `gridintel.conditions.reference` |

A condition says how often it held, when first and last, its figure (peak
loading; time since the last check-in) and whether it holds at the as-of
time. 120 minutes is two missed check-ins of a device that reports hourly;
it is a parameter of the methodology.

"Monitor quiet" is derived only when the heartbeat record is complete. From a
partial record a missing check-in may only be a missing record, and the
screen says that the rule could not be applied.

### Which scope an alarm belongs to

An alarm is under a scope when the asset it names sits under that scope in
the current topology (`placeOfAsset`). A power transformer is in its
substation and on no feeder. A monitoring device is where its asset is. An
alarm on a name not matched to the registry belongs to no electrical scope:
it is listed at organization level only and counted as unplaced, so it is
seen once and never guessed into a place.

## Also decided: power transformers have a loading

The synthetic dataset gains hourly apparent power for each power
transformer, as a substation's remote terminal unit would read it: the
demand of the feeders on its bus section, with the substation's own loss.
The loading calculation accepts a power transformer, and the substation
screen lists each with what it carries and its loading.

## On the synthetic dataset

- **29 alarms.** 26 follow from the outage log, so the two agree: one for
  each unplanned interruption that protection or a monitor would see (19
  losses of Hillcrest's rural 33 kV line, the Riverside line fault, three
  feeder faults, three transformer or low-voltage faults), raised when
  supply was lost and cleared when the last part was restored. Load shedding
  and planned work raise none. Three more exercise the states a list must
  show: one standing and unacknowledged, one standing and acknowledged, one
  with no raise time.
- **The source systems raise no overload alarm and no communications
  alarm.** That is deliberate and realistic, and it is why the two derived
  rules exist. Riverbank (DT-OLD-2) therefore has one of each: a recorded
  alarm for its blown fuses and a derived loading condition.
- **Three derived conditions.** DT-OLD-2 above rating at 69 hourly readings
  and DT-GOV-3 at 53; the monitor on DT-OLD-3 quiet for 9 h 05 min at the
  demo clock. None of the loading conditions holds at the demo clock, which
  is midnight.
- **Power transformer peak loading:** Riverside T1 72.2% of 5 MVA, Hillcrest
  T1 55.7% of 5 MVA, Hillcrest T2 24.8% of 2.5 MVA.

## What is not done here

The Events / Alarms workspace itself is Phase 6c-3. What 6c-2 puts in place
is the data, the engine and one panel on the existing screens, which lists
active alarms, undated alarms, the six most recently raised of the cleared
ones with their total, and the derived conditions. Nothing can be
acknowledged or assigned: the platform is read-only.
