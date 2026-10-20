# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-20. Status: **Phase 10 (Mini-grid Intelligence) is
complete** (accepted by the Founder, 2026-10-12; merged to `main`, tags
`phase-10a` and `phase-10b`). It was taken ahead of Phase 8 by the Founder's
decision of 2026-10-10 (ADR 0015). Phase 7 is complete (tags `phase-7a`,
`phase-7b`). **Phase UI-A is accepted** (Founder, 2026-10-14, checked on a
phone; merged to `main`, tag `phase-ui-a`). **Phase UI-B is accepted** (Founder, 2026-10-15, checked on
a phone; merged to `main`, tag `phase-ui-b`). **The UI revamp is
complete.** **Phase REPORTS-A is merged** (by the Founder's instruction of
2026-10-19; tag `phase-reports-a`). **Phase REPORTS-B is at its
checkpoint** (2026-10-20): the other three reports and XLSX, on branch
`phase-reports-b`, not merged (ADR 0019 and its amendment).

**Order of what follows (Founder, 2026-10-13).** The UI revamp comes first,
before GridIntel is shown to people. After it the next modules are **DER
Intelligence, then Planning**; that order is to be confirmed after user
feedback. **AI (Phase 11) will be built per sector**: one AI layer for the
platform, each sector registering its own tools over its own services (ADR
0017). Phases 8 and 9 keep their numbers and their place is not decided
here.

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

## Phase 7: GIS, a platform capability (complete; approved 2026-10-10, tags `phase-7a` and `phase-7b`)

Moved ahead of the API and database by Founder decision (ADR 0004). Chosen
as the next phase by the Founder on 2026-10-09, with the decisions recorded
in ADR 0014. Two gated sub-phases; work stops after each.

**The Founder's decisions (2026-10-09; ADR 0014).**

1. GIS is a platform capability serving every module (Utility now;
   Mini-grid, DER and Planning later): the spatial view of the energy
   system the user operates. It is not a site-prospecting tool. Every value
   on the map comes from an existing service, with status and origin; the
   map never computes a figure.
2. Write once, configure per section: one shared map component in the
   design system; each module registers only its layers and default view.
3. Spatial domain: location for any entity (points, lines, areas), with no
   required link to a substation.
4. Spatial services generic over entity kinds: what is here, what is inside
   an area, what is behind an asset, totals by area.
5. Viewer scope from the first day: every spatial service and read model
   takes a viewer; filtering happens in services; cache keys include the
   viewer scope; a test proves a restricted viewer sees nothing outside its
   territory. The only viewer for now is the public demonstration. Screens
   for a real tenant render per request; building ahead of time stays only
   for the public synthetic demonstration.
6. AI-ready on the same pattern; nothing built now.

**Condition (ADR 0004, unchanged).** The map consumes services only, never
the dataset directly.

### Phase 7a: Foundations (approved and merged 2026-10-09; tag `phase-7a`)

| Item | Status | Commit |
| --- | --- | --- |
| Housekeeping: a telemetry reading at the as-of time | Done | `48827ed` |
| Housekeeping: a service point's first visit generates one transformer's connections, not the dataset (option 1 of the Phase 6 proposal) | Done | `97fd3c8` |
| Spatial domain: geometry, entity location with its basis, areas, territories | Done | this checkpoint |
| Spatial analytics: geometry, locations from the registry, network trace, allocation to areas (methodology `gridintel.spatial.reference` 0.1.0) | Done | this checkpoint |
| Areas and territories port; in-memory and demonstration adapters | Done | this checkpoint |
| Viewer scope: `ViewerContext`, visibility by territory, viewer-keyed cache | Done | this checkpoint |
| Spatial services: what is here, what is inside, what is behind, totals by area | Done | this checkpoint |
| Layer registry and the map read model; Utility registered as the first module | Done | this checkpoint |
| ADR 0014, with the basemap and boundary proposals | Done; the proposals are not decided | this checkpoint |

No screen, route or component was built, and no dependency was added.

**1. The as-of reading: what moved.** One reading at the demo clock (1
October, 00:00 WAT) from every transformer monitor and remote terminal
unit. Compared across every network screen, the five workspaces and five
service points, field by field: **only the 55 "loading now" figures moved**
(48 distribution transformers, 4 feeders, 3 power transformers), each from
its 23:00 reading to its 00:00 one, with the reading it names. No peak, no
energy, revenue or reliability figure, no alarm, condition or attention
list moved: the reading is outside the month.

| Loading now | Before (23:00 reading) | After (00:00 reading) |
| --- | --- | --- |
| Farm Road feeder | 25.4% | 0.0% |
| Its ten transformers (DT-FRM-3 shown) | 29.5% | 0.0% |
| Hillcrest T2 | 11.7% | 0.0% |
| Hillcrest T1 | 22.8% | 17.3% |
| Riverside T1 | 35.1% | 25.1% |
| Market Road / Old Town / Government Avenue | 38.6% / 37.4% / 29.6% | 27.7% / 26.6% / 22.5% |
| DT-OLD-2 / DT-GOV-3 | 53.9% / 44.5% | 40.7% / 31.3% |

A zero here is a measured reading, not a gap, and its status is "ok". The
other feeders fall because midnight load is lower than 23:00 load. An
assumption is recorded in `DATASET_ASSUMPTIONS.md`: no load-shedding block
is taken to begin at the clock, though three feeders are shed from midnight
on most days, because the dataset holds no interruption that starts at or
after the clock.

