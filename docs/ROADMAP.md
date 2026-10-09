# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-09. Status: **Phase 6 is complete.** Its close-out was
approved by the Founder and merged to `main` on 2026-10-09, tag `phase-6`.
The next phase has not been chosen; the Founder chooses it. Its first item
is already decided and is listed under "Next phase" below.

## Completed

| Phase | Commit | Result |
| --- | --- | --- |
| 1. UI prototype | up to `a2c5f7f` | Executive and Operations screens on mock data |
| 2. Canonical domain model | `87a4694` | `src/domain` |
| 3. Deterministic analytics | `70afd3e` | `src/analytics`, tested |
| 4. Repository ports and first services | `adbc17e` | Ports, memory and mock adapters, import boundaries |
| Governance | `da0fad7`, `8e04b10` | Engineering rules, decision gates, ADRs, blueprint, roadmap, CI |

## Phase 5: Vertical slice on a synthetic demo path (complete)

**Goal.** One complete, truthful path through every layer: drill from region
to meter in the running app and see calculated losses, loading and SAIDI,
each traceable to source and method, with no KPI computed in a component.

| Step | Status |
| --- | --- |
| 0. `"type": "module"`, Node engine | Done |
| 1. Composition root (`src/composition/runtime.ts`) | Done; the UI lint rule comes with step 4 |
| 2. Synthetic demo dataset (`src/repositories/demo`) | Done; awaiting realism review |
| 3. Services with status, provenance and synthetic marker | Done for losses / ATC&C, reliability, loading, collection |
| Checkpoint: Founder reviews the dataset | Approved with changes |
| 3a. Reliability attribution, estimated-input status, band compliance (ADR 0006) | Done |
| 3b. Operations read models with coverage (`src/services/operations`) | Done |
| 4. Operations drill-down on services, selection in the URL, UI lint rule | Done |
| Checkpoint: Founder reviews the Operations drill-down | Approved with changes |
| 4a. Basis rule for reported versus calculated; derived is not estimated (ADR 0007) | Done |
| 5. Executive page on services, with "where to look first" | Done |
| Close-out: README, blueprint, roadmap, retrospective | Done |

**Decisions recorded.** ADR 0003 (synthetic source kind), ADR 0004 (GIS
order), ADR 0005 (billing domain and loss inputs), ADR 0006 (reliability
attribution and the `calculated_with_estimates` status), ADR 0007 (same-basis
comparison). ADR 0008 (revenue gap) was proposed here and accepted and built in Phase 6a.

**Acceptance, as met.** Drill from region to service point by URL; losses,
loading and SAIDI calculated and traceable to source and method; Executive
shows reported against calculated on the same basis and holds no literal
KPI; a lint rule keeps the UI off data files, the domain, analytics and
repositories, with no exemption left; every screen with demo data carries
the SYNTHETIC DATA label; typecheck, tests, lint, build and CI green.

**Operations routes.** `/dashboard/utility/operations`, then
`/regions/[id]`, `/substations/[id]`, `/feeders/[id]`, `/transformers/[id]`
and `/service-points/[id]`. Screenshots: `docs/screenshots/phase5`.

**What the dataset contains.** 1 region, 1 substation, 1 power transformer,
2 feeders (NERC Band A and Band C), 6 distribution transformers, 432
connections (prepaid, postpaid and unmetered), boundary meters at every
level, 30 days of hourly interval energy, telemetry, 87 outages, bills, vends
and payments in NGN, and a synthetic monthly report to compare against.
Assumptions: `src/repositories/demo/DATASET_ASSUMPTIONS.md`.

**Carried into Phase 6 by Founder decision.**

- Region-level energy accounting (aggregation across sections). Until then a
  region shows its only substation's figures, labelled as such.
- Widening the dataset so feeder loading is realistic. Until then the UI
  shows a caveat beside feeder loading.
- Alarms. The Operations screens show an explicit "not available" state.

**Risks.**

- Synthetic data mistaken for real data. Mitigation: `synthetic` source kind,
  marker on every service result, persistent UI label, tests.
- Scope creep into a full UI redesign. Mitigation: only Operations and the
  two Executive KPIs change.

**Acceptance criteria.**

- From the running app: region → substation → feeder → transformer → meter
  on the demo path, by URL.
- Losses, loading and SAIDI are shown as calculated, each with source,
  period, method and data status.
- The Executive page shows reported versus calculated collection efficiency
  and ATC&C; no literal KPI remains in Operations or Executive.
- A lint rule fails any component that imports `src/data`, legacy types,
  adapters or analytics.
- Every screen showing demo data is visibly labelled synthetic.
- Typecheck, tests, lint, build and CI are green.

### Phase 5 retrospective

**What worked**

- *Dataset before screens.* Reviewing the synthetic dataset's numbers before
  any UI existed caught the realism and semantics questions early, when they
  cost one analytics change instead of a screen rewrite.
- *Checkpoints at decision points.* Each stop produced a decision that changed
  the engine (estimated-input status, attribution, basis). None of them would
  have surfaced from a finished UI.
- *Building bottom-up in the generator.* Customer consumption first, then
  losses, then boundary meters, kept every level consistent, and outages and
  meter data agree by construction.
- *Lint-enforced boundaries.* The layering held without review effort, and
  removing the last exemption was a one-line change.
- *One `MetricView` for every number.* Status, origin and trail came for
  free on every screen, including the Executive page, which reused the
  Operations panels unchanged.

**What to change for Phase 6**

- *The engine's vocabulary was settled too late.* `calculated_with_estimates`,
  attribution and basis each touched every KPI constructor. Before widening
  the UI, review the result model once more against the Phase 6 screens
  (alarms, assets, reliability) rather than discovering gaps per screen.
- *UI flows have no automated test.* Source & method was verified with a
  throwaway script driving a headless browser. See the proposal below.
- *Read models are slow to assemble.* A feeder page recomputes its children's
  accounts; the substation page takes 1 to 3 seconds. Acceptable on one
  substation, not on twenty. Phase 6 needs per-request memoisation in the
  composition root before the dataset is widened.
- *Region and portfolio figures borrow the substation's.* It is labelled, but
  it is a stand-in. Aggregation across sections should come early in Phase 6,
  before the dataset gains a second substation.
- *Screens are dense but uniform.* Every level shows the same panels. Phase 6
  should shape each level to its user's question, with the design system.
- *Commit size.* The analytics-plus-services commits were large. Split engine
  changes from their consumers.

**Proposal: browser tests in Phase 6 (dependency decision for the Founder)**

Recommend adding `@playwright/test` as a dev dependency, Chromium only.

- *What it would cover:* the drill path by URL, opening Source & method on a
  `calculated_with_estimates` and a derived figure, the SYNTHETIC DATA label
  on every route, footnote markers in tables, and "not comparable" rows.
  About ten tests.
- *Why not what we have:* the unit tests cover every number, but nothing
  checks that a screen shows it. The throwaway DevTools script used in Phase 5
  works, but it is unmaintained code tied to one browser path on one machine.
- *Cost:* one dev dependency, a browser download in CI (about a minute per
  run), and a second CI job.
- *Alternative:* keep a small in-repo DevTools script with no dependency.
  Cheaper, more brittle, no trace viewer. Not recommended.

### Decisions taken after Phase 5

- Revenue gap: accepted with corrections (ADR 0008), built in Phase 6a.
- Playwright: approved as a dev dependency, Chromium only, in CI.
- Phase 6 is split into three gated sub-phases, each ending in a checkpoint.
- Each sub-phase is worked on its own branch and merged to `main` after the
  Founder approves its checkpoint (see `ENGINEERING_RULES.md`).

## Phase 6: Complete the core utility product (complete; approved 2026-10-09, tag `phase-6`)

Three gated sub-phases. Work stops after each for the Founder's review.

### Phase 6a: Engine (complete, awaiting approval; branch `phase-6a`)

**Goal.** Make the engine ready to be widened: correct at every scope, fast,
free of legacy, and tested in a browser.

