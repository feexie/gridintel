# ADR 0010: A register advance counts toward recorded consumption

Date: 2026-10-05
Status: Accepted (Founder decision at the Phase 6c-1 checkpoint;
data-integrity semantics). Implemented in Phase 6c-2.

## Context

ADR 0009 gave each kind of customer meter only what it can report. A
postpaid meter that is not an AMI meter holds two readings of its register:
one at the start of the month and one at the month-end reading round. The
difference, the register advance, is measured consumption.

As first implemented, the recorded-consumption cross-check counted interval
energy only. A register advance was left out, because it covers the time
between two readings and not the period, and using it needed a rule for how
far from the period's ends a reading may be. That rule had not been decided.
The effect was that 1,425 connections with a measured figure were treated as
if nothing were known about them.

## Decision

1. **A register advance counts toward a period's recorded consumption when
   both of its readings fall within 3 days of the period's ends**: the
   opening reading within 3 days of the start, the closing reading within
   3 days of the end, on either side of that end. A reading taken a day
   before the period begins is last month's closing reading and opens this
   month, as it does in practice.
2. **No pro-rating.** The advance is used exactly as read. A meter read two
   days before the end of the month contributes what it registered up to
   that reading and nothing for the two days after. It is not stretched to
   the period, and nothing is added for the gap.
3. **It is its own measured source.** Interval energy and register advances
   are two sources, kept apart. Each has its own figure and its own count of
   connections covered (`EnergyAccount.recordedBySource`,
   `consumptionCoverage`). Neither figure is the consumption of the scope,
   and the screen says so beside each.
4. **Outside the window: excluded, with the reason.** Nothing stands in for
   an excluded advance. The connection is counted as "register advance not
   counted", and the reasons are listed with their counts.
5. **The window is a parameter of the methodology**
   (`EnergyParameters.registerReadingWindowDays`, 3 in the reference
   methodology), not a constant in the code that uses it. The reference
   energy methodology is now version `0.2.0`.
6. Where several readings lie within the window of an end, the one nearest
   that end is used.

## The total

"Recorded consumption" as a single total still exists only where every
connection under the scope is covered by one source or the other. A
connection with no meter, a prepaid meter that is not read, a meter with a
gap in its intervals or an excluded advance leaves the total unavailable.
This is unchanged: what is not measured is not known, and is not taken as
zero. What is new is that the two partial figures are shown, each with the
connections it covers.

## An advance resting on an estimated reading is not counted

This was not stated in the Founder's decision and is the engineer's reading
of it; it is raised at the checkpoint.

The decision makes the register advance a *measured* source. Where the round
did not reach a meter, the billing system estimates the closing reading. That
advance is an estimate, not a measurement, so it is excluded from the
measured source, with the reason "a reading was estimated, not read from the
meter". The alternative is to count it and mark the register figure as
partly estimated. That would put estimates under the heading "Measured
cross-checks". The bill raised on the estimated reading is unaffected: it is
still in energy billed, as an estimated charge.

## What does not change

- The accounting chain. Energy received, technical loss, energy delivered,
  energy billed, unbilled energy, ATC&C and the revenue gap read no customer
  meter and do not move.
- "Downstream measured" at a distribution transformer, which is the sum of
  its customers' interval meters. A register advance is not interval energy
  and is not a boundary measurement; that cross-check still needs intervals.
- Energy purchased on prepaid vends is still shown apart and is never added
  to recorded consumption.
- The service-point screen still shows the advance between the two readings
  held for the period. It now also says whether that advance counts toward
  the recorded consumption of the levels above, and why not when it does
  not.

## On the synthetic dataset

Every opening reading is at the first instant of the month and every closing
reading at 23:00 on 30 September, so none is outside the window. The
exclusions on screen are the 138 readings the round missed. The window rule
itself is covered by unit tests with readings on, inside and outside its
edge; no synthetic reading exercises it. Giving the synthetic reading round
a spread of days would, and would also move energy billed. That is a dataset
decision and has not been taken.

Region, September 2026, 6,448 connections:

| Group | Before | After |
| --- | --- | --- |
| Recorded by interval meters | 287 | 287 connections, 404,652 kWh |
| Intervals incomplete | 1 | 1 |
| Recorded by register advance | not counted | 1,287 connections, 371,055 kWh |
| Register advance not counted | not counted | 138 (estimated reading) |
| Meter not read | 3,965 "no interval data" | 2,540 |
| No meter | 2,195 | 2,195 |

The 2,540 are the 2,518 ordinary prepaid meters and 22 postpaid meters on
disconnected accounts, for which no reading is held.

No status changed at any scope. The cross-checks are `ok` on DT-MKT-3 (all
AMI) and `insufficient_data` everywhere else, as before, because every other
section has prepaid meters that are not read or connections with no meter.
