# Planning: design for the Global Energy Hackathon sprint

Design text only. Nothing here is built at tag `geh-baseline`. Today
`/dashboard/planning` is a "planned" page that holds no data and no figure.

Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026,
18:00 WAT. **Only the Metering planner is built in the sprint:** the DT
planner on the synthetic network (2.1 to 2.3) and the national / DisCo view
on NERC's published figures (2.5). Every other item below is labelled
**Planned** and shows no figure.

## 1. Structure of the Planning section

Planning is a sector with the same structure as the others (ADR 0017), split
by who is planning.

| Group | Planner | Status |
| --- | --- | --- |
| Utility planning | **Metering** | **Built in the sprint** |
| Utility planning | Distribution transformers (DT) | Planned |
| Utility planning | Feeders | Planned |
| Utility planning | Network expansion | Planned |
| Mini-grid planning | Unserved | Planned |
| Mini-grid planning | Underserved | Planned |
| Mini-grid planning | Productive use of energy (PUE) | Planned |
| Mini-grid planning | E-mobility | Planned |

Each planned planner keeps a page that states its purpose and that it is
not built, like the sector pages today.

## 2. The Metering planner

**Question it answers.** Which distribution transformers should a DisCo
meter first, how fast can it close its metering gap over five years, what
does that cost, and who pays?

### 2.1 Inputs

Every input has an origin. Inputs from records come from the existing
utility services, with their sourcing; inputs the user sets are
assumptions and are shown as assumptions, never as measured values.

