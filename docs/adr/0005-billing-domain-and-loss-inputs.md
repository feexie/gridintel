# ADR 0005: Billing records in the domain; where loss inputs come from

Date: 2026-10-01
Status: Accepted for the Phase 5 checkpoint; open points listed for the Founder

## Context

ATC&C needs energy billed, revenue billed and revenue collected. The domain
had no commercial records; the analytics engine took those figures as
supplied inputs. The approved dataset requires prepaid, postpaid and
unmetered (estimated-billing) customers, which cannot be expressed as a
single reported total.

Reliability and loading also needed pieces the engine did not have.

## Decisions

1. **Billing domain.** `BillingRecord` (a bill or a prepaid vend, with a
   `basis` of `meter_reading`, `prepaid_vend` or `estimated`) and `Payment`
   are added to `src/domain`, with a `BillingRepository` port.
2. **Billing totals are analytics.** `billingTotals` sums charges and
   payments for the accounts under a scope. Energy billed is marked
   `estimated` as soon as one charge in it was estimated. No billing records
   means missing, not zero.
3. **Collection is on a cash basis:** payments received in the period over
   charges raised in the period.
4. **Technical loss is a reported input.** It cannot be metered, so the
   energy account takes it from a loss study held as a `ReportedKpi` for
   exactly the same scope and period. Without one, only total loss is given
   and the technical/commercial split is unavailable.
5. **ATC&C decomposition.** `decomposeAtcc` returns technical, commercial and
   collection parts as fractions of energy input that sum to ATC&C. The
   collection part is billing efficiency × (1 − collection efficiency).
6. **Outage attribution.** `outagesForScope` keeps exposures on the scope or
   under it. Exposures on an element above the scope are returned as
   unattributable with a warning; they are never apportioned by a guess.
7. **Peak loading.** `peakLoading` evaluates loading at each instant that has
   a reading in a window and returns the highest observed.
8. **Feeder attributes.** `Feeder.serviceBand` (NERC band, a classification)
   and `Feeder.route` (polyline).

## Open points for the Founder

- Decision 3 and 4 are data-integrity semantics. They are implemented so the
  checkpoint can show real numbers, and are easy to change before UI work.
- Energy accounting does not support administrative scopes. A region has
  billing and reliability figures but no calculated ATC&C. The Executive page
  needs either the substation's figure, labelled as such, or cut-based
  aggregation across sections (new analytics).
- A calculated "hours of supply per day" against the feeder's service band is
  a natural next KPI and is not implemented.

## Consequences

The commercial side of ATC&C is now traceable to individual charges and
payments. The domain grew by one file. `KpiKey` is unchanged: the
decomposition is a structure, not three new KPI keys.
