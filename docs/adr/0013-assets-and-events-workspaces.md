# ADR 0013: What "requires attention", "wrong now" and "affected" mean on the Assets and Events / Alarms workspaces

Date: 2026-10-07
Status: Accepted, with decision 7 replaced. Implemented in Phase 6c-3 as
engineering choices; at the 6c-3 checkpoint (2026-10-07) the Founder
confirmed decisions 1, 2 and 8 and changed decision 7. See "Amendment" at
the end, which replaces decision 7 and the first item of "For the Founder to
confirm".

## Context

The two workspaces answer "Which assets require attention?" and "What is
wrong now, where, and who is affected?". Each question contains a word the
engine had no definition for: *attention*, *now* for interruptions, and
*affected*. Left undefined, a screen fills the gap with a score, a guess or
a borrowed number.

## Decisions

1. **"Requires attention" is a list of facts, not a score.** An asset is
   listed when at least one of these is on it: a source alarm standing on it
   or on its monitor at the as-of time (observed); a condition GridIntel
   derived for it or its monitor in the period (calculated, ADR 0011); one
   or more interruptions attributed to the distribution network that began
   at it in the period (calculated from the outage log, ADR 0006). Each
   fact has its own column and origin. Nothing is weighted or added.
2. **The order is a fixed rule, printed on the screen**: most standing
   alarms; then conditions that hold at the as-of time; then most readings
   above rating; then most interruptions begun; then by id.
3. **An alarm or condition on a monitor is shown on the asset it monitors,
   and says "on its monitor".** This is for the Assets list only. The
   agreement relation of ADR 0011 keeps its strict "same subject" rule.
4. **Assets are power transformers, feeders and distribution transformers
   in service.** A standing alarm that names none of them (a substation as a
   whole, a name not in the registry) is counted and pointed to on the
   Events / Alarms screen, not dropped.
5. **What is not held is said.** No source supplies maintenance records,
   and the registry holds no commissioning date or condition assessment for
   these assets. The screen says "not available" for both; no asset is
   ranked by age, health or overdue work.
6. **An interruption "in progress" is read from the outage log**
   (`openExposuresAt`, `src/analytics/reliability/open.ts`): supply was lost
   at or before the as-of time and the record says it came back after it.
7. **An exposure with no restoration time is not called in progress.** It is
   either still out or a restoration nobody wrote down, and the record
   cannot say which. It is listed under its own heading, "Restoration not
   recorded", with that sentence. An exposure with no start time is counted
   and not listed.
8. **"Who is affected" is two different figures, never one.** For an
   interruption: the customers the outage record gives, with the basis the
   record states (counted, read from the network model, or a judgement).
   For an alarm or a condition: the active accounts connected behind the
   asset it names, counted from the registry, labelled "Active accounts
   behind it", with the note that it is not a count of customers without
   supply. An alarm does not say that supply was lost. For a power
   transformer it is the accounts of the feeders it carries; for a monitor,
   those behind the asset it monitors.
9. **The three lists of "what is wrong now" are never merged**: source
   alarms standing, derived conditions that hold, interruptions in
   progress. An alarm with no raise time is not called standing.
10. **"Where" reuses the drill-down.** Each substation and feeder row shows
    the lengths of the lists its own Operations screen shows.

## On the synthetic dataset

- Assets: 55 looked at, 9 listed. South Gate (DT-OLD-3) first: a
  communications alarm on its monitor and "monitor quiet" derived, in
  agreement. Riverside T1: a standing oil-temperature alarm, nothing
  derived. Riverbank (DT-OLD-2) and Government Avenue 3: above rating at 69
  and 53 readings, no source alarm raised. Five more where one
  network-attributed interruption began.
- Events: three alarms standing, one alarm with no raise time kept apart,
  one condition holding, no interruption in progress, and one exposure with
  no restoration time (a service-point complaint logged on 21 September).

## For the Founder to confirm

- **Decision 7**: an open-ended outage record is not counted as in
  progress. With live data most interruptions in progress will have no
  restoration time yet, so on a real source this rule would put them under
  "Restoration not recorded". The alternative is to treat a missing
  restoration time as "still out" when the outage log is live and complete,
  which needs the source to say so.
- **Decision 8**: "accounts behind it" for alarms, in place of "customers
  affected".
- **Decisions 1 and 2**: no score, and this order.

## Amendment (2026-10-07): an outage has a status, and open means in progress

