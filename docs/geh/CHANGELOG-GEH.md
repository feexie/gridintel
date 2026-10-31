# Global Energy Hackathon: sprint changelog

Baseline: tag `geh-baseline` (commit `839c5d9`, Friday 30 October 2026, 15:45 WAT). Branch: `geh-sprint`.
Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026, 18:00 WAT.

## At the baseline

- Utility Intelligence on a synthetic DisCo: network drill-down, revenue and ATC&C losses, reliability, assets, alarms, map and reports.
- Mini-grid Intelligence on a synthetic operator: sites, sales, supply and reports.
- Platform: layered architecture with provenance on every value, 734 unit tests, a public demo build and a tenant build.
- Planning: placeholder pages only, with no figures.
- Main also includes 87e63a8 (Phase 8A: login, organisations, tenant deployment), committed before the sprint; the public site runs in demo mode without login.

## Built during the sprint

| Time (WAT) | Commit | What was built |
| --- | --- | --- |
| Fri 18:07 | `6854f8a` | Design rewritten for pay-as-you-meter; Brief 15 summary (docs only) |
| Fri 18:26 | `16d7935` | Design updated with the Founder's answers (charge sizing, 120-month run, PMI-meter charges, capital currency, band split) |
| Fri 18:27 | `c668518` | Planning section: Overview with two groups, Metering built (being filled), seven planned planners with no figures, grouped menu |
| Fri 18:27 | `fe0faee` | copy edit: removed generic AI wording |
| Fri 18:54 | `5fb1ba7` | Published metering figures (NERC Q1/Q2 2026 reports, September 2026 tariff orders, August 2026 as reported) behind a port, with citations |
| Fri 18:54 | `673fb7c` | Metering fund method: 120-month cash model, charge sized to repay each meter in 60 months, shocks, metering pace; 14 tests |
| Fri 19:07 | `774991c` | Metering Fund service: two cases, assumptions with basis, shocks, mitigations, public money at the cap; 6 tests |
| Fri 19:07 | `c0f5059` | Metering Fund screen: finding-first heading, charts, shocks, bands, years, assumptions form, sources, presentation mode; 4 browser tests |
| Fri 21:56 | `4d9152a` | Design revised after M2: Plan, Fund, Monitor; GridIntel structure; investor protection; DisCo allocation as M3 |
| Fri 22:11 | `a7a3ffe` | GridIntel structure in the method and service: charge as a share of each bill, Lifeline exempt, public top-up, first-loss layer, reserve account, investor outcome; PMI as a reported record |
| Fri 22:11 | `abe38c1` | Fund screen: Plan, Fund, Monitor; fund alone against the structure; investors; protection; receipt; band charges |
| Fri 22:35 | `9eaf9b2` | Initial investment against break-even (both cases, with chart); all public money in the structure headline; inflation pass-through needed |
| Fri 22:36 | `d17a041` | M3 data and method: DisCo collection efficiency and ATC&C (NERC Q2 Tables 7, 8); need and repayment-risk scores; tranche split against pro-rata; 4 tests |
| Fri 22:47 | `0d3f131` | M3 DisCo allocation screen: largest gap headline, 11 DisCos with need and risk scores, first million against pro-rata, pilot card, screen tabs |
| Sat 01:47 | `dd112e9` | Brief 15's two impact measures as headlines on the Metering Fund: customers metered by year 5, estimated bills removed a year at full rollout, row by year 1-5 |
| Sat 01:57 | `3b8dc4f` | M4: DT sequencing (synthetic network, revenue per naira, revolving effect), Monitoring (plan against synthetic actuals, tranches against verified installs), About this build; tabs on |
| Sat 01:59 | `7c4d2d7` | Key figures: 93 figures generated from the services with wording, value, origin and source (docs and script) |
| Sat 01:59 | `a833e13` | Disclosure finished as paste-ready portal text (docs only) |
| Sat 07:21 | `ac58192` | `npm run geh:figures` added; key figures regenerated, all 93 unchanged |
| Sat 07:36 | `ab88247` | Metering Fund layout fixed for filming at 1920x1080 (presentation mode): no empty stretched cards, no wrapped figures, chart labels readable |
| Sat 08:00 | `c585501` | Demo recording helper: `npm run geh:record`, nine scenes, one video and key-moment PNGs each (recordings not committed) |
| Sat 09:35 | `7f0e353` | Investors never lose more than they put in: each shock split into fund shortfall, buffers, investors (capital lost, return due) and uncovered; public money per meter beside PMI's reported range; wording approved (W1-W4); presentation mode on every Metering screen |
| Sat 09:35 | `ce7a045` | Key figures regenerated (docs only) |
| Sat 09:57 | `b0b0742` | Presentation mode full width on the four screens; demo re-filmed (receipt moved to scene h) |
| Sat 13:48 | `d8e213c` | The three A's on every step (Plan · Access, Fund · Affordability, Monitor · Availability); the Metering Plan report, printable and saved as PDF, with Download report on every Metering screen and in About this build |
| Sat 13:48 | `1f0a308` | Key figures regenerated, all unchanged (docs only) |
| Sat 14:48 | `08a123d` | Disclosure and About this build note that main also includes Phase 8A (87e63a8, before the sprint) and the public site runs without login (docs only) |
| Sat 20:40 | `e47955e` | Metering Marketplace (Marketplace · Match): five synthetic pledges matched to synthetic approved meter applications by DisCo and band; daily meter charge by band, at most half of each recharge, into escrow; unplaced money queued for the next allocation; scene j filmed. No existing method or figure changed |
| Sat 23:27 | `fd7abcc` | One meter's journey: one synthetic household in Ibadan, Band A single-phase, from application to the funder repaid, six steps each naming who acts and linking to its screen; scene k filmed |
| Sat 23:38 | `6419f9b` | Marketplace consistent with the Metering Fund: Bands C to E pay 5% of their typical bill with a blended top-up per meter; share of a typical bill for every band; months to repay at each private pledge's return; the journey repays at 24% (18 months); scenes j and k re-filmed |
| Sat 23:56 | `55edaf4` | Platform clips p1-p7 in the recorder, captioned "Existing platform, before the hackathon" (filming only) |
| Sun 00:46 | `1235539` | Band B joins Bands C to E in the Marketplace: 5% of its typical bill for 60 months with a blended top-up; private money funds Band A only; scenes j and k re-filmed |
