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
| `gridintel.planning.emobility-power-source` | 0.1.0 | Grid with diesel backup, diesel, solar + grid, solar + BESS, hybrid on an average and a rainy-season day: energy by source, fuel and tariff cost at the base and the low diesel price, diesel litres, CO2 avoided against petrol vehicles (not material within ±10%), payback against diesel; PV sized with the BESS's round-trip losses |
| `gridintel.planning.emobility-swap-finance` | 0.1.0 | Per-swap add-on into escrow; months to repay at a funder's return; the power option a hub is funded on (grid, grid after a DT upgrade, solar + BESS); pledges matched to hubs in the Marketplace's order, never beyond a pledge's tenor; unplaced money queued with its reason |
| `gridintel.planning.emobility-site-score` | 0.1.0 | Candidate order: fit at 24 months, cheapest costed option, headroom left, id; no weights |
| `gridintel.planning.emobility-verify` | 0.1.0 | An installed hub's swaps, energy and availability against its plan |

## Rules the engine keeps

- Missing is never 0: a DT without an observed peak, a feeder without hours of supply, a band
  without a published tariff, a hub without a cost, and a grid option without a cited emission
  factor all give `null` with the reason.
- Diesel has a base case (NBS Diesel Price Watch, May 2026, ₦3,277.47 a litre) and a low case
  (TechCabal, 30 July 2026, ₦1,750); every costed option shows both.
- The grid emission factor is IFI's Harmonized Grid Emission Factors v2.0 (July 2019), Nigeria
  combined margin, firm energy, 0.395 tCO2/MWh; the view notes that the dataset dates from 2019.
- A CO2 difference from petrol within ±10% of the petrol figure reads "no material saving under
  these assumptions", with the vehicles' fuel economy and range beside it.
- A hub is funded only on a power option that works at its site through 24 months: the grid
  where it fits, the grid after a named DT upgrade where only the DT rating fails, solar + BESS
  (waiting for its PV and BESS cost) where the hours of supply fail. No hub is funded on a grid
  option it fails, and no pledge on a hub that cannot repay within its tenor.
- Each hub is priced at its own feeder's band tariff (Yola DisCo's order for the synthetic
  DisCo); hours of supply are calculated from the outage log, never read from the band.
- Diesel cost is fuel only. A solar option shows no cost per kWh and no payback until its
  installed cost (an EPC quote) is supplied; the PV and BESS cost is a placeholder.
- PV is sized to the average day, making up the BESS's 90% round-trip efficiency on the energy
  that passes through it; no option is solar every day.
- Hub costs are synthetic and used only by the matcher; they are never investment figures.
- The Metering Marketplace's results are unchanged by the shared loan module (its tests and
  `npm run geh:figures`, all 101 figures unchanged).

## Inputs

Values live once, in the methods' parameters; `emobilityInputs.ts` reads them and attaches each
one's status and source. The NASA POWER peak sun hours are a cited constant in the dataset,
looked up once by hand; nothing calls the API.
