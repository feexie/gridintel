# Planning: design for the Global Energy Hackathon sprint

Entry: Brief 15, "Meter every customer" (summary in `BRIEF-15.md`). Track 3,
Business Models & Financing. Setting A, Residential.

Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026, 18:00
WAT. Feature freeze Sunday 01:00 WAT. Baseline: tag `geh-baseline`, commit
`839c5d9`. At the baseline `/dashboard/planning` is a "planned" page with no
data and no figure.

## 0. Positioning (Founder, 30 October 2026, after M2)

GridIntel is the trusted layer between public metering programmes, private
investors and DisCos. It **plans** where meters go, **funds** them through a
protected structure, and **monitors** that the money is working:
Plan → Fund → Monitor. Poor residential customers are never left out.

Each step is paired with the hackathon's three A's (Founder, 31 October
2026), everywhere the steps appear (the positioning strip, the Metering tabs,
the screen eyebrows, About this build): **Plan · Access** (DisCo allocation,
DT sequencing), **Fund · Affordability** (the Metering Fund: the charge under
the cap, band charges, Lifeline exempt, the GridIntel structure), **Monitor ·
Availability** (Monitoring of verified installs, with the five-year rollout
and the estimated bills removed). The positioning line: "Plan for access,
fund for affordability, monitor for availability."

M2's finding is the story. The customer alone cannot carry the meter: the
charge that repays a meter in five years is about five times a 5% cap,
because Bands B to E tariffs have been frozen since December 2022. The public
money needed to hold the charge at the cap (about N408.6bn for Nigeria) is
less than the N700bn already raised for PMI [S1]. No single payer closes the
gap; the right split does.

## 0a. The platform: a meeting place for metering (Founder, 31 October 2026)

GridIntel is a platform as a service for metering, a meeting place in the way
LinkedIn is for work: households, DisCos, programme managers (PMI, DISREP),
the World Bank and DFIs, private investors, meter makers (OEMs) and NERC meet
in one place. Money for metering exists; private money holds back because no
model reliably pays it back. The Marketplace (section 6c) shows the match: each
pledge goes to approved meters whose daily charge repays it within the
funder's tenor.

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

The Metering planner's screens (revised after M2, Founder, 30 October 2026):

| Screen | Step | Milestone | Question it answers |
| --- | --- | --- | --- |
| Metering Fund (fund alone, and the GridIntel structure) | Fund | M2, M2 additions | Can every customer be metered in five years with no upfront payment; what does the customer pay; who tops up; does it survive shocks; are investors protected? |
| DisCo allocation | Plan | M3 | Where should public meters and private capital go first, DisCo by DisCo, on NERC's figures? |
| DT sequencing | Plan | M4 | Inside one DisCo, which DTs first, so early meters fund later ones? (synthetic network) |
| Marketplace · Match | Fund | After M4 | Which funder pays for which approved meters, and what money waits for the next allocation? (synthetic, labelled) |
| Monitoring | Monitor | M4 | Is the money working: plan against actual, quarter by quarter? (synthetic, labelled) |
| About this build | | M4 | What existed at `geh-baseline` and what was built in the sprint |

Equity is not a separate screen: the charge as a share of the bill by band,
the lifeline exemption and the public money that covers it are on the fund
and allocation screens. The same model applies to mini-grids (one line on
screen); there is no separate mini-grid case.

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
| Investor / DFI capital | 100% in USD at 8% a year | Concessional DFI; assumption to verify (Founder, 30 Oct) |
| Naira-funding toggle | Capital in naira at 22% a year | Assumption to verify (Founder, 30 Oct) |
| Charge cap | 5% of the monthly bill | Assumption |
| Monthly bill by band, A to E | Allowed residential tariff × assumed consumption | Tariffs: NERC's September 2026 orders [N3] (reported per DisCo; an average of the 11 for the national and brief cases). Consumption per band: assumption, user-set (A 200, B 150, C 100, D 75, E 50 kWh a month) |
| Inflation passed into tariffs | 0% | NERC's September 2026 orders keep Band A frozen since July 2024 and Bands B to E since December 2022. User-set. The "charge indexed to the tariff" mitigation helps only above 0% |
| Share of customers in each band, A to E | **Placeholders**, shown the same way | The Founder supplies sourced values before recording |
| Collection gain from metering | 15% of the metered customer's billed revenue | Assumption |
| Share of the collection gain paid to the fund | 50% | Assumption |
| Customers who stop buying tokens or fall behind | 10% | Assumption; its effect on the fund is shown |
| Customer growth | 2% a year (brief scenario); from NERC periods (Nigeria case) | Assumption / calculated from reported figures |
| PMI | 750,000 meters in 2027, 62,500 a month, shared by unmetered customers at the start of 2027; later years user-set, default 0 | [S1], [S2]; phasing and share are assumptions |
| DISREP, MAF | User-set, default 0 | Assumption |

