# ADR 0013: What "requires attention", "wrong now" and "affected" mean on the Assets and Events / Alarms workspaces

Date: 2026-10-07
Status: Implemented in Phase 6c-3 as engineering choices. **Three of them
touch what a figure is said to mean; the Founder is asked to confirm them at
the 6c-3 checkpoint** (see the end).

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
