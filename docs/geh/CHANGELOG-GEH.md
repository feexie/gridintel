# Global Energy Hackathon: sprint changelog

Baseline: tag `geh-baseline` (commit `839c5d9`, Friday 30 October 2026, 15:45 WAT). Branch: `geh-sprint`.
Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026, 18:00 WAT.

## At the baseline

- Utility Intelligence on a synthetic DisCo: network drill-down, revenue and ATC&C losses, reliability, assets, alarms, map and reports.
- Mini-grid Intelligence on a synthetic operator: sites, sales, supply and reports.
- Platform: layered architecture with provenance on every value, 734 unit tests, a public demo build and a tenant build.
- Planning: placeholder pages only, with no figures.

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
