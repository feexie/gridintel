# ADR 0021: A public front door, initiatives as configuration, and branded organization workspaces

Date: 2026-11-08
Status: **Accepted** (Founder, 2026-11-10, at the NAV-A checkpoint, with
the fixes recorded below). The scope is the Founder's (briefs of 5 and 8
November 2026, and section 3c of the front-door brief, 10 November). The
plan was approved and the gates answered on 8 November; the checkpoint
answers and section 3c are recorded at the end of this record.
**Amended** by NAV-B (Founder, 25 and 26 November 2026): see "Amendment:
NAV-B" at the end.

## Context

GridIntel opens on `/dashboard`, a menu of sectors (Platform, Utility,
Mini-grid, DER, Planning), each with its screens (ADR 0017, 0018). It now
serves very different people: a household that wants a meter, a rider
looking for a charging hub, a DisCo, a mini-grid or DER company, a
financier and a regulator. Most of them should not have to understand
sectors to find the one thing they came for, and a household should not
need an account at all.

Phase 8A (ADR 0020) gave GridIntel login and organizations that never see
each other's records, in two deployments: the public demonstration (no
login) and a tenant deployment (every page behind login). It did not give
GridIntel a public face for people who are not members of an organization.

## Decisions

### 1. Two layers: public and signed in

| Layer | Who | What it may do |
| --- | --- | --- |
| Public | Anyone, no login | Browse initiatives; pick a role; submit a meter application; track one application by reference and phone; see the public charging network; see public summary figures |
| Signed in | A member of an organization | Read customer data, verify, assign, approve, fund, export; read reports |

- Anything that reads customer data, approves, assigns, funds or exports
  needs login and lives inside an organization's workspace.
- **Reports are login-only.** No report, and no link to one, appears on a
  public page.
- Public pages are mobile-first and light: no map library, no chart
  library and no dataset loaded on Home or the role picker.

### 2. Initiatives are configuration, not screens

An initiative is a named piece of work shown as a card on Home ("Meter
every customer", "Charging hubs", "Mini-grid verification"). Card titles
carry no city. Each initiative is one entry in a catalogue
(`src/constants/initiatives.ts`): its id, title, summary, the **id** of its
headline metric (and optionally of a progress metric), and its roles, each
with the view that role is sent to. A new initiative is a new entry; it
needs no new screen.

The catalogue holds **no figure**. A headline metric id is resolved by a
service (`src/services/initiatives`) to a `MetricView` with its status,
origin and sourcing, like every other figure (engineering rules 2 and 4).
Where no service can support the figure yet, the card shows its status
("not yet available", "synthetic", "reported") instead of a number.

### 3. The role picker

Opening a card asks "Who are you?" and lists the roles that initiative
defines.

- A **public role** (customer, end user, the public) goes straight to a
  public view.
- An **organization role** (utility, DER, mini-grid, financier, regulator)
  goes to sign-in, and after it lands in that person's workspace, on that
  initiative's screen for their workspace type.
- Routing is a pure function of the catalogue: `(initiative, role) →
  public view | sign-in with a landing place`. It is tested on its own.

### 4. Workspaces are organizations, branded

In the briefs, "workspace" means the signed-in organization's branded
environment. **In code it is the `Organization` (the tenant of ADR 0020).**
No new tenant concept is introduced.

- **Header**, top left: the organization's logo and name, from the
  organization's record, with a GridIntel fallback. A switcher appears
  when the person belongs to more than one organization; it lists only
  organizations they belong to (ADR 0020 unchanged).
- **Workspace type**: Utility, DER, Mini-grid, Financier, Regulator. The
  type decides which rail items and views appear. It is a property of the
  organization; the permission keys of the member (ADR 0018) still decide
  what that person may open within it.
- Branding (logo, name) is presentation only. It never decides access.

### 5. The slimmed rail (signed in only)

| Rail item | Question | Main for |
| --- | --- | --- |
| Home | What am I working on? The initiatives, as this workspace sees them | Everyone |
| Intelligence | What is happening on the network now? | Utility, Mini-grid, DER |
| Plan | What should we build next? Includes charging hub siting and load | Utility, DER, Mini-grid |
| Finance | Who pays, and how is it repaid? The funding pipeline | Financier (main area); Utility |
| Oversight | Is the programme delivering, across operators? | Regulator only |
| Reports, Help, account (bottom) | Profile, switch workspace, sign out | Everyone |

- **Applications** (Founder, 2026-11-08) live inside the "Meter every
  customer" initiative of a Utility workspace, reached from Home, and the
  initiative's card shows the count of applications pending (synthetic in
  NAV-A).
