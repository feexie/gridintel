# MG plan: a real reference mini-grid, then the mini-grid planning engine

Status: **approved with one change** (Founder, 24 November 2026): the P90 of
`demandFromReference` is taken from the reference site's daily totals, so diversity is
captured (3.2, method 1; expected figures re-derived in 3.6). The answers to the open
questions are in section 6. MG-REAL is built first; MG-PLAN-A follows the Founder's
approval of MG-REAL.
Branch: `phase-mg-plan`, from `main` at 47b5761 (NAV-A and EMOB-A merged).

Two phases:

- **MG-REAL**: one published, real mini-grid (site RMG01) enters GridIntel as a
  **reported reference site**, beside the synthetic portfolio and never added to it. It
  feeds the Sites screen and the Mini-grid verification card.
- **MG-PLAN-A**: the engine for planning a new mini-grid from reference sites: demand,
  sizing, tariff response, subsidy gap and productive-use gap. No screen. The screens come
  after NAV-B, under Mini-grid workspace → Plan → Unserved and Productive use.

Using the dataset is an external integration, so section 1 is a decision gate.

## 1. The source, and how it enters the repository (decision gate)

**Source.** Kemabonta, T. & Geoffrey, A. (2026), *A Multi-Year Daily Operations Dataset
from a Rural Solar Mini-Grid in Southern Nigeria* [Data set], v1.0.2, DOI
10.5281/zenodo.24098636, licence CC BY 4.0,
https://github.com/Kemabonta/rural-solar-minigrid-operations-dataset. The tags v1.0.0,
v1.0.1 and v1.0.2 all point at commit `bd9dea2`. The repository's `CITATION.cff` gives the
release date as 24 October 2026; Zenodo shows v1.0.2 published on 10 November 2026.

What it holds, read for this plan from the published CSVs:

| Table | Rows | Size | Used by |
| --- | --- | --- | --- |
| Site_Description, Equipment, CAPEX, OPEX, Tariffs, Tariffs_and_Events, Caveats, Data_Dictionary, Coding_Convention, README_Overview | 4 to 129 each | 0.6 to 23 KB | Both phases |
| Reliability_Outages (17 events), Reliability_Indices (12 months) | 17, 12 | 2.3 KB, 0.9 KB | MG-REAL |
| Site_Daily, Site_Monthly, Site_Yearly | 1,614, 54, 6 | 73 KB, 3 KB, 0.6 KB | Both |
| Customers, Meter_Customer_Link | 248, 142 | 8 KB, 4 KB | Both |
| Payments | 21,300 | 0.86 MB | MG-REAL (paying customers a year) |
| Meter_Daily | 142,450 | 5.95 MB | MG-PLAN-A (use per meter by class) |
| Meter_Uptime | 804 | 32 KB | Not used (communications only, caveat C27) |
| The .xlsx workbook | 19 sheets | 3.7 MB | Not taken: the same content as the CSVs |

**Recommendation: vendor the CSVs, pinned and unchanged.**

- `src/repositories/reference/rmg01/data/` holds the 20 CSVs exactly as published at
  `bd9dea2`, with no edits and no reformatting, plus the dataset's `LICENSE` (CC BY 4.0)
  and `CITATION.cff`. A `SOURCE.md` names the DOI, the version, the commit, the date we
  retrieved it and the SHA-256 of every file. The precedent is the geoBoundaries data
  vendored under `src/repositories/geoboundaries/data`.
- A unit test recomputes the SHA-256 of every vendored file against `SOURCE.md`, so a
  changed file fails the check.
- Size: about 7 MB, 6 MB of it Meter_Daily. The adapter reads the files once per process,
  on the server only, and the composition root caches the result as it does for every
  adapter.
- A script `scripts/reference-fetch.ts`, run by hand only, downloads a named version and
  rewrites `SOURCE.md`. A new dataset version is therefore a reviewed commit, never a silent
  change.

**Alternative: fetch at build time.** Not recommended. The build and CI would depend on
GitHub being reachable, offline development would break, and the "every number traces to
its source" rule would rest on a network call rather than a file in the commit.

