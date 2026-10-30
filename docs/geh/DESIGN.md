# Planning: design for the Global Energy Hackathon sprint

Design text only. Nothing here is built at tag `geh-baseline`. Today
`/dashboard/planning` is a "planned" page that holds no data and no figure.

Sprint: Friday 30 October 2026, 17:00 WAT, to Sunday 1 November 2026,
18:00 WAT. **Only the Metering planner is built in the sprint.** Every other
item below is labelled **Planned** and shows no figure.

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

The other seven planners, optimisation beyond a ranked rollout, real DisCo
data, and any external price or tariff feed.