**2. A service point's first visit.** The energy and billing of one supply
(a transformer's connections, or the 11 kV customer) depend only on that
supply, so the demonstration adapter now generates one supply when a
question is about its connections, and the whole dataset only when a
question needs it (`src/repositories/demo/onDemand.ts`). The billing port
takes an optional list of accounts, and the service-point read model asks
for its own account only.

- *The dataset is identical.* The existing dataset tests pass unchanged. A
  new test asks for every supply's records both ways and compares them
  record for record, in order. Every screen compared above is unchanged.
- *Measured locally*, a fresh process, first service-point view: 840 to
  1,049 ms before, 74 to 211 ms after (five runs each). Loading the code
  takes about 0.3 to 0.4 s on top in both.
- *Not measured on Vercel.* The 2.5 s observed on production was a cold
  function instance; it should fall by most of a second, but that is an
  expectation until it is measured after a merge.

**3. Spatial foundations.** What was built is listed in ADR 0014, "As built
in Phase 7a". On the demonstration network:

- *Map read model*: 2 substations, 4 feeder routes (marked schematic), 48
  transformers; none without a location. Computed in about 90 ms.
- *Trace of DT-OLD-2*: feeder Old Town, power transformer Riverside T1,
  substation Riverside, district South; 135 connections and 132 active
  accounts behind it.
- *Trace of the Farm Road feeder* (the open fault): Hillcrest T2, Hillcrest;
  10 transformers, 1,064 connections, **1,015 active accounts** behind it.
- *Revenue not realised by district*: North-east ₦12,342,819 (16
  transformers), North-west ₦20,383,902 (14), South ₦12,665,985 (18), and
  ₦912,259 carried by no transformer; together ₦46,304,966, the Revenue
  screen's figure.
- *Restricted viewers*: five territories (listed assets, a named area, a
  drawn boundary, an empty territory, a territory naming things that do not
  exist), each asked every question of every spatial service and the map.
  No answer holds an id or a name of anything outside the territory.

**Acceptance, as met.** `npm run verify`, run step by step: typecheck
clean; 518 unit tests; lint clean; both builds; 44 browser tests against
both builds (one new: loading now on Farm Road).

**For the Founder's decision** (ADR 0014).

- The twelve choices made in building it; in particular that a line
  crossing a territory's boundary is not visible to that viewer, which
  areas are public, and the three synthetic districts.
- The basemap (proposal 1; recommendation: none for 7b, as a setting of
  the shared component).
- Administrative boundaries (proposal 2; recommendation: geoBoundaries
  states and LGAs, after the HDX licence is read by a person).

**Known, and not done.**

- The Phase 6 read models take no viewer. That is correct for the public
  demonstration and must change before anyone logs in (Phase 8).
- The quiet transformer monitor on DT-OLD-3 still relays hourly power
  readings after its last check-in at 14:55, including the new one at the
  clock. It was so before this phase; found, not changed.
- The cold first visit to a service point has not been measured on Vercel.

### Phase 7b: Shared map and Utility layers (approved and merged 2026-10-10; tag `phase-7b`)

**The Founder's decisions at the 7a checkpoint (2026-10-09).** 7a approved,
merged to `main` and tagged `phase-7a`. The twelve choices of ADR 0014
confirmed, with the territory rule strict and operator territories normally
asset-based. No basemap: a setting of the shared component, off for the
synthetic demonstration. Boundaries from geoBoundaries gbOpen (states and
LGAs, option B), as an orientation layer only; the three synthetic
districts stay the only areas the demonstration totals by; no synthetic
figure is totalled by a real area and no synthetic entity is listed inside
one. All recorded in ADR 0014, "As decided and built in Phase 7b".

| Item, in the order set | Status | Commit |
| --- | --- | --- |
| 1. Housekeeping: the quiet monitor on DT-OLD-3 relays no readings after its last check-in | Done | `e7f237d` |
| 2. Boundaries: geoBoundaries states and LGAs, with provenance, build script and the two rules | Done | `73dbe2a` |
| 4. Layers, from existing services | Done | `73dbe2a` |
| 3. Shared map component (Leaflet, no basemap); Map workspace in the Platform menu | Done | this checkpoint |
| 5. Embedded maps on the Operations levels and Events / Alarms | Done | this checkpoint |
| 6. Click any asset: key figures with status and origin, link into the drill-down | Done | this checkpoint |
| 7. An empty place for mini-grid sites in the layer list | Done | `73dbe2a` |

No dependency was added: Leaflet and React Leaflet were already installed.

**1. The quiet monitor: what moved.** The monitor on South Gate (DT-OLD-3)
last checked in at 14:55 on 30 September. Its nine hourly readings after
that and the one at the demo clock are no longer in the dataset: a gap, not
a zero. Compared across every screen, field by field, only DT-OLD-3 moved:

| DT-OLD-3 | Before | After |
| --- | --- | --- |
| Loading now | 21.5% | Insufficient data: no recent reading |
| Peak loading | 78.1%, highest of 720 readings | 78.1%, highest of 711 readings |

Its totalizer meter is a meter of its own and is complete, and the feeder
is read at the substation, so no energy, feeder, revenue, reliability or
alarm figure moved. The "monitor quiet" condition and the source's
communications alarm now agree with the data as well as with each other.

**2. Boundaries.** As in ADR 0014: 37 states and 774 LGAs, 360 KB and
1.6 MB in the repository (828 KB and 3.7 MB as published), each file's URL,
SHA-256, licence, release and dates recorded in the ADR, in the file and on
its data source. Each LGA's state is derived from the geometry and marked
as derived; the counts per state match the official ones for all 37. The
application now holds real records beside synthetic ones, and the spatial
services never relate the two.

**3 to 7. The map.**

- *One component* (`src/components/system/map`), used by the Map workspace
  and inside five other kinds of screen. It draws on a plain ground and
  fetches nothing from any other host (a browser test checks).
- *Layers.* Substations, feeder routes (dashed, each carrying the word
  "schematic" on the map), and transformers coloured by peak loading,
  ATC&C, revenue not realised or band compliance, one at a time, with a
  legend in words. Interruptions in progress and standing source alarms as
  rings round the assets they concern. The three synthetic districts with
  revenue not realised, and what belongs to no district in rows of its own.
  States and LGAs for orientation: states with the map, LGAs when switched
  on. Mini-grid sites: a place in the list, disabled, saying no source is
  connected.
- *Selecting an asset*, by clicking it or from a list, shows where it sits
  (what supplies it, its district, what it supplies), its key figures each
  with status, origin and method, and a link into the drill-down, which
  holds each figure's full trail.
- *What is in progress* is listed beside the map with what is behind it;
  ticking it marks those assets.
- *Embedded.* A substation, feeder or transformer screen shows itself with
  what supplies it and what it supplies; a transformer with its service
  points; a region and Events / Alarms the whole network. A service point
  shows where it is and what supplies it, **without figures**: a figure for
  its feeder would need every record under the feeder, and that screen is
  computed from one transformer's records.

**On the demonstration.**

- DT-OLD-2: Old Town feeder, Riverside T1, Riverside substation;
  Demonstration district South; 135 connections, 132 active accounts; peak
  loading 121.2%.
- The Farm Road fault: 10 transformers ringed as without supply; the outage
  record's 1,015 customers affected, and the registry's 1,015 active
  accounts behind the feeder, as two figures with two origins.
- Loading: 2 transformers above rating, 13 at 80 to 100%, 33 below. ATC&C:
  24 over 50%, 12 between, 12 below 25%.
- Revenue not realised: North-east ₦12,342,819, North-west ₦20,383,902,
  South ₦12,665,985, carried by no transformer ₦912,259; the 37 real states
  are named as not totalled.

**Sizes.** The Map page is about 620 KB of HTML before compression, of the
same order as a feeder screen. The map read model for the workspace takes
about 3 s to compute cold (it draws on every transformer's blocks) and is
built with the application on the demonstration.

**Acceptance, as met.** Each has a browser test.

| Criterion | Met |
| --- | --- |
| Trace DT-OLD-2 to its feeder, substation, district and customers | Yes |
| Trace the Farm Road open fault to the 1,015 accounts behind it | Yes |
| Works on a phone screen | Yes: 390 px wide, nothing wider than the screen, every action available from a list |
| SYNTHETIC DATA bar visible | Yes, on the map and on every screen with a map in it |
| Schematic label visible on feeder routes | Yes: on each route, and in words under the map |
| Boundary credit visible | Yes: inside the map frame whenever boundaries are drawn, and in the README |

`npm run verify`: typecheck clean; 551 unit tests; lint clean; both
builds; 54 browser tests against both builds. Screenshots at desktop and
phone width: `docs/screenshots/phase7b`.

**Found and fixed on the way.** The first embedded map on a service-point
screen asked for its feeder's and substation's figures, which generates the
whole synthetic dataset and undid the on-demand work of 7a (the first visit
went back above 4 s; the existing readiness test caught it). A map can now
be asked for without figures, and a unit test holds that a service point's
map builds no more than its own transformer.

**Choices made, for the Founder to confirm.**

- *The synthetic-and-real rule is applied both ways*: a real entity is not
  put in a synthetic district either.
- *Legend bands.* ATC&C at 25% and 50%; band compliance at 1 and 5 days;
  revenue not realised in thirds by rank. They sort a figure for colouring
  and are not findings. "Above rating" is the loading methodology's own.
- *Band compliance on a transformer is its feeder's figure*, labelled so.
- *An alarm on a monitor or a power transformer is ringed on the asset it
  is drawn with* (the transformer; the substation), and says so in words.
- *Selecting an asset shows figures without their inputs*; the drill-down
  one click away holds the readings and the full trail.
- *The old placeholder at `/dashboard/intelligence/gis`* was left as it was
  at the checkpoint. By the Founder's decision at approval it now redirects
  to `/dashboard/map`, and the placeholder page is removed.

**Known, and not done.**

- The Phase 6 read models still take no viewer (owed before login,
  Phase 8). The map's own read models all do.
- A click on a ring selects the asset beneath it, not the alarm or the
  interruption; those are read in the panel beside the map.
- The map has no search by place and no measuring tool.
- Keyboard users select from the list; the shapes on the map are not
  focusable.
- LGA names are not printed on the map; they show on hover.
- The cold first visit to a service point has still not been measured on
  Vercel production: it needs a merge to `main`.

**The Founder's decisions at the 7b checkpoint (2026-10-10).** Phase 7b
accepted and the engineer's choices confirmed. `/dashboard/intelligence/gis`
redirects to `/dashboard/map` (done before the merge, `9431cf6`; 55 browser
tests). Phase 7 is complete.

**A service point's first visit on production, measured after the merge
(2026-10-10).** Plain requests from the development laptop in Nigeria to
`https://gridintel-iota.vercel.app`, minutes after the deployment of
`9431cf6` finished. Eleven service points, none asked for before. On this
connection a small file already held at the edge took 0.4 to 1.1 s, about
0.3 to 0.8 s of it setting up the connection, so the figures are a ceiling
on what the server did.

| | First visit, whole response | Of which before the first byte, after the connection was set up | Repeat |
| --- | --- | --- | --- |
| The very first, on an instance that had just started (SP-FRM3-010) | 3.2 s | not separated | 0.8 s, 0.5 s |
| Four more, unseparated (SP-OLD2-001, SP-GOV3-004, SP-MKT2-005, the 11 kV customer) | 1.5, 2.4, 1.8, 1.0 s | not separated | 0.4 to 0.7 s |
| Six more, with the connection time taken out | 1.2, 1.6, 1.5, 1.4, 2.5, 2.6 s | 0.8, 1.3, 1.0, 0.7, 0.9, 1.2 s | 0.9 to 1.3 s |

- **No screen showed "Preparing data"**, and `/api/ready` answered
  `not_started` before and after.
- **Once an instance is running, the server answers a first visit in about
  0.7 to 1.3 s**, and the whole response arrives in 1.0 to 2.6 s on this
  connection. Before the change of Phase 7a the comparable first visits
  were 1.1 to 4.6 s (Phase 6 close-out), on the same uneven connection, so
  the two sets cannot be compared more finely than "somewhat faster, and
  mostly inside 2 s".
- **The very first request to an instance that has just started is still
  over the 2 s target: 3.2 s, against 2.5 s before.** One sample each, so
  the difference between them means nothing; what it shows is that this
  one request is not cured by generating less of the dataset. Its cost is
  the function starting and loading the application, which the generator
  change does not touch. It is paid once per instance, by whoever arrives
  first, on a service-point screen only: every network screen and the map
  are files.
- Also on production: the Map page (620 KB) arrived in 1.8 s first and
  0.7 s on repeat; the state outlines (360 KB) in 1.4 s and the LGA
  outlines (1.65 MB before compression) in 2.2 s; the old GIS address
  answers with a redirect to the map.

**The Founder's decision (2026-10-10).** The 3.2 s first request to a
service point on a cold instance is accepted. Nothing is to be built for
it. The ways that remain, should it ever matter, are those of ADR 0012:
build the 6,448 service-point screens ahead of time, or keep an instance
warm, which is a paid Vercel feature.

## Phase 8: API and backend boundary

**Goal.** Services reachable over HTTP with validated contracts.
**Includes.** Route handlers, runtime schemas (Zod, already installed), error
model, structured logging, auth boundary design. Logging in fills the
viewer's screen grant of ADR 0018 from the request (departments as sets of
permission keys); each screen and API route then checks the grant where its
data is read, besides the proxy.
**Later hosting option, not decided.** Serving each sector from its own
subdomain (for example `utility.` and `minigrid.`); the addresses stay
`/dashboard/...` until then (Founder, 2026-10-14).
**Dependencies.** Phase 6 service contracts stable.
**Risks.** Auth and security are decision gates.
**Acceptance.** Every service has a documented, validated endpoint; invalid
input is rejected with a typed error; contract tests pass. Must also be done
(Founder, 2026-10-14; ADR 0018):

- every screen checks the viewer's grant where its data is read, not only
  the proxy;
- every API route (`/api/areas` and those this phase adds) checks the grant;
- links inside pages are cut to the viewer's grant: the "Go to" cards, a
  finding's link, and the Platform Overview's sector sections (a sector the
  viewer may not open is left out). A viewer is never shown a link they
  would be refused at. Tests hold each of the three.

## Phase 9: Production data architecture

**Goal.** A database adapter behind the existing ports, with history.
**Includes.** Schema, migrations, seed from the demo dataset, ingestion path
for interval and telemetry data, topology history, stale-data policy.
**Dependencies.** Phase 8. New infrastructure is a decision gate.
**Risks.** Schema lock-in; time-series volume.
**Acceptance.** The app runs unchanged on the database adapter; parity tests
between memory and database adapters pass.

## Phase 10: Mini-grid Intelligence (complete; approved 2026-10-12, tags `phase-10a` and `phase-10b`; taken ahead of Phase 8, ADR 0015)

**Purpose (Founder, 2026-10-10).** Operating intelligence for mini-grid
operators and for the people who fund and report on them: how each site
performs technically and commercially, and whether reported figures match
the records. Not site prospecting.

Two gated parts. DER intelligence (fleets, aggregation, dispatch) is not in
this phase.

### Phase 10a: Domain, analytics and dataset (accepted and merged 2026-10-12; tag `phase-10a`)

| Item | Status |
| --- | --- |
| 1. Domain: a site under no substation; PV, battery, generator, inverter; site meter roles; generation as the energy-account input; tiers and productive use (ADR 0016) | Done |
| 1. The DisCo-only assumptions of BLUEPRINT section 13 removed or routed around, Utility unchanged | Done; see the blueprint |
| 2. Analytics: energy balance, availability, PV performance, storage, generator, renewable fraction, losses, revenue and collection, energy sold per connection (`gridintel.site.reference` 0.1.0) | Done, tested |
| 3. Synthetic dataset: four invented sites, every assumption in `DATASET_ASSUMPTIONS.md` | Done; realism reviewed |
| 4. A synthetic monthly site report, compared only like for like | Done |
| 5. The module registered with the spatial platform: sites fill the mini-grid layer | Done |
| ADR 0015 (order) and ADR 0016 (domain; accepted 2026-10-12) | Done |
| The realism review's three changes, and the final review's two (below) | Done; accepted |

No screen, route or component was built, and no dependency was added.

**What was built.**

- *Domain.* `src/domain/site.ts`; `site` as a scope kind; a service point
  supplied by a site; the meter roles `generation`, `storage` and
  `site_output`; telemetry for state of charge, in-plane irradiance, the
  curtailment estimate and a generator's hour and fuel registers;
  `tariffTier` and `productiveUse` on an account; site KPI keys and units;
  three more basis dimensions for reported figures.
- *Analytics* (`src/analytics/site`). Every figure is a `CalculatedKpi`
  for the site scope, with its inputs, status, origin and method. A figure
  that cannot be given names the meter, reading or record it lacks.
- *Port and adapters.* `SiteRepository` (the site register). The mini-grid
  operator's records are a second set of repositories with its own result
  cache (`getMinigridRepositories`), never read by the utility's screens.
- *Service.* `sitePerformance` and `sitePortfolio`
  (`src/services/minigrid`), each with sourcing, and each reported claim
  beside the calculation on its basis.
- *Map.* The Mini-grid module registers its sites and one layer with five
  key figures per site and its active connections. It is on the Map workspace's layer list, off when
  the map opens; the opening view is unchanged.

**The four sites: design** (all assumptions; tariffs are not current rates).

| | Tamarind Cross | Dry River | Palm Landing | Granite Hill |
| --- | --- | --- | --- | --- |
| Designed to show | Well-run solar-hybrid | Generator dependence | Poor collection | Low demand |
| Zone (illustrative) | Sudan savanna, NW | Guinea savanna, middle belt | Rainforest, south | Sudan savanna, NE |
| PV | 100 kWp | 45 kWp | 80 kWp | 60 kWp |
| Battery | 240 kWh / 80 kW | 90 kWh / 40 kW | 200 kWh / 60 kW | 150 kWh / 40 kW |
| Generator | 50 kVA, cycle charging | 60 kVA, load following | 40 kVA, cycle charging | none |
| Connections, active / on register | 465 / 465 | 300 / 300 | 393 / 417 | 130 / 130 |
| Tier 1 / 2 / 3 / 4 (productive) / public | 330 / 60 / 55 / 14 / 6 | 230 / 30 / 28 / 9 / 3 | 324 / 40 / 40 / 8 / 5 | 110 / 8 / 9 / 1 / 2 |
| Productive-use share of energy sold | 29.3% | 40.2% | 22.4% | 10.7% |
| Assumed tariff, NGN/kWh (tier 4 / others / tier 3) | 230 / 260 / 280 | 260 / 290 / 310 | 240 / 270 / 290 | 230 / 260 / 280 |

**Calculated for September 2026.** "est." marks a figure calculated with an
estimated input.

| | Tamarind Cross | Dry River | Palm Landing | Granite Hill |
| --- | --- | --- | --- | --- |
| Energy generated (kWh) | 11,904 | 8,932 | 9,546 | 1,917 |
| PV / generator (kWh) | 11,274 / 630 | 4,429 / 4,503 | 5,946 / 3,600 | 1,917 / 0 |
| Renewable fraction | 94.7% | 49.6% | 62.3% | 100% |
| Curtailment (kWh, est.) | 694 | 46 | 37 | 5,039 |
| In-plane irradiation (kWh/m²) | 151.5 | 130.8 | 97.1 | 146.7 |
| Specific yield (kWh/kWp) | 112.7 | 98.4 | 74.3 | 31.9 |
| Performance ratio / before curtailment (est.) | 74.4% / 79.0% | 75.2% / 76.0% | 76.5% / 77.0% | 21.8% / 79.0% |
| Battery equivalent full cycles | 17.4 | 18.1 | 15.6 | 4.8 |
| Round-trip efficiency (est.) | 90.2% | 90.1% | 89.9% | 90.7% |
| Storage loss (kWh, est.) | 450 | 177 | 347 | 79 |
| State of charge, lowest / mean | 16% / 58% | 20% / 39% | 15% / 38% | 44% / 93% |
| Generator running hours | 21 | 315 | 150 | no generator |
| Fuel used (litres) / per kWh | 218 / 0.35 | 2,290 / 0.51 | 1,248 / 0.35 | no generator |
| Energy sent out (kWh) | 11,245 | 8,547 | 9,028 | 1,599 |
| Station use (kWh, residual) | 216 | 214 | 216 | 180 |
| Energy delivered (kWh) | 10,460 | insufficient data | 7,764 | 1,519 |
| Distribution loss, of sent out | 7.0% | insufficient data | 14.0% | 5.0% |
| Site loss, of generated | 12.1% | insufficient data | 18.7% | 20.7% |
| Availability | 99.69% | 95.83% | 98.75% | 99.72% |
| Hours of supply per day | 23.92 | 23.00 | 23.70 | 23.93 |
| Interruptions | 2 | 7 | 2 | 1 |
| Hours lost per connection, by cause | planned 2.0, fault 0.26 | fault 30 | weather 6, planned 3 | fault 2 |
| Energy sold (kWh) | 10,450 | 7,757 | 7,758 | 1,507 |
| Energy sold per connection (kWh) | 22.5 | 25.9 | 19.7 | 11.6 |
| Revenue billed (NGN) | 2,672,889 | 2,186,916 | 2,076,678 | 392,505 |
| Revenue collected (NGN) | 2,566,180 | 2,128,526 | 1,833,537 | 366,710 |
| Collection efficiency (cash) | 96.0% | 97.3% | 88.3% | 93.4% |
| Collection: households / shops / productive use / public | 100 / 100 / 100 / 21.6% | 100 / 100 / 100 / 21.2% | 100 / 100 / 64.7 / 20.8% | 100 / 100 / 100 / 20.9% |
| Revenue per connection (NGN) | 5,748 | 7,290 | 5,284 | 3,019 |

Dry River's three "insufficient data" figures are designed: six of its 300
customer meters reported nothing for four days, and a gap is not a zero.

**The site report against the calculation.**

| Site | Agrees (within 0.5%) | Variance, calculated less reported | Not comparable |
| --- | --- | --- | --- |
| Tamarind Cross | Energy generated, renewable fraction, uptime, energy sold, connections, revenue collected, generator hours | none | Collection efficiency: 99% stated on an accrual basis; the calculation is on cash (95.9%) |
| Dry River | Energy generated, energy sold, connections, revenue collected, collection efficiency | Renewable fraction 68% reported, 49.6% calculated: −18.4 points. Uptime without planned interruptions 99.5% against 95.83%: −3.67 points. Generator hours 190 against 315: +125 | none |
| Palm Landing | Energy generated, renewable fraction, uptime, energy sold, generator hours; connections 417 on its stated basis (all accounts) | Collection efficiency 97% against 88.3%: −8.7 points. Revenue collected NGN 2,015,000 against 1,833,537: −181,463 | none |
| Granite Hill | Energy generated, renewable fraction, energy sold, connections, revenue collected, collection efficiency | none | Uptime: 99.9% with no statement of which interruptions it counts |

Each variance is designed, to show what a funder's check finds: a site
that reports itself greener and more reliable than its meters and its
interruption log show, and one that reports money it did not receive.
The two "not comparable" cases show the two reasons a claim cannot be
checked: a different basis, and none stated.

**Acceptance, as met.** Site performance and availability are calculated
on synthetic site data, and a site's meters never enter a network energy
account. The Utility module's 551 unit tests pass, with one line of one
test changed (a type narrowing). `npm run verify`: see the checkpoint
report for the counts.

**The Founder's realism review (2026-10-12).** ADR 0016 accepted:
curtailment as built, and the other seven points. Three changes to the
dataset, built on the same branch; the tables above are after them.

1. *Cycle charging at Tamarind Cross and Palm Landing; load following kept
   at Dry River as a designed finding.* The fuel curve was also made less
   steep (0.06 litres an hour per kW of rating plus 0.22 per kWh, from
   0.08 and 0.24), so that a well-loaded set burns about 0.30 litres per
   kWh. That moved Dry River's fuel too, though its dispatch is unchanged.
2. *Palm Landing's poor collection comes from 13 postpaid accounts*, its
   8 productive-use accounts on credit and 5 public institutions. Its
   households and shops are prepaid, as everywhere. Collection is given by
   customer class.
3. *Palm Landing's battery* now holds 75% of nameplate (it held 90%) and
   is charged by the generator only to 35%, so that its low state of
   charge stays a designed sign of an ageing, undersized battery.

| What moved | Tamarind Cross | Dry River | Palm Landing |
| --- | --- | --- | --- |
| Fuel per kWh (litres) | 0.51 → 0.30 | 0.51 → 0.42 | 0.47 → 0.30 |
| Fuel used (litres) | 225 → 189 | 2,290 → 1,898 | 1,599 → 1,080 |
| Generator running hours | 37 → 21 | 315 (unchanged) | 307 → 150 |
| Generator energy (kWh) | 444 → 630 | 4,503 (unchanged) | 3,389 → 3,600 |
| Renewable fraction | 96.3% → 94.7% | 49.6% (unchanged) | 63.8% → 62.3% |
| Curtailment (kWh, est.) | 545 → 694 | unchanged | 1 → 37 |
| Performance ratio | 75.4% → 74.4% | unchanged | 77.0% → 76.5% |
| Battery equivalent full cycles | 16.9 → 17.4 | unchanged | 8.9 → 15.6 |
| Mean state of charge | 52% → 58% | unchanged | 26% → 38% |
| Site loss, of generated | 11.9% → 12.1% | unchanged | 17.2% → 18.7% |
| Revenue billed (NGN) | unchanged | unchanged | 2,078,859 → 2,076,678 |
| Revenue collected (NGN) | unchanged | unchanged | 1,271,476 → 1,624,223 |
| Collection efficiency | unchanged | unchanged | 61.2% → 78.2% |

Granite Hill has no generator and no account on credit beyond its two
public institutions: nothing of it moved. Availability moved at no site.

Palm Landing's collection by class, before and after: households 67.9% →
100%; shops 53.0% → 100%; productive use 55.3% → 3.9%; public
institutions 57.7% (unchanged). The synthetic reports of Tamarind Cross and
Palm Landing were rewritten to agree with the new records where they are
meant to agree, and Palm Landing's designed overstatement was moved with
them: 95% collection reported against 78.2%.

**The Founder's final review (2026-10-12), and Phase 10a accepted.**

1. *The fuel curve is restored* to 0.08 litres an hour per kW of rating
   plus 0.24 per kWh, recorded as a generic diesel curve. "About 0.3" was
   a rough guide and not a target: a physical assumption is never tuned to
   reach an expected figure. Cycle charging stays.
2. *What a credit account pays is set by who it is*: a mill or workshop on
   credit 60 to 70%, a public institution 15 to 25%, at every site.
   Collection lands where that puts it.
3. Everything else in the report above is accepted.

| What moved at the final review | Tamarind Cross | Dry River | Palm Landing | Granite Hill |
| --- | --- | --- | --- | --- |
| Fuel per kWh (litres) | 0.30 → 0.35 | 0.42 → 0.51 | 0.30 → 0.35 | no generator |
| Fuel used (litres) | 189 → 218 | 1,898 → 2,290 | 1,080 → 1,248 | no generator |
| Revenue collected (NGN) | 2,563,682 → 2,566,180 | 2,126,019 → 2,128,526 | 1,624,223 → 1,833,537 | 365,328 → 366,710 |
| Collection efficiency | 95.9% → 96.0% | 97.2% → 97.3% | 78.2% → 88.3% | 93.1% → 93.4% |
| Collection, public institutions | 19.7% → 21.6% | 17.8% → 21.2% | 57.7% → 20.8% | 16.7% → 20.9% |
| Collection, productive use | 100% | 100% | 3.9% → 64.7% | 100% |

Nothing else moved: generator hours, energy, renewable fraction, battery
cycles, availability and revenue billed are as in the tables above. Palm
Landing's report now claims 97% collection and NGN 2,015,000 collected, so
that its designed overstatement stays: what it billed its credit accounts,
reported nearly as if paid.

Of Palm Landing's NGN 243,141 not collected, its 8 mills and workshops owe
147,140 and its 5 public institutions 96,001. The institutions pay the
lowest share (20.8%); the mills owe the larger sum because they are billed
more than three times as much.

**Superseded: the notes put to the Founder before the final review.**

- Palm Landing then collected 78.2%, not 61%. With 13 credit accounts
  holding 26% of its billing, 61% is out of reach unless they are a larger
  part of the site. It is still the lowest of the four, and all of its
  NGN 452,455 shortfall is owed by those 13 accounts.
- Its mean state of charge rose from 26% to 38%. Cycle charging lifts it
  whatever the setpoint; 38% with a 15% floor is still low.
- Tamarind Cross's renewable fraction fell by 1.6 points, which is what
  cycle charging costs: a generator that charges the battery displaces
  some of the next day's sun.

**Known, and not done.**

- No view model and no screen. `src/composition/minigrid.ts` binds the two
  services for 10b.
- The mini-grid services take no viewer, like the Phase 6 read models;
  owed before login.
- No fuel cost, operating cost or site economics: the dataset holds no
  cost records.
- Collection at every site is below 100% only because of its postpaid
  accounts, by design.

### Phase 10b: Screens (accepted and merged 2026-10-12; tag `phase-10b`)

**Accepted by the Founder (2026-10-12)** after review on a local server:
the portfolio shows all four findings clearly. The choices listed below
stand as built. One correction came with the acceptance: the sentence
under the site cards read "within 1%of its own value"; the space is now
written into the sentence and a browser test holds it.

**The Founder's scope (2026-10-12).** A Mini-grid workspace in the menu,
with a portfolio view and a site view; the sites layer on the shared map
and embedded site maps; every figure with status, origin, and source and
method; the SYNTHETIC DATA bar. Acceptance: within a minute on a phone, a
funder can see which site over-reports, which burns diesel inefficiently,
which is oversized for its demand, and where unpaid money sits.

| Item | Status |
| --- | --- |
| Mini-grid Intelligence in the menu; the portfolio at `/dashboard/minigrid`, in place of the placeholder | Done |
| Portfolio: what stands out, by five printed rules; the four sites side by side; collection by class over every site | Done |
| Site view at `/dashboard/minigrid/sites/[siteId]`: generation mix and energy flow, PV and curtailment, battery, generator, availability and interruptions, commercial with collection by class, the report against the calculation | Done |
| Sites on the shared map; a map on the portfolio and on every site screen; a site on any map leads to its screen | Done |
| Read models and their rules (`src/services/minigrid/view.ts`), tested; browser tests, one of them the acceptance on a phone | Done |

No dependency was added.

**What was built.**

- *Read models.* `minigridPortfolioView` and `minigridSiteView`. Every
  figure is the site performance service's own, as a `MetricView`. A
  reported claim uses the same comparison view as Utility, so the same
  component draws it.
- *What stands out.* Five rules, each printed under its finding: a report
  that differs from the records (a claim on the same basis, more than 1%
  of its own value away); the most fuel per kWh (when at least 20% above
  the least); PV held back (at least half of what was available
  curtailed); the site that left the most uncollected, with the classes
  that owe it; and the class that paid the smallest share across the
  portfolio. The thresholds are the engineer's, accepted with the phase.
- *Three additions to the analytics*, so that no component calculates:
  the share of available PV that was curtailed, state of charge day by
  day, and class totals added across sites (the rate taken of the sums).
- *Screens.* `src/components/minigrid`: `Portfolio`, `Site` and what they
  share. They compose the system components; the battery chart and the
  generation-mix bar are drawn in CSS from the read model's figures.
- *Map.* `spatial.sites()`: every site with the state outlines for
  orientation. A site alone would be one mark on an empty ground. A site
  selected on any map links to its own screen.
- *Rendering.* Five more pages are built with the application (the
  portfolio and four sites); on the request path they are warmed with the
  rest.

**Acceptance, on the demonstration, at 390 px wide** (a browser test holds
each line). The portfolio opens on "What stands out":

| The funder's question | What the screen says first |
| --- | --- |
| Which site over-reports? | "Dry River's report differs from its records on 3 of the 8 figures it states": renewable fraction 68.0% reported, 49.6% calculated (−18.4 pp); availability 99.5% against 95.8%; generator hours 190 against 315 |
| Which burns diesel inefficiently? | "Dry River's generator burns the most fuel for each kWh it makes, and ran the longest": 0.51 L/kWh against 0.35 at Palm Landing; 315 hours |
| Which is oversized for its demand? | "Granite Hill took less than half of the PV energy available to it": 72.4% curtailed (estimated); performance ratio 21.8%, 79.0% before curtailment |
| Where does unpaid money sit? | "Palm Landing left the most revenue uncollected. All of it is owed by 13 postpaid accounts": productive use ₦147,140 (paid 64.7%), public institutions ₦96,001 (paid 20.8%); and across the portfolio, public institutions paid the smallest share (21.2%) |

Palm Landing's report is also listed as differing (collection 97% against
88.3%, revenue collected ₦2,015,000 against ₦1,833,537), as designed.