### 3.3 Calculation (versioned methodology in `src/analytics`; pure, deterministic)

The rollout runs over five years (60 months). The model runs month by month
over 120 months (the meter life), so the repayment of the last meters is
seen; it reports by year. Charts and the headline stay on the 60-month
rollout. Rules decided by the Founder (30 October):

- **The charge is sized so that each meter is repaid within 60 months of its
  own installation** (Brief 15: cost recovery through energy purchases over
  five years). One line on screen: "Each meter is repaid within 5 years of
  installation; the last meters finish repaying in month [n]."
- **The fund's cash-positive year is shown even if it falls after year 5.**
- **Who pays the charge.** Every customer metered under the scheme pays the
  same charge, on a fund meter or a PMI meter. Customers metered before
  year 1 pay nothing.
- **Charges on PMI meters do not repay investor capital**: those meters were
  publicly funded. They go to the maintenance and replacement reserve and to
  the pool that covers exempt and vulnerable customers. This rule is stated
  on screen.

The exact treatment of the points below is fixed in M2 and stated in the
methodology and on screen:

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

When the charge breaks the cap, a second line says what holding it at the cap
would take: each meter's shortfall (installed cost less what the capped
charge and the collection gain repay in 60 months, at the fund's cost of
capital) and the public money that would close it for all the fund's
meters. The screen's data bar says "PUBLISHED FIGURES AND ASSUMPTIONS"
rather than "SYNTHETIC DATA": the Metering Fund holds no synthetic record.


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

### 3.7 M2 additions: the GridIntel structure

A one-click preset beside the "fund alone" result. Every part is labelled
and editable:

- **Charge as the same percentage of each customer's bill** (default 5%),
  not the same naira amount: one rule for everyone, so higher bands pay more
  naira. Lifeline customers (R1, up to 50 kWh a month, NERC order [N3]) are
  exempt; their share of customers is an assumption.
- **Public top-up** from PMI, DISREP and MAF covering what the charge and
  the collection gain leave unpaid on each meter, paid at installation.
- **Local assembly on; naira-denominated funding with a local-currency
  guarantee** (InfraCredit-type; the guaranteed rate is an assumption);
  **duty-shock reserve on.**
- **First-loss layer:** public or DFI money absorbs the first losses
  (default 10% of capital, user-set).
- **Reserve account:** about 6 months of repayments (user-set).

Headline pair: "Fund alone: N1,286 a month, 5x the cap." against
"GridIntel structure: within the cap for every band; public top-up N[x]bn,
[y]% of the N700bn already raised for PMI; survives [n] of 4 shocks." If the
structure still fails a shock or breaks the cap, the screen says so plainly
and by how much. No assumption is tuned to make it pass.

### 3.8 Investor protection

Text and figures from the model:

- **Split at source:** the meter charge is split at the token vending point
  into a trustee escrow account and never passes through the DisCo's books.
- **Meters owned by the fund vehicle.**
- **First-loss layer** and **reserve account**, as above.
- **Regulatory recognition of the charge** is stated as a requirement, not a
  fact.
- Investor outcome, base and stressed: repaid or not, loss absorbed by the
  first-loss layer and the reserve, IRR and payback (modelled, labelled).
