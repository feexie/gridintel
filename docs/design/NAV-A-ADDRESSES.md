# Phase NAV-A: every current address against its proposed new one

Date: 2026-11-10. Branch `phase-nav-a`. Status: **a proposal for the
Founder's approval at the NAV-A checkpoint.** Nothing has moved: every
address below answers today exactly as before. NAV-B moves the screens,
adds a 308 redirect from each old address, and a browser test walks every
old address (ADR 0021, decision 9).

## The scheme proposed

| Layer | Address | Notes |
| --- | --- | --- |
| Public | `/` Home (the initiatives), `/initiatives/[id]` (Who are you?), `/initiatives/[id]/[role]`, `/track` | Today under `/preview`. No login; no report; no rail |
| Signed in | `/dashboard` Home; `/dashboard/initiatives/[id]` | The organization is taken from the session, never from the address |
| | `/dashboard/intelligence/[domain]/...` | The domain (`utility`, `minigrid`, `der`) stays in the address, because the public demonstration shows more than one demo workspace to the same visitor and the views of two domains share names (GIS Map, AI Assistant, Overview) |
| | `/dashboard/plan/...`, `/dashboard/finance/...`, `/dashboard/oversight/...` | View names are unique across domains here, so no domain segment |
| | `/dashboard/reports/[domain]/...` | Reports stay login-only, at the foot of the rail |

Permission keys follow the addresses (ADR 0018): the new key is the rail
item and the view (`intelligence.utility.revenue`, `plan.metering-allocation`).
Each old key is mapped to its new one, and `access.test.ts` covers both until
the old keys are removed (NAV brief).

## Every current address

`→ same` means the address does not change.

### Platform

| Current address | Proposed address | Rail item | Note |
| --- | --- | --- | --- |
| `/` | `/` (public Home) | none (public) | Today it redirects to `/dashboard` |
| `/dashboard` (Platform Overview) | `/dashboard` (Home) | Home | Becomes the initiatives, then the role's key figures; the all-sector map moves to Intelligence |
| `/dashboard/reports` | `/dashboard/reports` → same | Reports (foot) | |
| `/dashboard/settings/people` | `/dashboard/account/people` | Account (foot) | Tenant only |
| `/dashboard/refused` | → same | none | The refusal page |
| `/dashboard/settings` | removed | none | A Phase 1 "Coming Soon" page with no link to it; removal is the Founder's call (deleting functionality is a gate, though this holds none) |
| `/dashboard/intelligence/ai` | removed | none | Phase 1 "Coming Soon", no link to it; collides with the new Intelligence addresses |
| `/dashboard/intelligence/analytics` | removed | none | As above |
| `/dashboard/map`, `/dashboard/intelligence/gis` | redirect to `/dashboard` (Home) | none | Already redirects (ADR 0017); kept |
| `/login/...`, `/auth/...` | → same | none | Tenant only |

### Utility

| Current address | Proposed address | Rail item |
| --- | --- | --- |
| `/dashboard/utility` (Overview) | `/dashboard/intelligence/utility` | Intelligence |
| `/dashboard/utility/map` | `/dashboard/intelligence/utility/map` | Intelligence |
| `/dashboard/utility/ai` (planned) | `/dashboard/intelligence/utility/ai` | Intelligence |
| `/dashboard/utility/executive` (and `/all`) | `/dashboard/intelligence/utility/executive` (and `/all`) | Intelligence |
| `/dashboard/utility/operations` and every level below (`regions/[id]`, `substations/[id]`, `feeders/[id]`, `transformers/[id]` and `/all`, `service-points/[id]`) | `/dashboard/intelligence/utility/operations/...`, the rest of the address unchanged | Intelligence |
| `/dashboard/utility/reliability` | `/dashboard/intelligence/utility/reliability` | Intelligence |
| `/dashboard/utility/revenue` (and `/all`) | `/dashboard/intelligence/utility/revenue` (and `/all`) | Intelligence |
| `/dashboard/utility/assets` (and `/all`) | `/dashboard/intelligence/utility/assets` (and `/all`) | Intelligence |
| `/dashboard/utility/events` | `/dashboard/intelligence/utility/events` | Intelligence |
| `/dashboard/utility/reports` | `/dashboard/reports/utility` | Reports (foot) |
| `/dashboard/utility/reports/[report]`, `/[period]`, `/data.csv`, `/data.xlsx` | `/dashboard/reports/utility/[report]/...`, the rest unchanged | Reports (foot) |

