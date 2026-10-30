# Planning: design for the Global Energy Hackathon sprint

Entry: Brief 15, "Meter every customer" (summary in `BRIEF-15.md`). Track 3,
Business Models & Financing. Setting A, Residential.

Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026, 18:00
WAT. Feature freeze Sunday 01:00 WAT. Baseline: tag `geh-baseline`, commit
`839c5d9`. At the baseline `/dashboard/planning` is a "planned" page with no
data and no figure.

## 1. The concept: pay-as-you-meter, funded by the meters themselves

1. **No upfront payment.** A Metering Fund buys and installs the meters. It
   is financed by a blend of investor and DFI capital, and public money
   (PMI, DISREP, MAF) reserved for vulnerable customers.
2. **Cost recovered through energy purchases.** A meter charge is taken on
   each token purchase, capped at a set share of the monthly bill (default
   5%). The same rule applies to every customer, so customers on a free
   meter and on a paid meter are treated alike.
3. **The DisCo repays part of the fund** from the collection gain that
   metering brings: metered customers stop disputing estimated bills.
4. **Rollout order by revenue recovered per naira spent**, DT by DT, so the
   first meters earn the cash that pays for later ones (a revolving fund).
5. **Stress-tested** against import duty, naira devaluation and inflation,
   with mitigations the user can switch on.
6. **Equity.** The charge as a share of the monthly bill by tariff band.
   Lifeline and vulnerable customers are exempt; the public share covers
   them.

Where this model comes from (shown on the fund screen): "Pay-as-you-meter
applies the PAYGo model used for solar home systems and phone financing in
Africa: the customer pays for the asset in small amounts as they buy
energy, not upfront."

**Today's route, for comparison only.** Under MAP the customer pays for the
meter upfront and is refunded as energy credits over 120 months (as
reported [S5]). MAP meter prices were deregulated by NERC Order
NERC/2024/040, effective 1 May 2024 [S3], so there is no single regulated
price. The fund replaces the upfront payment; it does not use MAP's terms.

## 2. Structure of the Planning section

| Group | Planner | Address | Status |
| --- | --- | --- | --- |
| Utility planning | **Metering** | `/dashboard/planning/metering` | **Built in the sprint** |
| Utility planning | Distribution transformers (DT) | `/dashboard/planning/dt` | Planned |
| Utility planning | Feeders | `/dashboard/planning/feeders` | Planned |
| Utility planning | Network expansion | `/dashboard/planning/network-expansion` | Planned |
| Mini-grid planning | Unserved | `/dashboard/planning/unserved` | Planned |
| Mini-grid planning | Underserved | `/dashboard/planning/underserved` | Planned |
| Mini-grid planning | Productive use of energy (PUE) | `/dashboard/planning/pue` | Planned |
| Mini-grid planning | E-mobility | `/dashboard/planning/e-mobility` | Planned |

A planned page states its purpose in one line and that it is not built. It
holds no figure.

The Metering planner has four screens (exact addresses fixed in M1):

| Screen | Milestone | Question it answers |
| --- | --- | --- |
| Metering Fund | M2 | Can every customer be metered in five years with no upfront payment, what is the monthly charge, and does the fund survive shocks? |
| Where the first meters go | M3 | Which DTs to meter first so early meters fund later ones? |
| Who pays, and is it fair | M4 | What the charge is as a share of the bill by band, who is exempt, and what public money covers them |
| About this build | M4 | What existed at `geh-baseline` and what was built in the sprint |

## 3. The Metering Fund model (M2)

### 3.1 Two cases, switchable

| Case | Customers and metered share | Origin |
| --- | --- | --- |
| Brief scenario | 15 million customers, 45% metered, growth 2% a year | GEH Brief 15 test scenario; growth an assumption |
| Nigeria reference | Active and metered customers, meters installed per month | NERC. The primary source is NERC's metering factsheet of 14 October 2026, if found on nerc.gov.ng; the press articles [S1], [S2], [S5] are secondary. The brief's figures (December 2025: 6.97m of 12.16m metered, 57.27%) are shown as reported, citing GEH Brief 15 |

If the NERC factsheet cannot be reached, work stops and the Founder is told
before the Nigeria case is built.

