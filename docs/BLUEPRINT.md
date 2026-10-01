# GridIntel blueprint

Current versus target architecture, as of 2026-10-01 (commit `da0fad7`).
Update this file when the architecture changes. The plan is in
`ROADMAP.md`; the vision is in `FOUNDING_DIRECTIVE.md`.

## 1. Product map

**Today:** a Next.js 16 frontend prototype with two working screens
(Executive, Operations) on static mock data, plus a canonical domain model,
a deterministic analytics engine, repository ports and a first service that
are tested but not yet used by any screen.

**Target:** a digital energy intelligence and decision-support platform in
which edge, data, domain, analytics, services, GIS, AI, planning and UI form
one system, and every figure can be traced to its source and method.

## 2. System architecture: current versus target

| Layer | Exists today | Missing |
| --- | --- | --- |
| Edge / devices | `EdgeDevice`, `DeviceHeartbeat` domain types; 3 mock devices | Device registration, protocols, any real device |
| Ingestion | Nothing | Ingest API, validation, deduplication, late and corrected data |
| Data / storage | In-memory `DomainDataset` built from legacy mock files | Database, history, time-series store |
| Domain | `src/domain`: organization, network, metering, observations, events, reporting, provenance, geo | DER, mini-grid sites, tariff, billing, payments, planning, topology history |
| Analytics | `src/analytics`: energy account, losses / ATC&C, collection efficiency, SAIDI / SAIFI / ASAI, loading, reconciliation, topology index | Forecasting, anomaly detection, DER and mini-grid performance, financial analytics |
| Repository ports | Registry, observations, events (outages), reported KPIs, sources; each with completeness | Alarms, maintenance, billing, write side |
| Services | `loadTopology`, reported-figure inputs, `regionCollectionEfficiency` | Composition root, read models, services for the other analytics |
| API | Nothing | Route handlers, runtime validation, error model, auth |
| UI | Executive and Operations on legacy data; 9 "Coming Soon" pages | Any connection to services; honest data states |
| GIS | `Coordinates` type; Leaflet installed, unused | Map, topology rendering, spatial queries |
| AI / MCP | Nothing | Tool layer over services, assistant UI |
| Planning | Nothing (an unused legacy type file) | Whole module |

## 3. Layering

```text
Target                               Today
------                               -----
UI                                   UI ──► src/data + src/types (legacy)
 ↓
Application services                 src/services (3 functions, unused by UI)
 ↓
Analytics ──► Domain                 src/analytics ──► src/domain   (complete)
 ↓
Repository ports                     src/repositories/ports          (complete, read-only)
 ↑
Adapters                             memory, mock (maps legacy data)
 ↑
Database / telemetry / external      none
```

Import boundaries for domain, analytics, ports, adapters, services and
`src/data` are enforced by ESLint. There is no rule yet for the UI.

## 4. Application map

| Route | Product function | State |
| --- | --- | --- |
| `/dashboard` | Platform overview (capabilities, architecture, partners) | Working, static marketing content |
| `/dashboard/utility` | Utility suite hub | Working, links only |
| `/dashboard/utility/executive` | Executive: portfolio view | Working on legacy data; KPIs computed or hardcoded in the page |
| `/dashboard/utility/operations` | Operations: drill-down region → meter | Working on legacy data; three panels are hardcoded |
| `/dashboard/utility/revenue` | Revenue | Coming Soon |
| `/dashboard/utility/ai`, `/dashboard/intelligence/ai` | AI assistant (duplicated route) | Coming Soon |
| `/dashboard/intelligence/analytics` | Analytics | Coming Soon |
| `/dashboard/intelligence/gis` | GIS | Coming Soon |
| `/dashboard/der`, `/minigrid`, `/planning` | Sector suites | Coming Soon |
| `/dashboard/reports`, `/settings` | Administration | Coming Soon |

No routes exist for Assets, Reliability or Events / Alarms.

| Module | Role |
| --- | --- |
| `src/domain` | Canonical types |
| `src/analytics` | Deterministic calculations, results with status, missing inputs, origin, quality, methodology |
| `src/repositories/ports` | Read-only data interfaces |
| `src/repositories/memory` | In-memory adapter over a `DomainDataset` |
| `src/repositories/mock` | Maps legacy mock data to the domain; `MappingReport` lists what could not be carried |
| `src/services/analytics` | Use cases joining repositories and analytics |
| `src/components/utility/operations` | 18 components; drill-down panels and cards |
| `src/context/OperationsContext` | Client-side selection state holding legacy objects |
| `src/data`, `src/types` | Legacy mock data and legacy types |
| `src/components/charts`, `tables`, `cards/StatCard`, `shared/EmptyState` | Built but used by no screen |

## 5. Data-flow map

**Live path (what users see):**

```text
src/data/utility/*.ts (hand-written literals)
  → imported directly by components
  → filtered / summed / averaged in the component
  → rendered
```

Plus literals typed straight into JSX (reliability, alarms, outages,
collection efficiency 86.6%, ATC&C 17.1%), which have no data source at all.

**Canonical path (tested, not displayed):**

```text
src/data/utility/*.ts
  → repositories/mock/legacy.ts (single gate)
  → mapRegistry / mapObservations / mapEvents / mapReported
  → DomainDataset + MappingReport (152 issues, 0 errors)
  → in-memory repositories (ports)
  → services → analytics → result with status and provenance
  → terminates in tests
```

