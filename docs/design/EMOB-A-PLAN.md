# EMOB-A plan: the e-mobility engine

Status: draft for the Founder's approval. No code is written until it is approved.
Branch: `phase-emob-a`, from `main` at 0045ec6. 14 November 2026.

EMOB-A builds the engine only: domain types, five methods, a synthetic dataset on the
Savanna demonstration network, and services that answer the five questions with sourcing.
It adds no screen, no route and no navigation entry. Screens are EMOB-B, after NAV-B.

## 1. What the engine answers

| # | Question | Method | Answer, per hub or area |
| --- | --- | --- | --- |
| 1 | Demand | `demand.ts` | Vehicles, swaps a day, kWh a day and charging kW at 0, 12, 24 and 48 months, under slow, base and fast adoption |
| 2 | Sites and headroom | `headroom.ts` | The DT that supplies the hub, its headroom in kVA, the feeder's band and hours of supply, and whether the hub fits now and at 12, 24 and 48 months |
| 3 | Power source | `powerSource.ts` | Cost per kWh and per swap on grid with diesel backup, diesel only, solar + BESS and hybrid; diesel litres a day; CO2 avoided; payback against diesel (only once costs are supplied) |
| 4 | Finance | `swapFinance.ts` | Pledges matched to hubs (hubs and their batteries only), repaid from the per-swap add-on into escrow; months to repay at each funder's return; money that cannot be placed is queued |
| 5 | Verify | service only | Swaps, energy and uptime against plan for installed hubs; synthetic until a pilot |

`siteScore.ts` ranks candidate hubs from the answers to 2 and 3.

## 2. Inputs, with status and source

Every input is held once, with its status and source, in the inputs table of
`src/services/planning/emobilityInputs.ts` (the same pattern as the Metering Fund's
`assumptions.ts`). Methods take the values as parameters. Nothing is hard-coded in a method.

