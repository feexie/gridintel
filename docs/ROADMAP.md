# GridIntel roadmap

Living document. Updated at the end of every phase. A phase starts only after
the Founder approves it. Changing the order is a decision gate.

Last updated: 2026-10-01. Status: **Phase 5 proposed, awaiting approval.**

## Completed

| Phase | Commit | Result |
| --- | --- | --- |
| 1. UI prototype | up to `a2c5f7f` | Executive and Operations screens on mock data |
| 2. Canonical domain model | `87a4694` | `src/domain` |
| 3. Deterministic analytics | `70afd3e` | `src/analytics`, tested |
| 4. Repository ports and first services | `adbc17e` | Ports, memory and mock adapters, import boundaries, 164 tests |
| Governance | `da0fad7` and the commit adding this file | Engineering rules, decision gates, ADRs, blueprint, roadmap, CI |

## Phase 5: Vertical slice on a synthetic demo path

**Goal.** One complete, truthful path through every layer: drill from region
to meter in the running app and see calculated losses, loading and SAIDI,
each traceable to source and method, with no KPI computed in a component.

**Why next.** The engine, ports and boundaries exist but nothing reaches the
screen, and the mock data cannot exercise the engine. A slice proves the
architecture end to end before it is widened. Migrating all UI first would
mostly produce "insufficient data" panels.

**Steps.**

0. Housekeeping: `"type": "module"` (if all four checks stay green), Node
   engine version, README refresh.
1. Composition root: one server-side module that selects the adapter. Lint
   rule: UI imports only services and view-model types.
2. Synthetic demo dataset, written directly as canonical records in a new
   adapter (`src/repositories/demo`), not as more legacy mock data:
   1 region > 1 substation > 1 power transformer > 2 feeders > about 6
   distribution transformers > service points, meters and customers; boundary
   meters at substation, feeder head and transformer; 30 days of interval
   energy; billing and collections; 3–5 dated outages with exposure; and
   **telemetry for loading**. Generated deterministically from a fixed seed
   and a fixed demo clock.
3. Services returning results with status and provenance: energy account,
   losses / ATC&C, reliability, loading, collection efficiency, and
   operations read models with coverage.
4. Operations drill-down on these services. Selection moves to the URL so
   server components fetch the data and every drill-down level is linkable.
   Outside the slice: explicit "insufficient data" or "sample" states.
5. Executive page: remove the hardcoded 86.6% and 17.1%; show reported and
   calculated side by side.

**Changes proposed to the Founder's plan.**

- *Telemetry added to the dataset.* Loading is calculated from telemetry,
  which the proposed dataset did not list. Without it the acceptance
  criterion (calculated loading) cannot be met.
- *Dataset as a new canonical adapter.* Extending the legacy files would
  deepen the dependency on types that are to be removed.
- *Alarms are out of the slice.* The domain has `Alarm` but no port and no
  data. In Phase 5 the fabricated alarm panel is replaced by a "not
  available" state; real alarms come in Phase 6.
- *Fixed demo clock.* The dataset covers a fixed period and the app shows
  "as of" that time. A dataset relative to today would make results
  non-deterministic.
- Order of steps 1–5 is kept as proposed.

**Dependencies.** Phase 4 (done). Next.js 16 guides for server components and
`searchParams`.

**Risks.**

- Synthetic data mistaken for real data. Mitigation: provenance flag plus a
  persistent UI label; a test that every demo record carries the flag.
- Synthetic figures that are physically implausible. Mitigation: generate
  customer consumption first and derive boundary energy from it with explicit
  technical and commercial loss assumptions, documented in the adapter.
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

**Needs Founder decision before starting** (see open questions in the
Phase 5 approval summary): how synthetic data is flagged in provenance; what
happens to the legacy Adamawa mock.

## Phase 6: Complete the core utility UI and retire legacy

**Goal.** Executive and Operations fully on services; legacy `src/data` and
`src/types` removed; alarms and events real.
**Includes.** Alarm and maintenance ports; Events / Alarms, Reliability and
Assets workspaces; navigation restructure; shared loading, error, empty and
stale states; consistent design tokens; component tests.
**Dependencies.** Phase 5.
**Risks.** Removing legacy before replacement is live (decision gate).
**Acceptance.** No import of `src/data/utility` or `src/types/utility`
remains; each of the three new workspaces answers its user's question from
the founding directive on the demo dataset.

## Phase 7: API and backend boundary

**Goal.** Services reachable over HTTP with validated contracts.
**Includes.** Route handlers, runtime schemas (Zod, already installed), error
model, structured logging, auth boundary design.
**Dependencies.** Phase 6 service contracts stable.
**Risks.** Auth and security are decision gates.
**Acceptance.** Every service has a documented, validated endpoint; invalid
input is rejected with a typed error; contract tests pass.

## Phase 8: Production data architecture

**Goal.** A database adapter behind the existing ports, with history.
**Includes.** Schema, migrations, seed from the demo dataset, ingestion path
for interval and telemetry data, topology history, stale-data policy.
**Dependencies.** Phase 7. New infrastructure is a decision gate.
**Risks.** Schema lock-in; time-series volume.
**Acceptance.** The app runs unchanged on the database adapter; parity tests
between memory and database adapters pass.

## Phase 9: GIS and network intelligence

**Goal.** A map that is an analytical view of the network.
**Includes.** Coordinates on assets, feeder topology rendering, KPI overlays,
outage geography, map-to-drill-down linking.
**Dependencies.** Phase 6 (could move ahead of Phases 7–8 if a demonstrable
map matters sooner; it needs only the demo dataset).
**Acceptance.** An overloaded transformer can be traced on the map to its
feeder, substation, area and affected customers.

## Phase 10: Mini-grid and DER intelligence

**Goal.** Extend the domain and analytics to sites, PV, BESS, inverters and
generators.
**Dependencies.** Phase 8. Touches the energy-accounting boundary rules
(decision gate: data-integrity semantics).
**Acceptance.** Site performance and availability calculated on synthetic
site data without double counting against network energy accounts.

## Phase 11: AI / MCP intelligence

**Goal.** Natural-language query and explanation over services.
**Includes.** Tools wrapping services one-to-one, PII filtering, citations to
source results, tool-call audit.
**Dependencies.** Phases 7 and 6. External integration is a decision gate.
**Acceptance.** Every factual statement in an answer links to a service
result; the assistant states "insufficient data" where the engine does.

## Phase 12: Planning and optimization

**Goal.** Load growth, capacity, scenarios, investment prioritization.
**Dependencies.** Phases 8 and 9; financial domain objects.
**Acceptance.** A scenario produces capacity shortfalls and costed options
with stated assumptions.

## Phase 13: Edge and IoT integration

**Goal.** Real telemetry from field devices.
**Includes.** Device registration, ingest endpoints, protocols, heartbeat
monitoring.
**Dependencies.** Phase 8. External integration and security gates.
**Acceptance.** A physical or simulated device appears in the registry and
its readings flow to a KPI with full provenance.

## Phase 14: Digital energy twin

**Goal.** Unified physical and digital representation, and controlled
closed-loop workflows.
**Dependencies.** Phases 9, 12 and 13.