| Item | Status |
| --- | --- |
| Remove legacy `src/data/utility`, legacy types, the mock adapter and the `mock` source kind | Done |
| Region and portfolio accounts as the sum of their electrical sections | Done |
| Revenue gap (ADR 0008) on the Executive page | Done |
| "Where to look first": asset-risk group, feeders ranked by money, one entry per subject | Done |
| Result cache, held once per process, with a written invalidation rule | Done |
| Every page under 500 ms on the current dataset | Done (see timings below) |
| Playwright, Chromium only, in CI | Done, 17 flows |
| Blueprint note on DisCo-only assumptions | Done |

**Page timings**, production build, one machine, milliseconds. "Before" is the
start of Phase 6a; "after" is with the cache warmed at server start. The
Executive and Operations home pages are prerendered and were already fast.

| Route | Before | After, first request | After, repeat |
| --- | --- | --- | --- |
| Executive | 19 | 47 | 11 |
| Operations home | 11 | 22 | 31 |
| Region | 1,184 | 459 | 119 |
| Substation | 1,838 | 81 | 71 |
| Feeder, Market Road | 2,524 | 85 | 71 |
| Feeder, Old Town | 2,528 | 64 | 83 |
| Transformer, Riverbank | 1,282 | 351 | 372 |
| Transformer, Market Square | 1,125 | 198 | 186 |
| Service point | 80 | 71 | 23 |

The first request to any drill-down route also loads that route's code, which
is what the Region figure shows. Timings vary by tens of milliseconds between
runs. A browser test holds every screen to the 500 ms budget.

**How it got there.** Parsing each timestamp once instead of on every use;
giving peak loading only the readings recent enough for each instant instead
of the whole history; looking interval records up by meter; computing each
section once per process and reusing it; warming the network screens at start.

**Acceptance, as met.** A region with one substation has exactly that
substation's account (tested); the revenue gap values each transformer at its
own low-voltage non-MD rate and keeps the 11 kV customer out of every rate
(tested); no legacy import remains; typecheck, unit tests, lint, build and
browser tests are green.

### Phase 6b: Dataset widening (complete, approved 2026-10-04; tag `phase-6b`)

**Goal.** A synthetic network large enough that nothing about it is an
artefact of being small.

**Includes.** A second substation, so region aggregation sums more than one
section; a realistic number of transformers per feeder, so feeder loading is
real and its caveat can be removed; the same realism rules, with every
assumption in `DATASET_ASSUMPTIONS.md`.
**Dependencies.** Phase 6a approved and merged.
**Risks.** Dataset size and page time: the cache computes each section once,
but the first computation grows with the network; the 500 ms budget must
still hold. A longer "where to look" list needs a cut-off rule.
**Acceptance.** Feeder peak loading is plausible for an 11 kV feeder and its
caveat is gone; the region account equals the sum of two substations; every
page stays under 500 ms; the assumptions file is complete.
**Constraint.** Nothing added may assume every network is a DisCo network
(see the blueprint note).

**What was built.**

| Item | Status |
| --- | --- |
| Second substation (Hillcrest) with two feeders: Government Avenue (Band B) and Farm Road (Band D) | Done |
| 48 transformers, 10–14 per feeder; 6,448 connections; the six hand-designed transformers unchanged | Done |
| Feeder peak loading 54–81% of rating; the feeder-loading caveat removed | Done |
| Government (MDA) accounts as a customer category; billing and collection by customer class on every level | Done |
| Accounts with no recorded demand class (19, Farm Road), excluded from the rate and counted on screen | Done |
| Farm Road's chronic loss of upstream supply; three more individual outage events | Done |
| Customer meters report daily; boundary meters stay hourly | Done |
| Revenue gap on every network level, with the sections below it | Done |
| "Where to look first": every feeder ranked by money; the screen shows the top three with the rest one click away | Done |
| Topology index looks meters and service points up by asset instead of scanning the registry | Done |
| `DATASET_ASSUMPTIONS.md` rewritten for the widened network | Done |
| Reopened 2026-10-04: interruptions attributed by where they began; 33 kV line faults are the network's, only the transmission station and the grid are upstream (ADR 0006, amendment; reliability methodology 0.2.0) | Done |
| The synthetic report left booking 33 kV faults as upstream, so the same-basis comparison shows a designed variance | Done |
| ADR 0009, what customer meters report | Proposal only; not implemented |

**Attribution before and after the 33 kV correction** (SAIDI in hours / SAIFI).
Totals and load shedding are unchanged; only the split between network and
upstream moves.

| Scope | Total | Load shedding | Network, before | Network, after | Upstream, before | Upstream, after |
| --- | --- | --- | --- | --- | --- | --- |
| Region | 240.9 | 225.3 / 42.28 | 2.8 / 0.68 | 13.9 / 3.81 | 12.8 / 3.61 | 1.7 / 0.48 |
| Riverside | 208.7 | 201.8 / 43.32 | 3.4 / 0.65 | 6.9 / 1.65 | 3.6 / 1.00 | 0 / 0 |
| Hillcrest | 282.0 | 255.3 / 40.95 | 2.1 / 0.72 | 22.8 / 6.56 | 24.6 / 6.93 | 3.9 / 1.09 |
| Market Road | 73.8 | 70.0 / 20 | 0.2 / 0.05 | 3.8 / 1.05 | 3.6 / 1.00 | 0 / 0 |
| Old Town | 305.2 | 296.0 / 60 | 5.6 / 1.08 | 9.2 / 2.08 | 3.6 / 1.00 | 0 / 0 |
| Government Avenue | 190.1 | 187.0 / 30 | 3.1 / 1.08 | 3.1 / 1.08 | 0 / 0 | 0 / 0 |
| Farm Road | 441.8 | 374.0 / 60 | 0.4 / 0.11 | 57.1 / 16.11 | 67.5 / 19.00 | 10.7 / 3.00 |

Reported against calculated SAIDI on Hillcrest, both stated as "network
interruptions only": 1.9 h reported, 22.8 h calculated, variance +20.9 h.
The variance is the 33 kV line faults the report books as upstream.

**Page timings**, production build, one machine, median of five requests
after the cache is warm, milliseconds (from the browser timing test):

| Route | Median |
| --- | --- |
| Executive | 102 |
| Operations home | 6 |
| Region | 67 |
| Substation, Riverside / Hillcrest | 60 / 97 |
| Feeder, Market Road / Old Town / Government Avenue / Farm Road | 104 / 101 / 125 / 73 |
| Transformer, Riverbank (first 40 rows / all 135) | 89 / 215 |
| Service point | 25 |

Screenshots: `docs/screenshots/phase6b`.

The Executive page is now rendered on demand rather than prerendered, because
it reads `?feeders=all`; its figures still come from the cache. Without the
cache the Executive read model takes several seconds to compute on this
dataset, so the warm-up at server start now matters more than it did.

**Acceptance, as met.** Feeder peak loading is 54–81% of rating and carries
no caveat (browser test); the region account is the sum of the two
substations, each counted once, and its ATC&C is of the summed energy and
revenue rather than an average of two percentages (tested); every route is
under 500 ms (browser test, 12 routes); the assumptions file covers the
widened network. Typecheck, 298 unit tests, lint, build and 21 browser tests
are green.

**For the Founder's review.** Raised at the checkpoint. The Founder's answers
are recorded under Phase 6c.

- Three generated transformers on Government Avenue (DT-GOV-3, DT-GOV-10,
  DT-GOV-4) peak above their rating in office hours, because government load
  comes on top of a customer count sized for the evening peak. They were not
  designed by hand. They are kept and documented as a realistic case, so
  asset risk now lists four transformers. The alternative is to size
  Government Avenue's transformers for the daytime peak, leaving DT-OLD-2 as
  the only overload.
- The cut-off for the money ranking (top three feeders) is a constant in the
  Executive component. It hides nothing: the full list is one click away.
- The loss of 33 kV supply to Riverside is modelled as a fault on Riverside's
  own 33 kV line, so it is network-attributable. Had it begun at the
  transmission station it would be upstream.