| Input | Value | Status | Source or basis |
| --- | --- | --- | --- |
| Swap price | ₦3,000 a swap | Reported | TechCabal, 30 July 2026 (a Lagos swap operator's published price) |
| Add-on to recover the asset | ₦1,000 a swap | Reported | Same article |
| Diesel price | ₦1,750 a litre | Reported | Same article |
| Diesel yield | 3 kWh a litre | Assumption | Typical small generator at part load; to confirm with an operator |
| **Diesel cost per kWh** | **₦583.33/kWh** | **Calculated** | ₦1,750 ÷ 3 kWh a litre (`powerSource.ts`) |
| Band A tariff | ₦209.50/kWh | Reported | NERC September 2026 tariff orders, Table 3, non-MD class; already held in `src/repositories/published/nerc.ts` and read from there, not retyped |
| Bands B to E tariffs | per DisCo | Reported | Same orders, same file; used when a hub sits on a feeder of that band |
| Battery, motorcycle | 3 kWh | Assumption | To confirm with an operator |
| Battery, tricycle | 5 kWh | Assumption | To confirm with an operator |
| Charging efficiency | 90% | Assumption | Charger and battery losses |
| **kWh drawn per swap** | **3.33 kWh (motorcycle), 5.56 kWh (tricycle)** | **Calculated** | Battery ÷ charging efficiency |
| Swaps a day per hub | 300 | Assumption | The demonstration hub; each synthetic hub states its own figure |
| **Energy a day, demonstration hub** | **1,000 kWh** (300 motorcycle swaps) | **Calculated** | 300 × 3 kWh ÷ 0.9 |
| Peak sun hours | 4.5 h a day | Assumption | Northern Nigeria is higher, the south lower; one figure for EMOB-A |
| PV performance ratio | 0.80 | Assumption (new; see open question 3) | Losses from heat, dust, wiring and the inverter |
| BESS depth of discharge | 90% | Assumption (new; see open question 3) | Lithium iron phosphate |
| Diesel CO2 | 2.68 kg a litre | Standard factor | IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.2: gas/diesel oil 74,100 kg CO2/TJ, net calorific value 43.0 TJ/Gg, at a density of 0.84 kg/L. Written out in the method so the arithmetic can be checked |
| PV and BESS installed cost | **not set** | **Placeholder** | Until the Founder supplies an EPC quote. Every figure that needs it (solar and hybrid cost per kWh, payback) is `null` with the reason "placeholder: no EPC quote", never 0 |
| Hub cost (swap cabinets and battery stock) | per synthetic hub | Synthetic | Needed to match pledges; labelled synthetic; replaced by an operator's figure at a pilot |
| Adoption, slow / base / fast | 15% / 35% / 60% a year growth in vehicles served | Assumption | Each stated on its own line; never shown as a forecast (open question 2) |
| Swaps a vehicle a day | 1.5 (motorcycle), 2 (tricycle) | Assumption | Commercial riders; to confirm with an operator |
| Hub charging window | the feeder's hours of supply on grid; 14 h a day off grid | Assumption | Operating day of a hub |
| Existing load growth on a DT | 5% a year | Assumption | Applied to the DT's observed peak at 12, 24 and 48 months |
| Hub load power factor | 0.95 | Assumption | Modern chargers with power-factor correction |
| Hub charging coincides with the DT's evening peak | yes | Assumption, stated as the cautious case | A hub that can be shown to charge off-peak gets more room; not modelled in EMOB-A |
| DT rating | per DT | Synthetic | Demonstration network registry |
| DT observed peak | per DT | Calculated, on synthetic telemetry | `peakLoading` over the demonstration month (loading methodology, unchanged) |
| DT loading threshold | the loading methodology's own threshold | Calculated rule | `LOADING_REFERENCE`, unchanged |
| Feeder band | A, B, C, D | Synthetic classification | Registry |
| Feeder hours of supply | about 21.5 / 17.7 / 13.8 / 9.3 h a day (Market Road, Government Avenue, Old Town, Farm Road) | Calculated, on synthetic outages | `calculateSupplyHours`, unchanged; the band is never read as hours |
| Band minimum hours | 20 / 16 / 12 / 8 / 4 | Reported | NERC Service-Based Tariff, already in `SUPPLY_HOURS_REFERENCE` |
| Spiro swaps and states | about 84,000 swaps; Ogun, Lagos, Oyo, Benue | Reported, reference only | edgeX, 9 October 2026. Held as a reported figure for context; used in no calculation |

The figures marked calculated above are what the methods will give with these inputs; the
tests fix them.

## 3. Files

```text
src/domain/emobility.ts                         types only
src/analytics/planning/loan.ts                  shared loan arithmetic (moved, see section 5)
src/analytics/planning/emobility/demand.ts      gridintel.planning.emobility-demand 0.1.0
src/analytics/planning/emobility/headroom.ts    gridintel.planning.emobility-headroom 0.1.0
src/analytics/planning/emobility/powerSource.ts gridintel.planning.emobility-power-source 0.1.0
src/analytics/planning/emobility/swapFinance.ts gridintel.planning.emobility-swap-finance 0.1.0
src/analytics/planning/emobility/siteScore.ts   gridintel.planning.emobility-site-score 0.1.0
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
`SwapBattery` (segment, kWh); `Hub` (id, kind "swap" | "charging", operator, DT id, location,
segment mix, planned swaps a day, status "candidate" | "planned" | "installed", provenance);
`HubOperator`; `HubPledge` (funder kind, amount, return, tenor, areas); `SwapRecord` (hub, day,
swaps, kWh, minutes available). Buses and cars are types only in EMOB-A: no input in the brief
gives them a battery or a usage figure, so they carry no figure (open question 1).

**`demand.ts`.** `projectDemand(start, curve, months)` → for each horizon: vehicles served,
swaps a day (vehicles × swaps a vehicle a day), kWh a day (swaps × battery ÷ efficiency) and
charging kW (kWh ÷ charging window hours). Growth is compound: `start × (1 + rate)^(months/12)`.
By state and DisCo: the synthetic dataset has one DisCo and one area, so EMOB-A aggregates by
hub, feeder and DisCo; "by state" works once a dataset has more than one.

**`headroom.ts`.** For a hub on a DT at each horizon:
`DT load = observed peak kVA × (1 + growth)^(months/12)`;
`hub kVA = hub charging kW ÷ power factor`;
`fits = DT load + hub kVA ≤ rating × loading threshold`;
`headroom kVA = rating × threshold − DT load` (may be negative). Grid-only charging also needs
time: `fits on hours = hub kWh a day ≤ min(charger kW, headroom kW) × feeder hours of supply`.
The result names which limit fails: "DT rating", "supply hours", or both. A DT with no observed
peak (no telemetry) gives `null` headroom with that reason, not a fit.

**`powerSource.ts`.** For one hub's kWh a day and the feeder's hours and tariff:
- Grid with diesel backup: the grid supplies what fits in its hours and headroom; diesel the
  rest. Cost per kWh is the energy-weighted blend; per swap is cost per kWh × kWh drawn per swap.
- Diesel only: ₦1,750 ÷ 3 = ₦583.33/kWh; litres a day = kWh ÷ 3.
- Solar + BESS: PV kWp = kWh a day ÷ (peak sun hours × performance ratio); BESS kWh = the
  energy charged outside sun hours ÷ depth of discharge. Sizes are calculated; cost per kWh and
  payback are `null` ("placeholder: no EPC quote") until the cost is supplied.
- Hybrid: grid in supply hours, solar in the day, diesel for what is left; its diesel part is
  calculated now, its total cost waits for the EPC quote.
- Diesel litres avoided and CO2 avoided (litres × 2.68 kg) for each option against diesel only.
- Payback against diesel = installed cost ÷ (diesel cost a day − option cost a day) ÷ 30.4;
  `null` while the cost is a placeholder, or when the option saves nothing.

**`swapFinance.ts`.** Per hub: charge a day into escrow = add-on × swaps a day; months to repay
the hub's cost at a funder's return = the shared `monthsToRepayWithReturn`. Matching: pledges
ordered as the Marketplace orders them (lowest return first, then fewest areas, then id); each
pledge funds hubs it is allowed to (area, tenor long enough at its return) in hub-id order;
whatever it cannot place is queued, and unfunded hubs are listed as waiting. Hubs only;
rider and vehicle finance are out of scope (Founder, 5 November 2026).

**`siteScore.ts`.** No weighted score, so no invented weights. Candidates are ordered by:
fits on grid at 24 months (yes first), then cost per swap of the cheapest option that can be
costed, then headroom left at 24 months, then id. Each rank carries the reason it sits there.

## 5. Reuse, and keeping Metering's results identical

- **Loan arithmetic.** `monthsToRepay`, `monthsToRepayWithReturn` and `repaymentSchedule` move
  to `src/analytics/planning/loan.ts`, taking `daysPerMonth` as a parameter.
  `marketplace.ts` keeps its exported names and signatures and passes its own 30.4, so every
  caller and every Marketplace result is unchanged. Its methodology version stays 0.3.0, since
  its results do not change.
- **Pledge ordering.** The comparator (lowest return, fewest areas, id) moves to `loan.ts` and
  both matchers use it. `matchPledges` itself stays as it is: it is built on bands and DisCos,
  and generalising it is not safe for little gain.
- **DT loading and hours of supply.** The service reads the existing `assetLoading` (peak over
  the demonstration month) and `calculateSupplyHours`; neither method changes.
- **DT sequencing** is not reused: it ranks DTs for metering by recovered revenue, which has no
  e-mobility meaning.
- **Proof.** The Marketplace and Metering unit tests pass unchanged, and `npm run geh:figures`
  shows all 101 figures unchanged.

## 6. The synthetic dataset

`src/repositories/demo/emobility.ts`, on the existing Savanna Electricity Distribution network,
every record with synthetic provenance (`demoProvenance`), invented names only, no real company.

- **Operators:** two invented operators ("Northfield Swap Co-operative", "Riverside Battery
  Exchange").
- **Hubs:** about six, each placed on a real DT of the demonstration network. The DTs are
  picked to show one case each, the same way the network's two overloaded DTs were designed:
  - a hub that fits now and at 48 months (Market Road, Band A);
  - a hub that **fits now but not at 24 months** under base adoption;
  - a hub on Farm Road (Band D, about 9.3 h a day) with **too few hours for grid-only charging**;
  - a hub on DT-OLD-2, already overloaded, that does not fit now;
  - one installed hub with swap records, for Verify;
  - the demonstration hub, 300 swaps a day.

  The exact DTs are chosen once the engine gives each DT's headroom. If no DT gives a case,
  I will report it and not change an assumption to make it appear.
- **Pledges:** three or four, including one that **cannot place its money** (its tenor is too
  short at its return for any hub), which ends queued.
- **Swaps:** 30 days of daily swap records for the installed hub, seeded (`seeded("emobility")`),
  with a few days of reduced uptime from the feeder's own outages.

## 7. Services

`src/services/planning/emobility.ts` returns one view model per question, each with `sourcing`.
Any result built on a synthetic record is marked synthetic. Each figure carries its status
(reported, calculated, assumption, placeholder, synthetic) and a "How this is calculated" line.
No KPI is left for a screen to compute. Services receive the repositories; the composition root
picks the demo adapter.

## 8. Tests (fixed inputs)

- `demand`: compound growth at 12, 24, 48 months for each curve; kWh per swap 3.33 and 5.56;
  1,000 kWh a day for 300 motorcycle swaps.
- `headroom`: **a hub that fits a DT now but not at 24 months**; a DT with no observed peak
  gives `null`, not a fit; **a feeder with too few supply hours for grid-only charging**, with
  the reason "supply hours".
- `powerSource`: diesel ₦583.33/kWh and 333.3 litres a day for 1,000 kWh; CO2 893 kg a day;
  solar cost and payback `null` with no EPC cost; **diesel against solar + BESS once a cost is
  supplied** (a test-only cost, never shipped as a figure); the grid-plus-backup blend.
- `swapFinance`: months to repay at 0% and at a return; **a pledge that cannot place its money
  (queued)**; ordering matches the Marketplace rule.
- `siteScore`: ordering and reasons; an option with no cost never ranks as cheapest.
- `loan`: the moved functions give the same numbers as before; Marketplace tests unchanged.
- Repository: every record is synthetic; no real company name appears (checked against a list).
- Service: every figure has a status; synthetic sourcing propagates.

## 9. What stays untouched

No screen, route, navigation entry, Marketplace or Metering result, network record, outage,
telemetry, loading or supply-hours method. No new dependency, service or integration.
Nothing from the private business model canvas (prices, revenue, partners, positioning) enters
the repository; only the input figures the brief lists.

## 10. Checks and stopping

Per the Founder's instructions for this laptop: one check at a time (`typecheck`, `test`,
`lint`, then `build` with `test:e2e:local`, then `build:tenant` with `test:e2e:tenant`), ports
3210 to 3214 cleared first, never the full verify locally. CI runs `npm run verify` once the
billing lock is cleared. Commits after each passing step, pushed.

Order: domain and `loan.ts` move → `demand` → `headroom` → `powerSource` → `swapFinance` →
`siteScore` → dataset → services → docs. Then stop at the checkpoint with the methods, their
tests and the key figures they give.

## 11. Open questions for the Founder

1. **Buses and cars.** The brief lists them under Demand, but no input gives their battery or
   use. Recommendation: types only in EMOB-A, no figures, until you supply the inputs.
2. **Adoption curves.** 15% / 35% / 60% a year are my placeholders for slow / base / fast. Do you
   have figures or a source you prefer?
3. **Two inputs not in the brief:** PV performance ratio 0.80 and BESS depth of discharge 90%.
   Without them a 1,000 kWh hub sizes to 222 kWp; with them to about 278 kWp. Recommendation:
   keep both, stated as assumptions. The canvas's "about 220 kWp" is a rough figure; I will not
   tune to it.
4. **Hub cost.** The brief has no figure for swap cabinets and battery stock, which the matcher
   needs. Recommendation: a synthetic figure per hub, labelled synthetic, until an operator
   gives one.
5. **Diesel CO2 citation.** IPCC 2006 defaults as above. Is that the source you want cited?
