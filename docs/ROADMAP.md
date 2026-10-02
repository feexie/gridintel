# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-02. Status: **Phase 6a complete on branch `phase-6a`,
awaiting the Founder's approval before it is merged to `main`. Phase 6b not
started.**

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

### Phase 6b: Dataset widening (not started)

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

### Phase 6c: Workspaces (not started)

**Goal.** Each user's question has a screen shaped for it.

**Includes.** Events / Alarms (an alarm port and synthetic alarm data),
Reliability and Assets workspaces; navigation restructure; a design system
and a chosen typeface; one `h1` per page.
**Dependencies.** Phase 6b.
**Risks.** Scope creep into a full redesign; alarms are new domain data.
**Acceptance.** Each workspace answers its user's question from the founding
directive on the widened dataset; the alarm panel shows real (synthetic)
alarms or an explicit empty state; browser tests cover the new flows.

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