- **Removed** from the earlier NAV draft: Deliver (progress lives inside
  each initiative) and Customers (in the Utility workspace it is
  Applications). The front-door brief wins over the earlier navigation
  brief where they differ.
- **No left rail for anonymous visitors.** The public layer has a top bar
  with Sign in, and nothing else.
- Every screen lives at exactly one address and is reached from exactly
  one place in the rail; initiatives and other screens link to it.
- A rail item with nothing built for a workspace type shows a planned
  page with no figure, as today.

### 6. The demo workspace

- A demo workspace is **read-only**, holds **synthetic data only**, opens
  **without login**, and is badged **DEMO** in its header on every screen.
- **Only demo workspaces can be entered without signing in.** A real
  organization's workspace can never be.
- There is one demo workspace per workspace type, each a synthetic
  organization, so the switcher can be shown working. The existing
  synthetic DisCo and mini-grid operator are two of them; the other three
  are named so that no one could take them for real (Founder,
  2026-11-08): "Demonstration DER Developer (synthetic)", "Demonstration
  Financier (synthetic)" and "Demonstration Regulator (synthetic)".

### 7. Terminology

| Word | Meaning from this ADR on |
| --- | --- |
| Workspace (UI text) | An organization's branded environment, signed in or demo |
| Organization (code) | The tenant (ADR 0020); what the UI calls a workspace |
| **View** (was "workspace" in ADR 0017) | One screen within a rail item: Executive, Reliability, Sites |
| Initiative | A card on Home, configured, holding no figure of its own |
| Role | Who the visitor says they are, per initiative; public or organization |
| Workspace type | Utility, DER, Mini-grid, Financier, Regulator |

ADR 0017's "workspace" (a screen within a sector) is renamed **View**.
The rename in code (`Sector.workspaces`, `UTILITY_WORKSPACES` and the
like) is done in NAV-B, when the navigation catalogue is rewritten, so it
is made once. New code from NAV-A on uses "View" for a screen.

### 8. Permissions (catalogue, enforced server-side)

The keys of the front-door brief, recorded here as the target. Screen keys
(ADR 0018) remain; these add action keys beside them. Hiding a button is
never the check: each action is checked where it is carried out.

| Holder | Keys |
| --- | --- |
| Public | `initiatives.read_public`, `meter_application.create`, `meter_application.track`, `charging_network.read_public` |
| Utility | `meter_application.read_own_disco`, `.verify`, `.assign_network`, `.approve`; `plan.read`; `reports.read` |
| Financier | `finance.pipeline.read` (masked), `finance.commit`; `reports.read` |
| DER, Mini-grid | `plan.read`, `charging.load.read`; `reports.read` |
| Regulator | `oversight.read`; `reports.read` |

How these join the membership's grant (ADR 0020, `grantFor`) is
deferred to the database brief (Founder, 2026-11-08). NAV-A enforces
nothing new: it builds no action.

**One principle is fixed now (Founder, 2026-11-08): an organization's
workspace type sets its default sectors.** A Utility workspace includes
`planning.metering` besides `utility`, so a DisCo's people can open the
Metering screens; today an organization holds only the sectors listed on
its record, and `grantFor` drops every other key. The default sectors of
each type are set with the database brief.

### 9. Addresses

- **NAV-A**: the clickable shell lives under its own prefix, `/preview`,
  on the public demonstration only, and replaces nothing: `/` still leads
  to `/dashboard`, and the current menu is unchanged.
