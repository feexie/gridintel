# Phase NAV-B plan: the screens move into the new structure

Date: 2026-11-25. Status: **approved by the Founder (2026-11-25) with one change, three
safeguards and conditions, all written in below (sections 0, 4, 4a to 4c, 9 to 11). Not started.**
Branch (once approved): `phase-nav-b` from `main`. Decision record: ADR 0021
(accepted 2026-11-10), with the amendment this plan proposes (section 11).
Addresses: `docs/design/NAV-A-ADDRESSES.md` (approved 2026-11-10), brought up
to date below. Phase 8A is closed (2026-11-25), so NAV-B and 8A no longer
collide on access.

What NAV-B does, in one paragraph:
- **Every screen moves** to its address by rail item, and every old address answers 308 to
  its new one, with the query string carried (`?present=1` included).
- **The public layer** leaves `/preview` for `/`. Home becomes the landing page, and each
  initiative gets its own page with **Take part**.
- **The signed-in frame** takes over `/dashboard`: the rail (Home, Intelligence, Plan,
  Finance, Oversight; Reports, Help and the account at the foot) and the workspace header.
- **Removed:** the old sector menu, the three Phase 1 "Coming Soon" pages, and ADR 0017's
  "workspace" in code (renamed View).
- **Unchanged:** no figure moves (`geh:figures`). The GEH video, deck and one-pager links keep
  landing on their screens.

---

## 0. Scope guard (Founder, 2026-11-25)

No existing functionality, data model, API contract, dashboard figure or working integration
may be removed, weakened or silently redesigned as part of NAV-B. Any change outside this
plan is written up and approved by the Founder before it is implemented. The plan's own
removals are the three Coming Soon pages (section 6) and the old menu, once the rail is live
(section 5); nothing else is removed.

## 1. Every screen's move

Each row is one 308 redirect (`permanent: true` in `next.config.ts`'s
`redirects()`, which runs before the proxy, so an old address is redirected on the
tenant too before sign-in is asked). Next passes the query string through to
the destination, so `?present=1` and `?disco=…` survive. `:path*` keeps the
rest of the address unchanged (ids, `/all`, `[period]`, `data.csv`).

The table is held once, as data (`src/constants/moves.ts`: old pattern, new
pattern, kind), and read by `next.config.ts` for the redirects, by a unit test
(every route that exists today has a row) and by the browser test that walks
every old address (section 8).

### Platform

