# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-01. Status: **Phase 5 complete. Phase 6 not started;
it waits for the Founder's approval and for the open decisions listed under
"Decisions waiting for the Founder".**

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
comparison). ADR 0008 (revenue gap) is a proposal and is not implemented.

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

### Decisions waiting for the Founder

1. Revenue gap in NGN (ADR 0008, proposal).
2. Playwright as a dev dependency (above).
3. Phase 6 scope and order.

## Phase 6: Complete the core utility UI and retire legacy

**Goal.** Executive and Operations fully on services; legacy `src/data`,
`src/types`, the mock adapter and the `mock` source kind removed; alarms and
events real; region-level energy accounting; a wider synthetic dataset with
realistically loaded feeders.
**Includes.** Alarm and maintenance ports; Events / Alarms, Reliability and
Assets workspaces; navigation restructure; shared loading, error, empty and
stale states; a design system with consistent tokens and a chosen typeface;
per-request memoisation of read models; browser tests if approved.
**Dependencies.** Phase 5.
**Risks.** Removing legacy before replacement is live (decision gate).
**Acceptance.** No import of `src/data/utility` or `src/types/utility`
remains; each of the three new workspaces answers its user's question from
the founding directive on the demo dataset.

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