**Choices made** (put to the Founder at the checkpoint; accepted as built).

- *The menu item is "Sites"*, under a "Mini-grid Intelligence" heading.
- *The unpaid-money finding names both of Palm Landing's credit classes.*
  Its mills owe the larger sum and its institutions pay the smaller
  share; the screen gives both figures and does not pick one.
- *The agreement tolerance is 1%* of the reported value.
- *A site screen's map shows all four sites*, with its own selected.
- *No finding is raised for a claim that cannot be compared*; the counts
  on each card and site screen show them.
- *The site view has no per-day or per-hour energy chart.* Only state of
  charge is drawn by day.

**Known, and not done.**

- The mini-grid read models take no viewer, like the Phase 6 ones; owed
  before login.
- The comparison table's note that the reported methodology "has not been
  verified as equivalent" repeats on every row, as it does in Utility.
  (Put right in the Phase 10 polish, below, for site screens and then
  for Utility's tables.)
- The overview page's platform cards are unchanged; its Mini-grid card
  now leads to a working screen.
- No site economics: the dataset holds no cost records.

### Phase 10 polish (2026-10-13; branch `phase-10-polish`, tag `phase-10-polish`)

Five corrections asked for by the Founder after checking production on a
phone.

- *The unverified-methodology note is said once.* On a site screen it is
  above the comparison table (`comparisonNote` in the site read model) and
  on no row. The Utility comparison tables followed on the Founder's
  word (tag `phase-10-polish-2`): Operations levels, Executive and
  Reliability each say it once above the table. One helper
  (`src/services/operations/comparison.ts`) builds the note for every
  workspace; a row keeps the methodology's name so that rows gathered
  from several scopes still get one note.
- *Origin is a whole word beside every figure in a table*, in every
  workspace: "Derived", "Calculated", never the first four letters.
- *Collection efficiency on a site is shown under the name "GridIntel
  reference collection".* It is calculated by the platform's one
  collection calculation, recorded under `gridintel.atcc.reference`; only
  the displayed name changes on site screens and the site's map figures.
  The id and version are shown beside it as recorded.
- *The map's selection panel gives the true reason an entity is in no
  area* (`areasReason`, from the spatial service): synthetic data is not
  placed in real states or LGAs and no synthetic district covers it; or it
  crosses a boundary; or it has no location. For a site it also says that
  no substation supplies it and that its connections are counted, not
  drawn, in place of "Nothing above it is held" and "Nothing further".
- *Asset labels*: "PV inverter", "Battery inverter".

## Phase UI: the UI revamp (complete; UI-A accepted 2026-10-14, UI-B accepted 2026-10-15; tags `phase-ui-a`, `phase-ui-b`)

**Purpose (Founder, 2026-10-13).** Before GridIntel is shown to people: a
modern, premium AI and data product on the surface, applied to a serious
energy operations tool. Brand areas may be striking; data areas stay sharp.
Phone first, at 390 px. Light and dark. IBM Plex kept.

**Goals.**

1. GIS inside each sector, by the shared map component only. No top-level
   Map; a small all-sectors map on the Platform Overview; the old addresses
   redirect there.
2. AI inside each sector, on the same pattern (ADR 0017). No AI is built.
   Each sector has an "AI Assistant (planned)" page.
3. Each sector Overview answers "what needs attention here?" in a few
   lines, with links in.
4. A Platform Overview that tells a first-time visitor in 30 seconds what
   GridIntel does.
5. Every screen readable and usable at 390 px. Less text on first view;
   rules, notes, and source and method one tap away, never removed.
6. Visual consistency from the design system, and one way of showing a
   finding.

**Rules.** No figure computed in a component. Every figure keeps status,
origin, source and method. The SYNTHETIC DATA bar stays on every screen.
Nothing that tells the truth about the data is removed, only moved or
folded. A new UI or animation library is a decision gate.

### Phase UI-A: proposal and prototype (accepted and merged 2026-10-14; tag `phase-ui-a`)

The proposal is `docs/design/UI-A-PROPOSAL.md`: the audit of every screen at
desktop and 390 px, the navigation, each screen's layout, and three visual
directions. The decision on AI and GIS inside each sector is ADR 0017.

| Item | Status |
| --- | --- |
| Audit of every current screen at desktop and 390 px, measured in a browser | Done; proposal, section 1 |
| The new navigation, every sector with the same structure | Done, built |
| Each screen's layout | Done; built for six screens, proposed for the rest |
| Three visual directions, each on the Platform Overview and one data screen, desktop and phone, with its palette | Done: Control room, Clean light, Energy brand |
| Prototype in the recommended direction (Energy brand): Platform Overview, Utility Overview and GIS Map, Mini-grid Overview and GIS Map, AI Assistant (planned) | Done |
| ADR 0017 | Done |
| The direction chosen by the Founder | **Done: C, "Energy brand"** (Founder, 2026-10-14) |
| The Founder's decisions on the prototype, built (below) | Done |

No dependency was added.

**What was built.**

- *Navigation and shell.* Platform: Overview. Each sector: Overview, GIS
  Map, AI Assistant (marked "Planned"), then its workspaces. By the
  Founder's sketch (2026-10-13): the sectors are a row across the top
  (Platform, Utility, Mini-grid, and DER and Planning marked "Planned"),
  and the sidebar holds only the screens of the sector the reader is in. On
  a phone, one row with a button that names the sector and opens the menu:
  the sectors, then this sector's screens. The data bar folds on a
  phone to the SYNTHETIC DATA label, the period and the as-of time, with the
  sentence about the dataset one tap away. On a phone the page starts
  126 px down, where it started 251 px down.
- *Addresses.* `/dashboard/utility/map`, `/dashboard/minigrid/map`,
  `/dashboard/utility/ai`, `/dashboard/minigrid/ai`. Sites moved to
  `/dashboard/minigrid/sites`; `/dashboard/minigrid` is the sector's
  Overview. `/dashboard/map` and `/dashboard/intelligence/gis` redirect to
  `/dashboard`.
- *Overview read models* (`src/services/overview`, `utility/overview.ts`,
  `minigrid/overview.ts`, `platform/overview.ts`; tested). They add no
  figure: every number is the `MetricView` of the screen a line leads to.
  Utility's lines come from five fixed rules in a fixed order (every
  interruption in progress; every transformer over its rating; the feeder
  first by revenue not realised; standing source alarms; assets listed).
  Mini-grid's are the portfolio's own findings, line for line. The Platform
  Overview shows the first line of each rule of each sector, up to three,
  and prints that rule. The two sectors' figures are shown side by side and
  never added.
