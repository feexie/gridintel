# GridIntel blueprint

Current versus target architecture. Update this file when the architecture
changes. The plan is in `ROADMAP.md`; the vision is in
`private/FOUNDING_DIRECTIVE.md`, which is not committed.

> **State at the Phase 6 close-out (2026-10-07).** Since 6c-3:
>
> - **Two ways to render, chosen by one question** (ADR 0012).
>   `datasetIsFixed()` in the composition root: true for the synthetic
>   demonstration adapter. Then the network screens (112 pages) are rendered
>   when the application is built, a service point is rendered on its first
>   visit, and no warm-up runs. For any other adapter every data screen is
>   rendered on request from the result cache, behind the warm-up and the
>   preparing page, as before. Every data route asks
>   `src/app/dashboard/utility/screen.ts`; nothing else knows which path is
>   taken.
> - **Two builds, both tested.** `GRIDINTEL_RENDER=request` builds the
>   request path into `.next-request` (`npm run build:request`). `verify`
>   builds both; the browser tests run against both.
> - **Longer lists are paths** (`…/all`), not query strings; the old
>   addresses redirect.
> - **An outage has a status** (`Outage.status`, from its source). Open with
>   no restoration time is in progress; closed or unstated with none is a
>   data-quality item (ADR 0013, amendment). `openOutagesAt` gives one row
>   for each outage. An open interruption counts in the reliability indices
>   to the end of the period, and the result is provisional (reliability
>   methodology 0.3.0; ADR 0013, second amendment).
> - **Not found.** `src/app/not-found.tsx` shows the dashboard frame with the
>   SYNTHETIC DATA bar.
> - **The founding directive is not in the repository.** It is in
>   `private/`, which is not committed.
>
> **State at the Phase 6c-3 checkpoint (2026-10-07).** Since 6c-2:
>
> - **Workspaces.** `/dashboard/utility/assets` and `/events` complete the
>   six. Read models in `src/services/assets` and `src/services/events`,
>   bindings in `src/composition`, components that compose the system
>   components. Both are built from the blocks the drill-down already
>   shows; what "attention", "in progress" and "affected" mean is in ADR
>   0013.
> - **Interruptions open at a time.** `openExposuresAt`
>   (`src/analytics/reliability/open.ts`) and the `openInterruptions`
>   service: in progress, restoration not recorded and start not recorded
>   are three cases, never merged.
> - **Alarms.** `allAlarmsBlock` lists every cleared alarm for the Events
>   screen; the drill-down still lists the most recent six. A subject view
>   names the kind of registry record it is.
> - **Tables.** Every table on a data screen is built from the table
>   primitives in `src/components/system/Table.tsx`.
> - **Typeface.** The IBM Plex files are in `src/app/fonts` and loaded with
>   `next/font/local`; a build fetches nothing.
> - **Hosting.** The preview is public on Vercel (ROADMAP, hosting notes).
>   Every page is `noindex, nofollow` and `/robots.txt` disallows all
>   (`src/app/layout.tsx`, `src/app/robots.ts`). ADR 0012 proposes building
>   every screen ahead of time on a fixed dataset; it is not implemented.
>
> **State at the Phase 6c-2 checkpoint (2026-10-05).** Since 6c-1:
>
> - **Workspaces.** `/dashboard/utility/reliability` and `/revenue` join
>   Executive and Operations. Each has a read model (`src/services/reliability`,
>   `src/services/revenue`) built from the same blocks as the drill-down, a
>   binding in `src/composition`, and a component that composes the system
>   components.
> - **Design system.** Tokens in `src/app/globals.css` (`@theme static`):
>   surfaces, lines, five text levels, status, chart series, three type
>   sizes. Product components name tokens, never palette colours or pixel
>   sizes. Shared components are in `src/components/system`: `Metric`
>   (tiles, cells, badges, panel, legend), `Panels` (losses, revenue gap,
>   reliability, loading, alarms, tables of children), `Table` (page head,
>   table and note primitives, share bar), `DataBar`, `PreparingData`,
>   `format`. IBM Plex Sans and Mono are self-hosted through `next/font`.
> - **Shell.** One menu (`src/constants/navigation.ts`) of screens that
>   exist; one `DataBar` in the dashboard layout with the SYNTHETIC DATA
>   label, the reporting period and the as-of time; one `h1` per page.
> - **Alarms and conditions (ADR 0011).** `EventRepository.listAlarms` and
>   `ObservationRepository.listHeartbeats`; `src/analytics/conditions`
>   derives conditions under named rules; `scopeAlarms` returns the recorded
>   and the derived separately. `placeOfAsset` says which scope an asset is
>   under. Loading accepts a power transformer. Amended in 6c-3: an alarm
>   has a canonical `kind`, and `relateToSourceAlarms` says for each
>   condition whether a source alarm of the matching kind stood beside it
>   (agrees, none raised, cannot tell). The lists stay two.
> - **Energy account (ADR 0010).** Recorded consumption has two measured
>   sources, intervals and register advances within a reading window, each
>   with its own figure and coverage.
> - **Reliability.** `attributionRuleDifference` sizes what a reported
>   attribution rule changes (ADR 0007, second amendment);
>   `reliabilityBreakdown` and `interruptionsByOrigin` cut a result by cause,
>   origin point and origin element.
> - **Readiness.** The process has a readiness state; the warm-up yields
>   between steps; data routes show a preparing page while it runs;
>   `/api/ready` reports the state. This is the first route handler.
> - **Process.** `npm run verify` runs all five checks; a commit follows only
>   a green run.
>
> **State at the Phase 6c-1 checkpoint (2026-10-04).** Since Phase 6a:
>
> - The synthetic network has two substations, four feeders and 48
>   transformers (Phase 6b). Hillcrest has two incomers, two power
>   transformers and two bus sections; `PowerTransformer` carries an optional
>   `busSection`.
> - The engine no longer assumes that a customer meter reports intervals (ADR
>   0009). AMI meters hold interval energy; postpaid meters read by hand hold
>   register readings (`TelemetryPoint`, `energy_import_register_kwh`), which
>   `registerAdvance` turns into the energy between two readings; ordinary
>   prepaid meters hold only vends. `EnergyAccount.consumptionCoverage` says
>   which connections the recorded-consumption cross-check can see. Energy
>   vended is shown as energy purchased and is never consumption.
> - Interruptions are attributed by where they began (ADR 0006, amendment),
>   and a reported basis may state its attribution rule, in which case the
>   calculation beside it is made on that rule (ADR 0007, amendment).
> - The Executive read model cuts its own money ranking; the component cuts
>   and filters nothing.
> - The in-memory adapter indexes interval energy by meter and telemetry by
>   source.
>
> **State at the end of Phase 6a (2026-10-02).** Legacy mock data, types,
> the mock adapter and the `mock` source kind are gone. Regions and the
> portfolio are accounted as the sum of their electrical sections. Results are
> cached once per process. Browser tests run in CI. See section 13 for the
> assumptions that would tie the platform to distribution utilities.
>
> **State at the end of Phase 5 (2026-10-01).** Sections 2
> to 12 below describe the repository as audited at commit `da0fad7`, before
> Phase 5. Since then:
>
> - The Operations Center and the Executive page run on the canonical stack end to end:
>   UI → composition root → operations read models → analytics services →
>   analytics → repository ports → synthetic demo adapter.
> - The domain has billing records, a `synthetic` source kind and feeder
>   service bands; analytics has billing totals, reliability attribution,
>   hours of supply and band compliance, peak loading, ATC&C decomposition and
>   the `calculated_with_estimates` status.
> - Every KPI states its basis, and a reported figure is compared only with
>   the calculated figure on the same basis (ADR 0007).
> - A lint rule keeps the UI away from data files, the domain, analytics and
>   repositories, with no exemption. No screen holds a literal KPI.
> - The Executive page lists "where to look first": ranked facts from fixed
>   rules over service results, each linking into the drill-down.
> - The legacy operations and executive components and `OperationsContext` are deleted.
>   Legacy `src/data`, `src/types` and the mock adapter remain until Phase 6.
> - CI runs typecheck, tests, lint and build on every push.

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

