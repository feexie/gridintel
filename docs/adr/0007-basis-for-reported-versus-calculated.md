# ADR 0007: A figure is compared only with a figure on the same basis

Date: 2026-10-01
Status: Accepted (Founder instruction; data-integrity semantics).
Amended 2026-10-04: see "Amendment: a basis may state its attribution rule".
Amended 2026-10-05: see "Second amendment: a rule difference is a finding".

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

## Amendment (2026-10-04): a basis may state its attribution rule

Approved by the Founder as a decision gate (data-integrity semantics), at the
Phase 6b checkpoint. Implemented in Phase 6c-1.

**What was missing.** Decision 1 has a basis state which classes of
interruption a figure counts. It does not say how an interruption was put in
a class. Two parties can both report "network interruptions only" and
classify the same fault differently: a utility that books faults on its own
33 kV lines as loss of upstream supply leaves them out of its network
figure, while the reference methodology (ADR 0006, amendment) puts them in.
The comparison saw the same basis on both sides and showed a variance with
nothing to say what it might be.

**Decision.**

- `KpiBasis.upstreamOrigins` (optional) is the attribution rule: the origin
  points the figure treats as upstream of the business it measures. It is
  what the source says, and is left out when the source does not say. It is
  never inferred.
- A calculated reliability figure always states the rule it was classified
  under: the `upstreamOrigins` of its methodology.
- The rule matters only for a figure that counts some, but not all, of the
  classes an interruption can be moved between (network, upstream supply,
  other). A total that counts every class is the same under any rule, and
  load shedding is always its own class.
- **When the reported figure states its rule**, the calculation is made on
  that rule and the two are compared. The calculation is the reference
  methodology with the reported origin points in place of its own
  (`reliabilityOnStatedRule`); it carries its own methodology id, so it never
  passes for a reference result. Where the rule differs from the reference
  one, the figure on the reference rule is shown beside the comparison, so
  the difference the rule makes is in plain view and nothing is hidden by
  adopting the report's rule.
- **When the reported figure does not state its rule**, the comparison is
  still made, because both figures count the same classes, and it carries a
  non-blocking note (`ATTRIBUTION_RULE_UNSPECIFIED`): the variance may
  reflect a difference in classification rather than in what happened. The
  rule is not assumed to match and is not assumed to differ.
- If the two rules are stated and differ and no calculation on the reported
  rule is supplied, the comparison is not comparable and gives no variance
  (`ATTRIBUTION_RULE_MISMATCH`, blocking), as for any other basis mismatch.
- "Same basis" (Decision 2) now means: no blocking basis issue. The note for
  an unstated rule does not make a comparison "not comparable".

**What does not change.** The headline indices and the attribution table on
every screen stay on the reference methodology. A reported rule is used only
for the calculation set beside that reported figure. Totals are the same
under any rule; only the split between classes moves.

**On the synthetic dataset.** The monthly report states its rule in its
feeder tables (upstream includes the 33 kV lines) and not in its substation
summary. So:

| Scope | SAIDI reported | Compared with, before | Compared with, now | Note |
| --- | --- | --- | --- | --- |
| Riverside | 3.0 h | 6.9 h (+3.9) | 6.9 h (+3.9) | rule not stated; classification note |
| Hillcrest | 1.9 h | 22.8 h (+20.9) | 22.8 h (+20.9) | rule not stated; classification note |
| Market Road | 0.2 h | 3.8 h (+3.6) | 0.2 h (0.0) | on the report's rule; reference 3.8 h beside it |
| Old Town | 5.0 h | 9.2 h (+4.2) | 5.6 h (+0.6) | on the report's rule; reference 9.2 h beside it |
| Government Avenue | 2.7 h | 3.1 h (+0.4) | 3.1 h (+0.4) | on the report's rule; no 33 kV fault, so the same |
| Farm Road | 0.4 h | 57.1 h (+56.7) | 0.4 h (0.0) | on the report's rule; reference 57.1 h beside it |

The designed finding of ADR 0006 (the report leaves its own 33 kV faults out
of its network figures) is still on every screen. At substation level it is
a variance under a classification note. At feeder level it is the gap
between the calculation on the report's rule and the reference figure shown
beside it. The reported figures themselves were not changed.

## Second amendment (2026-10-05): a rule difference is a finding

Approved by the Founder as a decision gate (data-integrity semantics), at the
Phase 6c-1 checkpoint. Implemented in Phase 6c-2.

**What was wrong.** The first amendment compares a report on its own
attribution rule and shows "the figure on the reference rule beside the
comparison". On the screen that became a muted line inside the comparison
row. Farm Road read: reported 0.4 h, calculated 0.4 h, difference 0.0 h,
same basis; and, in small type, 57.1 h on the reference rule. The agreement
was the headline and the 56.7 hours the rule removes from the feeder's
network figure was the footnote. That is the wrong way round. A rule that
moves a utility's own line faults out of its network figure is the most
important thing that comparison has to say.

**Decision.**

- When a reported figure states an attribution rule that differs from the
  reference methodology's, what the rule changes is a **finding**: a named
  statement with its size. For example: "Rule treats sub-transmission lines
  as upstream: +56.7 h SAIDI under the reference rule".
- The size is calculated, not read off the screen
  (`attributionRuleDifference`, analytics): the figure on the reference rule
  less the same figure on the reported rule. Both are computed from the same
  interruptions, for the same classes and the same customers served, so the
  difference is the rule's effect and nothing else. It is positive when the
  reported rule moves interruptions out of the classes the figure counts.
- The name says which origin points the two rules treat differently, in
  words, from the grid down.
- The finding is a figure like any other: it has a status, an origin
  (calculated), a method (the reference reliability methodology) and its two
  inputs, each with the methodology it was calculated under.
- **Where it is shown.** On the screen of the scope the report is stated
  for, above the attribution table, as a finding and not inside the
  comparison row. On a substation's screen, for each feeder below it, naming
  the feeder. In "Where to look first", under the feeder, as fixed rule 8.
- **A difference of zero.** A report can state a different rule that moved
  nothing in the period, because no interruption began where the rules
  differ. The scope's own screen still says the rule differs, and that it
  made no difference in the period. It is not listed in "Where to look
  first": a rule that changed nothing is nothing to look at.
- **No finding** exists when the rules are the same, when the report does not
  state its rule (the first amendment's classification note applies
  instead), or when the figure counts every class an interruption can be
  moved between.
- The comparison itself is unchanged: on the report's rule, with its
  variance. The row says that it was made on the report's rule and points to
  the finding.

**What does not change.** The headline indices and the attribution table stay
on the reference methodology. Nothing reported is altered. Totals are the
same under any rule.

**On the synthetic dataset.** SAIDI, network interruptions only:

| Feeder | On the report's rule | On the reference rule | Finding |
| --- | --- | --- | --- |
| Market Road | 0.2 h | 3.8 h | +3.6 h |
| Old Town | 5.6 h | 9.2 h | +3.6 h |
| Government Avenue | 3.1 h | 3.1 h | none in the period: no 33 kV fault |
| Farm Road | 0.4 h | 57.1 h | +56.7 h |

The substation summaries do not state their rule, so they have no finding of
their own. Their screens carry their feeders' findings.

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