- *One way of showing a finding* (`components/system/Attention.tsx`): a
  mark and a word (Act, Check, Note), one sentence, the figure with status
  and origin, a link, and the rule with source and method folded under it.
- *Two visuals from service figures*: ATC&C loss as its three parts, and
  generation mix by site. Each writes its values beside its marks.
- *Design tokens.* Light and dark themes from one set of roles; a brand
  colour; panel shape and depth; type one step larger (body 13 px, nothing
  under 10 px). The reader's device chooses the theme and their choice is
  kept.
- *Status colours made colour-blind safe.* Measured, the green of "ok" and
  the red of "alert" were one colour to a red-green colour-blind reader.
  "ok" is now a teal; the three pass as a set for the three kinds of colour
  blindness in both themes. Marks and words are unchanged.

**The Founder's decisions on the prototype (2026-10-14), built.**

- *Direction C, "Energy brand"*, chosen. Teal for "ok" kept. The other
  UI-A decisions accepted.
- *Partner logos removed for good*: the carousel, its data and the logo
  files are deleted. No partner is shown unless a written partnership
  exists. The founder's story and the architecture diagram go to a separate
  About page later; their files are kept, unlinked.
- *The Platform has no sidebar*: its one screen takes the full width. The
  theme switch moved to the top bar.
