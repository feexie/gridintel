# ADR 0006: Reliability attribution and a status for estimated inputs

Date: 2026-10-01
Status: Accepted (Founder instruction; both changes are data-integrity semantics).
Decision A amended 2026-10-04: see "Amendment: attribution follows the origin
point" below. The rule table in Decision A is kept as first written and now
applies only to interruptions with no origin point recorded.

## Context

Two things in the Phase 5 checkpoint were misleading.

1. SAIDI and SAIFI were single totals. On the synthetic network about 96% of
   customer-hours lost are load shedding, so the totals say little about how
   the distribution network itself performs.
2. Eight of nine energy accounts had status `insufficient_data`. Nothing was
   missing from the loss chain: customers without meters made the measured
   cross-checks unavailable, and their billed energy was estimated. An
   estimate is not missing data.

The Founder also confirmed: collection is on a cash basis and must be labelled
so; technical loss from a dated study is an estimate; commercial loss is a
derived residual that inherits that uncertainty.

## Decision A: reliability attribution

Every counted outage exposure is put in exactly one class, from the cause and
responsible party already recorded on the outage, in this order:

| Class | Rule |
| --- | --- |
| `load_management` | cause is load shedding, whoever ordered it |
| `upstream_supply` | responsible party is transmission or generation, or cause is loss of upstream supply |
| `network` | any other interruption the distribution business is responsible for |
| `other` | the customer, a third party, or not known |

`ReliabilityResult.attribution` gives customer-minutes, customer
interruptions, SAIDI and SAIFI per class. The classes use the same counted
exposures as the totals, so they always sum to the totals. Nothing is
apportioned: exposures that cannot be attributed to the scope are still
reported separately and are in no class.

## Amendment (2026-10-04): attribution follows the origin point

Approved by the Founder as a decision gate (data-integrity semantics).

**What was wrong.** Decision A called an interruption "upstream" whenever its
record named transmission as the responsible party or "loss of upstream
supply" as the cause. In Nigeria the 33 kV lines that feed injection
substations are the distribution company's own assets. A fault on one is the
distribution company's interruption, yet its record is typically written from
the substation's point of view, as a loss of upstream supply. The rule took
that label at its word and moved the distribution company's own faults out of
its network figures. Only an interruption that begins at the 132/33 kV
transmission station, or a collapse of the grid, is upstream.

**Decision.** Where an interruption began is recorded as a fact, and
responsibility follows from it rather than from the label.

- `Outage.originPoint` (optional) states the part of the system where the
  interruption began: `grid`, `transmission_station`, `subtransmission_line`,
  `mv_feeder`, `distribution_transformer` or `lv_network`. It is not inferred
  from the cause; where the source did not record it, it stays undefined.
- The reliability methodology names the origin points that are upstream of
  the business being measured (`upstreamOrigins`). The reference methodology
  names `grid` and `transmission_station`. Which side of the boundary a
  sub-transmission line sits on is therefore a parameter, not something built
  into the domain: a methodology for a network where those lines belong to
  the transmission company would list `subtransmission_line` as upstream.
- The rule, in order:

| Class | Rule |
| --- | --- |
| `load_management` | cause is load shedding, whatever its origin point |
| `upstream_supply` | the origin point is one the methodology names as upstream |
| `network` | any other recorded origin point, unless the responsible party is the customer or a third party |
| `other` | the customer or a third party |

- An interruption with **no origin point** is classified by the original
  Decision A table, unchanged. Nothing recorded before this amendment changes
  class unless an origin point is added to it.
- Load shedding stays its own class. It is a shortfall in the supply
  allocated, not a failure of the distribution network and not a loss of
  upstream supply in the sense of a fault.
- The `include.upstream` switch of the methodology follows the same test.
- The reference reliability methodology is now version `0.2.0`. Results name
  the version, so a figure calculated under the old rule can be told apart.
- `ReliabilityComponents.breakdown.byOriginPoint` gives the usable exposures
  by origin point, with `not_recorded` for those that state none.

**Consequences.**

- On the synthetic dataset the network-attributable figures rise wherever a
  33 kV line fault was previously booked as upstream, and upstream falls by
  the same amount. Totals do not change.
- The synthetic monthly report is deliberately left as a utility would state
  it, with its own 33 kV faults booked as upstream. Its reliability figures
  still say they count "network interruptions only", so they are on the same
  basis as the calculation and are compared with it. The difference appears
  as a variance. That variance is a designed finding, recorded in
  `DATASET_ASSUMPTIONS.md`; the reported figures must not be retuned to
  remove it.
- A basis states which classes a figure counts, not how each interruption was
  put in a class. Two parties can therefore state the same basis and classify
  the same event differently. The comparison cannot detect that; it can only
  show the variance. Whether a basis should also state its attribution rule
  was left open here and is now decided: it may, in `KpiBasis.upstreamOrigins`
  (ADR 0007, amendment of 2026-10-04).
- 33 kV lines and transmission stations are not registry assets. In the
  synthetic data their outages name them as unresolved references.

## Decision B: `calculated_with_estimates`

A fourth result status is added beside `ok`, `insufficient_data` and
`not_computable`:

- **`calculated_with_estimates`**: the value was computed and every input it
  needs is present, but at least one input was estimated or substituted
  rather than measured. The result lists those inputs in `estimatedInputs`,
  each with the share of its value that was estimated (null when not known).
- `insufficient_data` is reserved for inputs that are genuinely missing.

How it is applied:

- `CalculatedKpi.status` and `EnergyAccount.status` are `ResultStatus`. Every
  KPI is finalised by one function, so the rule cannot be applied
  inconsistently. Building-block figures keep the three-value status and
  carry `quality`; `resultStatus(status, quality)` gives their display status.
- `InputValue.estimatedShare` carries the share. Billing totals set it to
  estimated kWh ÷ total kWh billed.
- **Energy account status describes the accounting chain only** (energy
  received through unbilled energy, and revenue). The two measured
  cross-checks (downstream measured, recorded consumption) have their own
  status in `crossChecks`. An unmetered customer makes a cross-check
  unavailable; it does not make the chain incomplete.
- **Technical loss** from a loss study is passed in with origin `reported`
  and quality `estimated`, share 1.
- **Commercial loss** carries `derivation: { kind: "residual" }` and lists
  technical loss and energy billed as its inputs, so an estimate in either
  shows on it.
- **Collection** results carry `collectionBasis: "cash"`.

## Display vocabulary

The UI shows one origin per number, derived from origin and quality:
measured (observed and measured), reported, calculated, estimated (quality
estimated or substituted, whatever the origin) and derived (a residual).

## Consequences

- On the synthetic dataset no account is `insufficient_data` any more; all
  nine are `calculated_with_estimates` because technical loss is always a
  study figure. ATC&C itself is `ok` on the fully metered transformer.
- An estimated share is not known for boundary meters with estimated
  intervals; it is reported as null rather than guessed.
- `EnergyAccount.missingInputs` no longer includes cross-check inputs; they
  are in `crossChecks.missingInputs`. One Phase 3 test changed accordingly.
- Outage customer counts in the synthetic dataset are now "recorded" (as an
  outage system would hold them), so reliability indices there are `ok`.
