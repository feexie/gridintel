# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-04. Status: **Phase 6c-1 (data and engine) complete on
branch `phase-6c`, awaiting the Founder's approval at its checkpoint. Phase
6c-2 (workspaces) not started; its scope is proposed under Phase 6c.**

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

## Phase 6: Complete the core utility product

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

### Phase 6c: Workspaces (6c-1 complete, awaiting approval; 6c-2 not started)

Split by the Founder into two gated parts: 6c-1, the decisions below, on the
data and the engine; 6c-2, the workspaces themselves, after 6c-1 is approved.

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

#### Phase 6c-1: Data and engine (complete, awaiting approval; branch `phase-6c`)

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

#### Phase 6c-2: Workspaces (not started; proposed scope, for approval)

Each workspace is one screen shaped for one job, built on services that
exist or are named here. Nothing below is built.

| Workspace | User | The job it answers | Needs that do not exist yet |
| --- | --- | --- | --- |
| Events / Alarms | Operations engineer on shift | "What is wrong now, where, and who is affected?" | An alarm port and synthetic alarms; a port for device heartbeats (the records exist, no port reads them) |
| Reliability | Network performance engineer | "Which feeders fail their customers, why, and is it ours to fix?" | Nothing new in the engine: causes and origin points are calculated and not yet shown |
| Assets | Asset manager | "Which assets require attention?" | Loading of power transformers (no telemetry for them in the dataset); nothing on age, condition or maintenance |

- **Events / Alarms.** Active alarms by severity and age, each linked to its
  asset; interruptions in progress and recently restored, with where they
  began, their class, customers affected and restoration stages; monitors
  that have gone quiet. Read-only: no acknowledgement or assignment.
- **Reliability.** Feeders ranked by network-attributable SAIDI and SAIFI;
  the split by class, cause and origin point; day-by-day band compliance;
  the assets interruptions most often begin at; reported against calculated,
  with the attribution rule.
- **Assets.** The transformer fleet: rating, peak loading, hours over
  rating, interruptions that began there, commercial loss, and how its
  connections are metered (AMI, read monthly, prepaid, unmetered). Power
  transformers and feeders as their own lists. Age, condition and
  maintenance shown as not available.
- **Navigation.** A Utility Intelligence menu of Executive, Operations,
  Reliability, Assets and Events / Alarms; the "Coming Soon" pages out of the
  menu; one `h1` per page; the period and the SYNTHETIC DATA label in one
  place.
- **Design system and typeface.** One set of tokens for status, origin,
  type and spacing, taken from what the Operations panels already do; the
  metric, table and panel components moved out of `components/operations`
  into a shared set. Typeface: IBM Plex Sans with IBM Plex Mono for figures,
  self-hosted. Recommended; the choice is the Founder's.

**Proposed order.** Design system and navigation; Reliability; Assets;
Events / Alarms last, because it alone needs new domain data.

**Questions that gate 6c-2.**

1. Are alarms records from a source system, conditions GridIntel derives
   from telemetry (over rating, monitor quiet), or both kept apart? The
   recommendation is both, never mixed: one is observed, the other
   calculated.
2. Should the dataset gain telemetry for power transformers, so Hillcrest T1
   and T2 have a loading?
3. Is a Revenue workspace wanted in 6c-2? The roadmap lists three; the
   revenue manager's job is today answered inside Operations.
4. The typeface.

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