### 3.2 Assumptions (every one editable and labelled "assumption" with its basis)

| Assumption | Default | Basis |
| --- | --- | --- |
| Exchange rate | N1,334 per $ | 30 October 2026, to confirm |
| Meter hardware | $45 per single-phase meter | Brief: mini-grid meters fell to about $40; utility meters cost more |
| USD share of meter cost | 100% | Imported; a local-assembly toggle lowers it |
| Import duty | 10% | Base case; the brief notes the rise from 10% to 45% that stalled the 2018 MAP scheme |
| Installation and logistics | N25,000 per meter | Assumption |
| Reference price only | Eko DisCo MAP vendor prices 2024: single-phase N122,000 to N168,000 | [S4]. "For reference, not current market price." Not used in the calculation |
| Meter life | 10 years | Assumption |
| Maintenance and replacement reserve | 2% of meter cost a year | Assumption |
| Meter failure rate | User-set | Assumption |
| Fund cost of capital | 12% a year, blended | Assumption |
| Charge cap | 5% of the monthly bill | Assumption |
| Monthly bill by band, A to E | **Placeholders**, shown on screen as "to be replaced with sourced figures" | The Founder supplies sourced values before recording |
| Collection gain from metering | 15% of the metered customer's billed revenue | Assumption |
| Share of the collection gain paid to the fund | 50% | Assumption |
| Customers who stop buying tokens or fall behind | 10% | Assumption; its effect on the fund is shown |
| Customer growth | 2% a year (brief scenario); from NERC periods (Nigeria case) | Assumption / calculated from reported figures |
| PMI | 750,000 meters in 2027, 62,500 a month, shared by unmetered customers at the start of 2027; later years user-set, default 0 | [S1], [S2]; phasing and share are assumptions |
| DISREP, MAF | User-set, default 0 | Assumption |

### 3.3 Calculation (versioned methodology in `src/analytics`; pure, deterministic)

The model runs month by month over five years (60 months) and reports by
year. The exact treatment of the points below is fixed in M2 and stated in
the methodology and on screen:

- **Meters to install:** enough to reach 100% metered by month 60,
  including customer growth. Public meters (PMI) are installed on their
  schedule; the fund installs the rest.
- **Cost per meter (naira):** hardware in USD × exchange rate on the USD
  share, plus import duty on the imported part, plus installation and
  logistics.
- **CAPEX:** meters installed × cost per meter, per year.
- **Funding drawn by source:** investor/DFI capital and public money, per
  year.
- **Recoveries:** the meter charge on token purchases (less the customers
  who stop buying), the DisCo's share of the collection gain, and the
  public share covering exempt customers.
- **Outgoings:** CAPEX, the maintenance and replacement reserve, failed
  meters replaced, and the cost of capital on the fund's balance.
- **Fund balance** each month, and the year the fund turns cash-positive.
- **Customer charge** per month, in naira and as a share of the bill by
  band. The charge is the same for every customer.

### 3.4 Headline

"Every customer metered by year 5 with no upfront payment. Charge: N[x] a
month, [y]% of a typical Band [z] bill."