- *The hero line*: "Know what your network is really doing, not just what
  the report says."
- *A report against the records on the Platform Overview.* Utility has a
  sixth rule, `report_differs`: the reported reliability figure furthest
  from the calculation on its own basis. Each sector's lines on the
  Platform Overview always include its largest such difference, by a
  printed rule. "Largest" is measured against the reported figure itself
  (the same measure as the 1% agreement tolerance), so that figures in
  different units can be set side by side; a report line in both sectors
  leads with its largest difference.
- *Plain words*: an interruption names what is still off by kind, "10
  transformers", not "10 elements", on the overviews and in Events /
  Alarms.
- *Permission-driven navigation* (ADR 0018): every sector and screen has a
  permission key; the row of sectors, the menu and the routes show only
  what the viewer's grant opens; a refused address is answered with 403 and
  a page that says so. The demonstration viewer holds everything. No login
  and no user management are built.

**On the demonstration.** The Utility Overview opens on: the fault on Farm
Road (1,015 customers affected, as the outage record gives it; 10
transformers still off); Riverbank transformer at 121.2% and Government
Avenue transformer 3 at 110.6% of rating; Government Avenue feeder with the
largest revenue not realised (₦16,953,603, a monthly estimate); Hillcrest
substation's reported SAIDI, 1.9 h against 23.1 h from the outage log (11 of
the 12 reliability figures reported differ); 4 source alarms standing; 10
of 55 assets listed. The Mini-grid Overview opens on Dry River's report
differing from its records on 3 of 8 figures, led by generator running
hours (190 h reported, 315 h logged), then renewable fraction (68%
reported, 49.6% calculated).

