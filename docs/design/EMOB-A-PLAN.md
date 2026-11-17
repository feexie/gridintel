# EMOB-A plan: the e-mobility engine

Status: approved with corrections (Founder, 16 November 2026); the corrections are applied
below. Branch: `phase-emob-a`, from `main` at 0045ec6.

EMOB-A builds the engine only: domain types, five methods, a synthetic dataset on the
Savanna demonstration network, and services that answer the five questions with sourcing.
It adds no screen, no route and no navigation entry. Screens are EMOB-B, after NAV-B.

## 1. What the engine answers

| # | Question | Method | Answer, per hub or area |
| --- | --- | --- | --- |
| 1 | Demand | `demand.ts` | Vehicles, swaps a day, kWh a day and charging kW at 0, 12, 24 and 48 months, under slow, base and fast adoption |
| 2 | Sites and headroom | `headroom.ts` | The DT that supplies the hub, its headroom in kVA, the feeder's band, tariff and hours of supply, and whether the hub fits now and at 12, 24 and 48 months |
| 3 | Power source | `powerSource.ts` | For grid with diesel backup, diesel only, solar + grid, solar + BESS and hybrid: cost per kWh and per swap (fuel and tariff only), diesel litres a day, CO2 avoided against petrol vehicles, payback against diesel (only once costs are supplied) |
| 4 | Finance | `swapFinance.ts` | Pledges matched to hubs (hubs and their batteries only), repaid from a per-swap amount into escrow (not available until a source is cited; the ₦1,000 a swap repays the rider's loan, never the hub); months to repay at each funder's return; money that cannot be placed is queued |
| 5 | Verify | service only | Swaps, energy and uptime against plan for installed hubs; synthetic until a pilot |

`siteScore.ts` ranks candidate hubs from the answers to 2 and 3.

## 2. Inputs, with status and source

Every input is held once, with its status and source, in the inputs table of
`src/services/planning/emobilityInputs.ts` (the same pattern as the Metering Fund's
`assumptions.ts`). Methods take the values as parameters. Nothing is hard-coded in a method.

### Swaps and energy

| Input | Value | Status | Source or basis |
| --- | --- | --- | --- |
| Swap price | ₦3,000 a swap standard (₦2,000 to ₦2,800 also seen) | Reported | edgeX, republishing TechCabal, 30 July 2026 (Founder, 17 November 2026) |
| Deduction toward the rider's conversion loan | ₦1,000 a swap, until the loan is repaid | Reported | edgeX, republishing TechCabal, 30 July 2026. Rider loan repayment, never hub revenue; no hub calculation uses it |
| Repayment a swap to a hub's funder | Not available | Not available | No source cited; escrow and months to repay wait for one (Founder, 17 November 2026) |
| Diesel bought, Ikorodu swap station | About 1,000 litres every 3 to 4 days | Reported | Same article. A cross-check only (750 to 1,000 kWh a day at 3 kWh a litre) |
| Battery, motorcycle | 3 kWh | Assumption | To confirm with an operator |
| Battery, tricycle | 5 kWh | Assumption | To confirm with an operator |
| State of charge on return | 25% | Assumption | A battery comes back a quarter full on average |
| Charging efficiency | 90% | Assumption | Charger and battery losses |
| **kWh drawn per swap** | **2.50 kWh (motorcycle), 4.17 kWh (tricycle)** | **Calculated** | Pack kWh × (1 − state of charge on return) ÷ charging efficiency |
| kWh drawn per swap, upper case | 3.33 kWh (motorcycle), 5.56 kWh (tricycle) | Calculated | Full depletion: pack kWh ÷ charging efficiency |
| Swaps a day per hub | 300 | Assumption | The demonstration hub; each synthetic hub states its own figure |
| **Energy a day, demonstration hub** | **750 kWh base case; 1,000 kWh upper case** | **Calculated** | 300 motorcycle swaps × 2.50 kWh; × 3.33 kWh at full depletion |

### Power sources

| Input | Value | Status | Source or basis |
| --- | --- | --- | --- |
| Diesel price, base case | ₦3,277.47 a litre | Reported | NBS Diesel Price Watch, May 2026 (published 24 June 2026), average retail price (Founder, checkpoint review, 16 November 2026). Linked through secondary reporting: Legit.ng, with ThisDay (30 June 2026) as a second |
| Diesel price, low case | ₦1,750 a litre | Reported | TechCabal, 30 July 2026, "Swap is turning petrol three-wheelers electric—with diesel generators": a Lagos swap station's diesel price. Date and price checked against the article (2026, not 2025); labelled the low case |
| Diesel yield | 3 kWh a litre | Assumption | Small generator at part load; to confirm with an operator |
| **Diesel cost per kWh, fuel only** | **₦1,092.49/kWh base; ₦583.33/kWh low** | **Calculated** | Each price ÷ 3 kWh a litre. Labelled "fuel only": genset O&M and replacement are excluded. Every costed option shows both |
| Grid tariff | the band of each hub's feeder | Reported | NERC September 2026 orders, Table 3, non-MD class, read from `src/repositories/published/nerc.ts`. The synthetic DisCo sits near Yola, so it takes Yola DisCo's order: A ₦209.50, B ₦63.33, C ₦52.51, D ₦50.01 (no Band E in that order). Which order the synthetic DisCo takes is a dataset assumption, stated |
| Grid hours of supply | each hub's feeder | Calculated, on synthetic outages | `calculateSupplyHours`, unchanged: about 21.5 / 17.7 / 13.8 / 9.3 h a day on Market Road (A), Government Avenue (B), Old Town (C), Farm Road (D). The band is never read as hours |
| Band minimum hours | 20 / 16 / 12 / 8 / 4 | Reported | NERC Service-Based Tariff, already in `SUPPLY_HOURS_REFERENCE` |
| Peak sun hours, each hub | 5.73 h a day (annual); 4.73 h (rainy-season case, August) | Reported (satellite climatology) | NASA POWER Climatology API v2.10.1, `ALLSKY_SFC_SW_DWN`, January 2001 to December 2025, at 9.25° N, 12.47° E, retrieved 16 November 2026. Every synthetic hub lies in the same 1° cell, so all take this figure; each hub still carries its own value and source. Horizontal irradiance; tilt gain is not counted. Replaces the brief's 4.5 h assumption |
| PV performance ratio | 0.80 | Assumption | Losses from heat, dust, wiring and the inverter |
| BESS depth of discharge | 90% | Assumption | Lithium iron phosphate |
| Daytime charging share | 50% | Assumption (added in the build) | Share of the day's charging done in sun hours: sizes PV for solar + grid, and the BESS for the energy charged outside sun hours |
| BESS round-trip efficiency | 90% | Assumption (checkpoint review) | Applied to the energy that passes through the BESS: PV makes the daytime share plus the rest ÷ 0.90 |
| PV and BESS installed cost | **not set** | **Placeholder** | Until the Founder supplies an EPC quote. Every figure that needs it (solar options' cost per kWh, payback) is `null` with the reason "placeholder: no EPC quote", never 0 |

### Emissions

| Input | Value | Status | Source or basis |
| --- | --- | --- | --- |
| Diesel CO2 | 2.68 kg a litre | Standard factor | IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.2: gas/diesel oil 74,100 kg CO2/TJ × 43.0 TJ/Gg × 0.84 kg/L. The arithmetic is written out in the method |
| Petrol CO2 | 2.31 kg a litre | Standard factor | IPCC 2006 Guidelines, Vol. 2, Ch. 3, Table 3.2.1: motor gasoline 69,300 kg CO2/TJ × 44.3 TJ/Gg × 0.753 kg/L |
| Petrol motorcycle fuel economy | 40 km a litre | Assumption | Commercial motorcycle in town use |
| Petrol tricycle fuel economy | 30 km a litre | Assumption | Commercial tricycle in town use |
| Electric motorcycle range per kWh | 25 km a kWh | Assumption | About 40 Wh a km |
| Electric tricycle range per kWh | 12 km a kWh | Assumption | About 83 Wh a km |
| Grid emission factor | 0.395 kg CO2 a kWh | Reported | IFI Harmonized Grid Emission Factors v2.0 (July 2019), Nigeria, combined margin, firm energy, 0.395 tCO2/MWh (UNFCCC-hosted data set). The dataset dates from 2019, and the view says so |
| Material CO2 difference | ±10% of the petrol figure | Assumption (checkpoint review) | Within it, the result reads "no material saving under these assumptions", with the vehicles' fuel economy and range beside it, never a precise figure |
| Solar emissions in operation | 0 kg a kWh | Stated rule | Operating emissions only; manufacture is not counted, and the result says so |

Avoided CO2 per swap = petrol the same distance would burn × 2.31 kg − the hub's power-source
emissions for that swap. The distance is the energy the rider uses (pack kWh × (1 − state of
charge on return)) × km a kWh.

### Demand, sites and finance

| Input | Value | Status | Source or basis |
| --- | --- | --- | --- |
| Adoption, slow / base / fast | 15% / 35% / 60% a year growth in vehicles served | Placeholder | Placeholder scenarios, each on its own line; never shown as a forecast |
| Swaps a vehicle a day | 1.5 (motorcycle), 2 (tricycle) | Assumption | Commercial riders; to confirm with an operator |
| Hub charging window | the feeder's hours of supply on grid; 14 h a day off grid | Assumption | Operating day of a hub |
| Existing load growth on a DT | 5% a year | Assumption | Applied to the DT's observed peak at 12, 24 and 48 months |
| Hub load power factor | 0.95 | Assumption | Chargers with power-factor correction |
| Hub charging coincides with the DT's evening peak | yes | Assumption, the cautious case | Off-peak charging is not modelled in EMOB-A |
| DT rating | per DT | Synthetic | Demonstration network registry |
| DT observed peak | per DT | Calculated, on synthetic telemetry | `peakLoading` over the demonstration month (loading methodology, unchanged) |
| DT loading threshold | the loading methodology's own | Calculated rule | `LOADING_REFERENCE`, unchanged |
| Hub cost (swap cabinets and battery stock) | per synthetic hub | **Synthetic** | Needed only to exercise the matcher. Labelled synthetic in the record, the method result and every view model, and never presented as an investment figure |
| Spiro swaps and states | about 84,000 swaps; Ogun, Lagos, Oyo, Benue | Reported, reference only | edgeX, 9 October 2026. Context only; used in no calculation |

## 3. Files

```text
src/domain/emobility.ts                         types only
src/analytics/planning/loan.ts                  shared loan arithmetic (moved, see section 5)
src/analytics/planning/emobility/demand.ts      gridintel.planning.emobility-demand 0.1.0
src/analytics/planning/emobility/headroom.ts    gridintel.planning.emobility-headroom 0.1.0
src/analytics/planning/emobility/powerSource.ts gridintel.planning.emobility-power-source 0.1.0
src/analytics/planning/emobility/swapFinance.ts gridintel.planning.emobility-swap-finance 0.1.0
src/analytics/planning/emobility/siteScore.ts   gridintel.planning.emobility-site-score 0.1.0
src/analytics/planning/emobility/verify.ts      gridintel.planning.emobility-verify 0.1.0 (added in the build: the
                                                Verify sums are a method, not service arithmetic)
  each with a *.test.ts beside it
src/repositories/ports/emobility.ts             EmobilityRepository (records only)
src/repositories/demo/emobility.ts              the synthetic dataset (+ test)
src/services/planning/emobilityInputs.ts        the inputs table of section 2
src/services/planning/emobility.ts              five view models with sourcing (+ test)
src/composition/emobility.ts                    wires the demo adapter; cached once per process
docs/emobility/DESIGN.md                        technical only
```

Existing files touched: `src/analytics/planning/marketplace.ts` (imports the moved loan
functions and re-exports them under the same names), the repositories index, the composition
root, `docs/ROADMAP.md`, `docs/BLUEPRINT.md`. The lint boundaries already cover these folders;
I expect no change to `eslint.config.mjs`, and will not weaken it.

## 4. Method shapes

All pure: no clock, no I/O, no randomness. Every result field that cannot be calculated is
`null` with a reason, never 0.

**Domain (`emobility.ts`).** `VehicleSegment` ("motorcycle" | "tricycle" | "bus" | "car");
`Hub` (id, kind "swap" | "charging", operator, DT id, location, segment mix, planned swaps a
day, peak sun hours with their source, status "candidate" | "planned" | "installed", synthetic
cost, provenance); `HubOperator`; `HubPledge` (funder kind, amount, return, tenor, areas);
`SwapRecord` (hub, day, swaps, kWh, minutes available). Buses and cars are types only in
EMOB-A: no input gives them a battery or a usage figure, so they carry no figure.

**`demand.ts`.** `energyPerSwap(pack, socOnReturn, efficiency)` = pack × (1 − SoC) ÷ efficiency,
with the full-depletion upper case beside it. `projectDemand(start, curve, months)` → for each
horizon: vehicles served, swaps a day (vehicles × swaps a vehicle a day), kWh a day (base and
upper case) and charging kW (kWh ÷ charging window hours). Growth is compound:
`start × (1 + rate)^(months/12)`. The synthetic dataset has one DisCo and one area, so EMOB-A
aggregates by hub, feeder and DisCo; "by state" works once a dataset has more than one.

**`headroom.ts`.** For a hub on a DT at each horizon:
`DT load = observed peak kVA × (1 + growth)^(months/12)`;
`hub kVA = hub charging kW ÷ power factor`;
`fits = DT load + hub kVA ≤ rating × loading threshold`;
`headroom kVA = rating × threshold − DT load` (may be negative). Grid-only charging also needs
time: `fits on hours = hub kWh a day ≤ min(charger kW, headroom kW) × the feeder's hours of
supply`. The result names which limit fails: "DT rating", "supply hours", or both. A DT with no
observed peak gives `null` headroom with that reason, not a fit.

**`powerSource.ts`.** For one hub's kWh a day, its feeder's band tariff and hours of supply, and
its peak sun hours (annual and rainy-season cases). No option assumes 100% solar every day:
solar is sized to the annual figure, and the rainy-season shortfall is met by the option's
backup and shown.
- Grid with diesel backup: the grid supplies what fits in its hours and headroom at the
  feeder's band tariff; diesel the rest.
- Diesel only: ₦1,092.49/kWh fuel only at the base price (₦583.33 at the low price); litres a
  day = kWh ÷ 3.
- Solar + grid: PV kWp = kWh a day ÷ (peak sun hours × performance ratio), less what the grid
  supplies; the grid covers what PV does not, within its hours and headroom; diesel what is left.
- Solar + BESS: PV sized for the whole day's energy, the share charged outside sun hours
  grossed up for the BESS's 90% round-trip efficiency; BESS kWh = energy charged outside sun
  hours ÷ depth of discharge; diesel backup for the rainy-season shortfall.
- Hybrid: solar + BESS + grid, diesel for what is left.
- For each: energy by source (kWh a day), cost per kWh and per swap where it can be costed
  (fuel and tariff only; solar options `null` until the EPC cost, since their backup's fuel
  alone would make them look free; once supplied, shown beside the installed cost and payback),
  at the base and the low diesel price, diesel litres a day, CO2 per swap avoided against petrol
  vehicles (the grid at 0.395 kg a kWh; "no material saving under these assumptions" within
  ±10% of the petrol figure, with the fuel-economy and range assumptions beside it), and payback against diesel = installed cost ÷ (daily diesel fuel cost − the
  option's daily running cost) ÷ 30.4, `null` while the cost is a placeholder or the option
  saves nothing.

**`swapFinance.ts`.** Per hub: charge a day into escrow = hub repayment a swap × swaps a day,
not available while no source for that amount is cited (the ₦1,000 a swap repays the rider's
conversion loan and is never counted as hub revenue; Founder, 17 November 2026), so only a
grant, which is not repaid, can be matched; months to repay
the hub's synthetic cost at a funder's return = the shared `monthsToRepayWithReturn`. Matching:
pledges ordered as the Marketplace orders them (lowest return first, then fewest areas, then
id); each pledge funds hubs it is allowed to (area, tenor long enough at its return) in hub-id
order; whatever it cannot place is queued with the reason (no costed hub on its feeders; tenor
shorter than any hub's payback; every hub it could fund already funded; or the money left less
than any hub it could still fund), and unfunded hubs are listed as waiting. A hub is offered
for funding only on a power option that works at its site through 24 months (checkpoint
review): the grid where it fits; the grid after a DT upgrade, named with the DT and the month
it is needed by, where only the DT rating fails (the upgrade's cost is not in the hub's); solar
+ BESS where the feeder's hours of supply fail, its PV and BESS cost added to the hub's, so it
waits for the EPC quote. No hub is funded on a grid option it fails. Every
figure built on a hub's cost carries the synthetic status. Hubs only; rider and vehicle finance
are out of scope (Founder, 5 November 2026).

**`siteScore.ts`.** No weighted score, so no invented weights. Candidates are ordered by: fits
on grid at 24 months (yes first), then cost per swap of the cheapest feasible option that can be
costed, then headroom left at 24 months, then id; among hubs that do not fit, fewer failed
checks (DT rating, supply hours) come first, then the fewest kVA short, before cost (Founder,
17 November 2026). Where the hub does not fit on the grid at 24
months, the options that draw on the grid are not feasible and never named cheapest: "not
feasible without a DT upgrade (X kVA short)", or "not feasible: too few hours of supply"
(Founder, checkpoint approval, 16 November 2026). Each rank carries the reason it sits there.

## 5. Reuse, and keeping Metering's results identical

- **Loan arithmetic.** `monthsToRepay`, `monthsToRepayWithReturn` and `repaymentSchedule` move
  to `src/analytics/planning/loan.ts`, taking `daysPerMonth` as a parameter. `marketplace.ts`
  keeps its exported names and signatures and passes its own 30.4, so every caller and every
  Marketplace result is unchanged. Its methodology version stays 0.3.0.
- **Pledge ordering.** The comparator (lowest return, fewest areas, id) moves to `loan.ts` and
  both matchers use it. `matchPledges` itself stays as it is: it is built on bands and DisCos.
- **DT loading, hours of supply, tariffs.** The service reads the existing `assetLoading`, the
  reliability service's hours of supply and the published NERC tariffs; no method changes.
- **DT sequencing** is not reused: it ranks DTs for metering by recovered revenue.
- **Proof.** The Marketplace and Metering unit tests pass unchanged, and `npm run geh:figures`
  shows all 101 figures unchanged.

## 6. The synthetic dataset

`src/repositories/demo/emobility.ts`, on the existing Savanna Electricity Distribution network,
every record with synthetic provenance, invented names only, no real company.

- **Operators:** two invented operators.
- **Hubs:** about six, each on a real DT of the demonstration network, each with its peak sun
  hours and their source. The DTs are picked to show one case each, as the network's two
  overloaded DTs were designed:
  - a hub that fits now and at 48 months (Market Road, Band A);
  - a hub that **fits now but not at 24 months** under base adoption;
  - a hub on Farm Road (Band D, about 9.3 h a day) with **too few hours for grid-only charging**;
  - a hub on DT-OLD-2, already overloaded, that does not fit now;
  - one installed hub with swap records, for Verify;
  - the demonstration hub, 300 swaps a day.

  The exact DTs are chosen once the engine gives each DT's headroom. If no DT gives a case,
  I will report it and not change an assumption to make it appear.
- **Hub costs:** synthetic, one per hub, labelled synthetic, used only by the matcher.
- **Pledges:** three or four, including one that **cannot place its money** (its tenor is too
  short at its return for any hub), which ends queued.
- **Swaps:** 30 days of daily swap records for the installed hub, seeded, with a few seeded
  days of reduced availability (the adapter records; it does not read the outage log).
- **As built:** HUB-01 on DT-MKT-8 (fits through 48 months); HUB-02, the demonstration hub, on
  DT-GOV-4 (fits now, not at 24 months); HUB-03 on DT-FRM-1 (too few supply hours); HUB-04 on
  DT-OLD-2 (already over rating); HUB-05 on DT-MKT-1 (installed); HUB-06 on DT-OLD-10
  (tricycles). Picked from the DTs' observed peaks; no assumption was changed.

## 7. Services

`src/services/planning/emobility.ts` returns one view model per question, each with `sourcing`.
Any result built on a synthetic record is marked synthetic. Each figure carries its status
(reported, calculated, assumption, placeholder, synthetic, not available) and a "How this is
calculated" line. Fuel costs say "fuel only". No KPI is left for a screen to compute.

## 8. Tests (fixed inputs)

- `demand`: kWh per swap 2.50 and 4.17 (upper case 3.33 and 5.56); 750 kWh a day for 300
  motorcycle swaps, 1,000 kWh upper case; compound growth at 12, 24, 48 months for each curve.
- `headroom`: **a hub that fits a DT now but not at 24 months**; a DT with no observed peak
  gives `null`, not a fit; **a feeder with too few supply hours for grid-only charging**, with
  the reason "supply hours".
- `powerSource`: diesel ₦1,092.49/kWh (₦583.33 low) fuel only and 250 litres a day for 750 kWh;
  the BESS's round-trip losses in the PV size; no material CO2 saving within ±10%; each hub priced
  at its own band's tariff; solar cost and payback `null` with no EPC cost; **diesel against
  solar + BESS once a cost is supplied** (a test-only cost, never shipped); the rainy-season
  case leaves a shortfall met by backup; avoided CO2 against petrol, and `null` for a grid
  option with no grid factor.
- `swapFinance`: months to repay at 0% and at a return; **a pledge that cannot place its money
  (queued), and the 3-month pledge queued with "tenor shorter than any hub's payback"**; the
  funding basis (grid, grid after a DT upgrade, solar + BESS); ordering matches the Marketplace rule; cost figures carry the synthetic status.
- `siteScore`: ordering and reasons; an option with no cost never ranks as cheapest.
- `loan`: the moved functions give the same numbers as before; Marketplace tests unchanged.
- Repository: every record is synthetic; no real company name appears.
- Service: every figure has a status; synthetic sourcing propagates.

## 9. What stays untouched

No screen, route, navigation entry, Marketplace or Metering result, network record, outage,
telemetry, loading or supply-hours method. No new dependency, service or integration (the
NASA POWER figure was looked up once by hand and is held as a cited constant; nothing calls the
API). Nothing from the private business model canvas enters the repository; only the input
figures the brief lists.

## 10. Checks and stopping

One check at a time (`typecheck`, `test`, `lint`, then `build` with `test:e2e:local`, then
`build:tenant` with `test:e2e:tenant`), ports 3210 to 3214 cleared first, never the full verify
locally. CI runs `npm run verify` once the billing lock is cleared. Commit after each passing
step, pushed.

Order: domain and `loan.ts` move → `demand` → `headroom` → `powerSource` → `swapFinance` →
`siteScore` → dataset → services → docs. Then stop at the checkpoint with the methods, their
tests and the key figures they give.

## 11. Open questions for the Founder

1. **Buses and cars.** Types only, no figures, until inputs are supplied (the plan's
   recommendation; build proceeds on it).
2. **Adoption curves.** Settled at the checkpoint review: 15% / 35% / 60% a year stay as
   labelled placeholder scenarios.
3. **Diesel price source.** Settled: NBS Diesel Price Watch, May 2026, ₦3,277.47 a litre, the
   base case; TechCabal ₦1,750 the low case.
4. **Grid emission factor.** Settled: IFI Harmonized Grid Emission Factors v2.0 (July 2019),
   Nigeria combined margin, firm energy, 0.395 tCO2/MWh, noted as a 2019 dataset.
