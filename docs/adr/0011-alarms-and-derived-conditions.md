# ADR 0011: Alarms from source systems and conditions derived by GridIntel

Date: 2026-10-05
Status: Accepted (Founder decision at the Phase 6c-1 checkpoint). Implemented
in Phase 6c-2. Amended 2026-10-06 (Founder decision at the Phase 6c-2
checkpoint): see "Amendment" at the end, which replaces the last sentence of
decision 3 and the second bullet of "On the synthetic dataset".

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

## Amendment (2026-10-06): source alarms of the kinds SCADA raises, and agreement

**Founder's decision at the 6c-2 checkpoint.** The synthetic source alarms
are to include the kinds a real SCADA raises (RTU communications failure,
feeder overcurrent trip), and the data is to show both cases on screen: a
source alarm that a derived condition agrees with, and a derived condition
that no source alarm raised.

This reverses the 6c-2 choice that "the source systems raise no overload
alarm and no communications alarm", and it needs something decision 3 ruled
out: saying how an entry in one list relates to an entry in the other.

### What changes

1. **The lists are still two, and still never merged.** Decision 3 stands
   except for its last sentence. Nothing is moved, removed or deduplicated.
2. **An alarm has a kind.** `Alarm.kind` (domain, optional) says what the
   alarm is about in GridIntel's vocabulary: communications failure,
   overcurrent trip, earth-fault trip, loss of supply, overload, equipment.
   The adapter for a source maps each code it knows; the source's own code
   is kept beside it. A code with no mapping has no kind, and none is
   guessed from the message.
3. **Each rule names the kind of source alarm that is about the same
   thing.** Monitor quiet: communications failure. Loaded above rating:
   overload.
4. **Each derived condition says whether such an alarm stood beside it**
   (`relateToSourceAlarms`, `src/analytics/conditions/correspondence.ts`;
   conditions methodology 0.2.0). The alarm must be of the rule's kind, on
   the same subject, and standing while the condition held: at the as-of
   time for a quiet monitor, at some time between the first and last
   reading above rating for a loading condition.

   | Result | Meaning |
   | --- | --- |
   | Agrees | Such an alarm stood. The condition names it; the alarm names the condition. Each stays in its own list |
   | None raised | No such alarm stood, **and the source's alarm record is complete** |
   | Cannot tell | The record is partial or not held; or an alarm of the kind is on the subject with no raise time; or an alarm on the subject has a code not mapped to a kind; or when the condition held is not known |

5. **What the results do not mean.** "None raised" is a fact about the
   record. It is not a finding that a source system failed: a source with no
   alarm of that kind raises none. An alarm with no condition beside it is
   not contradicted: GridIntel derives conditions under two rules only, and
   "monitor quiet" tests the as-of time only. Agreement is two independent
   observations of the same thing; it does not make the condition measured
   or the alarm calculated.
6. **"Same subject" is strict.** A communications alarm written against the
   transformer, when the condition is on the transformer's monitor, does not
   agree. Matching across related assets would be a guess about what the
   source meant.

### On the synthetic dataset, now

- **31 alarms.** The 26 from the outage log, the three state cases, and two
  communications failures.
- **The SCADA front end polls every remote unit**, substation RTUs and
  transformer monitors alike, and raises `RTU-COMMS-FAIL` for any that misses
  two consecutive polls.
  - *Agreement.* The monitor on DT-OLD-3 last checked in at 14:55 on 30
    September. The source alarm is raised at 16:55, is acknowledged, and is
    standing at the demo clock. GridIntel derives "monitor quiet" for the
    same device from the heartbeats. The source's rule (two missed hourly
    polls) and the reference rule (120 minutes) happen to coincide; they are
    stated separately because they are two rules.
  - *A source alarm with nothing derived beside it.* Riverside's RTU lost
    its link from 10:08 to 10:41 on 12 September, between two hourly
    readings, so no reading is missing. Cleared.
- **Feeder trips name the protection that operated.** `FDR-OC-TRIP`
  (overcurrent): the Market Road trip and reclose, and the Government Avenue
  cable fault, which locked out. `FDR-EF-TRIP` (earth fault): the Old Town
  conductor down. They replace `FDR-TRIP-RECLOSE` and `FDR-TRIP-LOCKOUT`.
  The outage log is unchanged, so no reliability figure moved. No rule
  corresponds to a trip, so no condition is set beside one.
- **Still no overload alarm**, which is the realistic case. DT-GOV-3 (the
  designed daytime overload, 53 readings) and DT-OLD-2 (69) are therefore
  derived conditions that no source alarm raised, and the screen can say so
  because the synthetic alarm record is complete.
- **The alarm entered by hand** (`DOOR-OPEN`) has a code that is not mapped,
  and so has no kind.

### A choice made here, for the Founder to confirm

The agreement case is on a transformer monitor, not on a substation RTU. A
substation RTU silent at the demo clock would also have to stop sending that
substation's telemetry, which would make the loading of every feeder and
power transformer there stale at the as-of time. That is a realistic and
useful case, but it moves figures on four screens and was not asked for.