**Attribution on every screen that uses it.** The dataset is carried as a `Citation` with
two new optional fields, `licence` and `licenceUrl`, alongside the citations the NERC
figures already use. Every view model that carries a reference figure also carries the
dataset's attribution, and a shared `ReferenceAttribution` component prints it as: authors,
year, title, version, DOI link, "CC BY 4.0", and "GridIntel's calculations on the
published data; the data are unchanged". That last line states the changes made, which
CC BY requires. A unit test fails any reference view without the attribution. A browser
test checks the attribution text and the licence link on every screen that shows a
reference figure.

**Privacy.** Meters, customers and agents carry pseudonymous codes (`RMG01-Mnnnn`,
`RMG01-Cnnnn`, `RMG01-Axx`), and the dataset removed names and locations (C16). GridIntel
still treats the codes as customer data: no view, report or future AI prompt shows a
meter or customer code, or any group smaller than 5. The dataset itself notes several such
groups, for example customers created in 2022 (4) and 2025 (1). Figures are shown per site
and per class only.

**What the source is.** Everything in it is **reported**: figures published by someone
else. Some are the operator's documents (site, equipment, costs, tariffs, outage log) and
some are platform exports (meter-days, payments). What GridIntel works out from them is
**calculated on reported data**, under a named method, and is never relabelled as
measured by GridIntel. The 17.9% the dataset states is held as a **reported claim** and
checked against our own calculation from Site_Daily, the same claim-against-calculation
pattern as the synthetic sites' reports.

## 2. Phase MG-REAL: the reference site (data and Intelligence)

### 2.1 What it shows

| Figure | Status | How |
| --- | --- | --- |
| Site facts: 30 kWp PV, lead-acid battery 136 kWh, 4 × 10 kVA hybrid inverters, about 2 km three-phase LV network, energized July 2020, 3 communities, southern Nigeria | Reported | Site_Description, Equipment. The battery is shown as "136 kWh (documents also give 140, 144 and 150 kWh; none tested)" (C18). The location is withheld, so the site has no point on the map |
| Site meter against the sum of customer meters: **17.9% over the 927 days with both** (2022-06-06 to 2025-01-25), the dataset's figure | Reported claim | Caveat C05 |
| The same gap, calculated: (Σ community series − Σ sum of meters) ÷ Σ community series over days with both; by year (69%, 85% and 90% of the site total reached by the meters in 2022, 2023 and 2024); 8.6% for the 362 days of the independent export | Calculated | Site_Daily; the claim agrees if within the platform's tolerance |
| Why the meters under-count: unmetered air conditioning of the battery and inverter container, and observed theft and meter bypassing, which the data cannot split | Reported (operator observation) | C05, C17. Shown as the dataset words it; GridIntel does not apportion the gap |
| Reliability, Dec 2020 to Nov 2021: SAIDI, SAIFI and CAIDI for the 8 months with logged outages | Reported, and calculated beside it | Reliability_Indices as reported. Recalculated from Reliability_Outages (`customer_hours`, `customers_interrupted`, `customers_served`) with the existing reliability indices where their inputs fit |
| ASAI | Reported, two figures | The reported ASAI divides by 8,760 hours (C25); the dataset's recalculation on hours in the month is shown beside it |
| Months with no logged outage (May, Jun, Sep, Oct 2021) | "No outage logged" | Never shown as 0 hours or 100%. Outside Dec 2020 to Nov 2021: "no outage log exists" |
| Customers paying each year: 116 (2020, from 31 July), 141, 136, 123, 125, 68 (2025, to 26 January) | Calculated, with the dataset's own counts as the reported claim | Customers with at least one PAY payment in the calendar year, from Payments |
| **Repeat buyers**: customers who bought credit in 2021 and again in 2024, shown as "x of y" (y = buyers in 2021) | Calculated | Payments (PAY). Labelled "repeat buyers", never "retention" (Founder, 24 November 2026) |
| Accounts created to date: 208, 234, 238, 244, 244, 245 | Calculated | Customers by year created |
| Paying customers as a share of accounts created: e.g. 141 of 234 in 2021 | Calculated | Labelled "customers who bought credit in the year". Not "retention" or "churn": the customer file holds no closure dates (C10) |
| Tariff events: ₦165/kWh to July 2023, ₦350/kWh from July 2023, about ₦500/kWh from about February 2024; supply interruption April to July 2023 | Reported | Tariffs, Tariffs_and_Events, always with "change dates approximate; agents paid a lower, unrecorded rate" (C11, C23) |
| Supply: 24 hours a day intended; 10 to 12 hours a day in the operator's report of May 2023 | Reported | Site_Description. No daily log of supply hours exists |
| Use: daily kWh of the sum of meters and of the community series, meters reporting, share of zero meter-days | Calculated | Site_Daily, Meter_Daily. Gap days are blank, never 0 (C01); the low-use window is flagged (C02) |

