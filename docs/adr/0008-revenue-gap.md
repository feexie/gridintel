# ADR 0008: Revenue gap in NGN

Date: 2026-10-01, accepted 2026-10-02
Status: **Accepted** with the Founder's corrections. Implemented in Phase 6a.

## What it answers

"How much revenue did the portfolio not realise this month, and through which
leak?"

## Definition

Two parts, always shown separately.

| Part | Formula | Origin | Status |
| --- | --- | --- | --- |
| Commercial gap | unbilled energy valued at the low-voltage, non-MD average billed rate of the place it occurs | Derived | Calculated with estimates |
| Collection gap | revenue billed − revenue collected, cash basis | Calculated | OK |
| Revenue not realised | the sum of the parts that are positive | Derived | Calculated with estimates |

### Commercial gap

- **Valued where the loss occurs.** At a distribution transformer: its
  unbilled energy × that transformer's rate. Above it: the sum of the levels
  below, plus the level's own residual × that level's rate. A feeder's
  residual is the unbilled energy between the feeder head and the
  transformers' boundary meters.
- **The rate is the low-voltage, non-MD average billed rate:** revenue billed
  ÷ energy billed, over accounts supplied through a distribution transformer
  and not recorded as maximum demand. A feeder's rate is that of all such
  accounts under its transformers.
- **A customer supplied at 11 kV is in no rate.** It is not supplied through
  a transformer, and it is recorded as maximum demand
  (`Customer.demandClass`). One large account cannot move the rate.
- **Never a blended rate.** On the synthetic data a portfolio-average rate
  would value the Band C feeder's losses at more than three times their
  worth.
- **Technical loss is excluded.** That energy could not have been sold.
- A residual smaller than 0.5 kWh is rounding between loss studies and is
  treated as nothing.

### Collection gap

- Revenue billed less revenue collected in the period, on a cash basis, over
  every account in the scope, medium-voltage accounts included.
- **It can be negative**, in a period of arrears recovery. It is then shown as
  negative, with a note.

### Never netted

A negative part is shown as it is and is **never set against the other
part**. Revenue not realised is the sum of the parts that are positive; a
negative part counts as nothing. A negative commercial gap (more energy
billed than delivered) is handled the same way.

## Labelling

- **Monthly, for the reporting period. Not annualised.**
- Always "an estimate of revenue not realised". Never "theft", never "revenue
  loss", never "amount owed": part of unbilled energy is under-estimation of
  unmetered consumption, and nobody owes it.
- Origin **Derived** and status **Estimated inputs** on the commercial part
  and the total; **Calculated** and **OK** on the collection part, with
  **Cash basis**.
- On synthetic data the caveat that tariffs are assumptions is shown beside
  the rates.
- Source and method lists each transformer's unbilled energy, its rate and
  its amount.

## Use in "Where to look first"

Founder correction of 2026-10-02:

- **Asset risk is not ranked by money.** Transformers over their rating are a
  separate group shown above the money ranking.
- **The money ranking compares non-overlapping figures only:** feeders, by
  revenue not realised. A transformer's commercial gap is part of its
  feeder's total; it is shown as context and never competes.
- **Each subject appears once**, with every rule it triggered.
- Subjects with no money figure follow in the fixed rule order.
- The ranking method is printed with the list.

## Limits

- `demandClass` is "md" or "non_md" where the source records it. An account
  with no class recorded is treated as non-MD.
- The rate assumes unbilled energy would have been billed at the section's
  current mix of customers.
- Unbilled energy inherits the technical-loss study's uncertainty.
- The data cannot separate meter bypass from under-estimated unmetered
  consumption, so there is no "recoverable" sub-figure.
- Shown on the Executive page only. Showing it at every drill level is a
  later decision.

## Consequences

`calculateRevenueGap` in analytics, `scopeRevenueGap` in services,
`billingTotals` gains a low-voltage non-MD selection, `Customer.demandClass`
in the domain. Tests cover the medium-voltage exclusion, per-transformer
valuation against a blended rate, a negative collection gap, and that the
levels sum.
