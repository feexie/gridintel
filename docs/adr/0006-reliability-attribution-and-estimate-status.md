# ADR 0006: Reliability attribution and a status for estimated inputs

Date: 2026-10-01
Status: Accepted (Founder instruction; both changes are data-integrity semantics)

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