| Old address | New address | Redirect | Rail item |
| --- | --- | --- | --- |
| `/` | `/` (public Home on the demonstration) | none: the page changes | public |
| `/dashboard` (Platform Overview) | `/dashboard` (Home: the initiatives as this workspace sees them) | none: the page changes | Home |
| (Platform Overview's all-sector map and sector summaries) | `/dashboard/intelligence` (Intelligence's index) | none (new address) | Intelligence |
| `/dashboard/reports` | `/dashboard/reports` | none | Reports (foot) |
| `/dashboard/settings/people` | `/dashboard/account/people` | 308 | Account (foot), tenant only |
| `/dashboard/settings` | removed (404) | none | (Coming Soon, section 6) |
| `/dashboard/intelligence/ai` | removed (404) | none | (Coming Soon) |
| `/dashboard/intelligence/analytics` | removed (404) | none | (Coming Soon) |
| `/dashboard/map`, `/dashboard/intelligence/gis` | `/dashboard/intelligence` | 308 (today 307 to `/dashboard`; the map now lives on Intelligence's index) | Intelligence |
| `/dashboard/refused` | same | none | none |
| `/login/...`, `/auth/...` | same | none | tenant only |

### Utility

| Old address | New address | Redirect |
| --- | --- | --- |
| `/dashboard/utility` (Overview) | `/dashboard/intelligence/utility` | 308 |
| `/dashboard/utility/map` | `/dashboard/intelligence/utility/map` | 308 |
| `/dashboard/utility/ai` (planned) | `/dashboard/intelligence/utility/ai` | 308 |
| `/dashboard/utility/executive` (and `/all`) | `/dashboard/intelligence/utility/executive` (and `/all`) | 308 (`:path*`) |
| `/dashboard/utility/operations/:path*` (regions, substations, feeders, transformers and `/all`, service points) | `/dashboard/intelligence/utility/operations/:path*` | 308 |
| `/dashboard/utility/reliability` | `/dashboard/intelligence/utility/reliability` | 308 |
| `/dashboard/utility/revenue` (and `/all`) | `/dashboard/intelligence/utility/revenue` (and `/all`) | 308 |
| `/dashboard/utility/assets` (and `/all`) | `/dashboard/intelligence/utility/assets` (and `/all`) | 308 |
| `/dashboard/utility/events` | `/dashboard/intelligence/utility/events` | 308 |
| `/dashboard/utility/reports` | `/dashboard/reports/utility` | 308 |
| `/dashboard/utility/reports/:path*` (`[report]`, `[period]`, `data.csv`, `data.xlsx`) | `/dashboard/reports/utility/:path*` | 308 |

The old long-list addresses with a query (`?feeders=all`, `?valuation=all`,
`?transformers=all`, `?rows=all`) are kept, re-pointed straight at the new
`/all` addresses, so they take one hop, not two.

### Mini-grid

| Old address | New address | Redirect |
| --- | --- | --- |
| `/dashboard/minigrid` (Overview) | `/dashboard/intelligence/minigrid` | 308 |
| `/dashboard/minigrid/map` | `/dashboard/intelligence/minigrid/map` | 308 |
| `/dashboard/minigrid/ai` (planned) | `/dashboard/intelligence/minigrid/ai` | 308 |
| `/dashboard/minigrid/sites` | `/dashboard/intelligence/minigrid/sites` | 308 |
| `/dashboard/minigrid/sites/[siteId]` | `/dashboard/intelligence/minigrid/sites/[siteId]` | 308 (`:path*`) |
| `/dashboard/minigrid/sites/reference/[siteId]` (MG-REAL; not in the 10 November table) | `/dashboard/intelligence/minigrid/sites/reference/[siteId]` | 308 (`:path*`) |
| `/dashboard/minigrid/reports/:path*` | `/dashboard/reports/minigrid/:path*` | 308 |

With it: `REFERENCE_SITE_PATH` (the data bar's published-data notice is keyed
on it) and `outputFileTracingIncludes` (the vendored CSVs must reach the
server on Vercel) move to the new addresses. A browser test opens the reference
page at its new address and finds the published-data bar.

### DER

| Old address | New address | Redirect |
| --- | --- | --- |
| `/dashboard/der` (planned) | `/dashboard/intelligence/der` | 308 |

### Planning (the GEH sprint's screens)

| Old address | New address | Redirect | Rail item |
| --- | --- | --- | --- |
| `/dashboard/planning` (Overview) | `/dashboard/plan` | 308 | Plan |
| `/dashboard/planning/metering/allocation` | `/dashboard/plan/metering-allocation` | 308 | Plan |
| `/dashboard/planning/metering/dt` | `/dashboard/plan/dt-sequencing` | 308 | Plan |
| `/dashboard/planning/metering` (Metering Fund) | `/dashboard/finance/metering-fund` | 308 | Finance |
| `/dashboard/planning/metering/marketplace` | `/dashboard/finance/marketplace` | 308 | Finance |
| `/dashboard/planning/metering/monitoring` | `/dashboard/oversight/monitoring` | 308 | Oversight |
| `/dashboard/planning/metering/journey` | `/dashboard/initiatives/meter-every-customer/journey` | 308 | Home (inside Meter every customer) |
| `/dashboard/planning/metering/report` | `/dashboard/reports/metering-plan` | 308 | Reports (foot) |
| `/dashboard/planning/about-this-build` | `/dashboard/about-this-build` | 308 | Help (foot) |
| `/dashboard/planning/dt` (planned) | `/dashboard/plan/dt` | 308 | Plan |
| `/dashboard/planning/feeders` (planned) | `/dashboard/plan/feeders` | 308 | Plan |
| `/dashboard/planning/network-expansion` (planned) | `/dashboard/plan/network-expansion` | 308 | Plan |
| `/dashboard/planning/unserved` (planned) | `/dashboard/plan/unserved` | 308 | Plan |
| `/dashboard/planning/underserved` (planned) | `/dashboard/plan/underserved` | 308 | Plan |
| `/dashboard/planning/pue` (planned) | `/dashboard/plan/pue` | 308 | Plan |
| `/dashboard/planning/e-mobility` (planned) | `/dashboard/plan/charging-hubs` | 308 | Plan |

The order of the rules matters (`/dashboard/planning/metering` exact before
`/dashboard/planning/metering/:path*`); the unit test of section 8 checks
that each old address lands on exactly its row.

### New addresses (no old one)

| Address | Rail item | What |
| --- | --- | --- |
| `/dashboard/intelligence` | Intelligence | Index: the domains this workspace has, and the all-sector map and summaries the Platform Overview showed |
| `/dashboard/finance`, `/dashboard/oversight` | Finance, Oversight | Index of the item's views for this workspace type (no figure), as `/dashboard/plan` lists Plan's |
| `/dashboard/initiatives/[id]` | Home | The initiative inside a workspace (NAV-A's shell page, now at its real address) |
| `/dashboard/initiatives/meter-every-customer/applications` | Home | Planned page (MTR-B builds it); no figure |
| `/dashboard/finance/pipeline`, `/dashboard/oversight/regulator`, `/dashboard/plan/rooftop-solar`, `/dashboard/plan/storage` | as named | Planned pages, no figure |

## 2. The public layer: `/preview` moves to `/`

On the **public demonstration**:

| Old address (NAV-A prototype) | New address | Redirect |
| --- | --- | --- |
| `/preview` | `/` (Home: the three initiative cards) | 308 |
| `/preview/initiatives/[id]` (was the role picker) | `/initiatives/[id]/take-part` | 308 |
| `/preview/initiatives/[id]/[role]` | `/initiatives/[id]/take-part/[role]` | 308 |
| `/preview/track` | `/track` | 308 |
| `/preview/workspace/demo-[type]` | `/dashboard?workspace=[type]` | 308 |
| `/preview/workspace/demo-[type]/[item]` | the item's new address (`/dashboard/intelligence/[domain]`, `/dashboard/plan`, `/dashboard/finance`, `/dashboard/oversight`) `?workspace=[type]` | 308, one row per type and item (small, listed in `moves.ts`) |
| `/preview/workspace/demo-[type]/initiatives/[id]` | `/dashboard/initiatives/[id]?workspace=[type]` | 308 |

The pages move from `src/app/preview` into a route group `src/app/(public)`,
so they keep `PublicFrame` (top bar with Sign in, no rail) and stay light:
no map library, no chart library and no dataset on Home or the role picker
(the NAV-A test for this is kept). `frontDoor.ts`'s `PREVIEW_HOME` goes;
its hrefs become `/`, `/initiatives/[id]`, `/initiatives/[id]/take-part`,
`/track`. `src/app/page.tsx` (today a redirect to `/dashboard`) becomes Home.

**The initiative page, `/initiatives/[id]`** (brief 3c.1). Drawn from the
initiative's catalogue entry only:
- what it is;
- who it is for;
- its status flow, held in the catalogue entry (Meter every customer, from the brief:
  Submitted, Under review, Verified, Assigned (DT and feeder), Approved, Funded, Installed;
  Rejected at any step, with a reason);
- who takes part (counts by organization type, labelled synthetic);
- its headline figures through the existing initiatives service, with status and source;
- one button, **Take part**, which opens `/initiatives/[id]/take-part` ("Who are you?").

A card on Home now opens this page, not the picker. Acceptance: a card opens its
initiative page, and Take part opens the role picker (browser test).

**`hostedBy`** (brief 3c.2). An optional field on each catalogue entry, `{ name, logo }`,
**empty for all three initiatives**.
- When set, the host's name and logo show on the card and the initiative page.
- Acceptance, by a unit test: no initiative in the catalogue has a host, so none is shown.
  The test fails if one is ever added without this plan's rule being revisited.
- A browser test confirms that no card or page shows a "Hosted by" line.
- The field belongs to the database brief; NAV-B only reads it.

**On the tenant deployment** nothing public is added: `/` still leads to
`/dashboard` (and so to sign-in), and `/initiatives`, `/track` are not found
there (ADR 0021 gate 2, kept; see question 4).

## 3. The signed-in rail and workspace header over `/dashboard`

One frame for every `/dashboard` page, replacing the sector row and side
menu (`dashboard/layout.tsx`, `navigation.ts`'s `sectors`). The data bar
stays where it is, once per page.

- **Workspace header**, top left: the organization's logo and name, GridIntel's logo as the
  fallback (no organization has a logo yet).
  - A switcher appears only when the person belongs to more than one organization. In 8A a
    person has one membership, so on the tenant it never shows.
  - The account menu holds the person's email, People (administrators), and Sign out
    (`/auth/signout`).
- **Rail**: Home, then the items of the workspace type (`RAILS` in `workspaces.ts`, as NAV-A
  drew them), with Reports, Help and the account at the foot.
  - Each rail item opens its index; its views are listed under it.
  - A view the viewer may not open is not shown (ADR 0018 rule kept: no link to a page that
    would be refused).
  - A planned view keeps its "Planned" mark and holds no figure.
- **Home** (`/dashboard`): the initiatives as this workspace sees them (NAV-A's workspace home,
  `initiativesFor(type)`), with figures scoped to the organization (3c.3). It carries a clear
  link, "Platform overview (now under Intelligence)", to the former Platform Overview at
  `/dashboard/intelligence`, so a visitor from a GEH link finds it in one click (Founder,
  2026-11-25). A browser test opens `/dashboard` and follows that link.

**On the tenant** the frame is drawn on the server from the session: the
organization's record (name), its workspace type, and the member's grant.

- **Workspace type.** Until the database brief adds a column, it is taken from the
  organization's sectors (`utility` gives Utility, `minigrid` gives Mini-grid), by a pure
  function with a test. It is labelled as derived in code (question 3).
- **The tenant DisCo's Plan and Finance.** Opening them needs the Utility type's default sectors
  (ADR 0021 decision 8: a Utility workspace includes the metering screens). Today `demo-disco`
  holds only `utility`, so `grantFor` drops every planning key. This touches access, so it is
  question 2.

**On the public demonstration** the pages stay built ahead of time, and the
frame is drawn on the client from the catalogue. It holds no figure, so a
static page is the same for every visitor.

- **The demo workspace.** The demo shows one of the five demo workspaces, each a synthetic
  organization, badged **DEMO** in the header on every page, with the switcher listing all
  five (ADR 0021 decision 6).
  - Which one is kept in a cookie, set by the switcher and by the role picker's organization
    roles. A link may name it with `?workspace=[type]`, which the client reads once and then
    removes from the address.
  - Both are validated against the catalogue's five demo workspaces; any other value falls
    back to the default (Demonstration DisCo). The tenant ignores both entirely (safeguard C).
- **An address outside the chosen workspace's rail.** For example, a financier demo opening a
  Utility revenue link: the frame switches to a demo workspace whose rail has that view
  (`demoTypeFor(view, preferred)`, pure and tested). A link from the deck therefore always shows
  its screen with a rail it belongs to.
- **Grant.** The demo's viewer still holds everything; Sign in leads to the tenant's sign-in
  page (configuration, as now).

## 4. Permission keys are stable View IDs (Founder's change, 2026-11-25)

**The key is the view's id, never its address.** A URL change never changes a view's identity
or its permission. The ids are NAV-A's (`utility.executive`, `plan.metering-allocation`,
`finance.metering-fund`); a screen NAV-A's catalogue did not list takes its old key as its id
where it had one (`utility.overview`, `utility.reports.reliability`, `platform.reports`), and a
new id only where it is new.

**One catalogue** (`src/constants/views.ts`, grown from NAV-A's `VIEWS`) is the single
authoritative source for:
- navigation (the rail, the old menu while it lasts, and every link to a screen);
- the permission of each view;
- workspace visibility (which types' rails list it);
- route resolution: `hrefOf(id, …rest)` from id to address, and `viewAt(pathname)` back;
- the automated access tests.

Each entry holds:
- its id;
- its label and question;
- its domain (`platform`, `utility`, `minigrid`, `der`, `planning`);
- its address;
- whether it is exact (a landing page) or opens the addresses below it;
- its permission: `protected` with its id as the key, or `open` (only `platform.refused`,
  the refusal page);
- planned or not.

No other module keeps a list of screens or writes a `/dashboard` address:
- `navigation.ts`'s `sectors`, `PLANNERS`' and `METERING_SCREENS`' hrefs and `REPORTS`' hrefs
  are derived from it.
- Components and services ask `hrefOf`.
- A unit test fails if any module under `src/` other than the catalogue and `moves.ts` holds a
  `/dashboard` address literal or exports its own list of screens.

### The View IDs

| View ID | Today's address | Domain | Note |
| --- | --- | --- | --- |
| `platform.home` | (new) `/dashboard` | platform | Home; new view |
| `platform.overview` | `/dashboard` | platform | The Platform Overview; moves to `/dashboard/intelligence` with its content |
| `platform.reports` | `/dashboard/reports` | platform | Opens to anyone who may open one report (rule kept) |
| `platform.people` | `/dashboard/settings/people` | platform | Administrators only |
| `platform.about-this-build` | `/dashboard/planning/about-this-build` | platform | Opens to every signed-in viewer (answer 5) |
| `platform.refused` | `/dashboard/refused` | platform | **open**: the refusal page |
| `utility.overview`, `.map`, `.ai`, `.executive`, `.operations`, `.reliability`, `.revenue`, `.assets`, `.events` | `/dashboard/utility/...` | utility | Unchanged ids |
| `utility.reports`, `utility.reports.reliability`, `.operations`, `.daily-brief` | `/dashboard/utility/reports/...` | utility | Unchanged ids |
| `minigrid.overview`, `.map`, `.ai`, `.sites` (a site and a reference site below it), `minigrid.reports`, `.reports.site-performance`, `.reports.compliance` | `/dashboard/minigrid/...` | minigrid | Unchanged ids |
| `der.overview` | `/dashboard/der` | der | Unchanged id |
| `plan.overview` | `/dashboard/planning` | planning | Was `planning.overview` |
| `plan.metering-allocation`, `plan.dt-sequencing` | `.../metering/allocation`, `.../metering/dt` | planning | NAV-A ids |
| `finance.metering-fund`, `finance.marketplace` | `.../metering`, `.../metering/marketplace` | planning | NAV-A ids |
| `oversight.monitoring` | `.../metering/monitoring` | planning | NAV-A id |
| `initiative.journey` | `.../metering/journey` | planning | NAV-A id |
| `plan.metering-report` | `.../metering/report` | planning | New id (the Metering Plan report) |
| `plan.dt`, `plan.feeders`, `plan.network-expansion`, `plan.unserved`, `plan.underserved`, `plan.pue`, `plan.charging-hubs` | `/dashboard/planning/[planner]` (planned) | planning | NAV-A ids (`plan.charging-hubs` was `planning.e-mobility`) |
| `plan.rooftop-solar`, `plan.storage`, `finance.pipeline`, `oversight.regulator`, `initiative.applications` | (new, planned) | der, planning, planning, planning, utility | NAV-A ids; no figure |
| `finance.overview`, `oversight.overview`, `initiative.home` | (new) `/dashboard/finance`, `/dashboard/oversight`, `/dashboard/initiatives/[id]` | planning, planning, platform | New: the rail items' indexes and an initiative inside a workspace |

A held key opens its view and the views whose id lies below it (`utility` opens every
`utility.*`; `utility.reports` every report of the sector), as today. **Unknown keys open
nothing; an address no view resolves to is refused** (safeguard A).

### Old keys to View IDs

The translation is applied where a grant is built (`grantFor`, and the People screen's reading
of a membership). No stored row has to change: today the one real membership holds `null`.
Old keys that are already View IDs translate to themselves.

| Old key | View IDs |
| --- | --- |
| `platform` | every `platform.*` view the old key opened (fixed by the fixture, step 0), and `platform.home` |
| `platform.overview` | `platform.overview`, `platform.home` |
| `platform.reports`, `platform.people` | themselves |
| `utility`, `utility.*`, `minigrid`, `minigrid.*`, `der`, `der.overview` | themselves |
| `planning` | every planning-domain view, listed |
| `planning.overview` | `plan.overview` |
| `planning.metering` | `plan.metering-allocation`, `plan.dt-sequencing`, `finance.metering-fund`, `finance.marketplace`, `oversight.monitoring`, `initiative.journey`, `plan.metering-report` |
| `planning.dt`, `.feeders`, `.network-expansion`, `.unserved`, `.underserved`, `.pue` | `plan.dt`, `plan.feeders`, … |
| `planning.e-mobility` | `plan.charging-hubs` |
| any other key | nothing (deny) |

`grantFor` cuts a grant to the organization's domains by each view's **domain** field, not by
the key's first word. `holdsSector` and the data gate (`admitsRead`) use the same field.
Utility's default domains are `utility` and `planning` (answer 2). An organization's own
sectors are added to them.

### The frozen-fixture test (kept, as approved)

Made in step 0, before anything moves, with the access functions as they are today:
- for every old key, alone and in the grants of the five viewer types (section 4a);
- for a sample of every old address (each row of section 1, with real ids);
- whether the address opens.

After step 1, and again after every move, the test asks the same question with the translated
grant at the address the old one redirects to, and the answers must be the same, row by row.
The one named exception is `platform.about-this-build`, opened to every signed-in viewer
(answer 5).

## 4a. Safeguard A: permission integrity (Founder, 2026-11-25)

Each line is a test:

1. **Every View ID is unique** (unit).
2. **Every view has an explicit permission:** `protected` or `open`. A view without one fails
   (unit). `open` is allowed only for `platform.refused`.
3. **Default deny** (unit):
   - an unknown or unmapped key opens nothing;
   - an address that resolves to no view is refused;
   - a view not in the catalogue cannot be opened.
4. **No widening by a move** (unit). For each role, the test compares the set of views open to
   it before the move (the step 0 fixture) and after, and fails on any view newly opened. The
   only exception is `platform.about-this-build`, which is named. The roles: the demo's public
   viewer, an administrator, a member with all screens, the revenue member (partial grant), and
   a member with no grants.
5. **By direct URL request, not by the navigation** (browser, on the builds):
   - **Unauthenticated visitor** (tenant): every address, old and new, leads to `/login`; none
     answers a page.
   - **Signed in, no grants** (tenant; a new fixture account, `none@disco.test`, `screens: []`):
     every protected view is refused; only the refusal page answers.
   - **Partial grant** (tenant; `revenue@disco.test`): exactly its views open; every other
     address is refused.
   - **Organization administrator** (tenant; `admin@disco.test`): every view of its domains, and
     People; another organization's domain refused.
   - **Public viewer** (demo build): every view opens; there is no People, sign-in or
     account address.

   For each viewer, the expected answer of each address comes from the catalogue and the
   grant (`canOpen`), and the page's actual answer must match it.

## 4b. Safeguard B: redirect integrity (Founder, 2026-11-25)

`e2e/old-addresses.spec.ts` runs on all three builds: the demo build (`npm run build`,
`.next`), the on-request build (`GRIDINTEL_RENDER=request`, `.next-request`) and the tenant
build (`npm run build:tenant`, `.next-tenant`). It checks:

- every legacy address answers **308** to its correct destination, with real ids;
- **no loops and no chains**: each old address reaches its final address in one hop, and a
  unit test checks that no destination in `moves.ts` is itself a redirect source;
- **query parameters are preserved** (`?present=1`, `?disco=`, any other); the plan names none
  to drop;
- **access still applies after the redirect** (tenant): an old address redirects, then the new
  address asks for sign-in, or refuses a view the grant does not hold, exactly as a direct
  visit would. This runs for the five viewer types of 4a.

## 4c. Safeguard C: workspace isolation (Founder, 2026-11-25)

- **On the tenant** the workspace is the signed-in person's organization only. `?workspace=`
  and the workspace cookie are ignored entirely there.
  - The client frame is not drawn on the tenant.
  - Tested: the same requests with and without them give byte-identical frames and the same
    answers; they open nothing.
- **On the demo**, `?workspace=` and the cookie can only select one of the five synthetic demo
  workspaces in the catalogue. Any other value falls back to the default, validated by a pure
  function with a unit test (unknown values, an organization id, `demo-disco` spelt otherwise,
  an empty string).
- **No demo grant, demo workspace or demo cookie has any effect on the tenant.** The tenant's
  grant comes from the session only. The existing `unsafeConfiguration` checks stay unchanged.

## 5. ADR 0017's "workspace" renamed View in code

The rename is done once, when the navigation catalogue is rewritten:

| Today | After |
| --- | --- |
| `Sector.workspaces`, `UTILITY_WORKSPACES`, `MINIGRID_WORKSPACES`, `PLANNING_WORKSPACES` | derived from the View ID catalogue (`views.ts`) in step 1, and removed with `navigation.ts`'s `sectors` in step 8 |
| `ViewId` | unchanged: the id is the key and never follows the address (section 4) |
| Comments and test names saying "workspace" for a screen | "view" |
| The browser test "the menu marks the workspace the reader is in" | rewritten for the rail |

"Workspace" stays only where it means an organization's environment: UI text, `WorkspaceType`,
the demo workspaces. A unit test greps `src/` for `workspaces:` and `_WORKSPACES`, and fails if
either returns.

## 6. The three Coming Soon pages removed

`src/app/dashboard/settings/page.tsx`, `src/app/dashboard/intelligence/ai/page.tsx` and
`src/app/dashboard/intelligence/analytics/page.tsx` are deleted. These are the Phase 1
placeholders, with no link to them. The Founder answered on 10 November.

- Nothing redirects to or from them, so they answer 404.
- `/dashboard/intelligence/[domain]` answers 404 for any word that is not a domain, so `ai` and
  `analytics` do not come back through it.
- `/dashboard/settings/people` keeps working through its own redirect (section 1).

## 7. Figures, and the GEH links

- **Figures:** a real comparison at every step. The 101 figures (value, wording, origin) are
  listed before the step and after it, and compared line by line (`scripts/geh-compare.ts`,
  reading `docs/geh/KEY-FIGURES.md` before and after). Any difference other than the stamp line
  stops the work and is reported. Pages move with their page components; no service, method or view model changes.
  The checks that the screens' figures are the same (the existing e2e and unit tests) run at
  the new addresses.
- **GEH video, deck, one-pager and posts:** the addresses in the GEH material I can see are the
  21 in `docs/geh/BRIEF-15.md` and `e2e/record-demo.ts`. For example: `/dashboard`,
  `/dashboard/planning`, `/dashboard/planning/metering`, `.../marketplace`, `.../journey`,
  `.../report`, `/dashboard/planning/about-this-build`, the seven planned planners,
  `/dashboard/utility/executive`, `/map`, `/reliability`, `/revenue`, `/reports`,
  `/reports/reliability/2026-09`, and `/dashboard/minigrid/sites/MG-TAM`.
  - A browser test opens each one on its own, with and without `?present=1`. It follows the
    redirect and checks it lands on the expected screen, by its h1, with presentation mode on
    when asked.
  - `/dashboard` keeps its address but becomes Home, so a GEH link to it lands on the
    initiatives rather than the old Platform Overview (question 7).
  - The recorder (`e2e/record-demo.ts`) moves to the new addresses.

## 8. The browser test that walks every old address

`e2e/old-addresses.spec.ts`, run against all three builds by `verify` and in CI. It:

- walks every row of `moves.ts` with a real sample for each pattern (a region, substation,
  feeder, transformer and service point; a site and the reference site; each built report and
  a period; a CSV and an XLSX);
- asserts **308** with the expected `Location` (by `request`, not following), then follows it
  and asserts the page answers 200, or 404 for the three removed pages;
- repeats each with `?present=1` and checks the query is carried;
- walks every `/preview` address (demo build), including the `?workspace=` hand-over;
- on the tenant build, confirms an old address redirects before sign-in, then leads to
  `/login` with the new address as `next`.

A unit test beside `moves.ts` checks the table itself: no two rows claim the same old address;
every route under `src/app` as it stood at step 0 (a frozen list) has a row or is named as
unchanged or removed; and no new address is itself redirected (no chains).

## 9. Order of work

Each step is committed only after typecheck, lint and unit tests pass, and pushed. On this
laptop those are the local checks, as the Founder set. Each step then waits for CI's full
`npm run verify` (three builds, browser tests, tenant browser tests) before the next starts.
The 101-figure comparison runs at every step.

| Step | What | Checks |
| --- | --- | --- |
| 0 | Branch `phase-nav-b`. Freeze the route list and the access fixture (old access functions, every old key and the five roles, every old address sample); record the 101 figures | Unit tests; figures listed |
| 1 | **Keys and grants.** The View ID catalogue as the single source (`views.ts`), with domains, permissions and route resolution. `navigation.ts`, `planning.ts` and the reports derived from it; every `/dashboard` literal replaced by `hrefOf`. The old-to-new translation in `grantFor`; domains in `grantFor`, `holdsSector` and `admitsRead`; Utility's default domains. Safeguard A's unit tests and the fixture test; safeguard A's browser tests by direct URL on today's addresses (the fixture account `none@disco.test` added). **No route moves** | Typecheck, lint, unit; figures compared; CI |
| **Checkpoint 1** | Stop. Report the old-to-new key table, safeguard A's results for all five viewer types, and the open-view comparison per role, before and after. **Wait for approval** | |
| 2 | Intelligence: Utility, Mini-grid (with the reference page) and DER moved (`git mv`, the catalogue's addresses); their redirects; file tracing, `REFERENCE_SITE_PATH`, e2e `ROUTES` | As step 1, and the redirect tests of 4b for what has moved |
| 3 | Plan, Finance, Oversight, the journey, the Metering Plan report, About this build; their redirects; the recorder | As step 2 |
| 4 | Reports by domain; People to `/dashboard/account/people`; tenant tests | As step 2 |
| 5 | The three Coming Soon pages removed | As step 2 |
| 6 | The signed-in frame (rail, header, account menu); Home with the link to the Platform overview; the rail indexes; the demo's client frame with safeguard C | As step 2, and 4c's tests |
| 7 | The public layer at `/`; `/initiatives/[id]` with Take part and `hostedBy`; `/preview` redirects | As step 2 |
| 8 | The old menu's code removed; the View rename grep-checked | As step 2 |
| 9 | `old-addresses.spec.ts` complete on all three builds; the GEH walk; ADR 0021 amendment; ROADMAP, BLUEPRINT, DESIGN; screenshots | Full CI verify green |
| **Checkpoint 2** | Stop before merge with: the Vercel preview address (and the pilot's, if it builds one); screenshots; every row of the old-addresses test on all three builds; the access-test and workspace-isolation results; the GEH links checked; the 101-figure comparison. **No merge until the Founder has personally reviewed the preview and said so** | |

Each step leaves the application whole: a screen's links point at its new
address in the same commit that moves it, and the old address redirects from
that commit on.

## 10. Reviewing the new front door before it replaces today's home page

Production (`main`) is not touched until the Founder approves the checkpoint, so
https://gridintel-iota.vercel.app keeps today's home page throughout.

1. **A private preview of the demonstration.** Every push to `phase-nav-b` already makes a
   Vercel Preview deployment of the demo project. The project makes one for each branch
   commit today.
   - It is reachable at a fixed branch address (Vercel's
     `gridintel-git-phase-nav-b-…vercel.app` alias). I give the exact address on the first push.
   - It is behind **Vercel Authentication**: only someone signed in to your Vercel account opens
     it. I checked this today: a preview answers with Vercel's sign-in redirect.
   - You can open the new `/`, an initiative, Take part, the demo workspaces and the old
     addresses' redirects there, on a phone as well.
2. **A private preview of the tenant.** If the `gridintel-pilot` project also makes Preview
   deployments for the branch, its Preview has the four variables you ticked for Preview, so you
   can sign in there with your own account. You would then see the signed-in rail and header
   with your real `demo-disco` membership. I confirm on the first push whether it does. If it
   does not, the tenant's frame is reviewed through the tenant browser tests' screenshots.
3. **At checkpoint 2** I send you:
   - both preview addresses;
   - the screenshots (also attached to the `phase-nav-b` release);
   - a short walk-through: Home, a card, its initiative page, Take part, each role, each demo
     workspace's rail, three GEH links, one old address with `?present=1`.

   No merge until you have personally reviewed the preview and said so; production switches
   then.
4. **Showing someone else** before the merge needs a Vercel "share" link to the protected preview.
   That is your call; I would not make the preview public.
5. **Undo.** If anything is wrong after the merge, Vercel's Instant Rollback returns production to
   the previous deployment in one step while it is fixed. The redirects make no change that
   needs undoing elsewhere.

## 11. The Founder's answers (2026-11-25)

1. **Demo workspace** by cookie and `?workspace=`, on the demo only, within safeguard C. Yes.
2. **Utility's default domains** are `utility` and `planning`, set in code now. Yes.
3. **Tenant workspace type** from the organization's sectors until the database brief. Yes.
4. **No public layer on the tenant.** Yes.
5. **About this build** open to every signed-in viewer. Yes.
6. **No further list of GEH links.** Every old address has a 308 and the test walks them all,
   plus the 21 GEH addresses.
7. **`/dashboard` becomes Home.** Acceptable, provided Home shows a clear link to the former
   Platform overview (now under Intelligence), so a GEH visitor finds it in one click
   (section 3).
8. **Recorded as an amendment to ADR 0021**, including the View ID rule, the scope guard and
   the three safeguards.

## Not in NAV-B

- MTR-A (applications), MTR-B (the queue), EMOB-B and the MG-PLAN-A screens: they come after,
  in this structure.
- Action permissions (ADR 0021 decision 8): deferred to the database brief.
- Rewriting stored keys in Supabase and removing the old-key map.
