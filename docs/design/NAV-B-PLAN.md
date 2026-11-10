# Phase NAV-B plan (outline): the screens move into the new structure

Date: 2026-11-10. Status: **an outline, carried forward from the NAV-A
checkpoint. Not approved; not started.** NAV-B starts after the Founder
approves it and after Phase 8A merges (so the two do not collide on
access). Decision record: ADR 0021 (accepted 2026-11-10). Addresses:
`docs/design/NAV-A-ADDRESSES.md` (approved 2026-11-10).

## Carried forward from the NAV-A checkpoint (Founder, 2026-11-10)

| Item | What NAV-B does |
| --- | --- |
| The initiative's own page (brief 3c.1) | `/initiatives/[id]`: what the initiative is, who it is for, its status flow (Meter every customer: Submitted to Installed), who takes part (counts by organization type, synthetic until real organizations join), its headline figures with status and source, and one button, **Take part**, which opens `/initiatives/[id]/take-part` ("Who are you?"); a role at `/initiatives/[id]/take-part/[role]`. Drawn from the catalogue entry only. Built in NAV-B or with MTR-A, whichever comes first. Acceptance: a card opens its initiative page, and "Take part" opens the role picker |
| "Hosted by" (brief 3c.2) | `hostedBy` on the initiative catalogue: an optional host organization, empty for every initiative. When set, the host's name and logo show on the card and the initiative page. Never set without the host's written agreement; no real agency, regulator or funder shown as host, sponsor or partner until then. The field itself belongs to the database brief; NAV-B only reads it from the catalogue. Acceptance: no initiative shows a host it has not been given in writing |
| The domain in Intelligence's addresses | `/dashboard/intelligence/[domain]/...`, as the address table says |
| The three Phase 1 "Coming Soon" pages | Removed: `/dashboard/settings`, `/dashboard/intelligence/ai`, `/dashboard/intelligence/analytics` |
| One meter's journey; the Metering Plan report | Moved to `/dashboard/initiatives/meter-every-customer/journey` and `/dashboard/reports/metering-plan` |

## The rest of NAV-B (from the briefs)

- The signed-in rail and workspace header take over `/dashboard`; the
  screens move to the addresses of the table; every old address redirects
  with 308, presentation mode carried, and a browser test walks every old
  address.
- Permission keys move with the screens; each old key maps to its new one
  and `access.test.ts` covers both until the old keys go.
- The public layer moves from `/preview` to `/`; `/preview` redirects.
- "Workspace" in code for a screen (ADR 0017) is renamed "View".
- Figures on every moved screen unchanged (`npm run geh:figures`).
- The old menu is removed only when the new one is live.

The full plan (files, routes, tests, order of work) is written and put to
the Founder before NAV-B starts.
