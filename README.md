# GridIntel

GridIntel is an energy intelligence platform for electricity distribution
utilities, distributed energy resources (DER), mini-grids and power-system
planning.

> **Status: prototype on synthetic data.** The Executive page and the
> Operations Center run end to end on a designed, synthetic demonstration
> dataset: no real network, customer or transaction. There is no backend API,
> database, authentication, AI integration or GIS map yet.

## Documents

| Document | What it is |
| --- | --- |
| `docs/ENGINEERING_RULES.md` | Standing rules: data truth, layering, decision gates, workflow |
| `docs/ROADMAP.md` | Phases, their status and acceptance criteria |
| `docs/BLUEPRINT.md` | Current versus target architecture |
| `docs/adr/` | Decision records |
| `src/repositories/demo/DATASET_ASSUMPTIONS.md` | Every assumption behind the synthetic dataset |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) with React 19
- TypeScript (strict mode), ES modules
- Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
- ESLint 9 (flat config), which also enforces the import boundaries between
  layers
- Tests on Node's built-in test runner

- Leaflet / React Leaflet for the map, with no basemap

Installed for planned work but not yet used: TanStack Query and Table,
Zustand, Zod, React Hook Form, Recharts and date-fns.

## Data credits

Boundaries: geoBoundaries (CC BY 4.0), Runfola et al. 2020.

The administrative boundaries of Nigeria's states and local government areas
are from [geoBoundaries](https://www.geoboundaries.org) (gbOpen, release
`9469f09`, source GRID3), under the Creative Commons Attribution 4.0
International licence. They are simplified outlines for orientation and are
not survey-grade. Files, hashes and how they were built: ADR 0014 and
`scripts/build-boundaries.mjs`. Citation: Runfola, D. et al. (2020)
geoBoundaries: A global database of political administrative boundaries.
PLoS ONE 15(4): e0231866.

Everything else the application shows is synthetic demonstration data.

## Requirements

- Node.js 22.18 or later (the test script runs TypeScript files directly)
- npm

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects
to `/dashboard`.

## Scripts

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start the development server                |
| `npm run build`     | Create a production build                   |
| `npm run build:request` | The same build with every data screen rendered on request (ADR 0012) |
| `npm run verify`    | Type-check, unit tests, lint, both builds, browser tests |
| `npm run start`     | Serve the production build                  |
| `npm run lint`      | Run ESLint, including import boundaries     |
| `npm run typecheck` | Type-check the project with `tsc --noEmit`  |
| `npm test`          | Run the unit test suite                     |
| `npm run test:e2e`  | Run the browser tests (build first)         |

Typecheck, unit tests, lint, build and the browser tests run in CI. The browser
tests need Chromium once: `npx playwright install chromium`.

## Architecture

```
UI (src/app, src/components)
  ↓ view models
Composition root (src/composition)      chooses the adapter and the clock
  ↓
Services (src/services)                 use cases and read models
  ↓
Analytics (src/analytics) → Domain (src/domain)
  ↓
Repository ports (src/repositories/ports)
  ↑
Adapters (src/repositories/memory, demo)
```

- `src/domain`: canonical types. No runtime code.
- `src/analytics`: deterministic, pure calculations. Every result carries a
  status, its inputs, their origin and quality, and the methodology used.
- `src/repositories/demo`: the synthetic dataset, generated from a fixed seed.
- `src/services/operations`, `src/services/executive`: read models for the screens.
- `src/composition`: chooses the adapter and the clock, and holds the result
  cache.
- `e2e`: browser tests.

## Current functionality

| Route | Status |
| --- | --- |
| `/dashboard` | Platform overview |
| `/dashboard/map` | Map: the network on a plain ground, transformers coloured by loading, ATC&C, revenue not realised or band compliance, interruptions in progress with what is behind them, standing alarms, totals by synthetic district, and state and LGA boundaries for orientation. The same map is inside the Operations levels and Events / Alarms |
| `/dashboard/utility` | Utility Intelligence suite hub |
| `/dashboard/utility/operations` | Operations Center: drill from region to substation, feeder, transformer and service point. ATC&C decomposition, reliability with attribution, service-band compliance and peak loading, each with status, origin, source and method |
| `/dashboard/utility/executive` | Executive: a ranked "where to look first" list, ATC&C with its technical / commercial / collection split, reliability with attribution, service-band compliance per feeder, transformer peak loading, and reported figures against calculated ones on the same basis |
| Other routes | Placeholders |

## Development notes

This project uses Next.js 16, which has breaking changes from earlier versions
(for example, async `params`/`searchParams`, `proxy` instead of `middleware`,
and no `next lint`). Consult the bundled documentation in
`node_modules/next/dist/docs/` before writing framework code. See `AGENTS.md`.
