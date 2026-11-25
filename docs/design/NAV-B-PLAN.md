# Phase NAV-B plan: the screens move into the new structure

Date: 2026-11-25. Status: **proposed, for the Founder's approval. Not started.**
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
  `initiativesFor(type)`), with figures scoped to the organization (3c.3), then a short line to
  Intelligence for the network figures.

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
  - The tenant ignores both. The address never names an organization; only the demo's
    presentation choice travels, and only on the demo (question 1).
- **An address outside the chosen workspace's rail.** For example, a financier demo opening a
  Utility revenue link: the frame switches to a demo workspace whose rail has that view
  (`demoTypeFor(view, preferred)`, pure and tested). A link from the deck therefore always shows
  its screen with a rail it belongs to.
- **Grant.** The demo's viewer still holds everything; Sign in leads to the tenant's sign-in
  page (configuration, as now).

## 4. Permission keys, old to new

**The new key is the screen's address below `/dashboard`**, with `/` read as `.`. A landing
page that answers only at its exact address takes `.overview`. For example
`intelligence.utility.revenue`, `plan.metering-allocation`, `reports.utility.reliability`,
`account.people`.
- A unit test checks that every view's key equals its address, so the two cannot drift.
- Each view in the catalogue also names its **domain** (`platform`, `utility`, `minigrid`,
  `der`, `planning`). `grantFor` cuts a grant to the organization's domains by that field, not
  by the key's first word, because a key now starts with a rail item. `holdsSector` and the
  data gate (`admitsRead`) use the same field.

| Old key | New key(s) |
| --- | --- |
| `platform` | `home`, `intelligence.overview`, `about-this-build` |
| `platform.overview` | `home`, `intelligence.overview` |
| `platform.reports` | `reports` (the list; still opens to anyone who may open one report) |
| `platform.people` | `account.people` |
| `utility` | `intelligence.utility`, `reports.utility` |
| `utility.overview` | `intelligence.utility.overview` |
| `utility.map`, `utility.ai` | `intelligence.utility.map`, `intelligence.utility.ai` |
| `utility.executive`, `.operations`, `.reliability`, `.revenue`, `.assets`, `.events` | `intelligence.utility.executive`, … (the same view name) |
| `utility.reports` | `reports.utility` |
| `utility.reports.[report]` | `reports.utility.[report]` |
| `minigrid` | `intelligence.minigrid`, `reports.minigrid` |
| `minigrid.overview`, `.map`, `.ai`, `.sites` | `intelligence.minigrid.overview`, `.map`, `.ai`, `.sites` (`.sites` opens a site and a reference site below it) |
| `minigrid.reports`, `minigrid.reports.[report]` | `reports.minigrid`, `reports.minigrid.[report]` |
| `der`, `der.overview` | `intelligence.der`, `intelligence.der.overview` |
| `planning` | `plan`, `finance`, `oversight`, `initiatives.meter-every-customer`, `reports.metering-plan`, `about-this-build` |
| `planning.overview` | `plan.overview` |
| `planning.metering` | `plan.metering-allocation`, `plan.dt-sequencing`, `finance.metering-fund`, `finance.marketplace`, `oversight.monitoring`, `initiatives.meter-every-customer.journey`, `reports.metering-plan` |
| `planning.dt`, `.feeders`, `.network-expansion`, `.unserved`, `.underserved`, `.pue` | `plan.dt`, `plan.feeders`, … (the same name) |
| `planning.e-mobility` | `plan.charging-hubs` |

**How old keys keep working.** A membership's stored `screens` may hold old
keys. Today none does: the one real membership holds `null`, which is every
screen. The translation is applied where a grant is built (`grantFor`, and
the People screen's reading of a membership), so no stored row has to change
in NAV-B. The People screen writes new keys from NAV-B on. The old keys and
the map are removed once the database brief has rewritten stored keys, as
their own step.

**`access.test.ts` covers both.**

1. **A pinned fixture, made in step 0 before anything moves:** for every old key, and for a
   sample of every old address (each row of section 1, with real ids), whether
   `canOpen(grant, address)` is true. After the move the test asks the same question with the
   translated grant at the redirected address, and the answers must be the same, row for row.
   So no one gains or loses a screen by the move. Where the scheme is meant to change an answer
   (`about-this-build`, question 5), the fixture says so in a named exception.
2. **The new keys on their own**, as today's tests do: a sector key opens everything below it;
   a report key opens its report and the list of reports; nothing is open by default; a key of
   a domain the organization does not hold is dropped, whatever the membership says; the
   people key only for administrators.
3. `navigationFor` / the rail: no view is listed that the grant would refuse, and every built
   view is reached from exactly one place in each workspace type's rail.

## 5. ADR 0017's "workspace" renamed View in code

The rename is done once, when the navigation catalogue is rewritten:

| Today | After |
| --- | --- |
| `Sector.workspaces`, `UTILITY_WORKSPACES`, `MINIGRID_WORKSPACES`, `PLANNING_WORKSPACES` | the rail catalogue's `views` (`VIEWS` in `workspaces.ts` becomes the one catalogue; `navigation.ts`'s `sectors` is removed) |
| `ViewId` `"utility.executive"` | `"intelligence.utility.executive"` (equal to its key) |
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