[x], [y] and [z] come from the service. If the cap is breached or the fund
runs dry, the headline says so plainly and by how much (for example "The
charge breaches the 5% cap for Band E by N[x] a month").

### 3.5 Stress tests and mitigations

Beside the base case: import duty 45%; naira devaluation (default −30%);
inflation (default 30%); all three together. For each: is the fund solvent,
and is the charge under the cap?

Mitigation toggles, each recalculating the model: local-assembly share;
naira-denominated funding; duty-shock reserve; charge indexed to the
tariff.

### 3.6 Charts

- Fund balance over 60 months, base case against stressed.
- Meters installed per year.
- Funding sources per year (stacked bar).

Plain titles, axes with units, nothing that needs hovering.

## 4. Where the first meters go: DT planner (M3, synthetic network)

- Every DT ranked by revenue recovered per naira spent, from unmetered
  customers, estimated-billing exposure and losses on the DT. The weights
  are shown. Each row shows its inputs and which are missing; a DT with no
  boundary meter has its loss shown as "not available", never 0.
- The revolving effect: cumulative recovered revenue against cumulative
  CAPEX, ranked order against a fixed random order, same budget.
- A year-by-year rollout that can feed the Metering Fund: the user can use
  the DT plan's cash flows in place of the fund model's averages.
- Every figure is marked synthetic: it comes from the demonstration network.

## 5. Who pays, and is it fair: equity view (M4)

- The charge as a share of the bill by band (A to E).
- Vulnerable and lifeline customers exempt, and the public money needed to
  cover them.
- The fairness rule stated on screen: every customer, on a free meter or a
  paid one, pays the same charge under the same cap.
- A mini-grid case: the same charge rule, lower consumption, user inputs.

## 6. About this build (M4)

`/dashboard/planning/about-this-build`: what existed at `geh-baseline` and
what was built in the sprint (from `CHANGELOG-GEH.md`, with times), and a
link to https://github.com/feexie/gridintel/compare/geh-baseline...geh-sprint.

## 7. Estimated billing and the metering gap (used by M2)

From the earlier national view, kept:

- Unmetered customers = active customers − metered customers.
- Net backlog change per month = customer growth − meters installed.
- Months to meter everyone = unmetered ÷ (meters installed − customer
  growth). If meters installed ≤ customer growth, the gap never closes and
  the screen says so ("At this pace the metering gap does not close"), with
  no number of months.
- Required pace to meter everyone in 60 months = unmetered ÷ 60 + customer
  growth, per month.
- Assumption, stated on screen: every unmetered customer receives an
  estimated bill each month, so each meter installed removes 12 estimated
  bills a year once in place. Estimated bills a year are shown by scenario
  and year, labelled modelled. Estimated bills to metered customers (missed
  readings) are not included, and the screen says so.

## 8. How it is built

- Methodology in `src/analytics`: pure, versioned, tested with fixed inputs.
- Services in `src/services` return view models with `sourcing`. Every
  figure is labelled records (synthetic), reported (source and date) or
  assumption. Missing is shown as missing, never 0.
- Screens display only. No number is typed into a page; headline figures
  come from the service.
- The assumptions are carried in the page address, so a scenario can be
  reloaded and filmed exactly. The planner pages are rendered on request.
- Presentation mode (`?present=1`) hides the navigation and enlarges the
  headline figures.
- Under each headline, a "How this is calculated" line states the formula
  in words. The method is transparent and deterministic; it is never called
  AI.

## 9. Not in the sprint

The seven planned planners, optimisation beyond a ranked rollout, a DisCo's
own operational records (the DT planner runs on the synthetic network), and
any live price, tariff or exchange-rate feed.

## 10. Sources

Supplied by the Founder, 30 October 2026; cited on screen with their dates.

| Ref | Source | Date | Used for |
| --- | --- | --- | --- |
| S1 | AllAfrica / Vanguard, https://allafrica.com/stories/202610220636.html | 22 Oct 2026 | PMI total, funding, implementer; 750,000 meters in 2027 (citing NERC's factsheet) |
| S2 | Nigeria Startup Act, https://www.nigeriastartupact.ng/fg-pmi-trainees-to-install-750000-meters-in-2027-see-details/ | 16 Oct 2026 | 750,000 meters in 2027; gives as its source NERC's metering factsheet of 14 Oct 2026 (the factsheet behind the 63.1% / 4.7m figures). When the factsheet is found on nerc.gov.ng, NERC is cited as the primary source and the press articles as secondary |
| S3 | Mondaq summary, https://www.mondaq.com/nigeria/oil-gas-electricity/1488638/ | not recorded | NERC/2024/040: MAP prices deregulated from 1 May 2024 |
| S4 | The Guardian (Nigeria), https://guardian.ng/?p=2393191 | 2024 | Eko DisCo MAP vendor price ranges (reference only) |
| S5 | ThisDay, https://www.thisdaylive.com/2026/10/15/nerc-metering-rate-now-63-1-4-7m-customers-still-without-devices/ | 15 Oct 2026 | MAP's 120-month refund and 10-day installation, as reported citing NERC (comparison only) |
| B15 | GEH Brief 15, "Meter every customer", and its references | — | Test scenario; December 2025 metering (6.97m of 12.16m, 57.27%); DisCo losses Q4 2025; estimated-billing complaints 2020; mini-grid meter cost |
