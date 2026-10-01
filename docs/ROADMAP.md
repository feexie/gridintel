# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-01. Status: **Phase 5 in progress, stopped at the
dataset checkpoint. UI work waits for the Founder's realism review.**

## Completed

| Phase | Commit | Result |
| --- | --- | --- |
| 1. UI prototype | up to `a2c5f7f` | Executive and Operations screens on mock data |
| 2. Canonical domain model | `87a4694` | `src/domain` |
| 3. Deterministic analytics | `70afd3e` | `src/analytics`, tested |
| 4. Repository ports and first services | `adbc17e` | Ports, memory and mock adapters, import boundaries |
| Governance | `da0fad7`, `8e04b10` | Engineering rules, decision gates, ADRs, blueprint, roadmap, CI |

## Phase 5: Vertical slice on a synthetic demo path (approved)

**Goal.** One complete, truthful path through every layer: drill from region
to meter in the running app and see calculated losses, loading and SAIDI,
each traceable to source and method, with no KPI computed in a component.

| Step | Status |
| --- | --- |
| 0. `"type": "module"`, Node engine | Done |
| 1. Composition root (`src/composition/runtime.ts`) | Done; the UI lint rule comes with step 4 |
| 2. Synthetic demo dataset (`src/repositories/demo`) | Done; awaiting realism review |
| 3. Services with status, provenance and synthetic marker | Done for losses / ATC&C, reliability, loading, collection |
| **Checkpoint: Founder reviews the dataset** | **Here** |
| 3b. Operations read models with coverage | Not started |
| 4. Operations drill-down on services, selection in the URL | Not started |
| 5. Executive page: reported versus calculated | Not started |
| README refresh | Not started |

**Decisions recorded.** ADR 0003 (synthetic source kind), ADR 0004 (GIS
order), ADR 0005 (billing domain and loss inputs).

**What the dataset contains.** 1 region, 1 substation, 1 power transformer,
2 feeders (NERC Band A and Band C), 6 distribution transformers, 432
connections (prepaid, postpaid and unmetered), boundary meters at every
level, 30 days of hourly interval energy, telemetry, 87 outages, bills, vends
and payments in NGN, and a synthetic monthly report to compare against.
Assumptions: `src/repositories/demo/DATASET_ASSUMPTIONS.md`.

**Open before step 4.**

- Region-level ATC&C: energy accounting does not support administrative
  scopes (ADR 0005).
- Alarms stay out of the slice; the fabricated alarm panel becomes a "not
  available" state.

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

## Phase 6: Complete the core utility UI and retire legacy

**Goal.** Executive and Operations fully on services; legacy `src/data`,
`src/types`, the mock adapter and the `mock` source kind removed; alarms and
events real.
**Includes.** Alarm and maintenance ports; Events / Alarms, Reliability and
Assets workspaces; navigation restructure; shared loading, error, empty and
stale states; consistent design tokens; component tests.
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