**Checks.** `npm run verify` green in one run: typecheck clean; 651 unit
tests (9 new, for the overview read models); lint clean; both builds; 68
browser tests against both builds (13 more than before: the menu, the
planned pages, the overviews, the phone frame, the theme, each sector's
map, the redirects). Every route is inside the 500 ms budget on both
builds; the five new screens take 9 to 24 ms built ahead and 37 to 87 ms on
request (median of five). Screenshots at desktop and phone width:
`docs/screenshots/phase-ui-a` (`prototype`, and `directions` for the three
directions).

**Accepted (Founder, 2026-10-14, checked on a phone).**

- *Dry River's report line* keeps the one rule: largest difference relative
  to the reported figure, so generator running hours lead. Figures are not
  ranked by hand to tell a preferred story.
- *In-page links cut to the viewer's grant* are deferred to Phase 8 and are
  in its acceptance, with the per-screen and per-API grant checks of ADR
  0018.

**Not rebuilt.** Executive, Operations and its levels, Reliability, Revenue,
Assets, Events / Alarms, Sites and the site screens. They take the new
tokens and are otherwise as they were: on a phone nine of them still scroll
sideways as a whole page. The proposal says what UI-B would do to each.

**Known, and not done.**

- The founder's story and the architecture diagram wait for an About page
  (Founder, 2026-10-14); their files are kept, unlinked.