### Mini-grid

| Current address | Proposed address | Rail item |
| --- | --- | --- |
| `/dashboard/minigrid` (Overview) | `/dashboard/intelligence/minigrid` | Intelligence |
| `/dashboard/minigrid/map` | `/dashboard/intelligence/minigrid/map` | Intelligence |
| `/dashboard/minigrid/ai` (planned) | `/dashboard/intelligence/minigrid/ai` | Intelligence |
| `/dashboard/minigrid/sites` | `/dashboard/intelligence/minigrid/sites` | Intelligence |
| `/dashboard/minigrid/sites/[siteId]` | `/dashboard/intelligence/minigrid/sites/[siteId]` | Intelligence |
| `/dashboard/minigrid/reports` and below | `/dashboard/reports/minigrid/...` | Reports (foot) |

### DER

| Current address | Proposed address | Rail item |
| --- | --- | --- |
| `/dashboard/der` (planned) | `/dashboard/intelligence/der` | Intelligence |

### Planning (the GEH sprint's screens: every one keeps working through its redirect, including links in the video, deck, one-pager and posts)

| Current address | Proposed address | Rail item |
| --- | --- | --- |
| `/dashboard/planning` (Overview) | `/dashboard/plan` | Plan |
| `/dashboard/planning/metering/allocation` | `/dashboard/plan/metering-allocation` | Plan |
| `/dashboard/planning/metering/dt` | `/dashboard/plan/dt-sequencing` | Plan |
| `/dashboard/planning/metering` (Metering Fund) | `/dashboard/finance/metering-fund` | Finance |
| `/dashboard/planning/metering/marketplace` | `/dashboard/finance/marketplace` | Finance |
| `/dashboard/planning/metering/monitoring` | `/dashboard/oversight/monitoring` | Oversight |
| `/dashboard/planning/metering/journey` | `/dashboard/initiatives/meter-every-customer/journey` | Home (inside Meter every customer) |
| `/dashboard/planning/metering/report` | `/dashboard/reports/metering-plan` | Reports (foot) |
| `/dashboard/planning/about-this-build` | `/dashboard/about-this-build` | none (linked from Help) |
| `/dashboard/planning/dt` (planned) | `/dashboard/plan/dt` | Plan |
| `/dashboard/planning/feeders` (planned) | `/dashboard/plan/feeders` | Plan |
| `/dashboard/planning/network-expansion` (planned) | `/dashboard/plan/network-expansion` | Plan |
| `/dashboard/planning/unserved` (planned) | `/dashboard/plan/unserved` | Plan |
| `/dashboard/planning/underserved` (planned) | `/dashboard/plan/underserved` | Plan |
| `/dashboard/planning/pue` (planned) | `/dashboard/plan/pue` | Plan |
| `/dashboard/planning/e-mobility` (planned) | `/dashboard/plan/charging-hubs` | Plan (DER and Utility) |

Presentation mode (`?present=1`) is carried through every redirect.

### New in NAV-B (no current address)

| Proposed address | Rail item | What |
| --- | --- | --- |
| `/dashboard/initiatives/meter-every-customer/applications` | Home (inside Meter every customer) | The Utility's applications queue (MTR-B) |
| `/dashboard/finance/pipeline` | Finance | The financier's masked funding pipeline |
| `/dashboard/oversight/regulator` | Oversight | The regulator view (planned) |
| `/dashboard/plan/rooftop-solar`, `/dashboard/plan/storage` | Plan | DER planners (planned) |

### The prototype's own addresses (removed in NAV-B)

Everything under `/preview` (Home, `/preview/initiatives/...`, `/preview/track`,
`/preview/workspace/[demo]/...`) redirects to its public or signed-in
equivalent above once NAV-B is live.

## Questions for the Founder

1. Does the domain stay in the Intelligence addresses (`/dashboard/intelligence/utility/...`), as proposed, or does the session's workspace decide the domain, with shorter addresses?
2. Can the three Phase 1 "Coming Soon" pages (`/dashboard/settings`, `/dashboard/intelligence/ai`, `/dashboard/intelligence/analytics`) be removed in NAV-B?
3. Should One meter's journey and the Metering Plan report move as proposed, or stay beside the Metering screens?