**Founder's decision at the 6c-3 checkpoint.** Decision 7 is replaced.
Decisions 1, 2 and 8 are confirmed as written.

Decision 7 treated every outage record with no restoration time alike, as
"restoration not recorded". That is wrong for the normal case in a control
room, where an interruption in progress has no restoration time because it
has not been restored. What tells the two apart is not in the times; it is
the status the source system gives the outage.

1. **An outage carries the status its source gives it**: `Outage.status`,
   `open` or `closed`, optional. It is never inferred from the times. A
   source that does not state a status leaves it undefined.
2. **In progress** at a time: the exposure began at or before it, and either
   the record says supply came back after it, or it has no restoration time
   and the outage is `open`.
3. **Restoration not recorded**: no restoration time, and the outage is
   `closed` or has no status. This is a data-quality item. It is listed
   under its own heading, is not counted as in progress, and the screen
   says so.
4. **An outage restored in stages stays open** until its last part is back.
   A part with a restoration time at or before the as-of time is over, even
   in an open outage.
5. **A list shows one row for each outage**, with the parts still off and
   the sum of their customers (`openOutagesAt`). The sum is null when any
   part gives no count, so a partial sum is never shown as the total.
6. The status is the source's status when the record was taken. The demo
   clock is the end of the dataset, so the two coincide. With live data, a
   question asked "as of" an earlier time than the extraction would need
   the status history, which is not modelled.

### On the synthetic dataset

One outage is open at the demo clock: the 11 kV fault on Farm Road from
23:20 on 30 September, ten transformers, 1,015 customers, with its
earth-fault trip alarm standing. The 21 September complaint has no status
and stays "restoration not recorded". Portfolio energy received fell by 166
kWh (2,104,984 to 2,104,819) and revenue not realised by ₦5,146
(₦46,310,113 to ₦46,304,966); ATC&C is 31.45% on both, now printed as 31.4%
where it was 31.5%.

## Second amendment (2026-10-07): an open interruption counts, and the result is provisional

**Founder's decision.** The first amendment left the open outage out of the
reliability indices, because the methodology counted an exposure only when
it had both times. That understated what happened. It is changed:

1. **An interruption still open at the end of the period counts**, with its
   duration taken to the end of the period. The customers were without
   supply from when it began to at least then.
2. **The result is provisional**, and says so: "Provisional: includes n open
   outage(s); duration counted to period end." The marker is on SAIDI,
   SAIFI, CAIDI, ASAI and hours of supply, and stays until a restoration
   time is recorded.
3. **It is not an estimate.** The status of the figures stays "calculated";
   no input is estimated. Provisional means not final, not uncertain.
4. Only an outage the source says is **open** is treated this way. A record
   with no restoration time whose outage is closed, or has no status, is
   still excluded for missing data.
5. An open outage that began at or after the end of the period belongs to a
   later period.
6. This rests on the record having been taken at or after the end of the
   period: an outage open when the record was taken is taken to have been
   open at the period's end. A report for a period that has not ended would
   need the as-of time instead; that case is not built.
7. An open exposure is classed as sustained or momentary by its duration to
   the period's end, like any other. One that began less than five minutes
   before the period ended is therefore momentary for that period.

**Methodology versions.** `gridintel.reliability.reference` 0.3.0 (was
0.2.0); `gridintel.supply_hours.reference` 0.2.0 (was 0.1.0).

### What moved on the synthetic dataset

| Farm Road 11 kV feeder | Before | After |
| --- | --- | --- |
| SAIDI | 441.8 h | 442.5 h, provisional |
| SAIFI | 79.1 | 80.1 |
| Network-attributable SAIDI | 57.1 h | 57.8 h |
| Hours of supply per day | 9.27 | 9.25 |
| Days below the Band D minimum of 8 h | 9 of 30 | 10 of 30 (30 September fell below it) |
| Exposures excluded for missing data | 10 | 0 |

The difference in SAIDI is 0.67 h: 40 minutes for every one of the feeder's
1,015 customers. Hillcrest's network SAIDI rose from 22.8 h to 23.1 h and
the portfolio's SAIDI from 240.9 h to 241.0 h; both are provisional. No
figure at Riverside moved.

**The synthetic Farm Road report was changed with it**, from 0.4 h and 0.2
to 1.0 h and 1.1, so that it still agrees with the records on its own
attribution rule: the designed case there is "no difference on the report's
own rule", and a report for the month would count the fault too. What the
rule changes is unchanged: +56.7 h.