- Farm Road's rural 33 kV line interrupts Farm Road only, although Hillcrest
  is modelled with one power transformer. Giving the line its own power
  transformer and incomer would remove the simplification.
- Because Farm Road's line faults are now the network's, "highest
  network-attributable SAIDI" moved from Old Town to Farm Road.
- ADR 0009 (customer metering) is a proposal with four questions to answer.

### Phase 6c: Workspaces (complete: 6c-1, 6c-2 and 6c-3 approved; close-out approved 2026-10-09)

Split by the Founder into three gated parts: 6c-1, the decisions below, on
the data and the engine; 6c-2, further decisions, the design system,
navigation and the Reliability and Revenue workspaces; 6c-3, the Assets and
Events / Alarms workspaces.

**Goal.** Each user's question has a screen shaped for it.

**Includes.** Events / Alarms (an alarm port and synthetic alarm data),
Reliability and Assets workspaces; navigation restructure; a design system
and a chosen typeface; one `h1` per page.
**Dependencies.** Phase 6b.
**Risks.** Scope creep into a full redesign; alarms are new domain data.
**Acceptance.** Each workspace answers its user's question from the founding
directive on the widened dataset; the alarm panel shows real (synthetic)
alarms or an explicit empty state; browser tests cover the new flows.

**Founder's decisions at the 6b checkpoint (2026-10-04).** These come before
the workspaces, in this order.

1. **Hillcrest gets two 33 kV incomers and two power transformers**, as most
   Nigerian injection substations have. Farm Road's rural line feeds one bus
   section; Government Avenue is on the other. The simplification documented
   in `DATASET_ASSUMPTIONS.md` (the rural line interrupts Farm Road only,
   though the substation has one power transformer) is removed. First item
   of 6c.
2. **ADR 0009 is accepted and implemented before the workspaces**, with these
   defaults:
   - postpaid meters without AMI: monthly register reads, some of them
     estimated;
   - AMI on every maximum-demand account plus about 5% of the others;
   - ordinary prepaid meters: vend records only;
   - energy vended is shown as "energy purchased", never as consumption.

   The 6c checkpoint reports the effect on the energy account and the page
   timings.
3. **A reported basis may state its attribution rule.** When it is stated,
   the calculation is compared against it. When it is not, the comparison
   carries a note that the variance may reflect a difference in
   classification. This changes data-integrity semantics and is approved; it
   is recorded in ADR 0007.
4. **The top-three cut-off moves** from the Executive component into the read
   model.
5. **Government Avenue's overloads** (DT-GOV-3, DT-GOV-10, DT-GOV-4): explain
   at the 6c checkpoint whether they are designed or incidental.

Also confirmed: Farm Road having the highest network-attributable SAIDI is
correct and expected.

#### Phase 6c-1: Data and engine (complete, approved 2026-10-05; tag `phase-6c-1`)

| Decision | Status | Commit |
| --- | --- | --- |
| 1. Hillcrest: two incomers, two power transformers, two bus sections | Done | `0292960` |
| 2. ADR 0009, what customer meters report | Done | `c11d893` (engine), `312fbdd` (dataset, screens) |
| 3. A reported basis may state its attribution rule; ADR 0007 amended | Done | `b9a7a44` (engine), `bd23ffe` (dataset, screens) |
| 4. Top-three cut-off moved into the read model | Done | `8c2a132` |
| 5. Government Avenue's overloads explained | Done: incidental, not designed | see below and `DATASET_ASSUMPTIONS.md` |

**1. Hillcrest.** T1 (5 MVA, bus section A) carries Government Avenue; T2
(2.5 MVA, bus section B) carries Farm Road and is fed by the rural 33 kV
line. Each incomer has its own boundary meter, and the substation's energy
received is the sum of the two. The simplification is removed. Nothing
moved but meter rounding: 0.016 kWh on Hillcrest's energy received, ₦1 on
its revenue gap. `PowerTransformer` gains an optional `busSection`.

**2. Customer metering (ADR 0009).** 288 AMI meters (every maximum-demand
account and 4.7% of the rest) report hourly. 1,425 postpaid meters hold two
register readings, 138 with an estimated closing reading. 2,518 prepaid
meters hold only their vends. Effect on the energy account:

- *Status.* The account status is `calculated_with_estimates` at every scope,
  as before. No scope gained or lost a status. The cross-checks were already
  `insufficient_data` everywhere except DT-MKT-3, because of unmetered
  connections, and still are; DT-MKT-3 (all AMI by design) is still `ok`.
- *What became partial.* Recorded consumption has more it cannot see: the
  connections without interval data rose from 2,196 to 6,161 of 6,448 in the
  region. At a service point, "Energy recorded" was a measured figure for
  4,253 meters. It is now the sum of intervals for 288, one register reading
  for 1,425 (138 of them estimated), and "not available" for 2,540.
- *Figures that moved*, region, before to after: energy billed 1,720,886 to
  1,719,723 kWh (−0.07%); its estimated share 11.7% to 13.3%; unbilled energy
  187,457 to 188,619 kWh; ATC&C 31.46% to 31.50%; revenue not realised
  ₦46.45 M to ₦46.56 M. Estimated charges 2,118 to 2,256; meter-reading
  charges 1,581 to 1,443. They move because a register reading stops at the
  reading round (23:00 on 30 September) and because 138 readings are
  estimates. Energy received, technical loss and energy delivered did not
  move.
- *Labels.* "Energy purchased (prepaid vends)" under "Purchased, not
  consumed" on every level screen; "Energy purchased" on a prepaid service
  point; "One register reading for the month, not interval data"; "Estimated
  bills (no meter, or meter not read)".
- *Records.* Customer intervals 127,588 to 207,312; register readings 0 to
  2,850; billing records unchanged at 11,587.

**3. Attribution rule.** See the table in ADR 0007's amendment. Feeder
figures, which state their rule, are compared on it with the reference
figure beside them (Farm Road: 0.4 h reported, 0.4 h on the report's rule,
57.1 h on the reference rule). Substation figures, which do not, keep their
variance (Hillcrest +20.9 h) under a note that it may reflect a difference
in classification. No total, attribution table or headline index moved.

**4. Cut-off.** The read model gives the top three feeders, how many there
are, and all of them on request. The component no longer cuts or filters.

**5. Government Avenue's overloads are incidental.** The generator sizes a
transformer's customers for the evening peak and then adds government
accounts whose load falls in office hours, at 0.42 kW per kVA of rating. All
twelve transformers on the feeder therefore peak by day, at 71–97% of rating
before day-to-day variation, and the three that start highest go over.
Which three is a matter of the random draws. Full table in
`DATASET_ASSUMPTIONS.md`.

**Page timings.** Production build, one machine, milliseconds, median of five
requests after warm-up (the middle of three rounds), `main` and the branch
measured alternately, twice each. No route moved beyond run-to-run noise.

| Route | `main` | Branch |
| --- | --- | --- |
| Executive | 171, 159 | 162, 157 |
| Operations home | 8, 7 | 8, 7 |
| Region | 114, 113 | 113, 113 |
| Substation, Riverside | 104, 108 | 103, 102 |
| Substation, Hillcrest | 99, 101 | 102, 98 |
| Feeder, Market Road | 162, 149 | 135, 141 |
| Feeder, Old Town | 143, 145 | 144, 147 |
| Feeder, Government Avenue | 135, 135 | 139, 141 |
| Feeder, Farm Road | 127, 123 | 129, 127 |
| Transformer, Riverbank (first 40 rows) | 133, 134 | 128, 132 |
| Transformer, Riverbank (all 135 rows) | 283, 282 | 271, 268 |
| Service point, register reading | 28, 23 | 26, 25 |
| Service point, prepaid | 32, 27 | 26, 30 |
| Service point, AMI | 37, 25 | 24, 26 |

The machine was busier during this comparison than when Phase 6b's table was
taken, so the two tables are not comparable with each other. The warm-up at
server start was 10.8 s and 6.6 s on `main` and 7.7 s and 10.1 s on the
branch in the same four runs, which is noise; an earlier, quieter pair gave
7.5 s before the metering change and 4.5 s after it. It is not slower. The
in-memory adapter now looks telemetry up by source instead of scanning it.