## 13. Assumptions that would make the platform DisCo-only

The platform is also meant for mini-grids. Nothing has been built for them,
and nothing should be designed against them. These are the places
where the domain or the services currently assume a distribution utility.
None is hard to change; each needs a decision before mini-grid work starts.

| Where | Assumption today | What a mini-grid needs |
| --- | --- | --- |
| `ScopeRef`, topology index | Scopes are organization, region, substation, feeder, distribution transformer. Every asset hangs under a substation. | A **site** scope that is not under any substation, with its own generation, storage and distribution. |
| `MeterInstallation` roles | Boundary meters are substation incomer, feeder head, transformer totalizer and grid interface. Energy enters from upstream. | Roles for **generation** (PV, generator), storage in and out, and site output. |
| Energy account | Energy input is the net flow at the input boundary meters. Embedded generation is ignored unless a methodology allows a separately measured adjustment (default: none). | **Generation as the energy-account input**: energy generated, less storage losses and curtailment, equals energy available for sale. |
| `sectionsForScope` (the cut) | Sections are substations, feeders and transformers. | A site as a section in its own right. The cut's own comment says so. |
| Reliability, hours of supply | Customer-weighted from outage exposures per transformer. | The same calculation works, but mini-grid reporting usually wants **availability of the site's supply** and hours per day per customer tier. |
| `Feeder.serviceBand` | NERC Service-Based Tariff bands A to E. | Mini-grid tariffs are set per site under the mini-grid regulation; no bands. The field is optional, so it does not block, but band compliance has no meaning there. |
| `KpiKey` | ATC&C, SAIDI, SAIFI, collection and loading. | Generation, renewable fraction, capacity utilisation, connections, energy sold per connection, uptime. |
| `MetricKey` (telemetry) | Voltage, current, power, frequency, temperature, energy registers. | State of charge, irradiance, inverter and generator state, fuel. |
| Billing | Bills, vends and payments per customer; tariff as a code on the charge. | Mostly prepaid per-kWh or per-tier tariffs; the model fits. Connection fees and subsidy receipts are not modelled. |
| Revenue gap | Unbilled energy valued at the low-voltage non-MD rate of the transformer where it occurs. | The "where it occurs" level would be the site or its distribution segment. The valuation rule itself carries over. |
| Organization | `OrganizationKind` already includes `minigrid_operator` and `der_developer`. | Nothing. |
| Reported figures | `ReportedKpi` with a basis; compared only on the same basis. | Fits directly: a claimed figure beside a calculated one, with the basis stated. |

**What 6a and 6b must not do.** Add a required link from an asset to a
substation; add a rule that energy always enters from upstream; hard-code the
scope kinds in a way a new kind cannot join; make the NERC band required.
Phase 6a added none of these: the cut and the aggregation work over a list
of sections, and the revenue-gap tree is built from nodes, so a site can
become a section or a node without changing either calculation.
