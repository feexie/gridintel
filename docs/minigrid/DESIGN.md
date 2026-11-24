# Mini-grid: reference sites (MG-REAL)

Technical design of Phase MG-REAL. Plan: `docs/design/MG-PLAN.md`. Decision
record: `docs/adr/0022-reference-sites-from-published-data.md`.

## Source

Kemabonta, T. & Geoffrey, A. (2026). *A Multi-Year Daily Operations Dataset
from a Rural Solar Mini-Grid in Southern Nigeria* [Data set], v1.0.2,
https://doi.org/10.5281/zenodo.24098636, CC BY 4.0. Vendored unchanged at
commit `bd9dea2` in `src/repositories/reference/rmg01/data` (20 CSVs, LICENSE,
CITATION.cff, README.md); `SOURCE.md` beside it lists every SHA-256, checked by
`source.test.ts`.

## Layers

| Layer | File | What it does |
| --- | --- | --- |
| Domain | `src/domain/reference.ts` | `ReferenceSite`, its days, meter-days, customers, payments, outages, reported indices, tariffs and events, caveats, claims |
| Port | `src/repositories/ports/reference.ts` | `ReferenceSiteRepository`: `sites()`, `sources()`, `records(siteId)` |
| Adapter | `src/repositories/reference/rmg01/index.ts`, `../csv.ts` | Reads the CSVs as published; transcribes the publisher's own figures as claims |
| Analytics | `src/analytics/reference/` | The methods below, pure, with fixed-input tests |
| Services | `src/services/minigrid/reference.ts`, `referenceViews.ts` | The Sites cards and the reference page, formatted, with the credit; the verification line in `src/services/initiatives/figures.ts` |
| Composition | `src/composition/reference.ts` | Built once per process; no gate of its own |
| UI | `src/components/minigrid/Reference.tsx`; `src/app/dashboard/minigrid/sites/reference/[siteId]` | The Sites section, the reference page, the credit |

## Methods (0.1.0)

| Method | Rule |
| --- | --- |
| `gridintel.reference.meter-gap` | Over the days with both the site total and the sum of the meters: (Σ site − Σ meters) ÷ Σ site, and Σ meters ÷ Σ site. A day with either blank is left out |
| `gridintel.reference.credit-buyers` | Distinct customers with a PAY payment in a calendar year; repeat buyers: of a year's buyers, those who buy again in a later year; accounts created to date |
| `gridintel.reference.use` | By calendar year over the days with meter data: kWh a day, meters reporting, kWh per reporting meter-day, the share of meter-days at 0 kWh |
| `gridintel.reference.reliability` | By month of the fault log: SAIDI and SAIFI over the largest count of customers served logged in the month; CAIDI; ASAI on the hours in the month |

A claim agrees when GridIntel's figure rounds to the stated figure at the
stated decimals (`analytics/reference/claims.ts`); reported reliability is
compared at two decimals.

## Results on the vendored data

| Figure | As published | Calculated | |
| --- | --- | --- | --- |
| Customer meters below the site meter, 927 days with both | 17.9% | 17.9% (13,537.4 against 16,494.6 kWh) | agrees |
| The same, 362 days of the independent export | 8.6% | 8.6% | agrees |
| Meters' share of the site total, 2022 / 2023 / 2024 | 69% / 85% / 90% | 69% / 85% / 90% | agree |
| Customers who bought credit, 2020 to 2025 | 116, 141, 136, 123, 125, 68 | the same | agree |
| SAIDI, 7 of the 8 months with logged events | as reported | the same at two decimals | agree |
| SAIDI, March 2021 | 7.03 h | 6.88 h | **differs**: the report's divisor is not the largest count of customers served in the month (it matches their average, 189); kept as found |
| Repeat buyers, 2021 and 2024 | — | 114 of 141 | calculated only |

Wording: the dataset's 17.9% is (site − meters) ÷ site, so it is shown as "the
customer meters record 17.9% less than the site meter", not "the site meter is
17.9% above the meters" (which would be about 21.8%).

## What is not derived

No revenue, collection rate or price per kWh (payments are credit bought, only
part of the meters report, the tariff dates are approximate); no split of the
meter gap between its causes; no generation, battery or voltage figure; no
reliability outside December 2020 to November 2021; nothing within the day; no
map point or sun hours (the location is withheld). The page lists these.
