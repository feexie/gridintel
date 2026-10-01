# GridIntel

GridIntel is an energy intelligence platform for electricity distribution
utilities, distributed energy resources (DER), mini-grids and power-system
planning.

> **Status: prototype on synthetic data.** The Operations Center runs end to
> end on a designed, synthetic demonstration dataset: no real network,
> customer or transaction. There is no backend API, database, authentication,
> AI integration or GIS map yet. The Executive page still runs on legacy mock
> data.

## Documents

| Document | What it is |
| --- | --- |
| `docs/ENGINEERING_RULES.md` | Standing rules: data truth, layering, decision gates, workflow |
| `docs/ROADMAP.md` | Phases, their status and acceptance criteria |
| `docs/BLUEPRINT.md` | Current versus target architecture |
| `docs/adr/` | Decision records |
| `docs/FOUNDING_DIRECTIVE.md` | The founding product vision |
| `src/repositories/demo/DATASET_ASSUMPTIONS.md` | Every assumption behind the synthetic dataset |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) with React 19
- TypeScript (strict mode), ES modules
- Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
- ESLint 9 (flat config), which also enforces the import boundaries between
  layers
- Tests on Node's built-in test runner

Installed for planned work but not yet used: TanStack Query and Table,
Zustand, Zod, React Hook Form, Recharts, Leaflet / React Leaflet and date-fns.

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
| `npm run start`     | Serve the production build                  |
| `npm run lint`      | Run ESLint, including import boundaries     |
| `npm run typecheck` | Type-check the project with `tsc --noEmit`  |
| `npm test`          | Run the test suite                          |

All four checks (typecheck, test, lint, build) run in CI on every push.

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
Adapters (src/repositories/memory, demo, mock)
```

- `src/domain`: canonical types. No runtime code.
- `src/analytics`: deterministic, pure calculations. Every result carries a
  status, its inputs, their origin and quality, and the methodology used.
- `src/repositories/demo`: the synthetic dataset, generated from a fixed seed.
- `src/services/operations`: read models for the Operations screens.
- `src/data`, `src/types`, `src/repositories/mock`: legacy mock data, kept
  until Phase 6.

## Current functionality

| Route | Status |
| --- | --- |
| `/dashboard` | Platform overview |
| `/dashboard/utility` | Utility Intelligence suite hub |
| `/dashboard/utility/operations` | Operations Center: drill from region to substation, feeder, transformer and service point. ATC&C decomposition, reliability with attribution, service-band compliance and peak loading, each with status, origin, source and method |
| `/dashboard/utility/executive` | Executive dashboard on legacy mock data (to be migrated) |
| Other routes | Placeholders |

## Development notes

This project uses Next.js 16, which has breaking changes from earlier versions
(for example, async `params`/`searchParams`, `proxy` instead of `middleware`,
and no `next lint`). Consult the bundled documentation in
`node_modules/next/dist/docs/` before writing framework code. See `AGENTS.md`.
