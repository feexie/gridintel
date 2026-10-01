# GridIntel engineering rules

Standing rules for every session. For strategic context (product vision,
modules, long-term system layers) read `docs/FOUNDING_DIRECTIVE.md`; it is the
reference vision, not a task list. Current state and plan live in
`docs/BLUEPRINT.md` and `docs/ROADMAP.md`. Decisions live in `docs/adr/`.

## 1. Establish the real state first

- Run `git status`, `git log --oneline --decorate --graph -30`, `git branch -a`.
- Check uncommitted and untracked work: the latest progress may not be in a
  commit.
- Read the diffs and files, not only commit messages. Trust the repository
  over documentation.
- Do not assume the previous stopping point and do not rebuild what exists.

## 2. Data truth

Every value has an origin and a quality, and they are never mixed.

| Kind | Meaning |
| --- | --- |
| Measured / observed | From a meter, device or source system, with provenance |
| Reported | A figure published by someone else (`ReportedKpi`) |
| Calculated | Produced by `src/analytics` under a named, versioned methodology |
| Estimated / substituted | Marked as such in `DataQuality`, with the method in provenance |
| AI-interpreted | Explanation layered on top; never a source of facts |
| Missing / unknown | `null` with a reason; never `0` |

- Missing data is never zero. An empty result means "none" only when
  completeness is `complete`.
- Sample data is never presented as a complete inventory.
- Assumptions are recorded as assumptions, never as facts.
- Reported and calculated values are shown as separate figures.
- Every important KPI must be able to answer "where did this number come
  from?": source, time, method, quality, completeness.
- If the data cannot support a KPI, show the status (insufficient data,
  unavailable, sample, estimated, reported). Never fabricate measurements,
  customers, outages or financial results.
- Synthetic or demonstration data must be flagged in provenance and visibly
  labelled in the UI. It must never pass for real operational data.
- Customer PII never appears in analytics output or AI prompts.

## 3. Layering and import boundaries

```text
UI (app, components, context)
  ↓
Application services (src/services)
  ↓
Analytics (src/analytics)  →  Domain (src/domain)
  ↓
Repository ports (src/repositories/ports)
  ↑
Adapters (memory, demo, mock; later database, API, telemetry)
```

- `src/domain` imports nothing outside itself.
- `src/analytics` imports only the domain. It is deterministic and pure: no
  clock, no I/O, no randomness.
- Ports import only domain types. Repositories retrieve records; they never
  aggregate, calculate, pick a "latest" value or read the clock.
- Services receive repositories; they never choose an adapter. One
  composition root (`src/composition`) selects the adapter.
- Every service returns its result with `sourcing`; a result built on any
  synthetic record is marked synthetic and shown as such.
- The UI imports services and view-model types only. It does not import
  `src/data`, legacy types, adapters or analytics internals.
- The boundaries are enforced in `eslint.config.mjs`. Extend the rules when a
  layer is added; do not weaken them to make code pass.
- One canonical type per concept. No page-specific copies of an entity.

## 4. No KPI calculation in the UI

Components format and display. They do not sum, average, divide, filter to
derive counts, or hold literal KPI values. A component that needs a number
gets it from a service, together with its status and provenance.

## 5. AI is a layer above the energy engine

AI explains, queries and recommends over structured results. It never
replaces a deterministic calculation and its output is never stored or shown
as measured or calculated data.

## 6. Feature test

Before adding a feature, answer:

1. Does it represent a real energy-system concept?
2. Where does its data originate?
3. What is its canonical representation?
4. What business logic operates on it?
5. What service exposes that capability?
6. How does the UI consume it?
7. Can it eventually consume real-world data?
8. Can AI safely reason over it?
9. Can GIS relate it spatially?
10. Can planning/optimization eventually use it?
11. Can its results be traced back to their source?

If the answers are unclear, improve the architecture before adding
superficial functionality.

## 7. Decision gates

Stop and ask the Founder before:

- changing product scope or the roadmap order
- anything affecting data-integrity semantics or provenance
- auth, security, secrets, external integrations, or new infrastructure
  (database, cloud, paid services)
- deleting working functionality before its replacement is live
- adding a major dependency

Everything else is an engineering call: make it, state it briefly ("I found
X. It conflicts with Y. I am replacing it with Z because…"), and record major
decisions as short ADRs in `docs/adr/`.

## 8. Phase workflow

For each phase: inspect → plan → implement → test → review → commit → update
docs.

- Work only on the phase approved in `docs/ROADMAP.md`.
- Keep the repository working. Prefer several coherent commits to one large
  rewrite.
- Before every commit run `npm run typecheck`, `npm test`, `npm run lint` and
  `npm run build`. All four must pass.
- New analytics and services come with tests. Deterministic logic is tested
  with fixed inputs and fixed times.
- Temporary analysis scripts are removed after use. Do not modify production
  source merely to investigate.
- At the end of a phase update `docs/ROADMAP.md`, and `docs/BLUEPRINT.md` if
  the architecture changed.
- This is Next.js 16: read the relevant guide in `node_modules/next/dist/docs/`
  before writing framework code (see `AGENTS.md`).

## 9. Reporting format

At every stop, report:

Done / Commits / Checks (typecheck, test, lint, build) / Decisions made /
Open questions / Next.
