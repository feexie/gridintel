# Phase NAV-A plan: public front door, role picker, branded workspace shell

Date: 2026-11-08. Branch `phase-nav-a` (from `main` at `0045ec6`).
Status: **approved by the Founder on 2026-11-08; built, at its checkpoint on 2026-11-10.** Where the build differs from this plan: the routes are in `src/app/preview` with no route group (the dashboard layout wraps only `/dashboard`, so none was needed); the routing is in `src/constants/frontDoor.ts`; the pending count comes from `pending()` on the marketplace port; Sign in's address is read by `src/composition/signIn.ts`.
Decision record: ADR 0021 (draft).

NAV-A is a clickable shell on synthetic data. It moves nothing: `/` still
leads to `/dashboard`, the current menu and every current address are
unchanged, and no figure changes (`npm run geh:figures` shows no change).

## 1. Routes added (all under `/preview`, public demonstration only)

| Address | What it is | Layer |
| --- | --- | --- |
| `/preview` | Home: three initiative cards, top bar with Sign in, no rail | Public |
| `/preview/initiatives/[initiative]` | Role picker: "Who are you?" | Public |
| `/preview/initiatives/[initiative]/[role]` | A public role's view, or, for an organization role, the sign-in hand-off | Public |
| `/preview/workspace/[demo]` | A demo workspace's Home, badged DEMO | Demo (no login) |
| `/preview/workspace/[demo]/[item]` | A rail item (Intelligence, Plan, Finance, Oversight) in that workspace | Demo |
| `/preview/workspace/[demo]/reports` | Reports, inside the workspace only | Demo |

- On a tenant deployment every `/preview` address answers "not found"
  (the page checks `deploymentMode()`), so the tenant's proxy and
  `isPublicPath` are not touched in NAV-A.
- `/preview` is left out of the search index (`robots`) and its pages say
  "Prototype" in the top bar.
- A route group `src/app/(front)/preview/` gives the public pages their own
  light layout (no data bar, no dashboard shell), and
  `src/app/(front)/preview/workspace/[demo]/layout.tsx` gives the workspace
  its header and slimmed rail. Neither shares the dashboard layout.

**Public views in NAV-A (shells, nothing submitted):**

| Initiative · role | View in NAV-A |
| --- | --- |
| Meter every customer · Customer | The application form laid out with every field of the brief (name, phone, optional email, state, LGA or area, address, landmark, DisCo, meter OEM filtered by DisCo with "No preference", optional account number, optional map pin, NDPR consent), with submitting switched off and a line saying it is built in MTR-A. A "Track my application" page, the same. |
| Charging hubs · End user | State picker, and a planned page: the network data comes with EMOB-A/B. No figure. |
| Mini-grid verification · Public | Summary figures only, from the mini-grid service, labelled synthetic. |
| Any organization role | "Sign in to your workspace" (the button leads to the tenant sign-in once the address is set; gate 1), and "Open the demo workspace" for that workspace type, landing on that initiative's rail item. |

## 2. Files added

| File | Layer | Holds |
| --- | --- | --- |
| `src/constants/initiatives.ts` | Catalogue | The initiative config (below); no figure |
| `src/constants/workspaces.ts` | Catalogue | Workspace types, the slimmed rail per type, what each rail item lists, the demo workspaces (synthetic organizations, name, logo or fallback, type) |
| `src/constants/frontDoor.ts` | Pure function | The `/preview` addresses and `routeFor(initiative, role)`; `railFor(type)` is in `workspaces.ts` |
| `src/services/initiatives/views.ts` | Service | `InitiativeCardView`, `RolePickerView`, `WorkspaceHeaderView`, `RailView`: view models with sourcing |
| `src/services/initiatives/headline.ts` | Service | Resolves a headline metric id to a `MetricView` from the existing planning and mini-grid services; unknown or unsupported is a status, never 0 |
| `src/composition/initiatives.ts` | Composition | Wires the service to the existing published data and runtimes |
| `src/components/front/*` | UI | `PublicTopBar`, `InitiativeCard`, `RolePicker`, `SignInHandoff`, `MeterApplicationShell`, `TrackShell` |
| `src/components/workspace/*` | UI | `WorkspaceHeader` (logo, name, DEMO badge, switcher), `WorkspaceRail`, `RailItemPage` |
| `src/app/(front)/preview/**` | Routes | The addresses of section 1 |
| `e2e/front-door.spec.ts` | Test | Browser tests (section 7) |
| `src/constants/*.test.ts`, `src/services/initiatives/*.test.ts` | Test | Unit tests (section 7) |