- **Figures:** `npm run geh:figures` before and after each step, which must report all 101
  unchanged. Pages move with their page components; no service, method or view model changes.
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

Each step is committed when its checks pass, and pushed. On this laptop the local checks are
typecheck, lint and unit tests, as the Founder set. CI runs the full `npm run verify` (three
builds, browser tests, tenant browser tests) on every push, and each step waits for green
before the next starts.

| Step | What | Checks |
| --- | --- | --- |
| 0 | Branch. Freeze the route list and the access fixture (section 4.1); record the `geh:figures` baseline | Unit tests (the fixture's own) |
| 1 | `moves.ts` and its unit test; the view catalogue with new keys, domains and addresses; the old-to-new key map; `access.ts` on the new keys with translation; `access.test.ts` on both. No route moves yet: the catalogue points at today's addresses through the map | Typecheck, lint, unit tests; CI |
| 2 | Intelligence: Utility, Mini-grid (the reference page too) and DER route folders moved (`git mv`); their redirects; `REFERENCE_SITE_PATH`, file tracing, e2e `ROUTES` | Typecheck, lint, unit; `geh:figures`; CI (all builds and browser tests) |
| 3 | Plan, Finance, Oversight, the journey, the Metering Plan report, About this build; their redirects; the recorder | As step 2 |
| 4 | Reports by domain (`/dashboard/reports/[domain]/...`); People to `/dashboard/account/people`; tenant browser tests updated | As step 2, with the tenant tests |
| 5 | The three Coming Soon pages removed | As step 2 |
| 6 | The signed-in frame: rail, workspace header and account menu over `/dashboard`; Home as the initiatives; the rail items' index pages; the demo's client frame, switcher, DEMO badge and `demoTypeFor`. The old sector menu stops being drawn | As step 2; screenshots of each workspace type |
| 7 | The public layer: `src/app/(public)`, Home at `/`, `/initiatives/[id]` with Take part and `hostedBy`, the take-part routes, `/track`; `/preview` redirects; the NAV-A light-page test kept | As step 2 |
| 8 | The old menu's code removed (`sectors`, `Sector`, `_WORKSPACES`); the View rename completed and grep-checked | As step 2 |
| 9 | `old-addresses.spec.ts` complete (section 8) and the GEH-link walk; ADR 0021 amendment; ROADMAP, BLUEPRINT, DESIGN; checkpoint screenshots into `docs/screenshots/phase-nav-b` for the release | Full CI verify green; then **stop at the checkpoint** |

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
3. **At the checkpoint** I send you:
   - both preview addresses;
   - the screenshots (also attached to the `phase-nav-b` release);
   - a short walk-through: Home, a card, its initiative page, Take part, each role, each demo
     workspace's rail, three GEH links, one old address with `?present=1`.

   Merge happens only on your approval, and production switches then.
4. **Showing someone else** before the merge needs a Vercel "share" link to the protected preview.
   That is your call; I would not make the preview public.
5. **Undo.** If anything is wrong after the merge, Vercel's Instant Rollback returns production to
   the previous deployment in one step while it is fixed. The redirects make no change that
   needs undoing elsewhere.

## 11. Decisions this plan asks for

1. **The demo's workspace choice:** a cookie, plus an optional `?workspace=[type]` on a link,
   both read on the demonstration only; the tenant ignores both and takes the organization from
   the session. *Recommended.* The alternative, a demo segment in the address, gives every
   screen two addresses.
2. **The Utility workspace's default sectors** (ADR 0021 decision 8's principle), set in code
   now: Utility gives `utility` and `planning`, so the tenant DisCo can open Plan and Finance.
   Without it, those items are not shown on the tenant until the database brief.
   *Recommended:* set them now, with a test, the data being synthetic. This is access
   semantics, so it is your call.
3. **The tenant's workspace type** taken from the organization's sectors until the database
   brief adds a column. *Recommended.*
4. **No public layer on the tenant** in NAV-B (`/` leads to sign-in), as ADR 0021 gate 2.
   *Recommended*; MTR-A decides where an application is submitted.
5. **About this build open to every viewer who is signed in** (it shows the sprint changelog, no
   records). Today only the Planning sector's key opens it. *Recommended*, recorded as the one
   named exception in the access fixture.
6. **The GEH link list:** the 21 addresses above are those in the repository. If the deck,
   one-pager or posts hold others (a query, a feeder or site id), send them and they join the
   walk.
7. **`/dashboard` becomes Home:** a GEH link to `/dashboard` lands on the initiatives, with the
   old overview's map one click away on Intelligence. Acceptable?
8. **Recording:** an amendment to ADR 0021 (the key scheme of section 4, the demo frame of
   section 3, decisions 1 to 5 as answered), rather than a new ADR. *Recommended.*

## Not in NAV-B

- MTR-A (applications), MTR-B (the queue), EMOB-B and the MG-PLAN-A screens: they come after,
  in this structure.
- Action permissions (ADR 0021 decision 8): deferred to the database brief.
- Rewriting stored keys in Supabase and removing the old-key map.