**Acceptance, as met.** Typecheck, 336 unit tests, lint, build and 26
browser tests are green. Screenshots: `docs/screenshots/phase6c1`.

**For the Founder's review.**

- Government Avenue's overloads: keep as they are (incidental, documented),
  design one deliberately, or size those transformers for their daytime
  peak, which would leave DT-OLD-2 as the only overload.
- A register advance is measured consumption, but it is not added to the
  recorded-consumption cross-check, because its span is the readings' and
  not the period's. Adding it needs a rule for how far from the period's
  ends a reading may be. Not decided; not done.
- DT-MKT-3 is all AMI by design, so that one transformer shows the
  cross-checks working. Without it the cross-checks would be unavailable
  everywhere.
- The synthetic report states its attribution rule in its feeder tables and
  not in its substation summary. That split was chosen so both cases are on
  the screens.
- Register readings are all taken at the same instant, and the opening one
  at the first instant of the month. A real round takes days.
- Found, not caused, by this work: a request that arrives while the server
  is warming waits for the warm-up, 5 to 10 seconds. The browser tests no
  longer race it. Whether the server should refuse or hold traffic until it
  is warm is open.

#### Phase 6c-2: Decisions, design system, navigation, Reliability and Revenue (complete, approved 2026-10-05; tag `phase-6c-2`)

**Founder's decisions at the 6c-1 checkpoint (2026-10-05).** Items 1 to 6
are built first, in this branch, before the workspaces.

1. **An attribution-rule difference is a named finding** (data-integrity
   semantics; ADR 0007, second amendment). When a reported figure states an
   attribution rule that differs from the GridIntel reference methodology,
   the difference the rule makes is shown as a finding with its size, for
   example "Rule treats sub-transmission lines as upstream: +56.7 h SAIDI
   under the reference rule". It is not a muted side figure. It is on the
   feeder and substation screens and in "Where to look first".
2. **A register advance counts toward recorded consumption** (ADR 0010) as
   its own measured source, when both readings fall within 3 days of the
   period's ends. It is not pro-rated. Interval coverage and register
   coverage are shown separately. A reading outside the window is excluded,
   with the reason.
3. **Government Avenue has one deliberate daytime overload**, from MDA load,
   documented. The other transformers are sized for their daytime peak, so
   which transformers overload no longer depends on the random seed.
4. **Readiness.** While the server warms up it serves a short "preparing
   data" page instead of holding requests. "-0.0 h" is fixed.
5. **Process.** `npm run verify` runs typecheck, unit tests, lint, build and
   the browser tests, stopping at the first failure. A commit is made only
   after it passes (`ENGINEERING_RULES.md`, section 8).
6. **Alarms are both kinds, never mixed**: alarms recorded by a source
   system, and conditions GridIntel derives from telemetry, each derived one
   labelled with its rule. The dataset gains power-transformer telemetry, so
   Hillcrest T1 and T2 have a loading.
7. **Typeface.** IBM Plex Sans and IBM Plex Mono, self-hosted through
   `next/font`.

**Scope of 6c-2, in order.** Items 1 to 6; the design system and tokens;
navigation (a Utility Intelligence menu, placeholder pages out of the menu,
one `h1` per page); the Reliability workspace; the Revenue workspace (revenue
gap, collection by customer class with MDA visible, commercial against
collection loss by feeder).

**Moved to 6c-3.** The Assets and Events / Alarms workspaces. Decision 6 puts
the alarm data and the power-transformer loading in place in 6c-2; the
workspaces that are shaped around them follow.

