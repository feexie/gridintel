# GridIntel

GridIntel is an energy intelligence platform for electricity distribution
utilities, distributed energy resources (DER), mini-grids and power-system
planning.

> **Status: frontend prototype.** The application currently runs entirely on
> static mock data. There is no backend, database, authentication, AI
> integration or GIS map yet.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) with React 19
- TypeScript (strict mode)
- Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
  and lucide icons
- ESLint 9 (flat config, `eslint-config-next`)

Installed for planned work but not yet used: TanStack Query and Table,
Zustand, Zod, React Hook Form, Recharts, Leaflet / React Leaflet and date-fns.

## Requirements

- Node.js 20.9 or later (the Next.js 16 minimum)
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
| `npm run lint`      | Run ESLint (`next build` no longer lints)   |
| `npm run typecheck` | Type-check the project with `tsc --noEmit`  |

## Project structure

```
src/
├─ app/                 Routes (App Router)
│  └─ dashboard/        Dashboard shell and all sector workspaces
├─ components/
│  ├─ layout/           DashboardShell, Sidebar, Topbar, NavItem
│  ├─ platform/         Platform landing page sections
│  ├─ utility/          Utility suite (executive, operations)
│  ├─ cards/ shared/    Reusable cards, headers and badges
│  ├─ charts/ tables/   Chart and table placeholders
│  └─ ui/               shadcn/ui primitives
├─ constants/           Sidebar navigation
├─ context/             OperationsContext (operations drill-down selection)
├─ data/                Static mock data (platform content, utility network)
├─ lib/                 Utilities (`cn`)
└─ types/               Domain types (utility, telemetry, assets, platform)
```

Components import mock data directly from `src/data`. There is no service or
API layer yet.

## Current functionality

| Route                           | Status                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `/dashboard`                    | Platform overview: capabilities, architecture, founder story, partners                    |
| `/dashboard/utility`            | Utility Intelligence suite hub                                                             |
| `/dashboard/utility/executive`  | Executive dashboard: regional KPIs, revenue, SAIDI/SAIFI, ATC&C, event feed                |
| `/dashboard/utility/operations` | Operations center: region → substation → feeder → transformer → smart meter drill-down, edge device status |
| `/dashboard/utility/revenue`    | Placeholder                                                                                |
| `/dashboard/utility/ai`         | Placeholder                                                                                |
| `/dashboard/der`                | Placeholder                                                                                |
| `/dashboard/minigrid`           | Placeholder                                                                                |
| `/dashboard/planning`           | Placeholder                                                                                |
| `/dashboard/intelligence/*`     | Placeholders (analytics, GIS, AI)                                                          |
| `/dashboard/reports`, `/dashboard/settings` | Placeholders                                                                   |

Known prototype limitations:

- Only the Adamawa region has substation, feeder, transformer and meter mock
  data.
- Reliability, alarm and outage panels in the operations center display static
  values.
- Chart components are layout placeholders.

## Development notes

This project uses Next.js 16, which has breaking changes from earlier versions
(for example, async `params`/`searchParams`, `proxy` instead of `middleware`,
and no `next lint`). Consult the bundled documentation in
`node_modules/next/dist/docs/` before writing framework code. See `AGENTS.md`.
