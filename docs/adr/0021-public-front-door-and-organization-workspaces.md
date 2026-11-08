# ADR 0021: A public front door, initiatives as configuration, and branded organization workspaces

Date: 2026-11-08
Status: **Draft. Not accepted.** Proposed for Phase NAV-A. The scope
(public home, role picker, branded workspaces, the slimmed rail, what is
public and what needs login, the demo workspace) is the Founder's
(brief of 5 November 2026, refined in the front-door brief). The shapes and
names below are engineering proposals awaiting the Founder's approval. The
items marked **gate** need the Founder's answer before they are built.

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

## Decisions (proposed)

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
  synthetic DisCo and mini-grid operator are two of them.

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

How these join the membership's grant (ADR 0020, `grantFor`) is decided
with the database brief and NAV-B (**gate**: access semantics). NAV-A
enforces nothing new: it builds no action.

### 9. Addresses

- **NAV-A**: the clickable shell lives under its own prefix, `/preview`,
  on the public demonstration only, and replaces nothing: `/` still leads
  to `/dashboard`, and the current menu is unchanged.
- **NAV-B** (proposed, to be fixed in the address table at the NAV-A
  checkpoint): the public layer at `/` (Home), `/initiatives/[id]` (role
  picker) and its public views, and `/track`; the signed-in layer stays
  under `/dashboard`, by rail item (`/dashboard/intelligence/...`,
  `/dashboard/plan/...`, `/dashboard/finance/...`,
  `/dashboard/oversight/...`, `/dashboard/reports`). The organization is
  taken from the session, never from the address, so a copied link never
  opens another organization's records. Every old address redirects (308)
  to its new home, held by a browser test.

## Gates (the Founder's answers needed)

1. **One site or two.** Today the public demonstration has no sign-in
   pages (a test holds it) and the tenant deployment has nothing public.
   Proposed: the front door and the demo workspaces are served by the
   public demonstration; its Sign in button leads to the tenant
   deployment's sign-in page (an address set in configuration). The
   alternative, one deployment that is both public and signed in, changes
   ADR 0020's separation and is a security decision.
2. **Public pages on the tenant deployment.** If the tenant deployment
   also serves the front door, its proxy's list of public addresses grows
   (`isPublicPath`). That is an auth change.
3. **Action permissions** (decision 8) and how they join the membership.
4. **Public form protection** (MTR-A): rate limiting, a captcha and SMS
   are external services or new infrastructure.

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
