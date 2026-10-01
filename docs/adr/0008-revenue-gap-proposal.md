# ADR 0008: Revenue gap in NGN

Date: 2026-10-01
Status: **Proposed. Not implemented. Needs Founder approval** (data-integrity
semantics, and a new figure on the Executive page).

## What it would answer

"How much money is the portfolio not getting, and through which leak?"

## Proposed definition

Two parts, always shown separately, with their sum:

| Part | Formula | Origin | Status |
| --- | --- | --- | --- |
| Commercial gap | unbilled energy (kWh) × average billed rate (NGN/kWh) | Derived | Calculated with estimates |
| Collection gap | revenue billed − revenue collected, cash basis | Calculated from measured records | OK |
| Revenue gap | commercial gap + collection gap | Derived | Calculated with estimates |

- **Unbilled energy** is the energy account's residual: delivered − billed.
  It already carries the technical-loss study's uncertainty.
- **Average billed rate** = revenue billed ÷ energy billed for the same
  section and period. It is calculated from the charges actually raised, so
  no tariff table is needed and no new assumption enters. It values unbilled
  energy as if it would have been billed at the section's current mix.
- **Computed per feeder, then summed.** Tariffs differ by service band, so
  valuing a Band C feeder's unbilled energy at a blended portfolio rate would
  overstate it several times over. A substation or portfolio figure is the
  sum of its feeders' figures, never unbilled energy × a blended rate.
- **Technical loss is excluded.** It is energy that could not have been sold.
- **Collection gap is on a cash basis**, like collection efficiency. It can be
  negative in a month of arrears recovery, and is shown as such.

## How it would be labelled

- Origin tag **Derived**, status **Estimated inputs**, on the total and on
  the commercial part. The collection part is **Calculated**, **OK**.
- A visible note, not a hover: "An estimate of revenue not realised. The
  commercial part values unbilled energy at the average rate actually billed
  on each feeder; unbilled energy is a residual that depends on a
  technical-loss study. It is not an amount owed by anyone."
- On synthetic data, the existing caveat that tariffs are assumptions is
  shown beside it.
- Source and method lists unbilled kWh, energy billed, revenue billed, the
  resulting rate per feeder, and revenue collected.
- It is never called "revenue loss" or "theft": part of unbilled energy is
  under-estimation of unmetered consumption, not theft.

## Indicative size on the synthetic dataset

Worked by hand from figures already on the screens, for scale only: roughly
₦1.1M commercial on Market Road, ₦0.7M commercial on Old Town and ₦2.0M
uncollected, about ₦3.8M against ₦30.0M billed.

## Open choices for the Founder

1. Value unbilled energy at the average billed rate (proposed), or at a
   tariff table per band? A table needs tariffs in the domain and a source
   for them.
2. Show it on the Executive page only, or at every drill level?
3. Include a "recoverable" sub-figure (unbilled energy on metered, bypassed
   connections only)? The data cannot separate bypass from unmetered
   under-estimation today, so the proposal is no.

## Consequences if accepted

One new analytics function and KPI key, one more block on the Executive
page, tests that the feeder figures sum to the total and that the gap is not
computed from a blended rate.
