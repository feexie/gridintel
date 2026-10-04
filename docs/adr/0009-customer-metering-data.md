# ADR 0009: What customer meters report

Date: 2026-10-04
Status: **Proposed. Not implemented.** Awaiting the Founder's decision. Nothing
in the code follows this ADR yet.

## Context

The synthetic dataset treats every customer meter as a smart meter. Until
Phase 6b each reported hourly; since the dataset was widened to 4,253 metered
customers, each reports one reading a day. That was an interim choice to keep
the dataset small (see `DATASET_ASSUMPTIONS.md`). Neither version is how a
Nigerian distribution network is metered:

- Boundary meters (substation incomers, feeder heads, transformer totalizers)
  are the meters most likely to record intervals.
- A minority of customers have AMI or other smart meters that are read
  remotely. They are mostly maximum-demand and large commercial accounts.
- Ordinary prepaid meters are not read at all. What the utility holds for
  them is the vend: how much energy was bought, and when.
- Postpaid customers without a smart meter have a register that is read
  about once a month.

A product that only works when every customer meter reports intervals would
not work on a real network. The synthetic data should make the engine prove
that it works with what a utility actually holds.

## Proposal

Each kind of meter reports what that kind of meter can report.

| Meter | What the dataset would hold | Meter type |
| --- | --- | --- |
| Boundary meters (54 today) | Hourly interval energy, as now | `smart` |
| AMI customer meters: every maximum-demand account, plus a minority of the rest | Interval energy | `smart` |
| Ordinary prepaid meters | No interval data. Vend records only: energy purchased, amount, timestamp. These exist already as billing records on the `prepaid_vend` basis | `conventional` |
| Postpaid meters without AMI | No interval data. One register reading at the month-end run, which is already the energy on the `meter_reading` bill | `conventional` |
| Unmetered connections | Nothing, as now | none |

The last two rows need a decision the Founder's outline did not cover: a
postpaid meter that is not smart. The proposal treats it like an ordinary
prepaid meter, with no intervals and its monthly reading held on the bill.

Open parameters, to be set when this is approved:

- **The AMI share.** Suggested: all 91 maximum-demand accounts and about 10%
  of other metered customers, concentrated on Market Road and Government
  Avenue, with almost none on Old Town and Farm Road. About 500 meters.
- **The AMI interval.** Hourly, to match the boundary meters.

## Effect on the energy account

**The accounting chain does not change.** Energy received and energy
delivered come from boundary meters. Energy billed comes from billing
records. Technical loss comes from the loss study. Unbilled energy, ATC&C,
the loss split and the revenue gap are computed from those, and none of them
reads a customer meter's intervals. Their values would be the same as today.

**The "recorded consumption" cross-check changes.** It is today the sum of
every customer meter's intervals under a scope. With this proposal:

- It could be computed only where every metered customer under the scope has
  an AMI meter. Almost nowhere.
- Elsewhere it would be `insufficient_data`, with the meters that report no
  intervals named as the missing input. Under ADR 0006 a cross-check has its
  own status and does not make the chain incomplete, so account status would
  not change.
- It must not be replaced by energy vended. Energy bought is not energy
  consumed in the period: credit is carried over from one month to the next.
  A vend is a measured purchase and an estimate, at best, of consumption.

**A new, separately labelled figure is proposed: energy vended.** The sum of
prepaid vend energy under a scope in the period, origin measured, labelled as
purchased rather than consumed. It is useful beside energy billed and must
never be added to measured consumption.

**Bypass detection becomes honest about its limits.** Today a bypassed meter
shows as recorded consumption below what the transformer delivered. With
vend-only prepaid meters that comparison exists per customer only for AMI
meters. At transformer level the question becomes delivered energy against
billed energy, which is the commercial loss the chain already computes.

## Statuses and labels

| Where | Today | Proposed |
| --- | --- | --- |
| Service point, prepaid, no AMI: "Energy recorded" | A measured value | "Not available": this meter is not read. A separate tile, "Energy purchased", shows the vends, origin measured |
| Service point, postpaid, no AMI: "Energy recorded" | A measured value | The month-end register reading, origin measured, labelled as one reading rather than intervals |
| Service point with AMI | A measured value | Unchanged |
| Transformer and above: recorded-consumption cross-check | `ok` only where every customer is metered | `insufficient_data` almost everywhere, with the reason; "Energy vended" shown beside it |
| Account status (the chain) | `calculated_with_estimates` | Unchanged |
| Billed energy on a prepaid vend | Measured | Unchanged: the vend is what was billed |

No new status is needed. `insufficient_data` and "not available" already say
what is true: the data does not exist, and that is not zero.

## Record volume and performance

Counts from the current dataset (30 days):

| Records | Today | Proposed (about 500 AMI meters, hourly) | If every customer meter were hourly |
| --- | --- | --- | --- |
| Boundary intervals | 38,880 | 38,880 | 38,880 |
| Customer intervals | 127,588 (4,253 meters, daily) | about 360,000 | about 3,062,000 |
| Vend records | 7,888 | 7,888 | 7,888 |

- The proposal roughly doubles the interval records, to about 400,000. The
  dataset builds in about half a second today. How much of that is interval
  generation has not been measured, so the effect on build time is not known.
- The cost falls on scopes that hold AMI meters. The recorded-consumption
  cross-check would read fewer meters than today, though more records for
  each.
- Page times are served from the per-process cache and are not expected to
  move. The first computation at server start is, and should be measured
  before this is accepted as done. The 500 ms budget applies as before.
- Making every customer meter hourly is not proposed: about 3 million
  records, and it would model a network that does not exist.

## What implementing it would involve

- Dataset: assign AMI meters; stop generating intervals for the rest; set
  meter types truthfully; keep vends as they are. The model still computes
  each customer's consumption hour by hour internally, to size bills, vends
  and the boundary meters.
- Analytics: an energy-vended total; the recorded-consumption cross-check
  names meters without interval data as missing rather than assuming they
  report.
- Services and UI: the service-point screen distinguishes consumed,
  purchased and read-once; the level screens show energy vended.
- Tests: the data-quality case of a customer meter with a two-day gap moves
  to an AMI meter.
- Data-integrity semantics are touched (what "recorded" means for a
  customer), so this is a decision gate.

## Questions for the Founder

1. Is a postpaid meter without AMI modelled as a monthly register reading, as
   proposed?
2. The AMI share and where it sits: about 500 meters, maximum-demand accounts
   first?
3. Should energy vended be shown on the level screens, or only on the service
   point?
4. Which phase: before the Phase 6c workspaces, or after?