**At the 6c-2 checkpoint, as a proposal only** (new infrastructure is the
Founder's decision): a private, access-controlled hosted preview, with the
options, the monthly cost at current prices, what would leave the laptop, and
how access is restricted. The SYNTHETIC DATA banner stays on every screen of
any hosted version.

**The checkpoint reports** the usual items, screenshots, page timings (median
of five) and a before-and-after for every figure that moved.

| Item | Status | Commit |
| --- | --- | --- |
| 5. `npm run verify`; rule in `ENGINEERING_RULES.md` | Done | `0580d97` |
| 1. Attribution-rule difference as a named finding (ADR 0007, second amendment) | Done | `fa22c87` (engine), `db831ff` (screens) |
| 2. Register advance in recorded consumption (ADR 0010) | Done | `eeec750` (engine), `96b0435` (screens) |
| 3. Government Avenue: one designed overload | Done | `5f85271` |
| 4. Readiness page; "-0.0 h" | Done | `df736cb`; "-0.0" in `db831ff` |
| 6. Alarms of both kinds; power-transformer telemetry (ADR 0011) | Done | `8cfc291` (engine), `e39776a` (screens) |
| 7. Typeface; design system and tokens | Done | `8a73223` |
| Navigation | Done | `fc037e4` |
| Reliability workspace | Done | `084bbbb` (engine), `fc037e4` |
| Revenue workspace | Done | `084bbbb` (engine), `fc037e4` |

Item 5 was done first, so that every later commit was made after `verify`.

**What was built, and what moved.**

1. **Attribution-rule finding.** `attributionRuleDifference` (analytics)
   gives the figure on the reference rule less the same figure on the
   report's rule. It is shown as a finding above the attribution table on the
   feeder's screen, on its substation's screen and in the Reliability
   workspace, and is rule 8 of "Where to look first". Before: Farm Road's
   comparison read 0.4 h against 0.4 h with "57.1 h on the reference rule"
   in small type. After: "Rule treats sub-transmission lines as upstream:
   +56.7 h SAIDI under the reference rule". Market Road and Old Town +3.6 h
   each; Government Avenue states the same rule and it moved nothing, which
   its screen says, and it is not in "Where to look first". No index moved.
2. **Register advance.** Reference energy methodology 0.2.0, with the 3-day
   window as a parameter. Region: 1,287 connections now recorded by register
   advance (371,055 kWh) beside 287 by interval meters (404,652 kWh); 138
   advances not counted because the closing reading is an estimate; 2,540
   meters not read; 2,195 with no meter. Before, the 1,425 register meters
   were among 3,965 "no interval data". The total is still available on
   DT-MKT-3 only. No figure of the accounting chain moved.
3. **Government Avenue.** DT-GOV-3 stays at 300 kVA on purpose (110.6%, 53
   hours over). Nine of the other eleven ratings rise one standard size, so
   none can exceed its rating under any seed; they now peak at 51–85% where
   they peaked at 80–104%. Asset risk lists two transformers, not four. No
   connection, energy, revenue or reliability figure moved; feeder loading
   is unchanged at 72.3%. Full table in `DATASET_ASSUMPTIONS.md`.
4. **Readiness.** The warm-up works in steps with a 10 ms pause between
   them; data routes answer with a "preparing data" page that reloads
   itself; `/api/ready` gives 503 while warming. Cold start, three runs: the
   first data request was answered in 1.2 s (it held for 5 to 10 s before),
   later ones in 0.05 to 0.6 s, and the screen was ready 6.4 to 6.8 s after
   the server began listening.
5. **Alarms.** 29 synthetic source alarms, 26 of them built from the outage
   log; two derived rules (loaded above rating, monitor quiet); the two
   shown as separate lists on every screen in place of "alarms: not
   available". Power transformers peak at 72.2% (Riverside T1), 55.7%
   (Hillcrest T1) and 24.8% (Hillcrest T2).
6. **Design system.** Tokens for surfaces, lines, five text levels, status,
   chart series and three type sizes (`globals.css`); every product component
   names a token. Shared components in `src/components/system`. IBM Plex
   Sans and Mono through `next/font/google`, which downloads the files at
   build time and serves them from the app. Dates are written with fixed
   month names.
7. **Navigation.** Menu: Overview; Utility Intelligence with Executive,
   Operations, Reliability, Revenue. The nine "Coming Soon" pages are out of
   the menu and still reachable by address. One `h1` on every page (a
   browser test checks 30 pages). The SYNTHETIC DATA label, the reporting
   period and the as-of time are in one bar above every dashboard screen.
8. **Reliability workspace** (`/dashboard/utility/reliability`). Feeders
   ranked by network-attributable SAIDI (Farm Road 57.1 h, Old Town 9.2 h,
   Market Road 3.8 h, Government Avenue 3.1 h), with upstream, load shedding
   and total beside it; the rule findings and every reported figure at the
   scope it is stated for; the portfolio split by class; by cause; by origin
   point; the elements interruptions began at (the Hillcrest rural 33 kV
   line: 16); day-by-day band compliance for each feeder.
9. **Revenue workspace** (`/dashboard/utility/revenue`). The revenue gap and
   its two parts by feeder; collection by customer class, portfolio and per
   feeder, with government (MDA) accounts first: 90 accounts, 19.8%
   collected, ₦13.8 M not collected, 45.0% of the shortfall; commercial
   against collection loss by feeder, as shares and in money.

**Page timings.** Production build, one machine, milliseconds, median of five
requests after warm-up (the timing test). "Before" is `main` at the start of
6c-2. Differences of this size are run-to-run noise; every route is far
inside the 500 ms budget.

| Route | Before | After |
| --- | --- | --- |
| Executive | 136 | 108 |
| Reliability | new | 87 |
| Revenue | new | 96 |
| Operations home | 11 | 10 |
| Region | 108 | 80 |
| Substation, Riverside / Hillcrest | 104 / 85 | 80 / 84 |
| Feeder, Market Road / Old Town / Government Avenue / Farm Road | 92 / 92 / 102 / 90 | 109 / 108 / 85 / 107 |
| Transformer, Riverbank (first 40 rows / all 135) | 85 / 158 | 96 / 187 |
| Service point, register / prepaid / AMI | 17 / 22 / 20 | 18 / 19 / 16 |

The warm-up takes about 6 s on an idle machine, about half a second of it
the pauses that let requests through. The warmed server holds about 375 MB.

**Acceptance, as met.** `npm run verify` green: typecheck, 404 unit tests,
lint, build and 37 browser tests. Screenshots: `docs/screenshots/phase6c2`.

**Decisions the engineer made, for the Founder to confirm or change.** The
Founder's answers of 2026-10-05 are under Phase 6c-3 below: all confirmed
except the source alarms and the reading round, which change.

- *A register advance resting on an estimated reading is not counted* (ADR
  0010). The decision says "measured source"; an estimated reading is not
  one. The alternative is to count it and mark the register figure partly
  estimated.
- *The sizing rule for Government Avenue is a hard guarantee*: a rating must
  exceed the highest demand before variation by the most the variation can
  add (×1.296). That is what makes it independent of the seed, and it is why
  nine ratings rose and the feeder no longer runs close to rating by day. A
  looser rule would leave them higher and bring the seed back in.
- *A rule difference of zero is stated on the feeder's own screen and is not
  in "Where to look first".*
- *`/api/ready`* was added so the browser tests, and later a host's health
  check, can tell warming from ready. It reports a state and no data.
- *Derived conditions: two rules*, loaded above rating and monitor quiet
  (120 minutes). The source alarms deliberately include no overload and no
  communications alarm.
- *The SYNTHETIC DATA bar is on every dashboard page*, placeholders
  included, not only on data screens.
- *The synthetic reading round was not spread over days*, so no reading is
  outside the 3-day window and that exclusion is covered by unit tests
  only. Spreading it would move energy billed.

**Not done, by design.** The older tables inside the Operations panels keep
their own markup; only the new workspaces use the table primitives. The
valuation table on the Revenue screen lists all 48 transformers and is long.
Both are for 6c-3.

**Proposal only: a private, access-controlled hosted preview.** New
infrastructure is the Founder's decision; nothing has been set up. Prices
were read on 2026-10-05 and must be confirmed at sign-up.

What the app needs: one always-on Node process (it computes its screens once
at start and keeps them in memory, about 375 MB), so 1 GB of memory or more.
A serverless host would warm up again on every cold start and is a poor fit.

| Option | Monthly cost | What leaves the laptop | How access is restricted |
| --- | --- | --- | --- |
| A. Cloudflare Tunnel from the laptop, behind Cloudflare Access | $0 (Zero Trust free plan, up to 50 users). Needs a domain on Cloudflare, about $10 a year if none is held | Nothing is stored elsewhere. Pages pass through Cloudflare while the laptop is on and the tunnel is running | Cloudflare Access: a named list of email addresses, each signing in with a one-time code or Google |
| B. A small VPS (Hetzner CX23: 2 vCPU, 4 GB, €5.99) running the build, behind Cloudflare Access | about €6, plus the domain | The built app and the code that generates the synthetic dataset, on a server in Germany or Finland | Cloudflare Access as in A; the server's firewall accepts only Cloudflare |
| C. Render web service (Starter, $7, has 512 MB: too small; the next size up is needed) | $7 is not enough; expect the next tier, price to confirm | The source repository (Render builds from GitHub) and the built app, in the US or EU | No access control of its own at this tier: Cloudflare Access in front, or a password added to the app, which is an auth decision |
| D. Vercel Pro with password protection | $20 + $20 per project | The source repository and the built app | One shared password, not named people. Serverless: every cold start warms up again |

**Recommendation: B**, or A for a first look. A costs nothing and moves
nothing off the laptop, but it is only up while the laptop is. B is always
up for about €6 a month, with access limited to named people and no
password to share. In both, no real data leaves the laptop, because there is
none: the dataset is synthetic and is generated by the code itself. The
SYNTHETIC DATA bar is in the dashboard layout, so it is on every screen of
any hosted version and cannot be left off one screen.

Each option is new infrastructure, and B to D put the code on someone else's
machine. Access control in front of the app (A, B) adds no auth code to the
app; a password inside the app (C) would, and is a separate decision.

**Founder's decision (2026-10-05): option A for now, B later.** Nothing is
to be set up by the engineer; see Phase 6c-3 for the guide that is owed.

**Corrected by the Founder (2026-10-06): the preview is on Vercel, not
option A.** The Cloudflare guide is dropped. What is owed instead is under
Phase 6c-3.

**Hosting notes (Founder's decisions, 2026-10-07).**

- *Production is public, by the Founder's choice.* Deployment Protection is
  Standard Protection: preview (branch) URLs are behind a Vercel login, the
  production URL is open to anyone.
- *How it deploys.* The repository holds no Vercel configuration; the
  project is connected through the Vercel GitHub app. A push to `main`
  deploys to production; a push to any other branch makes a preview. A merge
  to `main` is therefore a publication.
- *Not indexed until launch.* Every page carries `noindex, nofollow`
  (`metadata.robots` in `src/app/layout.tsx`) and `/robots.txt` disallows
  everything (`src/app/robots.ts`). Both are removed only on the Founder's
  decision to launch.
- *The SYNTHETIC DATA bar is on every screen*, including the page a visitor
  lands on: `/` redirects to `/dashboard`, which is inside the dashboard
  layout that holds the bar. A browser test holds this.
- *The repository stays public during development.* No secret is ever
  committed. Strategy notes are not kept in the repository: they are in
  `private/`, which is in `.gitignore`.
- *Cold start.* Until the Phase 6 close-out, each new function instance on
  Vercel computed the screens again, and a visitor saw "Preparing data"
  while it did (observed on the live site, 2026-10-07). Since ADR 0012 the
  network screens are files built with the application, and a service point
  is rendered on its first visit; no warm-up runs on the demonstration
  dataset. `/api/ready` on Vercel reports one instance's state and is not a
  health signal for the deployment.
- *Rolling back.* If a deployment to production is wrong, go back to the one
  before it without waiting for a new build: on vercel.com open the
  project, and on the Production Deployment tile select **Instant
  Rollback**, choose the previous deployment, **Continue**, then **Confirm
  Rollback**. It takes effect at once. On the Hobby plan only the
  immediately previous production deployment can be chosen. **After a
  rollback Vercel stops promoting new pushes to `main`**: the site stays on
  the rolled-back deployment until **Undo Rollback** is selected on the same
  tile and a deployment is promoted. (Steps read from Vercel's
  documentation on 2026-10-08.)

#### Phase 6c-3: Checkpoint decisions, Assets and Events / Alarms (approved and merged 2026-10-07; tag `phase-6c-3`)

**Founder's answers at the 6c-2 checkpoint (2026-10-05).**

Confirmed as built:

- A register advance resting on an estimated reading is not counted (ADR
  0010).
- The Government Avenue sizing rule is a hard guarantee (×1.296).
- A rule difference of zero is stated on the feeder's own screen and is not
  in "Where to look first".
- `/api/ready` stays: a state, no data.
- The SYNTHETIC DATA bar is on every dashboard page, placeholders included.

Changed:

- **Source alarms.** The source alarms are to include the kinds real SCADA
  raises: RTU communications failure and feeder overcurrent trip. The two
  derived rules stay. This replaces the 6c-2 choice to leave overload and
  communications alarms out of the source data (amend ADR 0011).

**Scope, in this order.**

1. **Source alarms of real SCADA kinds** (amend ADR 0011;
   `DATASET_ASSUMPTIONS.md`). Add RTU communications failure and feeder
   overcurrent trip to the synthetic source alarms. Design the data so the
   screen shows both cases, each recognisable as such:
   - a source alarm that a GridIntel derived condition agrees with;
   - a derived condition that no source alarm raised, for example the
     DT-GOV-3 daytime overload.

   Source alarms and derived conditions remain two lists, never mixed;
   agreement is shown as a relation between an entry in each, not by merging
   them.
2. **Spread the reading round.** Readings are taken over several days per
   route, so that a few fall outside the 3-day window and their exclusion,
   with its reason, shows on screen. Report at the checkpoint what moved in
   energy billed, and in anything downstream of it, before and after.
3. **Revenue valuation table.** The top 10 transformers, with the full list
   one click away.
4. **Operations tables.** Move the older tables inside the Operations panels
   onto the system table primitives.
5. **Typeface files in the repository.** Commit the IBM Plex Sans and IBM
   Plex Mono font files and load them with `next/font/local`, so the build
   needs no network.
6. **The 6c-3 workspaces: Assets and Events / Alarms**, as in the workspace
   table below.

**Hosted preview (corrected 2026-10-06).** The Founder uses Vercel, not
option A; the Cloudflare guide is not wanted. The engineer changes no Vercel
setting and creates nothing external. Owed at the 6c-3 checkpoint:

- whether the repository holds a Vercel setup (`vercel.json`, a `.vercel`
  folder, any deploy configuration), and whether pushes to `main` deploy
  automatically;
- how GridIntel behaves on Vercel: the warm-up and the cache on serverless
  cold starts, memory needs, and whether the "preparing data" page is what a
  viewer sees on a cold start;
- a step-by-step guide, for someone doing it for the first time on Windows,
  to restricting access to the deployment: the Deployment Protection options
  by plan, current pricing from Vercel's own site, how to add or remove a
  viewer, and how to take it offline;
- whether the intended use fits the Hobby plan's terms.

The SYNTHETIC DATA bar stays on every screen of any hosted version.

**At the checkpoint.** The usual report, screenshots, timings (median of
five), before and after for anything that moved, and the Vercel items above.

**Phase 6c-3 checkpoint (2026-10-07). Approved by the Founder and merged to
`main` on 2026-10-07, tag `phase-6c-3`.**

**Done, in the order of the scope.**

1. *Source alarms of real SCADA kinds* (ADR 0011, amendment). 31 alarms;
   `RTU-COMMS-FAIL` and `FDR-OC-TRIP` / `FDR-EF-TRIP`. The agreement case is
   the monitor on DT-OLD-3; the derived conditions with no source alarm are
   DT-GOV-3 and DT-OLD-2. No reliability figure moved.
2. *The reading round is spread* (ADR 0010, amendment). 24 advances are
   outside the 3-day window (8 on Farm Road with no opening reading in it,
   16 on Old Town with no closing one) and each shows on its service-point
   screen with the reason. What moved is in the table below.
3. *Revenue valuation table*: the ten largest transformers, the residuals
   never cut, all 48 one click away.
4. *Operations tables* on the system table primitives, with the Executive
   and service-point tables.
5. *Typeface files in the repository*, loaded with `next/font/local`.
6. *Assets and Events / Alarms workspaces* (ADR 0013), in the menu and the
   hub. The six workspaces of Phase 6c now exist.

Also, by the Founder's decisions of 2026-10-07: the hosting notes above;
`noindex` and `robots.txt`; strategy notes moved out of the public docs into
`private/` (not committed); ADR 0012, a proposal.

**What moved when the reading round was spread.** Before is `main` at the
start of 6c-3. Energy received, technical loss, energy delivered, recorded
interval consumption and every reliability figure did not move.

| Portfolio | Before | After |
| --- | --- | --- |
| Energy billed (kWh) | 1,719,723 | 1,720,971 |
| Unbilled energy (kWh) | 188,619 | 187,371 |
| Recorded by register advance (kWh) | 371,055 | 369,681 |
| ATC&C loss | 31.50% | 31.45% |
| Commercial part | 8.96% | 8.90% |
| Collection part | 13.20% | 13.21% |
| Billing efficiency | 81.70% | 81.76% |
| Collection efficiency | 83.84% | 83.84% (unchanged to two places) |
| Revenue billed (₦) | 190,022,569 | 190,320,427 |
| Revenue collected (₦) | 159,323,296 | 159,570,252 |
| Revenue not realised (₦) | 46,557,069 | 46,310,113 |
| Commercial gap (₦) | 15,857,796 | 15,559,938 |
| Collection gap (₦) | 30,699,273 | 30,750,175 |

| By feeder, before → after | Market Road | Old Town | Government Avenue | Farm Road |
| --- | --- | --- | --- | --- |
| Energy billed (kWh) | 587,278 → 588,776 | 242,099 → 241,797 | 829,900 → 829,744 | 60,446 → 60,654 |
| ATC&C loss | 18.72% → 18.54% | 62.77% → 62.81% | 36.88% → 36.89% | 70.94% → 70.81% |
| Register advance counted (kWh) | 112,274 → 113,728 | 44,000 → 41,550 | 208,289 → 208,117 | 6,493 → 6,285 |
| Revenue not realised (₦) | 17,208,978 → 16,950,851 | 10,209,852 → 10,218,143 | 16,945,754 → 16,953,603 | 2,192,524 → 2,187,555 |

Government Avenue now ranks first on revenue not realised, ahead of Market
Road by ₦2,752 (under 0.1%). The two were ₦263,224 apart the other way
before. A ranking that close is not a finding, and the Executive screen
should not be read as if it were.

**Page timings.** Production build, one machine, milliseconds, median of five
requests after warm-up. Before is the 6c-2 checkpoint. Every route is inside
the 500 ms budget; differences of this size between runs are noise, and the
machine was also running the browser tests' second server.

| Route | Before | After |
| --- | --- | --- |
| Executive | 108 | 145 |
| Reliability | 87 | 82 |
| Revenue | 96 | 59 |
| Assets (ten transformers / all 48) | new | 52 / 117 |
| Events / Alarms | new | 58 |
| Operations home | 10 | 12 |
| Region | 80 | 134 |
| Substation, Riverside / Hillcrest | 80 / 84 | 85 / 81 |
| Feeder, Market Road / Old Town / Government Avenue / Farm Road | 109 / 108 / 85 / 107 | 109 / 109 / 106 / 94 |
| Transformer, Riverbank (first 40 rows / all 135) | 96 / 187 | 97 / 232 |
| Service point, register / prepaid / AMI | 18 / 19 / 16 | 23 / 24 / 26 |

**Choices made, for the Founder to confirm** (ADR 0013).

- *An outage record with no restoration time is not called in progress.* It
  is listed apart as "Restoration not recorded". On live data most
  interruptions in progress would fall there.
- *For an alarm, "who is affected" is "active accounts behind it"*, from the
  registry, and is said not to be customers without supply.
- *"Requires attention" has no score*: three facts in three columns and a
  fixed, printed order.
- *The agreement case stays on a transformer monitor* (carried from the ADR
  0011 amendment, still open).

**Not done, and known.**

- The address `/anything-that-does-not-exist` shows the framework's plain
  "not found" page, outside the dashboard layout, so it has no SYNTHETIC
  DATA bar. It shows no data. A not-found inside the dashboard has the bar.
- The strategy text moved on 2026-10-07 is still in the git history on
  GitHub. Removing it means rewriting the history of `main` and every phase
  branch, which is the Founder's decision.
- `docs/FOUNDING_DIRECTIVE.md` (the product vision) is still public. It was
  not moved: it is the reference the engineering rules point to.
- ADR 0012 is a proposal. Until it is decided, a visitor to the public site
  still sees "Preparing data" on a cold start.

**Acceptance, as met.** `npm run verify` green: typecheck, 443 unit tests,
lint, build and 41 browser tests. Screenshots:
`docs/screenshots/phase6c3`.

#### Phase 6 close-out (approved and merged to `main` on 2026-10-09, tag `phase-6`)

**The Founder's decisions at the 6c-3 checkpoint (2026-10-07), and what was
done.**

1. *An outage has a status; open means in progress* (ADR 0013, amendment).
   `Outage.status` from the source. One synthetic outage is open at the demo
   clock: the 11 kV fault on Farm Road from 23:20 on 30 September, ten
   transformers, 1,015 customers, its earth-fault trip alarm standing. The
   21 September complaint has no status and stays "Restoration not
   recorded", as a data-quality item.
2. *An open interruption counts in the indices, provisionally* (ADR 0013,
   second amendment; reliability methodology 0.3.0, hours of supply 0.2.0).
   Counted to the end of the period and marked "Provisional: includes n
   open outage(s); duration counted to period end". Not an estimate.
3. *ADR 0012 adopted.* On the synthetic demonstration adapter the network
   screens are built with the application; a service point is rendered on
   its first visit and computes only that screen; no warm-up runs. The
   request path, with the warm-up and the preparing page, is kept for real
   adapters and stays built and tested.
4. *Git history is not rewritten.*
5. *The founding directive is out of the repository*:
   `private/FOUNDING_DIRECTIVE.md`, not committed. `CLAUDE.md`, the
   engineering rules, the blueprint, ADR 0001 and the README point there.
6. *A not-found page in the dashboard frame*, with the SYNTHETIC DATA bar.
7. *DT-GOV-3 is on the Assets attention list* as loaded above rating
   (110.6% at peak, 53 of 720 readings) with no source alarm raised. It
   was already; a browser test now holds it.
8. *The agreement case on a substation RTU* is deferred.

**What moved.**

| | 6c-3 | Close-out |
| --- | --- | --- |
| Farm Road SAIDI | 441.8 h | 442.5 h, provisional |
| Farm Road network-attributable SAIDI | 57.1 h | 57.8 h |
| Farm Road days below the Band D minimum | 9 of 30 | 10 of 30 |
| Hillcrest network SAIDI, and its difference from the report | 22.8 h, +20.9 h | 23.1 h, +21.2 h |
| Portfolio SAIDI | 240.9 h | 241.0 h, provisional |
| Portfolio energy received (kWh) | 2,104,984 | 2,104,819 |
| Portfolio ATC&C loss | 31.45% (printed 31.5%) | 31.45% (printed 31.4%) |
| Revenue not realised (₦) | 46,310,113 | 46,304,966 |
| Source alarms, and those standing | 31, 3 | 32, 4 |
| Assets listed for attention | 9 of 55 | 10 of 55 (Farm Road feeder, for its standing trip alarm) |

The energy figures moved because Farm Road was off for its last 40 minutes.
The synthetic Farm Road report was raised from 0.4 h and 0.2 to 1.0 h and
1.1, so that it still agrees with the records on its own attribution rule;
what the rule changes is still +56.7 h.

**The two builds.** `next build` reports 128 pages built ahead of time, 112
of them data screens (103 network levels, the Operations home and eight
workspace pages); the request build reports 25. The ordinary build takes
about a minute on the development laptop and its app output is 185 MB.

**Page timings.** Production builds, one machine, milliseconds, median of
five. "On request" is the engine rendering from its result cache, as at
6c-3; "built ahead" is what a visitor to the demonstration now gets. Every
route is inside the 500 ms budget on both.

| Route | 6c-3 | On request | Built ahead |
| --- | --- | --- | --- |
| Executive | 145 | 158 | 25 |
| Reliability | 82 | 112 | 16 |
| Revenue | 59 | 52 | 13 |
| Assets (ten transformers / all 48) | 52 / 117 | 37 / 83 | 11 / 17 |
| Events / Alarms | 58 | 33 | 14 |
| Operations home | 12 | 20 | 12 |
| Region | 134 | 94 | 22 |
| Substation, Riverside / Hillcrest | 85 / 81 | 91 / 106 | 23 / 16 |
| Feeder, Market Road / Old Town / Government Avenue / Farm Road | 109 / 109 / 106 / 94 | 154 / 147 / 124 / 84 | 26 / 21 / 20 / 22 |
| Transformer, Riverbank (first 40 rows / all 135) | 97 / 232 | 104 / 212 | 26 / 32 |
| Service point, register / prepaid / AMI | 23 / 24 / 26 | 23 / 26 / 19 | 8 / 8 / 8 |

**A cold start, measured locally.** On a server of the ordinary build that
has only just started, the first answer for a feeder is the screen with its
figures, `/api/ready` says `not_started`, and the first visit to a service
point carries its figures with no preparing page; a browser test holds all
three. In a fresh process that first visit costs about one second, almost
all of it generating the synthetic dataset (0.5 to 0.9 s); the screen itself
takes about 50 ms.

**Cold start on production, measured after the merge (2026-10-09).** Plain
requests from the development laptop in Nigeria to
`https://gridintel-iota.vercel.app`, minutes after the deployment finished,
so nothing had been asked for before. Seconds, whole response. The laptop's
connection was uneven that morning: the same cached file took between 0.3 s
and several seconds, so these are a ceiling on what the site did, not a
measure of it.

| Screen | First visit | Repeat | Served as |
| --- | --- | --- | --- |
| Executive (top / all feeders) | 4.5 / 3.3 | 1.9 / 17.9 | file |
| Reliability | 2.8 | 0.7 | file |
| Revenue | 1.2 | 0.9 | file |
| Assets (ten / all 48) | 1.5 / 1.8 | 3.6 / 0.7 | file |
| Events / Alarms | 2.5 | 1.2 | file |
| Operations home | 2.9 | 1.2 | file |
| Region | 10.3 | 1.3 | file |
| Substation, Riverside / Hillcrest | 2.8 / 2.3 | 2.1 / 1.3 | file |
| Feeder, Market Road / Old Town / Government Avenue / Farm Road | 3.8 / 5.4 / 1.7 / 4.0 | 3.5 / 2.2 / 3.5 / 2.1 | file |
| Transformer, Riverbank (40 rows / all 135), Government Avenue 3 | 1.2 / 2.2 / 1.5 | 0.7 / 0.7 / 1.0 | file |
| Service point SP-FRM3-010 (the first, on a cold instance) | 2.5 | 0.6, 0.3 | rendered on first visit, then a file |
| Service point SP-OLD2-001 | 1.1 | 0.6, 0.6 | the same |
| Service points SP-GOV3-004, SP-MKT2-005 | 4.6, 2.6 | 5.6, 0.6 | the same |

- **No screen showed "Preparing data"**, on a first visit or a repeat: all
  18 network screens asked for, and all four service points. `/api/ready`
  answered `not_started` before and after.
- **Every network screen was served as a file** (Vercel's cache header said
  `PRERENDER` on the first request and `HIT` after). Their times are the
  download of 0.2 to 0.9 MB of HTML over this connection, not computing.
- **A service point's first visit is over the 2 s target.** The first, on a
  cold instance, took 2.5 s in all, 2.5 s of it before the first byte, so it
  is the server and not the download. Later first visits took 1.1 to 4.6 s
  on a connection where a cached file took up to 5.6 s, so they cannot be
  read more finely than "about one to two and a half seconds". From then on
  a service point is a file.
- Also checked on production: `/robots.txt` disallows everything; pages
  carry `noindex, nofollow`; an address that leads nowhere answers 404 in
  the dashboard frame with the SYNTHETIC DATA bar; an old `?valuation=all`
  address redirects to `/revenue/all`.

**Proposal only, not built: make a service point's first visit cheaper.**
Locally that first visit is about 1 s, of which 0.5 to 0.9 s is generating
the whole synthetic dataset (every connection's month of energy, bills and
readings) and 0.05 s is the screen. A Vercel instance is slower, which is
where the 2.5 s comes from. Three ways to bring it under 2 s, cheapest
first:

1. *Generate the energy of one supply at a time.* `buildEnergyModel` (0.4 s
   of the 0.9 s) builds every transformer's and every meter's hourly series
   at once. Building a transformer's connections when one of them is first
   asked for would leave a service-point visit paying for one transformer
   of 48. The registry, the outage log and the billing run would still be
   built whole (about 0.2 s). It changes only the demonstration adapter; the
   dataset it produces must be identical, which the existing dataset tests
   would hold. This is the recommended one.
2. *Build the dataset once at build time and ship it as a file.* The first
   visit would read it instead of generating it. It adds a build step and a
   large file to each function, and reading it may not be faster than
   generating it.
3. *Build every service point ahead of time* (ADR 0012, option A): 6,448
   more pages and about 0.5 GB of output. No first visit is ever slow, at
   the cost of a build several minutes longer.

None of these is needed for the network screens, which is where a visitor
arrives.

**`verify`.** It now makes both builds and runs the browser tests against
both. The browser tests use one worker on a developer's machine, to keep
memory down, and the default number in CI (`workers` in
`playwright.config.ts`; Founder's decision, 2026-10-09). On this laptop
(8 GB) the whole of `verify` in one go was stopped once for low memory; run
step by step it passes.

**The Founder's decisions at the close-out checkpoint (2026-10-09).**

- The synthetic Farm Road report at 1.0 h is accepted.
- Browser tests: one worker locally, the default in CI.
- A telemetry reading at the as-of time, with Farm Road's load at zero
  after the trip, is the first item of the next phase.
- A cold service point over 2 s on Vercel: propose the generator change, do
  not build it. The proposal is above.

**Known, and not done.**

- "Loading now" on Farm Road still shows the 23:00 reading, the last in the
  dataset, twenty minutes before the feeder tripped. It is the latest
  reading held and is labelled with the as-of time.
- The first visit to a service point generates the whole synthetic dataset.
  Whether that is inside 2 s on a cold Vercel instance is not known until
  it is measured there. If it is not, the dataset generator would have to
  build one connection without building all of them.
- A period that has not ended (as-of before the period end) would need an
  open interruption counted to the as-of time, not the period end. Not
  built; the demo clock is the period end.

**Acceptance, as met.** Typecheck clean; 452 unit tests; lint clean; both
builds; 43 browser tests against both builds. Screenshots:
`docs/screenshots/phase6close`.

**The workspaces.**

| Workspace | User | The job it answers | Phase |
| --- | --- | --- | --- |
| Reliability | Network performance engineer | "Which feeders fail their customers, why, and is it ours to fix?" | 6c-2 |
| Revenue | Revenue manager | "Where is revenue not realised, who is not paying, and is the loss commercial or collection?" | 6c-2 |
| Assets | Asset manager | "Which assets require attention?" | 6c-3 |
| Events / Alarms | Operations engineer on shift | "What is wrong now, where, and who is affected?" | 6c-3 |

- **Reliability.** Feeders ranked by network-attributable SAIDI and SAIFI;
  the split by class, cause and origin point; day-by-day band compliance;
  the assets interruptions most often begin at; reported against calculated,
  with the attribution rule and its finding.
- **Revenue.** The revenue gap and its two parts; collection by customer
  class with government (MDA) accounts visible; commercial loss against
  collection loss by feeder.
- **Navigation.** A Utility Intelligence menu; the "Coming Soon" pages out of
  the menu; one `h1` per page; the period and the SYNTHETIC DATA label in one
  place.
- **Design system and typeface.** One set of tokens for status, origin,
  type and spacing, taken from what the Operations panels already do; the
  metric, table and panel components moved out of `components/operations`
  into a shared set.

## Next phase (not chosen; the Founder chooses it)

**Its first item, already decided (2026-10-09).** A telemetry reading at the
as-of time. The synthetic dataset's last reading is at 23:00 on 30
September, so "loading now" at the demo clock shows Farm Road at 25.4%,
twenty minutes before the feeder tripped. Add readings at the demo clock,
with Farm Road's feeder, its ten transformers and Hillcrest T2, which
carries Farm Road alone, at zero after the trip, and report what moves.

**Open for the Founder's decision.** Whether to make a service point's
first visit cheaper, and which way (the proposal is in the Phase 6
close-out).

## Phase 7: GIS and network intelligence

Moved ahead of the API and database by Founder decision (ADR 0004).

**Goal.** A map that is an analytical view of the network.
**Includes.** Map read-model services, feeder topology rendering, KPI
overlays, outage geography, map-to-drill-down linking.
**Condition.** The map consumes services only, never the dataset directly.
**Dependencies.** Phase 6. Coordinates and feeder routes are already in the
Phase 5 dataset, so no re-seed is needed.
**Risks.** Leaflet is installed; any other map dependency or tile provider is
a decision gate (major dependency, external integration).
**Acceptance.** An overloaded transformer can be traced on the map to its
feeder, substation, area and affected customers.

## Phase 8: API and backend boundary

**Goal.** Services reachable over HTTP with validated contracts.
**Includes.** Route handlers, runtime schemas (Zod, already installed), error
model, structured logging, auth boundary design.
**Dependencies.** Phase 6 service contracts stable.
**Risks.** Auth and security are decision gates.
**Acceptance.** Every service has a documented, validated endpoint; invalid
input is rejected with a typed error; contract tests pass.

## Phase 9: Production data architecture

**Goal.** A database adapter behind the existing ports, with history.
**Includes.** Schema, migrations, seed from the demo dataset, ingestion path
for interval and telemetry data, topology history, stale-data policy.
**Dependencies.** Phase 8. New infrastructure is a decision gate.
**Risks.** Schema lock-in; time-series volume.
**Acceptance.** The app runs unchanged on the database adapter; parity tests
between memory and database adapters pass.

## Phase 10: Mini-grid and DER intelligence

**Goal.** Extend the domain and analytics to sites, PV, BESS, inverters and
generators.
**Dependencies.** Phase 9. Touches the energy-accounting boundary rules
(decision gate: data-integrity semantics).
**Acceptance.** Site performance and availability calculated on synthetic
site data without double counting against network energy accounts.

## Phase 11: AI / MCP intelligence

**Goal.** Natural-language query and explanation over services.
**Includes.** Tools wrapping services one-to-one, PII filtering, citations to
source results, the synthetic marker carried into every answer, tool-call
audit.
**Dependencies.** Phases 6 and 8. External integration is a decision gate.
**Acceptance.** Every factual statement in an answer links to a service
result; the assistant states "insufficient data" where the engine does.

## Phase 12: Planning and optimization

**Goal.** Load growth, capacity, scenarios, investment prioritization.
**Dependencies.** Phases 7 and 9; financial domain objects.
**Acceptance.** A scenario produces capacity shortfalls and costed options
with stated assumptions.

## Phase 13: Edge and IoT integration

**Goal.** Real telemetry from field devices.
**Includes.** Device registration, ingest endpoints, protocols, heartbeat
monitoring.
**Dependencies.** Phase 9. External integration and security gates.
**Acceptance.** A physical or simulated device appears in the registry and
its readings flow to a KPI with full provenance.

## Phase 14: Digital energy twin

**Goal.** Unified physical and digital representation, and controlled
closed-loop workflows.
**Dependencies.** Phases 7, 12 and 13.
