# ADR 0007: A figure is compared only with a figure on the same basis

Date: 2026-10-01
Status: Accepted (Founder instruction; data-integrity semantics)

## Context

The Operations screen put a reported SAIDI of 5.1 h beside a calculated
216 h and called it "Yes, with caveats". The report counted network
interruptions only; the calculation counted everything, including load
shedding. That is a false like-for-like. The same can happen with any figure
whose name hides a definition: collection on a cash or an accrual basis, a
loss as a fraction of different energy.

A second problem surfaced while fixing the first: outage customer counts
read from the network model were being graded as "estimated".

## Decision 1: every KPI states its basis

- `KpiBasis` (domain) holds the definitions that change a value without
  changing its name: which interruption classes are counted, whether planned
  interruptions are counted, the collection basis (cash or accrual), and what
  energy a loss is a fraction of.
- `ReportedKpi.basis` is what the source says the figure includes, or `null`
  when the source does not say.
- `CalculatedKpi.basis` is what the calculation includes. Reliability indices
  state their classes; loss figures state the loss basis; collection figures
  state cash or accrual only when the caller says which its revenue inputs
  are, because analytics cannot tell.

## Decision 2: comparison requires the same basis

- Each metric has the basis dimensions that matter for it
  (`basisDimensions`). Counts and other plain figures have none.
- Two figures are on the same basis only when every such dimension is
  **stated on both sides and equal**. A basis that is not stated is never
  assumed to match.
- Otherwise the comparison is **not comparable**, with the reason
  (`BASIS_MISMATCH` or `BASIS_UNSPECIFIED`, both blocking), and **no variance
  is given**. A difference between figures that count different things means
  nothing.
- `compareOnBasis` takes a reported figure and the candidate calculated
  figures and uses the one on the reported basis. `reliabilityOnBasis` gives
  SAIDI and SAIFI for a chosen set of attribution classes, as the sum of
  those classes' parts of the total.
- The rule applies to every reported-versus-calculated comparison: ATC&C,
  collection efficiency, SAIDI, SAIFI and anything added later.
- There is no "Yes, with caveats" across bases. A comparison on the same
  basis may still carry non-blocking notes (for example, that the source's
  methodology has not been verified as equivalent).

## Decision 3: derived is not estimated

- A customer count read from the network model (`topology_derived`) is exact
  for the topology it was read from. It no longer lowers a result's quality.
  Its limitation is reported as a warning, `CUSTOMER_COUNTS_TOPOLOGY_DERIVED`.
- Only a count that is itself a judgement (`estimated`) makes a reliability
  index `calculated_with_estimates`.
- `InterruptionClass` moves to the domain, since a reported basis refers to
  it.

## Consequences

- On the synthetic dataset, the reported substation SAIDI of 5.1 h is now set
  beside the network-attributable 5.7 h. Old Town's reported collection
  efficiency is on an accrual basis and is shown as not comparable with the
  calculated cash-basis figure.
- Legacy mock figures state no basis, so they are not comparable with
  anything and show no variance. One Phase 4 test changed accordingly.
- The synthetic outage log goes back to `topology_derived` customer counts,
  which is what it actually is.
- Any new reported source must state a basis for its figures to be compared.