### 2.2 What MG-REAL may not claim

- **No collection rate, no revenue, no revenue per kWh, no ARPU.** PAY records are credit
  bought, not energy sold (C12). Only part of the meters report, and tariff dates are
  approximate (C23). Payments appear only as "customers who bought credit in the year".
- No split of the 17.9% between technical loss, the unmetered air conditioning and theft.
- No generation, PV yield, battery state, voltage or performance ratio: the dataset has
  none (C06).
- No reliability index outside December 2020 to November 2021, and no inference of outage
  days from low use (C26).
- No load profile within the day: the data is daily (C06).
- No point on the map and no sun hours for RMG01: the location is withheld.
- RMG01 is never added to the synthetic portfolio's counts or totals, never counted in
  "sites agreeing with their records", and never shown without "reference site, published
  data" beside it.

### 2.3 Where it appears

- **Sites screen** (`/dashboard/minigrid/sites`, until NAV-B moves it): a "Reference sites"
  section below the operator's sites, headed "Published data from other operators, not
  part of this portfolio", with one card per reference site and its attribution.
- **A reference site's page**: `/dashboard/minigrid/sites/reference/[siteId]`, a route of
  its own so a reference id never reaches the synthetic site lookup. It carries the table
  in 2.1, the caveats (the dataset's 29, grouped by topic and quoted), and the attribution.
- **The Mini-grid verification card** (front door and workspace): a separate line,
  "Reference site RMG01 (published data): site meter 17.9% above the sum of customer
  meters, as the dataset states; calculated: x%", outside the synthetic counts and labelled
  real.
- The reference site is shown in the public demonstration and in a tenant deployment
  alike, read-only, as a public reference (Founder, 24 November 2026), and never in an
  organization's own totals.
- Addresses are today's; NAV-B moves them later with everything else.

### 2.4 Building blocks

| Layer | Addition |
| --- | --- |
| Domain | `src/domain/reference.ts`: `ReferenceSite` (id, code, name, country, region text, `locationWithheld`, facts with status and source, the dataset's `Citation`), `ReferenceDay`, `ReferenceMeterDay` (class, never a customer), `ReferenceOutage`, `ReferenceTariffEvent`, `ReferenceCaveat`, `ReferencePayment` (date, amount, type, customer code for counting only) |
| Port | `src/repositories/ports/reference.ts`: `ReferenceSiteRepository` with `sites()` returning a **list**, and per site `days()`, `meterDays()`, `outages()`, `reportedIndices()`, `tariffEvents()`, `caveats()`, `customers()`, `payments()`, `costs()`, each with its coverage. Retrieval only: no totals and no "latest" |
| Adapter | `src/repositories/reference/rmg01/`: parses the vendored CSVs, keeps blanks as `null` and never as 0, keeps the dataset's flags, tags every record `reported` with the citation |
| Analytics | `src/analytics/reference/`: `meterGap` (`gridintel.reference.meter-gap` 0.1.0), `paying` (`gridintel.reference.paying-customers` 0.1.0), `useSeries` (`gridintel.reference.use` 0.1.0); reliability reuses `analytics/reliability/indices.ts` where its inputs fit |
| Services | `src/services/minigrid/reference.ts` and its views; every figure carries status, sourcing and attribution, and `synthetic: false` |
| Composition | `src/composition/reference.ts`, built once per process |
| UI | The Sites section, the reference page, the verification card line, `ReferenceAttribution` |

### 2.5 Tests and acceptance

- The adapter: 1,614 Site_Daily rows; 38 gap days blank and not 0; 142,450 meter-days; 17
  outages; 4 tariff records; SHA-256 of every file matches `SOURCE.md`.
- `meterGap` on the vendored data: 16,494.6 kWh against 13,537.4 kWh over 927 days, 17.9%,
  agreeing with the claim. On 362 days, 4,659.8 against 4,259.6 kWh, 8.6%. Fixed-input
  tests for the arithmetic, plus one test on the vendored file.
- `paying`: 141 customers in 2021 and 136 in 2022, matching the dataset's own counts.
- Reliability: the calculated SAIDI for December 2020 against the reported 8.151 h; a month
  with no logged outage gives "no outage logged" and not 0.
- Every reference view has its attribution. A browser test checks the Sites section and the
  reference page for the citation and the licence link, in both builds and in the tenant
  build.
- The synthetic portfolio's figures are unchanged, and the verification card's synthetic
  counts are unchanged.
- `npm run geh:figures`: all 101 unchanged.

## 3. Phase MG-PLAN-A: the planning engine (no screen)

### 3.1 Reference sites are a list

Every method takes `ReferenceBasis[]`, one entry per reference site. Each entry holds the
figures the method needs, derived from that site's data by the analytics in 3.3, with
status and source. A second dataset needs a new adapter only (for example Zenodo record
22149102, Kenya and Nigeria mini-grids, which this plan has **not** read) and no change to
any method. Every benchmark the services return carries `referenceSites: n` and their ids.
With one site the benchmark is that site's figure, labelled "1 reference site". It is
never presented as a typical or national value.

### 3.2 Methods

Each method is named `gridintel.planning.minigrid-<name>`, version 0.1.0, pure, with
fixed-input tests. Every output figure carries `status` (`reported` | `calculated` |
`assumption`) and its `source`.

**1. `demandFromReference`**: the daily kWh of a planned community, years 1 to 5, P50 and P90.

- **P50 and P90 from the site's daily totals (Founder, 24 November 2026).** For each day,
  the sum of meters (Site_Daily) ÷ meters reporting gives the site's kWh per reporting
  meter-day, so the day's diversity between customers is in it. The P50 and the P90 are
  taken across the days of each **year of operation**.
- **By class**: the site figure × (the class's share of the year's metered energy ÷ the
  class's share of the year's meter-days), both from Meter_Daily. The class factors are
  weighted by meter-days, so they average 1 over the site.
- Gap days, the low-use window and stale repeats (C01, C02, C04) are excluded, the
  exclusions are listed in the output, and zero meter-days are kept (C03 cannot tell
  "no use" from "off").
- The connection ramp: accounts created to the end of year n ÷ accounts in the file
  (RMG01: 208, 234, 238, 244, 245 of 245, so 0.85, 0.96, 0.97, 1.00, 1.00).
- Buying customers: customers who bought credit in year n ÷ accounts created to date
  (RMG01: 0.56, 0.60, 0.57, 0.50, 0.51). It stands in for "retention", with that label.
- Demand(n, P) = Σ over classes [customers(class) × class factor(n)] × site kWh per reporting
  meter-day(n, P) × ramp(n) × buying(n) × (1 + losses).
- **No-diversity upper bound**, a separate line with that label: Σ over classes of
  customers × the class's own P90 meter-day (from Meter_Daily) × ramp × buying × (1 +
  losses), that is, every customer on a high day at once. It is never the design day and
  never called P90.
- Losses: an **assumption** entered by the user (default 10%). The RMG01 gap of 8.6% to
  17.9% is shown beside it as reference, and not used as a loss figure, because it includes
  unmetered own use and theft.
- Label on every output: **"Served demand at the reference site, a floor on true demand"**:
  the operator reported 10 to 12 hours of supply a day in May 2023.
- Optional suppressed-demand uplift: a multiplier, **assumption**, off by default, shown as
  a separate line and never folded into the P50.
- Class mix: residential at RMG01 includes 119 customers with no class in the source,
  treated as residential by the dataset's authors (C07). The class figures carry that note.

**2. `sizeSystem`**: PV kWp and battery kWh for a design day, and utilisation.

- Sun hours per planned site from NASA POWER, the same source, citation shape and
  average and rainy-season cases as EMOB-A. The planned site's coordinates are an input.
  RMG01's location is withheld, so it has no sun hours.
- Design day: the highest diversified P90 over years 1 to 5 (an option: a named year and
  case). The no-diversity upper bound is never used to size.
- Night share of daily energy: an **assumption** (default 60%), because the dataset has no
  hourly data.
- PV makes the day share plus the night share ÷ round-trip efficiency; kWp = that ÷ (sun
  hours × PR); battery kWh = night energy ÷ DoD. This is EMOB-A's arithmetic, so it moves
  to a shared module (3.5).
- Defaults, all **assumptions**: PR 0.80 (as EMOB-A); lead-acid DoD 0.5 and round-trip
  0.85; lithium iron phosphate DoD 0.9 and round-trip 0.9 (as EMOB-A). The chemistry is an
  input.
- Output: kWp, kWh, the rainy-season shortfall, utilisation by year and case (the energy
  the demand needs from PV ÷ the energy the PV makes on an average day), and a flag
  **"oversized"** where year-1 P50 utilisation is below a threshold (an assumption, default
  60%).
- RMG01 as a check, not a benchmark: 30 kWp against about 17 to 22 kWh a day served (the
  sum of meters, and the site total) gives a utilisation near 15 to 20% on an assumed 5 sun
  hours. Shown only with "sun hours assumed: location withheld".

**3. `tariffResponse`**: revenue under tariff options.

- kWh(t) = kWh(t₀) × (t ÷ t₀)^e. Revenue = kWh × t. e = −1 is the fixed budget (spend
  unchanged, revenue flat), and e = 0 is no response.
- **Fitted to the reference's tariff events** (₦165, ₦350, about ₦500/kWh) on use per
  reporting meter, before and after each change, excluding the interruption and the
  low-use window.
- **What the data shows (a scratch reading of Site_Monthly for this plan, to be recomputed
  by the method):** use per reporting meter-day was about 0.21 kWh at ₦165 over 2021 and
  2022, and about 0.16 kWh in July 2022 to February 2023, then about 0.22 kWh at ₦350 (August 2023 to January 2024) and about 0.11 kWh
  at ₦500 (March 2024 to January 2025). Use **rose** after ₦350, straight after the April
  to July 2023 interruption, and roughly halved at ₦500. Credit bought per day was about
  ₦5,200 over 2021 and 2022, ₦3,700 in July 2022 to February 2023, ₦5,200 at ₦350 and
  ₦4,300 at ₦500. A single
  fixed-budget fit is therefore not clean: the rebound after the interruption, the rising
  share of meters reporting, the shrinking meter gap and the unexplained fall in 2024 (C15)
  all overlap the tariff changes.
- **Scenarios (Founder, 24 November 2026):** the method returns e = −1 (fixed budget), e
  fitted to each event separately, and the user's own e, side by side. Each fitted e carries
  its window, its number of days and its confounders. Where the events give elasticities
  of opposite sign, the method returns **the range** (the events' elasticities, low to high)
  with "the reference events disagree", and **never a single figure** or an average.
- Payments are not used in the fit (C12), only kWh.

**4. `subsidyGap`**: capex minus net revenue over a stated period, per connection. Display only.

- Capex: the user's figure, or RMG01's actual cost scaled. Scaling: storage per kWh,
  generation per kWp and distribution and metering per connection, at RMG01's actual 2019
  cost of ₦35,071,810.50, with an **assumption** to bring it to today (a factor or a USD
  rate). The output is labelled "2019 reference cost, scaled" (C21).
- Net revenue: kWh sold (demand ÷ (1 + losses)) × tariff, with the tariff response, minus
  opex. **Opex has no reliable reference** (C22: one figure of USD 28 a month, plus company
  account lines), so it is a user input or a stated assumption, never RMG01's figure alone.
- Period: an input (default 10 years; years 6 and on hold year 5).
- Output: the gap in total and per connection, and the months for net revenue to repay
  capex at 0% and at a stated return, using `analytics/planning/loan.ts`. "Never" when it
  does not repay.
- Programme finance (tenders, results-based payments, grants) stays on Odyssey. GridIntel
  shows the gap and does not match money to it.

**5. `pueGap`**: the productive load needed to reach a target utilisation.

- Productive kWh a day = target utilisation × PV energy − the energy the demand needs from
  PV. The productive load is taken as daytime, direct from PV, with no battery (an
  **assumption**, stated).
- Target: an **assumption** (default 70%).
- Equipment examples (a grain mill, a freezer, a welding set, an irrigation pump), each
  with an assumed kW and hours, are **assumptions** for illustration only. They are never
  presented as the community's demand.

### 3.3 The inputs table

One table, `src/services/planning/minigridInputs.ts`, on the pattern of
`emobilityInputs.ts`. Every input is held once with its status and source; methods take
values as parameters.

| Input | Default | Status | Source or basis |
| --- | --- | --- | --- |
| Site kWh per reporting meter-day, by year of operation, P50 and P90 | From each reference | Calculated on reported data | Site_Daily (sum of meters ÷ meters reporting), with the exclusions listed |
| Class factors (share of energy ÷ share of meter-days), by year | From each reference | Calculated on reported data | Meter_Daily |
| Class P90 meter-day, for the no-diversity upper bound only | From each reference | Calculated on reported data | Meter_Daily |
| Connection ramp, years 1 to 5 | From each reference | Calculated on reported data | Customers, year created |
| Buying customers ÷ accounts, years 1 to 5 | From each reference | Calculated on reported data | Payments (PAY), Customers |
| Customers by class in the planned community | User | Input | The planner |
| Losses | 10% | Assumption | RMG01's 8.6% to 17.9% meter gap shown beside it, not used |
| Suppressed-demand uplift | Off (1.0) | Assumption | Supply of 10 to 12 h a day reported in May 2023 |
| Sun hours, average and rainy season | Per site | Reported | NASA POWER, as EMOB-A |
| PR | 0.80 | Assumption | As EMOB-A |
| Battery chemistry, DoD, round-trip | Lead-acid 0.5 / 0.85; LFP 0.9 / 0.9 | Assumption | LFP as EMOB-A |
| Night share of daily energy | 60% | Assumption | No hourly data (C06) |
| Oversized threshold | 60% at year 1 P50 | Assumption | |
| Tariff options | ₦165, ₦350, ₦500 /kWh and the user's own | Reported (RMG01's) and input | Tariffs |
| Tariff elasticity | −1, fitted per event, user's | Assumption and calculated | 3.2 (3) |
| Reference capex | ₦35,071,810.50 (2019) by category | Reported | CAPEX (C21) |
| Capex scaling to today | User | Assumption | |
| Opex a day | User | Assumption | C22: no reliable reference |
| Period, return | 10 years, 0% | Assumption | |
| Target utilisation | 70% | Assumption | |
| Productive equipment kW and hours | Examples | Assumption | Illustration only |

### 3.4 What each method may not claim

| Method | May not claim |
| --- | --- |
| `demandFromReference` | True or unconstrained demand; a load profile; that the no-diversity upper bound is a P90 or a design day; anything beyond 5 years; that the class split is the source's own |
| `sizeSystem` | An hour-by-hour dispatch or a loss-of-load probability; a cost; an EPC design; anything for a site without coordinates |
| `tariffResponse` | A price elasticity measured at one site as a general law; an effect on collection or revenue at RMG01; a figure where the events disagree |
| `subsidyGap` | A grant amount, a programme's eligibility, a lender's decision; an opex from RMG01; today's cost from 2019 prices without the stated scaling |
| `pueGap` | That a productive user exists or would pay; the equipment as demand |
| All | A benchmark from one site called typical; any figure without "n reference sites" |

### 3.5 Reuse, and keeping EMOB-A identical

- **Solar sizing.** `comparePowerSources` in `analytics/planning/emobility/powerSource.ts`
  holds the day/night arithmetic inline (PV for the day share plus the night share ÷
  round-trip; kWp ÷ (sun hours × PR); BESS ÷ DoD). It moves to
  `src/analytics/planning/solar.ts`, which EMOB-A then calls, with its results unchanged and
  its method version unchanged. This is the same move as `loan.ts` in EMOB-A. A test pins
  EMOB-A's six hubs' outputs before and after.
- **Sun hours.** The NASA POWER citation shape and the average and rainy-season pair, as
  EMOB-A. Planned mini-grid sites in the synthetic dataset get sun hours retrieved and
  cited the same way.
- **Loan arithmetic.** `monthsToRepayAt` and `monthsToRepayWithReturnAt` from `loan.ts`,
  unchanged.

### 3.6 The synthetic test community (fixed inputs)

250 customers: 232 residential and 18 non-residential. Every input is a fixed round
number held in the test, so the tests do not depend on the vendored file. The ramp and
buying shares are rounded and close to RMG01's. The kWh figures and class shares are round
numbers, **not** RMG01's. They were set before the expected figures were worked out
(re-derived 24 November 2026 for the diversified P90).

| Input | Value |
| --- | --- |
| Site kWh per reporting meter-day, P50, years 1 to 5 | 0.18, 0.21, 0.21, 0.19, 0.17 |
| Site kWh per reporting meter-day, P90, years 1 to 5 | 0.24, 0.27, 0.27, 0.25, 0.23 |
| Class shares of meter-days and of energy | Residential 92% and 80%; non-residential 8% and 20% (factors 0.8696 and 2.5) |
| Class P90 meter-day, for the no-diversity upper bound only | Residential 0.30, non-residential 1.20 |
| Connection ramp, years 1 to 5 | 0.85, 0.95, 0.97, 0.99, 1.00 |
| Buying share, years 1 to 5 | 0.55, 0.60, 0.57, 0.52, 0.51 |
| Losses | 10% |
| Sun hours (fixture, not NASA POWER) | 5.0 average, 4.0 rainy season |
| PR, night share, lead-acid DoD and round-trip | 0.80, 60%, 0.5, 0.85 |

The community counts as 246.74 meter-equivalents (232 × 0.8696 + 18 × 2.5).

Expected figures (hand-checked):

| Figure | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
| --- | --- | --- | --- | --- | --- |
| Demand P50, kWh/day | 22.84 | 32.49 | 31.51 | 26.55 | 23.53 |
| Demand P90 (diversified), kWh/day | 30.45 | 41.77 | 40.52 | 34.93 | 31.84 |
| No-diversity upper bound, kWh/day | 46.90 | 57.18 | 55.47 | 51.64 | 51.16 |
| With uplift 1.5, P50 | 34.26 | 48.73 | 47.27 | 39.82 | 35.30 |
| Utilisation P50 | 54.7% | 77.8% | 75.4% | 63.6% | 56.3% |
| Utilisation P90 | 72.9% | 100.0% | 97.0% | 83.6% | 76.2% |

- `sizeSystem` on the design day (year 2 diversified P90, 41.77 kWh): PV energy needed
  46.19 kWh a day, **11.55 kWp**, battery **50.12 kWh** (50.13 in the first hand check, a
  rounding: 25.062 ÷ 0.5 = 50.124). On a rainy-season day PV makes 80.0% of what the design
  day needs, and serves 81.2% of it (the day share direct, the rest through the battery),
  7.85 kWh short. The no-diversity bound would have needed 15.81 kWp and 68.62 kWh. Year-1
  P50 utilisation of 54.7% is still below the 60% threshold, so the result is flagged
  **oversized in year 1**. The cause is now the connection ramp and buying share of year 1,
  not the sizing basis, and the flag says which year and why.
- `pueGap` to 70% in year 1 at P50: **7.08 kWh a day** of daytime productive load.
- `tariffResponse` from 25 kWh a day at ₦165: at e = −1, 11.79 kWh at ₦350 and 8.25 kWh at
  ₦500, revenue ₦4,125 a day throughout; at e = −0.5, 17.17 kWh (₦6,007.8) and 14.36 kWh
  (₦7,180.7); at e = 0, ₦8,750 and ₦12,500. Two events with e = +0.4 and e = −2.0 return
  the range −2.0 to +0.4 with "the reference events disagree", and no single e.
- `subsidyGap` with capex ₦30,000,000, tariff ₦350, opex ₦3,000 a day, 10 years, no tariff
  response, P50: kWh sold 20.76, 29.53, 28.65, 24.13, 21.39 a day (29.54 in the first hand
  check, from the rounded 32.49; the method's 29.535 is right); net revenue over 10
  years ₦18,615,713; **gap ₦11,384,287, ₦45,537 a connection**. With opex ₦1,500 a day:
  gap ₦5,909,287, ₦23,637 a connection. At year 5's net of ₦4,487.30 a day, capex repays in
  219.9 months at 0% and **never** at 10% a year.
- A second reference site added to the fixture list changes the benchmarks and
  `referenceSites` to 2, with no code change.

These expected figures follow from the fixed inputs above. If a method gives something
different, the method or the hand check is wrong; the inputs are not retuned to match.

### 3.7 Services and files

- `src/domain/minigridPlanning.ts`: `PlannedCommunity`, `ReferenceBasis`, the result
  types.
- `src/analytics/planning/minigrid/`: `demand.ts`, `sizing.ts`, `tariff.ts`,
  `subsidyGap.ts`, `pueGap.ts`, `reference.ts` (reference data into `ReferenceBasis`), each
  with its tests; `src/analytics/planning/solar.ts` (shared, 3.5).
- `src/services/planning/minigrid.ts`, `minigridInputs.ts`, `minigridViews.ts`; a
  synthetic planned community on the demonstration, flagged synthetic, its benchmarks from
  the real reference site with attribution.
- `src/composition/minigridPlanning.ts`. No route, no screen and no menu entry.

## 4. What stays untouched

- `npm run geh:figures`: all 101 unchanged, in both phases.
- The synthetic mini-grid portfolio, its methods and its figures. RMG01 sits beside it,
  never in it.
- EMOB-A's results and method versions, pinned by a test across the `solar.ts` move.
- Metering, the Marketplace and `loan.ts`.

## 5. Order, branches and checks

1. `phase-mg-real`: vendored data, adapter, analytics, services, the Sites section, the
   reference page and the verification line. Checkpoint with screenshots (not committed).
2. `phase-mg-plan-a`: the engine. Checkpoint on the tests and the inputs table.
3. Screens for MG-PLAN-A after NAV-B: Mini-grid workspace → Plan → Unserved and
   Productive use.

Each step is committed after `npm run verify:local`, and CI's full `npm run verify` is green
before each checkpoint. DESIGN notes go to `docs/minigrid/DESIGN.md`, with an ADR for the
reference-site layer (a new kind of source: real, published, third-party, kept apart from
both the synthetic data and a tenant's own records).

## 6. The Founder's answers (24 November 2026)

1. **Tariff response:** as proposed. Scenarios: fixed budget (e = −1), each event's own e
   with its confounders, and the user's e. Where the events disagree in sign, the range,
   never a single figure.
2. **Vendor** the dataset, pinned at v1.0.2 (`bd9dea2`), with the licence, `CITATION.cff`
   and the checksum test.
3. **Tenant deployments** show RMG01 too, read-only, as a public reference, and never in an
   organization's own totals.
4. **MG-REAL goes before NAV-B** (NAV-B waits for the Founder's Supabase sign-in), at
   today's addresses; NAV-B moves them later with everything else.
5. Keep **"customers who bought credit in the year"**. Add **"repeat buyers"**: customers
   who bought credit in 2021 and again in 2024, as a count of a count, never called
   "retention".
6. **Zenodo 22149102 is later**, as its own decision gate.