- **NAV-B** (fixed at the NAV-A checkpoint in
  `docs/design/NAV-A-ADDRESSES.md`): the public layer at `/` (Home),
  `/initiatives/[id]` (the initiative's own page, brief 3c.1),
  `/initiatives/[id]/take-part` (Who are you?) and
  `/initiatives/[id]/take-part/[role]`, and `/track`; the signed-in layer stays
  under `/dashboard`, by rail item (`/dashboard/intelligence/...`,
  `/dashboard/plan/...`, `/dashboard/finance/...`,
  `/dashboard/oversight/...`, `/dashboard/reports`). The organization is
  taken from the session, never from the address, so a copied link never
  opens another organization's records. Every old address redirects (308)
  to its new home, held by a browser test.

## Gates, answered (Founder, 2026-11-08)

1. **Two sites.** ADR 0020's separation stands. The public demonstration
   carries the front door and the demo workspaces; its Sign in button
   leads to the tenant deployment's sign-in page, whose address is set in
   configuration. The public demonstration still has no sign-in page of
   its own.
2. **Public pages on the tenant deployment.** Not in NAV-A: `/preview` is
   not found there, and the tenant's proxy is unchanged.
3. **Action permissions** are deferred to the database brief, with the
   principle of decision 8 recorded.
4. **Public form protection** (MTR-A): stubs first. Rate limiting in the
   application; the captcha and SMS as stubs. Any paid service stays a
   decision gate.
5. **Phase 8A** is not closed: the Founder has not yet signed in on the
   real Supabase project. NAV-A does not depend on it.

## The NAV-A checkpoint (Founder, 2026-11-10)

**Answers.**

1. The phase is tagged `phase-nav-a` with its screenshots on the release;
   it is merged to `main` only once CI's full `verify` passes (CI was
   stopped by a GitHub billing lock, which the Founder is clearing).
2. The domain stays in Intelligence's addresses
   (`/dashboard/intelligence/utility/...`): the public demonstration shows
   several demo workspaces to one visitor, and two domains' views share
   names.
3. NAV-B removes the three Phase 1 "Coming Soon" pages
   (`/dashboard/settings`, `/dashboard/intelligence/ai`,
   `/dashboard/intelligence/analytics`).
4. One meter's journey moves inside Meter every customer, and the
   Metering Plan report to Reports, as `docs/design/NAV-A-ADDRESSES.md`
   proposes.
5. This record is accepted once the fixes below are in.

**Section 3c of the front-door brief: additions after the NAV-A
checkpoint (Founder, 10 November 2026).** They keep the structure close to
the Odyssey pattern (programme page, then role, then the organization's own
space) without rebuilding what Odyssey does.

- **3c.1 Initiative detail page.** A card opens the initiative's own public
  page before "Who are you?". It shows what the initiative is, who it is
  for, the status flow (for Meter every customer: Submitted to Installed),
  who takes part (counts by organization type, synthetic until real
  organizations join), its headline figures with their status and source,
  and one button, "Take part", which opens the role picker. Built in NAV-B
  or with MTR-A, whichever comes first. Configuration only: the page is
  drawn from the initiative's catalogue entry. Addresses:
  `/initiatives/[id]`, with "Take part" at `/initiatives/[id]/take-part`.
  Not built in NAV-A.
- **3c.2 "Hosted by".** Each initiative has an optional host organization,
  empty for now. When set, the host's name and logo show on the card and
  the initiative page. A host is never set without that organization's
  written agreement; no real agency, regulator or funder is shown as host,
  sponsor or partner until then. The field goes into the database brief;
  NAV-B only reads it from the catalogue (`hostedBy`). Not built in NAV-A.
- **3c.3 Scope inside a workspace.** A figure shown inside an
  organization's workspace is that organization's figure, or is labelled
  clearly as national or sector-wide (for example "National (NERC)"). A
  Utility workspace's pending applications are its own DisCo's queue
  only. Built at the checkpoint, with a unit test; the public Home keeps
  the total across every DisCo.