- **Investors never lose more than they put in** (Founder, 31 October 2026;
  method 0.3.0). Investors commit the capital the base case needs (₦63.0bn in
  the Nigeria case); a shock does not make them put in more. A shock's result
  is split: the fund's shortfall at month 120 (cost of capital included); what
  the first-loss layer, then the reserve, take (they protect investors, so
  they pay investors' balance first); investors' loss, never more than their
  capital and its accrued return, shown as capital lost (with its share of
  capital, at most 100%) and return due unpaid; and the rest, uncovered
  beyond investors, which falls to the public side (unless tariffs follow
  inflation, when the shock includes inflation). Money drawn beyond investors
  is owed alongside them at the same cost of capital, and each repayment is
  shared in proportion to what each is owed. The IRR is on investors' own
  cash and is never below -100%. The fund alone follows the same rule, with
  its own base-case capital and no buffers. "Survives" still means the
  buffers cover the whole shortfall, so the count of shocks survived and the
  inflation line do not change.
- **Public money per meter.** All public money in the structure over every
  meter the plan installs (fund and PMI), beside PMI's own figure as
  reported: ₦700bn over 1.1 million meters (GEH Brief 15, citing
  Nairametrics, October 2025) and over 3.8 million meters [S1], shown as a
  range because the sources differ. One line under the structure sentence
  says how many customers the same ₦700bn meters in the structure.

### 3.9 Customer receipt (illustrative)

A small mock-up of a token receipt: "Meter charge paid: N[x]. [n] months
left." Figures from the model, labelled illustrative.

### 3.10 Exchange rate reference

NERC's N1,369/$ (September 2026 orders, Table 1 [N3]) is shown beside the
N1,334 assumption.

## 4. DisCo allocation (M3, real data)

From NERC's Q2 2026 report [N1] (Table 15, Appendix IX), with Q1 [N2]:

- For each of the 11 DisCos: customers, metered, unmetered, share of the
  national gap, metering rate, install pace (2026 Q1 and Q2), months to 100%
  at the current pace. Collection efficiency and losses from the Q2 report
  where published; missing shown as missing.
- Two scores side by side, weights visible and editable:
  - **Need:** share of the gap, metering rate, low-band or residential share.
  - **Repayment risk:** collection efficiency, losses.
- **Recommended split:** public meters weighted to need; private capital
  weighted to low repayment risk at first, widening as the track record
  builds. Compared with today's pro-rata split.
- Headline: "[DisCo] holds [x]% of Nigeria's unmetered customers; at the
  current pace it reaches 100% in [n] months."
- Answers Brief 15's starter question 3: where should the first million
  meters go?
- **Pilot card:** one DisCo (user-set), two feeders, 20,000 meters over 12
  months, installed by NEMSA-certified local installers. Figures from the
  model; labelled a proposal.
- The rule on screen: poor residential customers are never last in the
  queue.

## 5. DT sequencing inside one DisCo (M4, synthetic network)

- Every DT ranked by revenue recovered per naira spent, from unmetered
  customers, estimated-billing exposure and losses on the DT. Weights shown;
  each row shows its inputs and which are missing; a DT with no boundary
  meter has its loss "not available", never 0.
- The revolving effect: cumulative recovered revenue against cumulative
  CAPEX, ranked order against a fixed random order, same budget.
- Every figure is marked synthetic.
- As built (method `gridintel.planning.dt-sequencing` 0.1.0): recovered a
  year = 12 × (estimated billing a month × 15% recovered, the fund's
  collection gain + commercial loss a month × unmetered ÷ connections × 50%
  recovered, an assumption). CAPEX = unmetered × the fund's starting cost of
  a meter. Budget ₦5 million a month (assumption), recoveries reinvested;
  the random order is a fixed shuffle (seed 15). Public meters still go to
  the DTs with most unmetered customers first: this order is for the fund's
  own meters.

## 6. Monitoring (M4, synthetic, labelled)

Plan against actual per DisCo per quarter: meters installed, supply to
metered customers, consumption, charge collected into escrow, investor
repaid to date. One line: tranches are released against verified installs
(results-based). Every figure is synthetic and labelled so.

As built (method `gridintel.planning.monitoring` 0.1.0): the plan is each
DisCo's recommended first million (section 4) spread evenly over 2026 Q3 to
2027 Q2. Actuals are designed records from a synthetic adapter, for 2026 Q3
only (the demonstration clock is 1 October 2026); later quarters show "not
reported", never 0. A tranche releases verified meters × the cost of a
meter; what the plan expected beyond them is held. Planned supply 12 hours a
day (assumption, Band C level); planned consumption 100 kWh a month (the
fund's Band C assumption); planned escrow = planned meters × 1.5 months ×
5% of a Band C bill on the DisCo's tariff.

## 6c. Metering Marketplace (synthetic, labelled)

`/dashboard/planning/metering/marketplace`, tab "Marketplace · Match" (Fund
step), presentation mode supported. Every pledge and application is
synthetic and labelled so; no existing method or figure changes.

- **Funders:** five designed pledges, each with amount, bands, DisCos,
  return and tenor: a Mission 300-style programme (1,000 meters, grant), a
  private capital fund (N150m, Bands A and B, Abuja, Eko, Ikeja, 22%, 36
  months), a DFI with cheaper, longer money (N400m, Bands C to E, 8% in
  dollars, 84 months), a DISREP-style programme (N120m, C to E and Lifeline,
  the four northern DisCos, grant), a second private fund (N80m, Band A,
  Enugu, Ibadan and Port Harcourt, 24%, 24 months).
- **Demand:** approved meter applications by DisCo and band (A single-phase,
  A three-phase, B to E, Lifeline), designed records.
- **Daily meter charge by band** (assumptions): A single-phase N200, A
  three-phase N250, B N150, C N100, D N75, E N50; Lifeline exempt. Taken at
  each recharge, never more than half of the recharge, into escrow; the rest
  carries to the next recharge. Months to repay = installed meter cost ÷
  (charge a day × 30.4). Installed cost from the Metering Fund's defaults
  ($45 single-phase; three-phase hardware $110, assumption).
- **Matching** (method `gridintel.planning.marketplace` 0.1.0, unit-tested):
  pledges cheapest money first (lowest return; then fewer DisCos; then id).
  A pledge funds a band only if its kind allows it (private money Bands A
  and B; DFI money C to E; public money C to E and Lifeline), it lists the
  band and the DisCo, and the band's months to repay fit within its tenor
  (a grant has none; only a grant funds Lifeline). Applications are taken
  poorest band first, then by DisCo. A meter is matched when the pledge has
  its full installed cost left. What a pledge cannot place is "Queued for
  the next allocation"; applications with no funder are "Waiting for a
  funder".
- Headline: "[x] funders have pledged N[y]; [z] approved meters are matched;
  N[w] is queued for the next allocation.", with a "How this is calculated"
  line.

## 6a. About this build (M4)

`/dashboard/planning/about-this-build`: what existed at `geh-baseline` and
what was built in the sprint (from `CHANGELOG-GEH.md`, with times), and a
link to https://github.com/feexie/gridintel/compare/geh-baseline...geh-sprint.

## 6b. The Metering Plan report

`/dashboard/planning/metering/report`, linked as "Download report" from the
tabs of every Metering screen (the Metering Fund's link carries its
assumptions) and from About this build. Built by `meteringPlanReportView`
from the three views the screens show (Metering Fund, DisCo allocation,
Monitoring), so it calculates nothing of its own and every figure keeps its
origin. Sections: the gap; Plan · Access; Fund · Affordability; Monitor ·
Availability (the monitoring figures labelled synthetic); shocks and the
inflation line; assumptions and sources, with the origin labels. It uses
the report system's layout and print stylesheet (ADR 0019): printed, or
saved as PDF from the browser's print dialog. Its figures are the screens'
formatted figures with their origins, not the report system's measured
`MetricView`s, so it has no period, record fingerprint or CSV.

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
  headline figures, on every Metering screen (Metering Fund, DisCo
  allocation, DT sequencing, Monitoring, About this build). Forms and the
  quarter links keep it on.
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
| N1 | NERC, Second Quarter 2026 Report, https://nerc.gov.ng/wp-content/uploads/2026/09/2026_Q2_Report.pdf | 29 Sep 2026 | **Primary.** Table 15 (p. 56): each DisCo's active and metered customers at 30 June 2026 (12,589,486; 7,743,839; 61.51%). Appendix IX (p. 76): meters installed per DisCo, 2026 Q1 (426,985, revised) and Q2 (350,270) |
| N2 | NERC, First Quarter 2026 Report, https://nerc.gov.ng/wp-content/uploads/2026/07/2026_Q1-Report.pdf | 2 Jul 2026 | **Primary.** Table 18 (p. 58): each DisCo's active and metered customers at 31 March 2026 (12,386,848; 7,324,079); used for customer growth |
| N3 | NERC, September 2026 MYTO supplementary orders, one per DisCo, e.g. https://nerc.gov.ng/wp-content/uploads/2026/09/AEDC_HOLDCO_YSS_September_2026_088.pdf | 2 Sep 2026 (effective 1 Sep 2026) | **Primary.** Table 3 (p. 7): allowed residential (non-MD) tariffs per band, for the states NERC still regulates. Band A N209.50 everywhere; YEDC lists no Band E. Lifeline (R1) is up to 50 kWh a month (AEDC Appendix 1, p. 10) |

NERC's metering factsheet of 14 October 2026 was not found on nerc.gov.ng
(30 October 2026). Its August 2026 figures are shown beside the case as
reported in [S5] (63.1%; 8.05m metered of 12.75m; 4,704,224 unmetered;
141,746 newly metered in August), not used in the calculation.
