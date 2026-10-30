# Global Energy Hackathon: disclosure (draft)

Baseline: tag `geh-baseline`, commit `839c5d9` (tagged 30 October 2026,
15:45 WAT, before the sprint began at 17:00 WAT). Repository:
https://github.com/feexie/gridintel (public). Everything at the tag existed
before the sprint; judges should score only what is listed under "Built
during sprint", which can be checked with `git diff geh-baseline`.

## Existed before the sprint

All data at the baseline is synthetic demonstration data, labelled as such
in the data's provenance and on every screen.

**Platform**

- Next.js 16 web application with a layered architecture (domain,
  deterministic analytics, application services, repository ports and
  adapters, one composition root), with the layer boundaries enforced by
  lint rules.
- Data provenance and quality on every value (measured, reported,
  calculated, estimated, missing), with reported and calculated figures
  shown apart; 20 architecture decision records (`docs/adr/`).
- Permission-driven navigation; a Platform Overview linking the sectors.
- A shared GIS map capability, used by each sector.
- Downloadable reports with a print layout, CSV and XLSX export.
- Two deployments from one codebase: the public demonstration (no login)
  and a tenant deployment (Phase 8A, on branch `phase-8a`, not merged to
  `main`): invited users only, password plus authenticator (TOTP) at every
  sign-in, organizations isolated by row-level security (Supabase), a
  People screen for administrators, and a setup guide and read-only setup
  check (`docs/PILOT_SETUP.md`, `scripts/pilot-check.ts`).
- Tests: 734 unit tests, browser tests (Playwright) against the demo and
  tenant builds, and CI running the full check on every push.

**Utility Intelligence (distribution utility)**

- Synthetic DisCo dataset: network hierarchy (regions, substations,
  feeders, distribution transformers, service points), boundary and
  customer meters by meter type (AMI, conventional prepaid and postpaid,
  unmetered), billing on metered, vend and estimated bases, outages,
  alarms.
- Executive overview; Operations drill-down by region, substation, feeder,
  transformer and service point.
- Revenue: energy account, ATC&C losses and their parts, revenue not
  realised, billing and collection by customer class.
- Reliability: SAIDI/SAIFI-type indices with attribution, hours of supply
  against service bands, reported against calculated.
- Assets (loading against rating) and Events / Alarms (source alarms and
  derived conditions).
- Utility map; reports: DisCo operations report, Reliability and service
  standards, Daily operations brief.

**Mini-grid Intelligence**

- Synthetic mini-grid operator dataset: sites with PV, battery and
  generator, customers and sales.
- Portfolio overview, site list and site pages (energy flow, supply and
  interruptions, sales and collection), site reports compared with
  records, mini-grid map.
- Reports: Mini-grid compliance and results, Mini-grid site performance.

**Placeholders (no data, no figures)**

- Planning, DER Intelligence and each sector's AI Assistant are "planned"
  pages. Intelligence > AI and Intelligence > Analytics show "Coming Soon".

## Built during sprint

| Time (WAT) | Commit | What was built |
| --- | --- | --- |

## AI tools

- Claude (Anthropic)
- Claude Code (Anthropic)

## Datasets

| Dataset | Source | Licence | Used for |
| --- | --- | --- | --- |
