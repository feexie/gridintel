# ADR 0021: A public front door, initiatives as configuration, and branded organization workspaces

Date: 2026-11-08
Status: **Accepted** (Founder, 2026-11-10, at the NAV-A checkpoint, with
the fixes recorded below). The scope is the Founder's (briefs of 5 and 8
November 2026, and section 3c of the front-door brief, 10 November). The
plan was approved and the gates answered on 8 November; the checkpoint
answers and section 3c are recorded at the end of this record.

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

**Section 3c of the front-door brief (10 November 2026)**, as the Founder
gave it at the checkpoint:

- **3c.1 An initiative has a page of its own**, at `/initiatives/[id]`,
  with "Take part" leading to the role picker at
  `/initiatives/[id]/take-part`. Not built in NAV-A; planned for NAV-B.
- **3c.2 "Hosted by"**: an initiative may name who hosts it, as an
  optional field (`hostedBy`) of the initiative catalogue, empty until set.
  Not built in NAV-A; planned for NAV-B.
- **3c.3 Workspace scope.** Inside a workspace, a figure is the
  workspace's own where it can be: a DisCo's workspace counts its own
  queue of pending applications only, and a national figure says it is
  national ("National (NERC)"). The public Home keeps the total across
  every DisCo. Built at the checkpoint, with a unit test.
- **3c.4 Regulator on Meter every customer**: "Who are you?" lists the
  regulator, sent to sign in, with the regulator's demo workspace. Built
  at the checkpoint.

**Fixes made at the checkpoint.** 3c.3 and 3c.4 above; a disabled map
placeholder under "Drop a pin on the map (optional)"; on a phone the theme
switch shows its icon only, so the public and workspace headers do not
wrap; an initiative's page inside a workspace names the initiative once,
and its card carries no link to itself.

The two acceptance checks section 6 of the brief gained with 3c were not
in the copy of the brief read at the checkpoint (`private/` held the
earlier text); they are to be added here when read.

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