| Input | Origin | Notes |
| --- | --- | --- |
| Customers, per DT | Records (service points and the network hierarchy) | Counted per DT from the topology; where a count is estimated the planner says so |
| Metered share, per DT | Records (each service point's meter, or none) | Unmetered connections are counted as unmetered, not as zero consumption |
| Estimated-billing exposure, per DT | Records (bills on the `estimated` basis) | Customers and energy billed on estimates in the chosen period |
| Losses, per DT | Calculated (energy account, where the DT has a boundary meter) | Where a DT has no boundary meter the loss is "not available", never 0 |
| Meter unit cost (NGN) | Assumption, set by the user | Per meter type (single-phase, three-phase), installed; no default is presented as a market price |
| Rollout capacity | Assumption, set by the user | Meters installed per year, or a budget per year |
| Funding split | Assumption, set by the user | See "Who pays" |

### 2.2 Outputs

| Output | What it is |
| --- | --- |
| DT-by-DT priority ranking | Every DT ranked by a stated, deterministic score: unmetered customers, estimated-billing exposure and losses on the DT. The weights are shown; each row shows its inputs and which are missing |
| 5-year rollout plan | Meters to install per year, assigned to DTs in ranking order within the capacity or budget set |
| Metered share by year | The share of customers metered at the end of each year, starting from the share in the records |
| Estimated bills removed | Per year, the estimated bills that would no longer be issued, counted from the estimated-basis bills in the records |
| CAPEX | Meters times unit cost, per year and in total, in NGN |
| Payback | Years until the change in revenue recovers the CAPEX. The direction of the change is not assumed: replacing an estimate with a reading can raise or lower a bill. Where the records cannot support a figure the planner says "insufficient data" |
| Who pays | CAPEX split by the funding sources the user sets (for example the DisCo, a Meter Asset Provider, the customer, a programme or donor), as amounts per year. The split is an assumption, not a statement of any scheme's rules |

### 2.3 Layering

- The scoring, rollout and payback are a new, versioned methodology in
  `src/analytics`: pure and deterministic, tested with fixed inputs.
- A planning service in `src/services` reads the records through the
  existing repository ports and returns a view model with `sourcing`. On the
  demonstration dataset every result is marked synthetic and shown as such.
- The screen formats and displays. It calculates nothing.
- User assumptions travel with the result, so the plan states the unit
  cost, capacity and funding split it was built on.

### 2.4 Not in the sprint

The other seven planners, optimisation beyond a ranked rollout, a DisCo's
own operational records (the DT planner stays on the synthetic network),
and any live price or tariff feed.

### 2.5 National / DisCo view (real public data)

The DT planner (2.1 to 2.3) runs on the synthetic network. This view does
not: it runs on **NERC's published metering figures**, per DisCo and
nationally. Every figure carries its source (the NERC publication, with
its title and address) and its date (the period it covers and the date it
was published). Figures are entered as reported (`ReportedKpi`), never as
measured, and the view is labelled as public reported data, apart from the
synthetic screens. A figure NERC does not publish for a period is shown as
missing, never as 0.

**Inputs, per DisCo and per period**

| Input | Origin |
| --- | --- |
| Active customers | NERC, reported |
| Metered customers | NERC, reported |
| Meters installed that month | NERC, reported |
| Metering rate | NERC, reported; shown beside the rate calculated from the two counts above, as separate figures |

Unmetered customers = active customers − metered customers (calculated).
Customer growth per month = the change in active customers between
consecutive periods (calculated). Where a period is missing, growth over
the gap is not spread across it; the view says the figure is unavailable.

**Calculation** (a versioned methodology in `src/analytics`, deterministic)

- Net backlog change per month = customer growth − meters installed.
- Months to meter everyone = unmetered ÷ (meters installed − customer
  growth).
- If meters installed ≤ customer growth, the gap never closes. The view
  says so in words ("At this pace the metering gap does not close") and
  shows no number of months.
- Required pace: meters to install per month to meter everyone within 60
  months = unmetered ÷ 60 + customer growth.
- The pace and growth used are stated with the periods they were taken
  from (for example the average of the latest N months, N shown).

**Scenarios**

| Scenario | Installs per month | Status |
| --- | --- | --- |
| Current pace | From the NERC figures, as above | Calculated from reported figures |
| Current pace + Presidential Metering Initiative (PMI) | Current pace plus 750,000 meters in 2027; later years user-set, default 0 | Reported facts and stated assumptions, below |
| User-set pace | Set by the user | Assumption |

**The PMI scenario.** Facts as reported (each shown with its source and
date; reported in the press, not taken from a NERC or government document):

- The programme totals about 3.8 million meters, funded with N700bn via
  FAAC in 2024, and is implemented by PMI-Smart Grid Development Limited.
  Source [S1].
- Per NERC's metering factsheet as reported there, distribution starts in
  2027 with 750,000 meters. Sources [S1], [S2].

Phasing beyond 2027 and the split between DisCos are not published
consistently, so the scenario rests on three assumptions, each stated on
the screen:

- The 750,000 meters of 2027 are installed evenly over its 12 months
  (62,500 a month).
- They are shared across DisCos in proportion to each DisCo's unmetered
  customers at the start of 2027.
- PMI meters in 2028 and later are set by the user; the default is 0. The
  remainder of the reported 3.8 million is not assumed to arrive.

**Estimated billing**

- Assumption, stated on the screen: every unmetered customer receives an
  estimated bill each month, so each meter installed removes 12 estimated
  bills a year once in place (counted from the month after installation).
- Reported: estimated bills a year, by scenario and by year. The figure is
  labelled modelled, from this assumption, not a count of bills issued.
  Estimated bills to metered customers (missed readings) are not included,
  and the view says so.

**Who pays and affordability**

| Route | Who pays the meter | How |
| --- | --- | --- |
| MAP (Meter Asset Provider) | The customer, upfront | Refunded as energy credits over 120 months (as reported [S5]) |
| MAF / DISREP | No charge to the customer | Funded by the programme |

- The cost per meter under each route, per year and in total, by scenario.
- **There is no single regulated MAP price.** MAP meter prices were
  deregulated by NERC Order NERC/2024/040, effective 1 May 2024 (as
  summarised in [S3]).
- Unit prices are user assumptions. The defaults are the midpoints of the
  ranges below, and the range is shown beside each default:

  | Meter | Range (VAT inclusive) | Default (midpoint) |
  | --- | --- | --- |
  | Single-phase | N122,000 to N168,000 | N145,000 |
  | Three-phase | N207,000 to N258,000 | N232,500 |

  Label on the screen: "Eko DisCo published MAP vendor prices, 2024; for
  reference, not current market price." Source [S4]. No price is presented
  as a current market price.
- The 120-month energy-credit refund and the rule that a MAP meter is
  installed within 10 days are labelled "as reported" [S5], not as the
  text of the regulation.
- Affordability: the upfront MAP payment and the monthly energy credit per
  customer, from the user's prices, shown beside each other. No household
  income figure is assumed.

**Sources for 2.5** (supplied by the Founder, 30 October 2026; to be cited
on the screen with their dates)

| Ref | Source | Date | Used for |
| --- | --- | --- | --- |
| S1 | AllAfrica / Vanguard, https://allafrica.com/stories/202610220636.html | 22 Oct 2026 | PMI total, funding, implementer; 750,000 meters in 2027 (citing NERC's factsheet) |
| S2 | Nigeria Startup Act, https://www.nigeriastartupact.ng/fg-pmi-trainees-to-install-750000-meters-in-2027-see-details/ | not recorded | 750,000 meters in 2027 |
| S3 | Mondaq summary, https://www.mondaq.com/nigeria/oil-gas-electricity/1488638/ | not recorded | NERC/2024/040: MAP prices deregulated from 1 May 2024 |
| S4 | The Guardian (Nigeria), https://guardian.ng/?p=2393191 | 2024 | Eko DisCo MAP vendor price ranges |
| S5 | ThisDay, https://www.thisdaylive.com/2026/10/15/nerc-metering-rate-now-63-1-4-7m-customers-still-without-devices/ | 15 Oct 2026 | 120-month refund, 10-day installation, as reported citing NERC |

Each source also goes in `DISCLOSURE-DRAFT.md` under "Datasets" when the
view uses it.
