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
| Port | `src/repositories/ports/reference.ts` | `ReferenceSiteRepository`: `catalogue()` (ids and datasets, no file read), `sites()`, `sources()`, `records(siteId)` |
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

## The data bar

Above a reference site's page the dashboard's bar reads "PUBLISHED DATA":
the page is a real site's published records, the operator's portfolio on the
other screens is synthetic, and the dataset's citation links to its DOI. In
place of the synthetic reporting period it gives the span the records cover
(26 August 2020 to 25 January 2025, as the publisher states it, checked
against the file) and the publication date. On every other screen the bar is
unchanged. The layout takes the notices from
`catalogue()`, so the CSVs are read only on the mini-grid screens that show
the data (`e2e/reference-site.spec.ts` checks both cases).

## What is not derived

No revenue, collection rate or price per kWh (payments are credit bought, only
part of the meters report, the tariff dates are approximate); no split of the
meter gap between its causes; no generation, battery or voltage figure; no
reliability outside December 2020 to November 2021; nothing within the day; no
map point or sun hours (the location is withheld). The page lists these.

# Mini-grid: the planning engine (MG-PLAN-A)

Technical design of Phase MG-PLAN-A: a plan for a community a mini-grid is
planned for, from reference sites. Plan: `docs/design/MG-PLAN.md`, section 3.
No route, screen or menu entry: the screens follow NAV-B.

## Layers

| Layer | File | What it does |
| --- | --- | --- |
| Domain | `src/domain/minigridPlanning.ts` | `PlannedCommunity`, `ReferenceBasis` (what one reference site gives a plan), `ReferenceTariffChange`, `ReferenceCapex` |
| Analytics | `src/analytics/planning/minigrid/` | The six methods below, pure, with fixed-input tests on the plan's test community |
| Shared | `src/analytics/planning/solar.ts` | Solar and storage sizing, moved from EMOB-A's power-source comparison; EMOB-A's results pinned unchanged (`src/services/planning/emobility.pinned.test.ts`) |
| Port | `src/repositories/ports/minigridPlanning.ts` | `PlannedCommunityRepository`: communities, citations, sources |
| Adapter | `src/repositories/demo/minigridPlanning.ts` | One synthetic community (Cassava Creek, 232 residential and 18 non-residential customers), with NASA POWER climatology at its point |
| Services | `src/services/planning/minigrid.ts`, `minigridInputs.ts`, `minigridViews.ts` | The reference bases, the inputs table, the plan view |
| Composition | `src/composition/minigridPlanning.ts` | Built once per process |

The RMG01 adapter also reads `CAPEX` now (as published, every line).

## Methods (0.1.0)

| Method | Rule |
| --- | --- |
| `gridintel.planning.minigrid-reference-basis` | 365-day years of operation from the first day with meter data; days with no meter data, in the low-use window or with a stale repeated total left out by the publisher's flags, zero meter-days kept; per day, sum of the meters ÷ meters reporting, P50 and P90 by linear interpolation between ranks, pooled over the years wholly at the first tariff (the default basis) and per year of operation (the "as happened" scenario); class factors the same two ways; class factor = class share of energy ÷ class share of meter-days; class P90 meter-day over the whole record; ramp and buying share by calendar year from the first; each tariff change with up to 182 kept days either side, its month left out of both, and what else changed; the 2019 build cost by category with the PV, battery (136 kWh, the reference value) and meters bought (220), the 245 accounts beside them; the recurring opex lines by year as a reported floor, with the blank lines named |
| `gridintel.planning.minigrid-demand` | Σ customers × class factor × site kWh per reporting meter-day (P50, P90) × ramp × buying share × (1 + losses); by default the single-tariff use held flat, the planned tariff acting only through the tariff response; the site's own curve as the "as happened" scenario, never the default; the no-diversity upper bound on the class P90 meter-days, labelled; an uplift as a separate line; "served demand, a floor on true demand" |
| `gridintel.planning.minigrid-sizing` | The shared solar rule on the design day (the highest diversified P90 of years 1 to 5); utilisation = PV energy the demand needs ÷ PV energy on an average day; the rainy season's share made and share served; "oversized" when year-1 P50 utilisation is below 60%, naming year 1's ramp and buying share |
| `gridintel.planning.minigrid-tariff-response` | kWh(t) = kWh(t₀) × (t ÷ t₀)^e; scenarios: e = −1 as the middle case, each reference change whose e is not positive (with its windows and confounders), the user's; a positive e is shown with its confounders, labelled "not usable as a price response", and used in no scenario; the range over the scenarios, never a single combined figure |
| `gridintel.planning.minigrid-subsidy-gap` | Capex − net revenue (kWh sold × tariff − opex) over the period, years after 5 holding year 5; months to repay on year 5's net at 0% and at a return (`loan.ts`); a reference build cost scaled by kWh, kWp and connection, the rest in proportion, labelled "2019 reference cost, scaled", brought to today through US dollars (the source's ₦350/$, then the planner's cited rate) |
| `gridintel.planning.minigrid-pue-gap` | Target × PV energy on an average day − PV energy the year's demand needs; daytime, direct from PV |

A benchmark across reference sites is the plain mean of the sites that have
the figure, with their number and ids (`benchmark.ts`); with one site it is
that site's figure, labelled "1 reference site".

## On RMG01

| Figure | Value |
| --- | --- |
| Site kWh per reporting meter-day at ₦165, years 1 and 2 pooled (730 days): the default | P50 0.227, P90 0.287 |
| Class factors at ₦165 | Residential 0.94, non-residential 1.34 |
| Site kWh per reporting meter-day by year, P50 ("as happened") | 0.231, 0.222, 0.163, 0.147, 0.122 |
| Same, P90 ("as happened") | 0.296, 0.275, 0.235, 0.261, 0.163 |
| Connection ramp | 0.85, 0.96, 0.97, 1.00, 1.00 |
| Buying share | 0.56, 0.60, 0.57, 0.50, 0.51 |
| Opex floor (grid maintenance and direct materials) | ₦3,749, ₦2,152, ₦4,073 a day in 2022, 2023, 2024; labour and platform fees blank |

135 days are left out (38 with no meter data, 105 in the low-use window, 83
with a stale repeated total; a day can carry more than one flag). The ₦165 to
₦350 change gives e = +0.53 (after the 2023 interruption, meters reporting 90
to 110): not usable as a price response, shown with its confounders and used
in no scenario. The ₦350 to ₦500 change gives e = −2.10 (zero meter-days 19.9%
to 27.0%). The scenarios are e = −1 (the middle case) and −2.10, and the
user's.

For the synthetic community (4.43 sun hours, 3.64 in July): demand P50 28.58,
34.74, 33.51, 30.30, 30.80 kWh; design day year 2, 44.01 kWh; 13.73 kWp and
52.82 kWh of lead-acid; not oversized (year 1 P50 uses 64.9%); productive-use
gap 2.47 kWh a day. The scaled reference cost is ₦21,666,037 at 2019 prices.
The subsidy gap is not given until the planner enters an opex a day and
today's ₦ a dollar, each with its source.