- **3c.4 Regulator** is a role on Meter every customer ("I oversee the
  metering programme across the DisCos"), routed to sign in, with the demo
  regulator workspace. Built at the checkpoint. The Founder kept the
  screen's wording over the brief's earlier "I oversee the programme
  across DisCos" (14 November 2026).
- **3c.5 Not built here, by design:** programme finance, tenders,
  results-based disbursement and data rooms stay on Odyssey. GridIntel may
  later import that data (a separate brief, with a decision gate).

**Acceptance checks added with 3c** (section 6 of the brief):

- A card opens its initiative page, and "Take part" opens the role
  picker (NAV-B or MTR-A, with 3c.1).
- No initiative shows a host it has not been given in writing (no host
  is set in NAV-A).

**Fixes made at the checkpoint.** 3c.3 and 3c.4 above; a disabled map
placeholder under "Drop a pin on the map (optional)"; on a phone the theme
switch shows its icon only, so the public and workspace headers do not
wrap; an initiative's page inside a workspace names the initiative once,
and its card carries no link to itself.

## Consequences

- The public demonstration gains public pages. Nothing on them is
  presented as real: every figure carries its status, and synthetic
  figures say so.
- `Organization` gains a workspace type and branding in the database
  brief. Until then the demo workspaces' type and branding are a
  synthetic catalogue, labelled synthetic.
- ADR 0017 and ADR 0018 stand, with "workspace" read as "View" in them.
- ADR 0020 stands: organizations kept apart, the switcher lists only the
  person's organizations, branding decides nothing.

## Amendment: NAV-B (Founder, 25 and 26 November 2026)

NAV-B moved every screen into the structure of decisions 1, 5 and 9 (plan:
`docs/design/NAV-B-PLAN.md`). The Founder approved the plan on 25 November
with a scope guard, one change and three safeguards, and answered its open
questions on 25 and 26 November. This amendment records them; where it
differs from decisions 8 and 9 above, it replaces them.

### The scope guard

"No existing functionality, data model, API contract, dashboard figure or
working integration may be removed, weakened or silently redesigned as part
of NAV-B. Any change outside the approved plan must be written up and
approved by me before it is implemented." The 101 GEH figures were compared
line by line at every step (`npm run geh:compare`, baseline `8445269`): all
101 identical.

### The View ID rule (the Founder's change)

- **A permission key is a stable View ID, never an address.**
  `utility.revenue` stays `utility.revenue` wherever its screen lives.
- **One catalogue**, `src/constants/views.ts`, is the only source for
  navigation, permissions, workspace visibility, route resolution
  (`hrefOf`, `viewAt`) and the tests. A unit test fails when another module
  writes a `/dashboard` address of its own or builds one from a home.
- **Old keys** are translated on read (`translateKey`), and the access of
  the six roles before NAV-B is frozen in a fixture
  (`src/constants/__pinned__/access-before-nav-b.json`). The fixture test
  names every difference:
  - widened: About this build, and each type's default views;
  - narrowed: People, for anyone not an administrator;
  - removed: the three placeholder pages.
- "Workspace" means an organization's environment only. A screen is a
  View, in code as well: a grep test fails if the old names come back.

### Safeguard A: permission integrity

- Every View ID is unique.
- Every view has an explicit permission (`own` or `viewer`).
- An unknown key opens nothing.
- An address that is no view is not found.
- No role's open views widened by a move.

Tests:

- unit tests in `access.test.ts`, `access.pinned.test.ts` and `views.test.ts`;
- browser tests by direct address for five viewers (`e2e/access-matrix.spec.ts`,
  `e2e/tenant/access-matrix.spec.ts`): not signed in, signed in with no
  grant, a partial grant, an organization administrator, and the
  demonstration's public viewer.

**A workspace type's default access** is exactly the views in that type's
rail, read from the catalogue's workspace visibility (`workspaceViews`), not
a whole sector (Founder, checkpoint 1). A Utility therefore gets no
mini-grid planner and no Oversight.

### Safeguard B: redirect integrity

Every legacy address answers **308** with its new address, on all three
builds, with real ids. The table is `src/constants/moves.ts`: 35 moves, and
23 rows for the prototype's `/preview` addresses.

- There are no loops and no chains: a new address is never itself moved.
- The query is carried: parameters are compared as a set, since a redirect
  puts the carried query before a destination's own `?workspace=`.
- Access still applies after the redirect: a member gets at the new
  address exactly what a direct visit gives.

Tests:

- `e2e/old-addresses.spec.ts` (both demonstration builds);
- `e2e/tenant/old-addresses.spec.ts`;
- `e2e/geh-links.spec.ts`, which walks the 21 addresses in the GEH material,
  each with and without `?present=1`.

### Safeguard C: workspace isolation

- **On a tenant deployment** the workspace is the signed-in person's
  organization, from the session only. `?workspace=` and the demo cookie
  are ignored entirely, and the workspace type comes from the
  organization's sectors (answer 3).
- **On the public demonstration** they are validated to one of the five
  demo types, else the default. The switcher leads to Home with
  `?workspace=` of the workspace chosen, so the address always names what
  the screen shows.
- The `unsafeConfiguration` checks stay.

Tests: `e2e/workspace-isolation.spec.ts` and
`e2e/tenant/workspace-isolation.spec.ts`.

**The isolation fix (accepted by the Founder, 26 November 2026).** Step 6
found that a tenant's Home cards read the mini-grid portfolio through a
cache shared by every request. The fix:

- a tenant's Home figures are worked for each request alone and never kept
  for another (`workspaceFiguresFor`, `src/composition/initiatives.ts`);
- the mini-grid portfolio is read only for a mini-grid operator, whose own
  records it is.

Test: in `e2e/tenant/workspace-isolation.spec.ts`, "one organization's
figures never appear on another's Home, whoever signed in before". The
operator signs in first. The DisCo's Home and initiative page must then
name no other organization, read none of the operator's portfolio, and
count the applications queue of that DisCo only.

### The answers (25 and 26 November)

1. **The demo workspace** is chosen by cookie and `?workspace=`, within
   safeguard C.
2. **Default access** is the type's rail, as above.
3. **A tenant's workspace type** comes from the organization's sectors,
   until the database brief records it.
4. **There is no public layer on the tenant.** `/` leads to its
   dashboard, and the public addresses are not found there.
5. **About this build** is open to every signed-in viewer.
6. **No further list of GEH links.** Every old address and the 21 GEH
   addresses are walked.
7. **`/dashboard` is Home,** with a clear link to the former Platform
   Overview, now `/dashboard/intelligence`.
8. **This amendment.**
9. **The phone (26 November).** The signed-in frame may start the page
   within 200 px of the top, since this ADR requires the workspace header
   (the organization's mark and name). The public pages had no budget of
   their own in a test, so one was added at 170 px, the limit before NAV-B
   (`e2e/front-door.spec.ts`).
10. **The public pages carry no "Prototype" tag (26 November).** A form
    that cannot be sent still says it is not open yet, and every SYNTHETIC
    and DEMO label stays.
11. **Removed in step 8:** the old menu's code, and the PlatformCapabilities
    images nothing references.

### Addresses after NAV-B

Decision 9's NAV-B line is now built.

- **The public demonstration's public layer:** `/`,
  `/initiatives/[id]`, `/initiatives/[id]/take-part`,
  `/initiatives/[id]/take-part/[role]` and `/track`.
- **The signed-in layer:**
  - `/dashboard` (Home);
  - `/dashboard/intelligence/{utility,minigrid,der}/...`;
  - `/dashboard/plan/...`;
  - `/dashboard/finance/...`;
  - `/dashboard/oversight/...`;
  - `/dashboard/initiatives/...`;
  - `/dashboard/reports/{utility,minigrid}/...`;
  - `/dashboard/account/people`;
  - `/dashboard/about-this-build`.