- The overview read models take no viewer, like the read models they are
  put together from; owed before login. Links inside pages are not cut to
  the viewer's grant (ADR 0018); deferred to Phase 8 and made part of its
  acceptance (Founder, 2026-10-14).
- Boxes that are not built from the panel component (site cards, a few
  notes) still have square corners.
- The Platform Overview's map lists its layers and the asset picker under
  it, as every embedded map does; a smaller form of the map is for UI-B.
- `/dashboard/der` and `/dashboard/planning` are now each the one page of
  a sector not built: it says so and holds no figure.
- `/dashboard/intelligence/ai`,
  `/dashboard/reports` and `/dashboard/settings` are still bare "Coming
  Soon" pages, reachable only by address.

### Phase UI-B: the remaining screens in direction C (accepted and merged 2026-10-15; tag `phase-ui-b`)

**Accepted** by the Founder on 2026-10-15, checked on a phone: "all fine".

The screens UI-A left as they were, rebuilt phone first in the Founder's order:
Executive, Events / Alarms, Operations and its levels, Reliability, Revenue,
Assets, Sites and the site screens. One commit per screen, each after
`npm run verify:local` passed.

| Screen | What changed |
| --- | --- |
| **Executive** | "Where to look first" in the one finding style: each subject once, with every rule it met and that rule's own figure, status and origin (`services/executive/items.ts`). The revenue gap by feeder as bars of its two parts. Section links. Band compliance and transformer loading folded on a phone |
| **Events / Alarms** | Interruptions in progress first and largest, as cards; restoration not recorded beside them as a data-quality item. Source alarms standing and derived conditions that hold, each as cards in its own list, never merged. Where, and the two full lists, after |
| **Operations and its levels** | "What needs attention here" first at every region, substation, feeder and transformer, by seven fixed rules in a fixed order (`services/operations/findings.ts`), each leading to its section of the same screen. Section links. The drill-down path scrolls on its own on a phone. A service point's connection details fit a phone |
| **Reliability** | The feeder ranking as bars of network-attributable SAIDI, what sets the rank, with upstream, load shedding and total beside each. The reports' rule findings and reported against calculated next. The breakdowns and the tables folded on a phone |
| **Revenue** | The gap by feeder as bars of its two parts. Collection efficiency first, then the portfolio's classes with government first. Each feeder's classes and the loss table folded on a phone; the loss split per feeder as bars |
| **Assets** | The assets with something on them as cards in the finding style, each of the three facts (source alarm, derived condition, interruptions) in its own place with its own origin. Each class table in its own frame |
| **Sites, and a site** | What stands out in the one finding style; its mark and word now come from the read model (`SiteFindingView.tone`), shared with the Mini-grid Overview. Site cards kept. A site's sections reached by links; notes folded; data gaps and the tariff caveat kept in view |

**Shared by every screen (system components).**

- *No page slides sideways at 390 px.* Every table sits in its own frame
  (`system/Table.tsx`) and scrolls inside it, with its first column held
  and a shadow at the right edge when there is more. Measured on every
  rebuilt screen with every fold opened: nothing is wider than the screen.
- *Less on first view, nothing removed.* Rules, notes, and source and
  method fold one tap away (`system/Fold.tsx`). Secondary tables are folded
  behind "Show the table" on a phone and open on a wider screen (CSS
  `::details-content`; a browser without it keeps the one-tap fold).
  Caveats about the data itself (incomplete records, assumed tariffs,
  gaps in metering, estimates) stay in view.
- *Source and method* opens under the figure at full width on a phone.
- *Two tiles across* on a phone; a headline figure takes the full width.
- *Bars are scaled in the services* (`services/overview/bars.ts`): a
  component never divides one figure by another. A bar with a missing or
  negative part is not drawn, and the screen says why.
- The status key is one tap away on every screen, and the SYNTHETIC DATA
  bar is on every screen.

**Checks.** `npm run verify:local` before each commit (typecheck, unit
tests, lint, the ordinary build and its browser tests). New: unit tests for
the bar scales, the Executive's findings, the level findings and the
ranking bars; `e2e/phone.spec.ts`, which opens every rebuilt screen at
390 px with every fold open and checks that nothing slides, that every
table frame fits, that the SYNTHETIC DATA bar is there, that a phone folds
a table a wider screen shows, and that source and method opens under its
figure. The full `npm run verify` (both builds) runs in CI on every push.
Screenshots at desktop and phone width: `docs/screenshots/phase-ui-b`.

**Decisions (engineering).**

- `npm run verify:local` (Founder, 2026-10-15) for this laptop; the full
  verify stays the rule in CI and at every checkpoint (ENGINEERING_RULES).
- The child tables of a level (substations, feeders, transformers,
  service points) stay tables in their own frame on a phone, with the name
  held in place, rather than cards: the figures are compared down a column.
- On Executive, the "other findings" group lists every rule a subject met,
  each with its own figure, rather than leading with one: a transformer's
  commercial gap is context, never a rank, and must keep its words.

**Known, and not done.**

- The reports' rule findings (Reliability, a level's reliability panel)
  keep their own amber box, beside the comparison they explain (Founder,
  2026-10-15: keep them there). They are findings about a report, not the
  one finding style.
- Links inside pages are still not cut to the viewer's grant (Phase 8).

## Phase REPORTS: downloadable reports (in progress; REPORTS-A merged 2026-10-19; REPORTS-B at its checkpoint 2026-10-20)

**Purpose (Founder, 2026-10-15).** Downloadable reports for the people who
will use GridIntel: regulators checking DisCo reliability, DisCo managers,
mini-grid operators, and mini-grid regulators and funders (REA/DARES-type
programmes). The Founder will also attach sample reports to proposals and
to a permit application's monitoring and reporting plan. Decisions: ADR
0019. Taken after the UI revamp by the Founder's instruction of
2026-10-15; DER and Planning keep their place after it.

**Rules (non-negotiable).**

- While the data is synthetic, every page carries "SAMPLE: SYNTHETIC DATA",
  and the cover states that the report shows the format and methods
  GridIntel would deliver, not real results. No page can be printed or
  cropped without the label.
- Every figure keeps its status, origin and method. Reported against
  calculated only on the same basis. Missing is never zero. Nothing is
  computed in a component; reports are built from the same services as the
  screens.
- A period the data does not cover is stated as not available, never
  filled. The dataset covers September 2026 only: daily and monthly
  reports work; annual is "not available for this period". The dataset is
  not widened in this phase.
- Each report carries a report ID, the time its figures were computed, its period, its
  methodology versions and a fingerprint of the data used.

**The five reports** (one report service, one layout; each a
configuration): 1. Reliability and service standards (regulator);
2. DisCo operations (management); 3. Daily operations brief (any day, two
printed pages); 4. Mini-grid site performance (operator); 5. Mini-grid compliance and
results (regulator, funder).

**Format.** A print-ready page per report (A4, page breaks, cover,
contents, methodology appendix, glossary), saved as PDF from the browser
on a desktop and on a phone; the figures as CSV with their status, origin
and units. A server-side PDF library is a decision gate: proposed only
(ADR 0019).