`eslint.config.mjs` gains the new folders in the existing boundaries: the
components import only view-model types from `src/services`; the routes
call the composition root.

## 3. The initiative config shape

```ts
export type WorkspaceType = "utility" | "der" | "minigrid" | "financier" | "regulator";
export type RailItemId = "home" | "intelligence" | "plan" | "finance" | "oversight";

export type PublicViewId = "meter-application" | "meter-track" | "charging-network" | "minigrid-summary";

export type InitiativeRole =
  | { id: string; label: string; description: string; audience: "public"; view: PublicViewId }
  | { id: string; label: string; description: string; audience: "organization"; workspaceType: WorkspaceType; landing: RailItemId };

export type Initiative = {
  id: string;                    // "meter-every-customer"
  title: string;                 // no city in the name
  summary: string;
  /** Resolved by src/services/initiatives to a MetricView with status and origin. Never a number here. */
  headline: HeadlineMetricId;
  /** Optional progress bar, resolved the same way; shown only when the service supports it. */
  progress?: HeadlineMetricId;
  roles: InitiativeRole[];
  status: "live" | "prototype" | "planned";
};
```

The three entries, with their proposed headline (each the Founder's to
confirm; open question 4):

| Initiative | Roles (public · organization) | Headline proposed | Status of the figure |
| --- | --- | --- | --- |
| Meter every customer | Customer · Utility, DER, Financier | Customers metered nationally, with a progress bar | Reported (NERC, the figure the Metering screens already use) |
| Charging hubs | End user · Utility, DER | None yet | "Not yet available" until EMOB-A |
| Mini-grid verification | The public · Mini-grid, Financier, Regulator | Sites with verified reports | Synthetic, from the mini-grid service |

A test holds that every role leads somewhere real, that every
organization role names a rail item its workspace type has, and that the
catalogue holds no numeric literal.

## 4. The role picker flow

```text
/preview  ── card ──▶  /preview/initiatives/[id]   "Who are you?"
                          │
          public role ────┼──▶ /preview/initiatives/[id]/[role]  (public view)
                          │
   organization role ─────┴──▶ /preview/initiatives/[id]/[role]  (sign-in hand-off)
                                   ├─ "Sign in"  → tenant sign-in (gate 1; inactive in NAV-A)
                                   └─ "Open the demo workspace"
                                         → /preview/workspace/demo-[type]/[landing]
```

`routeFor` is pure and is the only place this is decided; the pages render
its result.

## 5. The demo workspace

- One demo workspace per workspace type, each a synthetic organization:
  the existing synthetic DisCo (Utility) and synthetic mini-grid operator
  (Mini-grid), plus three new synthetic organizations for DER, Financier
  and Regulator, named as obviously synthetic and labelled so.
