# ADR 0018: What a viewer may open decides the menu and the routes

Date: 2026-10-14
Status: Accepted. Decisions 1 to 6 are the Founder's (2026-10-14). It
extends ADR 0017 (every sector has the same structure) and the viewer of
ADR 0014. No login is built by this ADR; logging in is Phase 8.

## Context

ADR 0017 gave every sector the same structure, and the frame now shows the
sectors across the top and, down the side, the screens of the sector the
reader is in. A real organization will not give every person every screen:
a revenue department works in Revenue, an operations room in Events and
Operations. If the menu is drawn from one fixed list and access is added
later screen by screen, the menu and the routes will disagree, and a viewer
will be shown links they are refused at, or reach screens they were never
shown.

ADR 0014 already puts a viewer on every spatial call, with what that viewer
may see (a territory). Which screens a viewer may open is a second,
separate question, and it belongs on the same viewer.

## Decisions (Founder, 2026-10-14)

1. **Every sector and every screen has a permission key.** A sector's key
   is its id (`utility`); a screen's is the sector's and the screen's
   (`utility.revenue`). The keys are in the screen catalogue,
   `src/constants/navigation.ts`.
2. **The row of sectors, the side menu and the routes show only what the
   viewer may open**, all from the viewer context. A viewer's grant is
   `ViewerContext.screens`: everything, or a list of keys.
3. **The public demonstration viewer may open everything.**
4. **A department is a set of screen permissions.** Examples, recorded and
   not built (the first is the Founder's; the others are the engineer's, to
   illustrate):

   | Department | Keys |
   | --- | --- |
   | Revenue department | `utility.overview`, `utility.map`, `utility.revenue` |
   | Operations room | `utility.overview`, `utility.map`, `utility.events`, `utility.operations` |
   | Network planning | `utility.overview`, `utility.map`, `utility.assets`, `utility.reliability` |
   | Mini-grid operator's staff | `minigrid` |
   | Executive | `platform`, `utility`, `minigrid` |

   No user management is built: who holds which grant is kept with logging
   in (Phase 8).
5. **The addresses stay `/dashboard/...`.** Serving a sector from its own
   subdomain (for example `utility.gridintel...`) is recorded in the roadmap
   as a later hosting option, not decided.
6. **A test holds it**: a viewer allowed only Utility > Revenue sees only
   that item and is refused every other route.

## How it is built (engineering)

- **One grant, one set of functions.** `src/constants/access.ts`:
  `navigationFor(grant)` cuts the catalogue to what the grant opens (a
  sector with nothing open is left out; a sector whose Overview is not open
  is entered at its first screen that is); `keyFor(path)` names the key an
  address needs; `canOpen(grant, path)` answers it. A sector's key opens
  every screen of the sector; a screen's key opens it and the screens below
  it (a feeder in Operations, a site in Sites). An address under a sector
  that is no screen needs the sector's key; any other dashboard address
  needs `platform`. Nothing is open by default: a list with no key opens
  nothing.
- **The menu.** The dashboard layout passes `navigationFor` of the viewer's
  grant to the frame. The row of sectors, the sidebar, the phone's menu and
  the product name's link (to the viewer's first screen) are drawn from it
  and from nothing else.
- **The routes.** `src/proxy.ts` (Next 16's proxy, before every
  `/dashboard` request) asks `canOpen`. An address the grant does not open
  is answered with the refusal page, `/dashboard/refused`, and status 403,
  at the same address. The refusal page says only that the screen is not
  open to the viewer.
- **The viewer** is in `src/composition/viewer.ts`, which imports nothing
  but a type, so the proxy can ask who is looking without loading the
  dataset. `runtime.ts` re-exports `getViewer`.

## Consequences

- Today nothing changes for a visitor: the demonstration viewer holds
  everything, and the browser tests check that every route answers 200.
  The narrower grants are tested where they are decided
  (`src/constants/access.test.ts`), including the proxy's 403.
- **Owed with logging in (Phase 8).** The viewer is read from the request,
  so screens are rendered on request (ADR 0012, 0014). Next's guidance is
  that a proxy is a first check, not the only one: each screen and each API
  route (`/api/areas`) will also check the grant where its data is read.
  Links inside pages (the "Go to" cards, a finding's link, the Platform
  Overview's sector sections) are not yet cut to the grant: a viewer would
  be refused at them, not shown them. The Platform Overview read model will
  take the viewer and leave out the sectors it may not open. The Founder
  made the three (screen checks, API checks, in-page links) part of Phase
  8's acceptance (2026-10-14).
- Permission keys are a second axis beside the territory of ADR 0014: a
  viewer may open Revenue for one territory only. The two never stand in
  for each other.