On the mock data this path yields: 1 substation, 1 feeder, 3 distribution
transformers, 3 meters, no power transformers, no customers, no interval
energy, 2 undated outages. Energy accounting, losses, loading and
reliability therefore all return `insufficient_data`; only collection
efficiency and reconciliation produce values.

## 6. Domain model audit

- **Duplicated concepts:** `src/types/utility.ts` and `src/types/executive.ts`
  redefine Region, Substation, Feeder, Transformer, Meter, EdgeDevice, Outage
  and Alarm. There are two legacy region shapes whose values disagree (26
  `CONFLICTING_SOURCES` issues).
- **Weak abstractions (legacy):** one object mixes identity, live readings
  and KPIs; status is stored rather than derived.
- **Missing entities:** DER (PV, BESS, inverter, generator), mini-grid site,
  tariff, bill, payment, receivable, planning objects, geography below region
  (state, LGA, community).
- **Missing temporal concepts:** topology is "current only"; no history of
  parent changes or customer-to-service-point assignment.
- **Provenance:** present on every canonical record. Synthetic data has no
  dedicated flag beyond `DataSource.kind = "mock"`.
- **Ports gap:** the domain has `Alarm` and `MaintenanceRecord` but no port
  serves them.

## 7. Business logic audit

- **In the engine:** all current KPIs, tested (164 tests).
- **In the UI (to remove):** revenue sums and unweighted SAIDI / SAIFI
  averages in `executive/page.tsx`; collection efficiency in
  `ExecutiveRegionCard.tsx`; online counts and percentages in `GridSummary`
  and `NetworkHealth`; parent-id filtering in every drill-down panel.
- **Hardcoded:** `ReliabilityOverview`, `AlarmPanel`, `OutagePanel`, and two
  KPI cards on the Executive page.
- **Incorrect assumptions:** averaging regional SAIDI / SAIFI without
  customer weighting; showing sample counts (1 substation) as totals.
- **Missing services:** energy account, losses / ATC&C, reliability, loading,
  operations read models.

## 8. UI / UX audit

- **Misleading information:** fabricated alarms, outages and reliability
  figures look live; "Live Operations Feed" and "Real-time" label static
  data; no figure shows its source, its time, or whether it is reported or
  calculated; nothing says the data is demonstration data.
- **Navigation:** the sidebar lists suite hubs only. The Intelligence routes
  (analytics, GIS, AI) are not in the navigation; AI exists at two routes;
  Assets, Reliability and Events have no home.
- **Workflow:** Operations is one long page of stacked panels. The selection
  lives in client state, so a drill-down cannot be linked, bookmarked or
  refreshed, and there is no breadcrumb.
- **Missing states:** no loading, error, empty, stale or insufficient-data
  states; only a global error boundary. `EmptyState` exists but is unused.
- **Placeholders:** nine pages render a bare, unstyled "Coming Soon".
- **Inconsistency:** two card styles (`border-slate-800` versus
  `border-white/6`), ad-hoc headers alongside `PageHeader`, hardcoded dark
  colours instead of theme tokens.
- **Unused building blocks:** chart, table and stat-card components, and the
  installed Recharts, TanStack, Zustand, Zod, Leaflet and date-fns.
- **Good:** drill-down cards are real buttons; the visual tone suits an
  operations product.

## 9. Edge / cloud readiness

- **Ready:** observations are append-only with `observedAt`, quality and
  provenance; device state is derived from heartbeats; ports are async,
  take time as a parameter and report completeness, so a database or
  telemetry adapter can replace the mock without touching analytics.
- **Not ready:** ports are read-only (no ingest path); no device identity or
  registration flow; no stale-data policy in a service; `MetricKey` lacks
  state of charge, irradiance and other DER metrics; no storage, no
  streaming, no auth.

## 10. AI / MCP readiness

- **Ready in principle:** results are structured and carry status, missing
  inputs, origin, quality and methodology, which is what a tool layer needs
  to answer without inventing facts. PII rules are written into the domain.
- **Not ready:** too few services to expose; no stable service contracts or
  runtime schemas; no authorization boundary; no audit of tool calls.
- **Path:** AI tools should wrap application services one-to-one. Do not
  start before the service layer is complete and stable.

## 11. Technical debt (most important first)

1. UI bypasses the canonical stack entirely.
2. Fabricated and hardcoded figures in the UI.
3. Duplicate legacy type system and conflicting mock data.
4. No composition root and no UI import boundary.
5. Mock data cannot exercise the analytics engine.
6. No CI (added with this blueprint) and no UI tests.
7. `README.md` is out of date.
8. `package.json` has no `"type": "module"` (Node warning on every test
   file) and declares Node ≥ 20.9 although the test script needs a Node that
   runs TypeScript natively.
9. Unused type modules (`asset`, `telemetry`, `der`, `minigrid`, `planning`)
   and `data/utility/revenue.ts`.

## 12. Product gaps

Assets, Reliability, Events / Alarms and Revenue workspaces; GIS; mini-grid
and DER domains and screens; planning; AI assistant; reports; authentication
and multi-organization access; real data ingestion; billing and financial
intelligence.