- Header: logo (none supplied, so the GridIntel fallback mark with the
  organization's initials) and name; a **DEMO** badge on every screen;
  the switcher lists the five demo workspaces, and switching changes the
  header and the rail.
- Read-only: no button in it carries out an action; any action button is
  shown disabled with "Sign in to do this".
- One rail item filled per type, by the existing screen's component and
  view model (nothing re-implemented, nothing recalculated):

  | Workspace type | Item filled | From |
  | --- | --- | --- |
  | Utility | Intelligence | The Executive view |
  | Mini-grid | Intelligence | The Sites view |
  | Financier | Finance | The Marketplace view |
  | Regulator | Oversight | The Monitoring view |
  | DER | Plan | The E-mobility planned page (no figure) |

  Every other item lists the views that will move there in NAV-B, each
  linking to its current address.
- Reports appear only inside the workspace (bottom of the rail), never on
  a public page; in NAV-A the item links to the current reports list.

## 6. What stays untouched

- `/`, `/dashboard/**`, the current menu (`navigation.ts`, `access.ts`),
  every current address and redirect, presentation mode.
- `proxy.ts`, `isPublicPath`, login, ADR 0020's two deployments, the
  identity port and adapters, the Supabase migration.
- Every method, service result and figure; the GEH recorder and
  `KEY-FIGURES.md`.
- The ADR 0017 word "workspace" in code (renamed to "View" in NAV-B).

## 7. Tests

Unit (node --test):
- the catalogue: every role resolves; organization roles land on a rail
  item their type has; no numeric literal; ids unique;
- `routeFor`: each public role to its view, each organization role to the
  hand-off with the right demo workspace and landing;
- `railFor`: Oversight only for Regulator; Finance first for Financier;
  no Deliver, no Customers; each view in exactly one rail item;
- headline resolution: a reported figure keeps "reported"; a synthetic one
  is marked synthetic; an unsupported one is a status and never 0.

Browser (Playwright, public build):
- an anonymous visitor at `/preview` sees three cards, a Sign in button,
  no rail, no Reports link and no data bar;
- card → role picker → customer → the application shell; → organization
  role → hand-off → demo workspace, badged DEMO, landing on the right item;
- the switcher changes the header's name and the rail;
- no public page contains a link to a report;
- the current Platform Overview and menu answer as before (existing tests).

Browser (tenant build): `/preview` and its pages are not found.

Checks: `npm run verify:local` before every commit; `npm run verify` green
before the checkpoint.

## 8. Conflicts with Phase 8A

1. **8A's state.** 8A's commit (`87e63a8`) is already in `main`: it was
   committed before the GEH sprint and came in with the sprint's merges.
   ROADMAP still says "at its checkpoint, not merged", there is no
   `phase-8a` tag, and the `phase-8a` branch has nothing `main` lacks. The
   front-door brief puts NAV-B after "8A login merges". This needs the
   Founder to close 8A formally (open question 1).
2. **One site or two** (ADR 0021, gate 1). The public demonstration has no
   sign-in pages, and a browser test holds that. NAV-A keeps it so: the
   Sign in button is a link to an address set in configuration, inactive
   until set.
3. **Public pages on the tenant deployment** (gate 2): NAV-A avoids it by
   serving `/preview` on the public demonstration only.
4. **Workspace type against `sectors`.** ADR 0020's organizations hold
   sectors (`utility`, `minigrid`); `grantFor` drops every key outside
   them, so a tenant DisCo today cannot open `planning.*` (the Metering
   screens). A workspace type must map to sectors, or replace them, in the
   database brief.
5. **Action permissions** (ADR 0021, decision 8) extend ADR 0018's screen
   grant. Nothing in NAV-A uses them.
6. **The financier's masked pipeline** reads application data. No PII may
   reach it (engineering rule 2); masking is designed in MTR-B.

## 9. Order of work after approval

1. Catalogues and pure routing, with unit tests. Commit.
2. Initiatives service and composition, with tests. Commit.
3. Public layer: Home, role picker, public views, hand-off. Browser tests. Commit.
4. Demo workspace: header, switcher, rail, the five filled items. Browser tests. Commit.
5. The address table (every current address against its proposed new
   one), screenshots into `docs/screenshots/phase-nav-a`, ROADMAP entry.
   Stop at the checkpoint.