### Phase REPORTS-A: the report service, two reports, CSV (merged to `main` 2026-10-19, tag `phase-reports-a`)

| Built | Where |
| --- | --- |
| The report service: periods, the catalogue, the document, the CSV | `src/services/reports` |
| Report identity: the data fingerprint of every record read; the report ID | `src/composition/fingerprint.ts`, `src/composition/reports.ts` |
| One print layout: cover, contents, sections, method and reproduction, regulatory references, glossary and key; the label in the top and bottom margin of every printed page and as words across every page | `src/components/reports/ReportDocument.tsx`, `.gr-*` in `globals.css` |
| The period: any day of September 2026 and the month; the year, and any period the data does not wholly cover, "not available for this period" | `period.ts`; addresses `/dashboard/{sector}/reports/{report}/{period}` |
| **Reliability and service standards**: the DisCo's indices and their attribution; by substation; by feeder, ranked by network-attributable SAIDI; where interruptions began; service-band compliance by day; interruptions still open (provisional); reported against calculated, each attribution-rule finding beside its comparison (Hillcrest's feeders) | `reliability.ts` |
| **Mini-grid compliance and results**: availability and hours of supply, interruptions; connections and consumption; generation; the tariff as an assumption; revenue and collection; each site's report against its records | `compliance.ts` |
| The figures as CSV, every row with the sample label, report ID and period | `.../{period}/data.csv` |
| A Reports entry in each sector, `/dashboard/reports` (was "Coming Soon"), a permission key per report, example roles | `navigation.ts`, `access.ts`, ADR 0019 |
| The regulatory-format research: NERC Reporting Compliance Regulations 2009 Schedule 4A, the MYTO 2024 supplementary orders, NERC Mini-Grid Regulations 2023, the DARES Implementation Manual; which fields each report carries; what is needed from the Founder | `docs/reports/REGULATORY_FORMATS.md` |

**Checks.** `npm run verify:local` before each commit. New: unit tests for
periods, both reports against the screens' read models, the document, the
CSV and the fingerprint; `e2e/reports.spec.ts` (the label and identity on
the cover, the label rules in print, the findings beside their
comparisons, a day, a year not available, the CSV, a phone). The full
`npm run verify` runs in CI on every push.

**Checkpoint material.** `docs/screenshots/phase-reports-a`: both reports
printed to PDF by Chromium's print engine (the engine of Chrome's "Save as
PDF"), for the month and for 14 September 2026, and screenshots at desktop
and phone width. Made again with
`SCREENSHOTS=docs/screenshots/phase-reports-a GRIDINTEL_E2E=local npx playwright test screenshots -g report`.

**Decisions (engineering).** Recorded in ADR 0019: the report ID and the
fingerprint; the label in the page margins and across the page rather than
in a band that would cover rows; a reported figure compared only with a
calculation for its own period; the regulatory references as coverage,
never as conformity.

**Known, and not done.**

- XLSX is not built; CSV only. **Built in REPORTS-B** (a writer of our
  own; no dependency).
- A page built ahead of time has the build's time as the time its figures
  were computed; its CSV has its own. Both carry the same report ID.
  **Fixed (2026-10-19):** the cover says "Figures computed <time>, from
  data as of <as-of>", not "Generated".
- **Fixed (2026-10-19):** on a report page the data bar names the
  report's own period (a day or the month) and its as-of time, or "not
  available for this period". It is not printed.
- Phone printing is the phone browser's own; it was checked in Chromium at
  phone width, not on a physical phone.

### Phase REPORTS-B: the other three reports and XLSX (at its checkpoint 2026-10-20; branch `phase-reports-b`, not merged)

| Built | Where |
| --- | --- |
| **DisCo operations** (management): ATC&C and its parts with the energy account, losses by feeder and the DisCo's reported figures on their basis; revenue not realised; billing and collection by customer class; reliability and hours of supply; assets requiring attention; outages, alarms and derived conditions at the end of the period. For a day, the loss account and the money are "not available for a day", with the reason | `operations.ts` |
| **Daily operations brief** (control room, management): any day in two printed pages, table text at least 8.5pt; hours of supply by feeder against its band, interruptions in progress and gaps in the record apart, source alarms standing and derived conditions holding at the day's end, assets loaded above rating. Days only; a month or a year is not available, with the reason | `daily.ts`; `compact` in the layout |
| **Mini-grid site performance** (operator): the sites side by side with the portfolio's findings, then each site: energy flow, PV, battery, generator, supply and interruptions, sales and collection by class. For a day, no sales or collection and no findings about money | `sitePerformance.ts` |
| **XLSX for every report**, beside the CSV: the same rows, values as numbers, the label in every row and the printed header and footer | `xlsx.ts`; `/…/{period}/data.xlsx` |
| A report names its kinds of period and its default period | `periodKinds` in `catalogue.ts` |
| The data bar names a report page's own period; the cover says "Figures computed …, from data as of …" (REPORTS-A fixes) | `DataBar.tsx`, `ReportDocument.tsx` |
| The quiet-monitor rule told only over a held window of check-ins (Founder, 2026-10-19) | ADR 0011 amendment; conditions methodology 0.3.0 |
| The data fingerprint computed faster with the same digests (the operations month: 63 s to 7 s) | `fingerprint.ts` |
| State electricity regulators: the 15 states NERC lists, and two orders since, from NERC's own pages | `docs/reports/REGULATORY_FORMATS.md`, section 3 |

**Checks.** `npm run verify:local` before each commit. New: unit tests for
the three reports against the screens' read models, the day rules, the
compact brief's sections, XLSX against the CSV (and a fixed CRC), the
fingerprint's text against `canonicalJson`, the quiet-monitor window;
browser tests for each report's cover and label, a day without money, the
brief printed on the 14th and the 30th (table text at least 8.5pt, at most
two pages, the appendices on pages of their own), its month not
available, the XLSX download, phone width.

**Checkpoint material.** Attached to the GitHub release `phase-reports-b`,
not committed (Founder, 2026-10-20; `docs/screenshots/` is ignored): all
five reports printed to PDF by Chromium's print engine for September 2026
and for 14 September (and the brief for 30 September, its busiest day), and
every report screen at desktop and phone width, made after the review fixes.
Made again with
`SCREENSHOTS=docs/screenshots/phase-reports-b GRIDINTEL_E2E=local npx playwright test screenshots -g report`.

**Known, and not done.**

- The compliance report (REPORTS-A) still gives a site's revenue and
  collection for a day; the new reports do not. For the Founder.
- A report's CSV and XLSX are built on first request in each server
  process (about 7 s for the operations month); the pages are built ahead
  of time.
- The state regulators' own reporting templates have not been read.
- Phone printing was checked in Chromium at phone width, not on a phone.

## Phase 11: AI / MCP intelligence

**Goal.** Natural-language query and explanation over services, **built per
sector** (Founder, 2026-10-13; ADR 0017): one AI layer for the platform;
each sector registers its own tools wrapping its own services; answers cite
service results with their status and origin and respect the viewer's scope.
**Includes.** Tools wrapping services one-to-one, PII filtering, citations to
source results, the synthetic marker carried into every answer, tool-call
audit. Each sector's "AI Assistant (planned)" page is replaced by the
assistant with that sector's tools.
**Dependencies.** Phases 6 and 8. External integration is a decision gate.
**Acceptance.** Every factual statement in an answer links to a service
result; the assistant states "insufficient data" where the engine does.

## DER Intelligence (next module after the UI revamp; order to be confirmed after user feedback)

**Goal.** Distributed energy resources as operating assets: solar PV,
storage, inverters and generators as fleets; performance, aggregation and
dispatch. It was left out of Phase 10 on purpose.
**Structure.** The same as every sector: Overview, GIS Map, AI Assistant,
then its workspaces (ADR 0017).
**Not yet scoped.** Scope and acceptance are set when the phase is approved.

## Phase 12: Planning and optimization (the module after DER; order to be confirmed after user feedback)

**Goal.** Load growth, capacity, scenarios, investment prioritization. It
joins with the same structure as every sector (ADR 0017).
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
