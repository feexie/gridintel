# Phase NAV-B plan (outline): the screens move into the new structure

Date: 2026-11-10. Status: **an outline, carried forward from the NAV-A
checkpoint. Not approved; not started.** NAV-B starts after the Founder
approves it and after Phase 8A merges (so the two do not collide on
access). Decision record: ADR 0021 (accepted 2026-11-10). Addresses:
`docs/design/NAV-A-ADDRESSES.md` (approved 2026-11-10).

## Carried forward from the NAV-A checkpoint (Founder, 2026-11-10)

| Item | What NAV-B does |
| --- | --- |
| The initiative's own page (brief 3c.1) | `/initiatives/[id]`: what the initiative is, its headline figures (from the initiatives service, with status and source), who hosts it when set, and **Take part**, which leads to `/initiatives/[id]/take-part` ("Who are you?"); a role at `/initiatives/[id]/take-part/[role]`. The Home card links to the page, not straight to the picker |
| "Hosted by" (brief 3c.2) | `hostedBy` added to the initiative catalogue as an optional field, empty for every initiative until the Founder sets one; shown on the initiative's page only when set. Who may host, and how a host is named and verified, is the Founder's decision before any is set |
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
