# E-mobility planner: technical design

Technical only. The plan, with every input's status and source, is
`docs/design/EMOB-A-PLAN.md`. EMOB-A built the engine; the screens are EMOB-B.

## Layers

| Layer | File | What it holds |
| --- | --- | --- |
| Domain | `src/domain/emobility.ts` | `VehicleSegment`, `Hub` (with its solar resource and citation), `HubOperator`, `HubPledge`, `HubSwapDay` |
| Analytics | `src/analytics/planning/emobility/` | Six pure methods (below), each named and versioned, with fixed-input tests |
| Shared analytics | `src/analytics/planning/loan.ts` | Months to repay, the repayment schedule and the pledge order, shared with the Metering Marketplace |
| Port | `src/repositories/ports/emobility.ts` | `EmobilityRepository`: hubs, operators, pledges, swap days, citations, sources |
| Adapter | `src/repositories/demo/emobility.ts` | The synthetic dataset on the Savanna network |
| Services | `src/services/planning/emobility.ts`, `emobilityInputs.ts`, `emobilityViews.ts` | The five views, the inputs table, the view-model types |
| Composition | `src/composition/emobility.ts` | Binds the demo adapter, the running network and the NERC tariffs; built once per process |

## Methods

| Method | Version | Does |
| --- | --- | --- |
| `gridintel.planning.emobility-demand` | 0.1.0 | kWh a swap = pack × (1 − state of charge on return) ÷ charging efficiency, full depletion as the upper case; swaps grown at slow, base and fast adoption to 12, 24, 48 months; vehicles served; charging kW |
| `gridintel.planning.emobility-headroom` | 0.1.0 | The DT's observed peak grown a year against rating × the loading threshold, plus the hub's draw at the DT's peak; whether the chargers take the day's energy in the feeder's hours of supply; names the limit that fails |
| `gridintel.planning.emobility-power-source` | 0.1.0 | Grid with diesel backup, diesel, solar + grid, solar + BESS, hybrid on an average and a rainy-season day: energy by source, fuel and tariff cost, diesel litres, CO2 avoided against petrol vehicles, payback against diesel |
| `gridintel.planning.emobility-swap-finance` | 0.1.0 | Per-swap add-on into escrow; months to repay at a funder's return; pledges matched to hubs in the Marketplace's order; unplaced money queued |
| `gridintel.planning.emobility-site-score` | 0.1.0 | Candidate order: fit at 24 months, cheapest costed option, headroom left, id; no weights |
| `gridintel.planning.emobility-verify` | 0.1.0 | An installed hub's swaps, energy and availability against its plan |

## Rules the engine keeps

- Missing is never 0: a DT without an observed peak, a feeder without hours of supply, a band
  without a published tariff, a hub without a cost, and a grid option without a cited emission
  factor all give `null` with the reason.
- Each hub is priced at its own feeder's band tariff (Yola DisCo's order for the synthetic
  DisCo); hours of supply are calculated from the outage log, never read from the band.
- Diesel cost is fuel only. A solar option shows no cost per kWh and no payback until its
  installed cost (an EPC quote) is supplied; the PV and BESS cost is a placeholder.
- PV is sized to the average day; no option is solar every day.
- Hub costs are synthetic and used only by the matcher; they are never investment figures.
- The Metering Marketplace's results are unchanged by the shared loan module (its tests and
  `npm run geh:figures`, all 101 figures unchanged).

## Inputs

Values live once, in the methods' parameters; `emobilityInputs.ts` reads them and attaches each
one's status and source. The NASA POWER peak sun hours are a cited constant in the dataset,
looked up once by hand; nothing calls the API.
