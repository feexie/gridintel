import type { Citation, DiscoId } from "@/domain";
import { EMOBILITY_DEMAND_REFERENCE } from "../../analytics/planning/emobility/demand.ts";
import { EMOBILITY_HEADROOM_REFERENCE } from "../../analytics/planning/emobility/headroom.ts";
import { dieselCostPerKwh, EMOBILITY_POWER_SOURCE_REFERENCE } from "../../analytics/planning/emobility/powerSource.ts";
import { EMOBILITY_SWAP_FINANCE_REFERENCE } from "../../analytics/planning/emobility/swapFinance.ts";
import type { EmobilityFigure } from "./emobilityViews.ts";

/* ==========================================================
   SERVICES — PLANNING: THE E-MOBILITY PLANNER'S INPUTS

   Every input the e-mobility methods take, with its status and its
   source or basis (docs/design/EMOB-A-PLAN.md, section 2). The values
   are the methods' own parameters, read from them, so a value lives
   in one place. Reported figures name their source and date;
   assumptions say so; the PV and BESS cost and the adoption cases
   are placeholders. The diesel price has a base case (NBS) and a low
   case (TechCabal); the grid emission factor is IFI's 2019 dataset.
========================================================== */

const demand = EMOBILITY_DEMAND_REFERENCE.parameters;
const headroom = EMOBILITY_HEADROOM_REFERENCE.parameters;
const power = EMOBILITY_POWER_SOURCE_REFERENCE.parameters;
const finance = EMOBILITY_SWAP_FINANCE_REFERENCE.parameters;

/** The synthetic DisCo lies near Yola, so its hubs take Yola DisCo's tariff order. A dataset assumption. */
export const SYNTHETIC_DISCO_TARIFF_ORDER: DiscoId = "yola";

/** The installed costs of PV and BESS: placeholders (null) until the Founder supplies an EPC quote. */
export const INSTALLED_COSTS = { pvNairaPerKwp: null, bessNairaPerKwh: null } as const;

const TECHCABAL = "Reported: TechCabal, 30 July 2026 (a Lagos swap operator's published figures)";
const EDGEX = "Reported: edgeX, republishing TechCabal, 30 July 2026";
const NBS = "Reported: NBS Diesel Price Watch, May 2026 (published 24 June 2026), average retail price a litre; secondary reporting by Legit.ng and ThisDay";
const IFI = "Reported: IFI Harmonized Grid Emission Factors, v2.0 (July 2019), Nigeria, combined margin, firm energy, 0.395 tCO2/MWh";

/** The documents the planner's reported inputs come from, besides NASA POWER (in the records) and NERC (published figures). */
export const EMOBILITY_INPUT_CITATIONS: Citation[] = [
  {
    id: "nbs-diesel-price-watch-2026-05",
    title: "National Bureau of Statistics, Diesel Price Watch, May 2026 (published 24 June 2026), as reported by Legit.ng",
    url: "https://www.legit.ng/business-economy/energy/1716140-nbs-diesel-price-rises-8640-n3277litre-2026/",
    published: "2026-06-24",
    standing: "secondary",
    locator: "Average retail price of diesel a litre, May 2026: ₦3,277.47. Also reported by ThisDay, 30 June 2026: https://www.thisdaylive.com/2026/06/30/fuel-inflation-persists-as-diesel-soars-86-petrol-climbs-55-kerosene-up-37-in-one-year/",
  },
  {
    id: "techcabal-2026-07-30",
    title: "TechCabal, \"Swap is turning petrol three-wheelers electric—with diesel generators\", 30 July 2026",
    url: "https://techcabal.com/2026/07/30/nigerias-petrol-three-wheelers-are-going-electric-with-batteries/",
    published: "2026-07-30",
    standing: "secondary",
    locator: "Diesel ₦1,750 a litre, bought by a Lagos swap station (date and price checked against the article, 16 November 2026). The swap price and the ₦1,000 a swap toward the rider's loan are cited from edgeX's republication",
  },
  {
    id: "edgex-techcabal-2026-07-30",
    title: "edgeX, republication of TechCabal, \"Swap is turning petrol three-wheelers electric—with diesel generators\", 30 July 2026",
    url: "https://pro.edgex.exchange/en-US/news/article/swap-electric-keke-battery-swap-nigeria",
    published: "2026-07-30",
    standing: "secondary",
    locator: "Standard swap price ₦3,000 (₦2,000 to ₦2,800 also seen); ₦1,000 a swap deducted toward the driver's conversion loan until it is repaid; the Ikorodu station buys about 1,000 litres of diesel every 3 to 4 days (Founder, 17 November 2026)",
  },
  { id: "ifi-harmonized-gef-v2-2019", title: "IFI Technical Working Group on GHG Accounting, Harmonized Grid Emission Factor data set, v2.0, July 2019", url: "https://unfccc.int/sites/default/files/resource/Harmonized_Grid_Emission_factor_data_set.pdf", published: null, standing: "primary", locator: "Nigeria, combined margin, firm energy: 0.395 tCO2/MWh. The dataset dates from 2019." },
];
const IPCC = "IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol. 2";

const naira = (value: number, digits = 0) => `₦${value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function emobilityInputs(): EmobilityFigure[] {
  return [
    { key: "swapPrice", label: "Swap price", value: `${naira(3_000)} standard (${naira(2_000)} to ${naira(2_800)} also seen)`, status: "reported", basis: `${EDGEX}. The standard price is used for the hub's margin a swap.` },
    { key: "riderLoan", label: "Deduction toward the rider's conversion loan", value: `${naira(finance.riderLoanRepaymentPerSwap)} a swap, until the loan is repaid`, status: "reported", basis: `${EDGEX}. Rider loan repayment, never hub revenue: no hub calculation uses it.` },
    { key: "nonEnergyOpex", label: "Non-energy opex a swap", value: `${pct(finance.nonEnergyOpexShare)} of the swap price (${naira(finance.swapPrice * finance.nonEnergyOpexShare)})`, status: "assumption", basis: "Staff, site and battery wear; to confirm with an operator." },
    { key: "hubRepayment", label: "Repayment a swap to a hub's funder", value: `${pct(finance.hubRepaymentShareOfMargin)} of the hub's margin a swap`, status: "calculated", basis: "Margin a swap = swap price − energy cost a swap on the hub's power option − non-energy opex. The share is an assumption. Where the margin is 0 or less the hub cannot repay on that option and no repaid pledge is matched to it." },
    { key: "hubRepaymentShare", label: "Share of the margin paid to a hub's funder", value: pct(finance.hubRepaymentShareOfMargin), status: "assumption", basis: "The rest of the margin is the operator's." },
    { key: "dieselBought", label: "Diesel bought at a Lagos (Ikorodu) swap station", value: "About 1,000 litres every 3 to 4 days", status: "reported", basis: `${EDGEX}. A cross-check only: 250 to 333 litres a day at 3 kWh a litre is 750 to 1,000 kWh a day, the demonstration hub's range.` },
    { key: "dieselPrice", label: "Diesel price, base case", value: `${naira(power.dieselPricePerLitre, 2)} a litre`, status: "reported", basis: `${NBS}.` },
    { key: "dieselLowPrice", label: "Diesel price, low case", value: `${naira(power.dieselLowPricePerLitre)} a litre`, status: "reported", basis: `${TECHCABAL}. The low case.` },
    { key: "dieselYield", label: "Diesel yield", value: `${power.dieselKwhPerLitre} kWh a litre`, status: "assumption", basis: "Small generator at part load; to confirm with an operator." },
    { key: "dieselPerKwh", label: "Diesel cost per kWh, fuel only, base case", value: `${naira(dieselCostPerKwh(), 2)}/kWh`, status: "calculated", basis: "Base diesel price ÷ diesel yield. Fuel only: genset O&M and replacement are excluded." },
    { key: "dieselPerKwhLow", label: "Diesel cost per kWh, fuel only, low case", value: `${naira(dieselCostPerKwh(power, "low"), 2)}/kWh`, status: "calculated", basis: "Low diesel price ÷ diesel yield. Fuel only: genset O&M and replacement are excluded." },
    { key: "gridTariff", label: "Grid tariff", value: "The band of each hub's feeder", status: "reported", basis: "NERC September 2026 tariff orders, Table 3, non-MD class. The synthetic DisCo lies near Yola and takes Yola DisCo's order (a dataset assumption)." },
    { key: "batteryMotorcycle", label: "Battery, motorcycle", value: `${demand.batteryKwh.motorcycle} kWh`, status: "assumption", basis: "To confirm with an operator." },
    { key: "batteryTricycle", label: "Battery, tricycle", value: `${demand.batteryKwh.tricycle} kWh`, status: "assumption", basis: "To confirm with an operator." },
    { key: "soc", label: "State of charge on return", value: pct(demand.stateOfChargeOnReturn), status: "assumption", basis: "A battery comes back a quarter full on average." },
    { key: "efficiency", label: "Charging efficiency", value: pct(demand.chargingEfficiency), status: "assumption", basis: "Charger and battery losses." },
    { key: "swapsPerVehicle", label: "Swaps a vehicle a day", value: `${demand.swapsPerVehicleDay.motorcycle} (motorcycle), ${demand.swapsPerVehicleDay.tricycle} (tricycle)`, status: "assumption", basis: "Commercial riders; to confirm with an operator." },
    { key: "adoption", label: "Adoption, slow / base / fast", value: `${pct(demand.adoptionPerYear.slow)} / ${pct(demand.adoptionPerYear.base)} / ${pct(demand.adoptionPerYear.fast)} a year`, status: "placeholder", basis: "Placeholder scenarios for growth in vehicles served, not forecasts, until adoption figures are supplied." },
    { key: "loadGrowth", label: "Existing load growth on a DT", value: `${pct(headroom.loadGrowthPerYear)} a year`, status: "assumption", basis: "Applied to the DT's observed peak at 12, 24 and 48 months." },
    { key: "powerFactor", label: "Hub load power factor", value: String(headroom.hubPowerFactor), status: "assumption", basis: "Chargers with power-factor correction." },
    { key: "coincidence", label: "Hub charging coincides with the DT's peak", value: "Yes", status: "assumption", basis: "The cautious case; off-peak charging is not modelled." },
    { key: "peakSun", label: "Peak sun hours", value: "Each hub's own, with a rainy-season case", status: "reported", basis: "NASA POWER climatology at the hub (see each hub)." },
    { key: "pr", label: "PV performance ratio", value: String(power.pvPerformanceRatio), status: "assumption", basis: "Losses from heat, dust, wiring and the inverter." },
    { key: "dod", label: "BESS depth of discharge", value: pct(power.bessDepthOfDischarge), status: "assumption", basis: "Lithium iron phosphate." },
    { key: "bessEfficiency", label: "BESS round-trip efficiency", value: pct(power.bessRoundTripEfficiency), status: "assumption", basis: "Applied to the energy that passes through the BESS; PV is sized to make up the loss." },
    { key: "daytimeShare", label: "Daytime charging share", value: pct(power.daytimeChargingShare), status: "assumption", basis: "Share of the day's charging done in sun hours; sizes PV for solar + grid and the BESS." },
    { key: "pvCost", label: "PV and BESS installed cost", value: "Not set", status: "placeholder", basis: "Placeholder until an EPC quote is supplied. No solar cost per kWh and no payback are shown until then." },
    { key: "dieselCo2", label: "Diesel CO2", value: `${power.dieselKgCo2PerLitre} kg a litre`, status: "reported", basis: `${IPCC}, Ch. 2, Table 2.2: 74,100 kg CO2/TJ × 43.0 TJ/Gg × 0.84 kg/L.` },
    { key: "petrolCo2", label: "Petrol CO2", value: `${power.petrolKgCo2PerLitre} kg a litre`, status: "reported", basis: `${IPCC}, Ch. 3, Table 3.2.1: 69,300 kg CO2/TJ × 44.3 TJ/Gg × 0.753 kg/L.` },
    { key: "petrolEconomy", label: "Petrol vehicle fuel economy", value: `${power.petrolKmPerLitre.motorcycle} km a litre (motorcycle), ${power.petrolKmPerLitre.tricycle} (tricycle)`, status: "assumption", basis: "Commercial vehicles in town use." },
    { key: "evRange", label: "Electric vehicle range per kWh", value: `${power.evKmPerKwh.motorcycle} km a kWh (motorcycle), ${power.evKmPerKwh.tricycle} (tricycle)`, status: "assumption", basis: "About 40 and 83 Wh a km." },
    { key: "gridCo2", label: "Grid emission factor", value: `${power.gridKgCo2PerKwh} kg CO2 a kWh`, status: "reported", basis: `${IFI}. The dataset dates from 2019.` },
    { key: "co2Material", label: "Material CO2 difference", value: `More than ±${pct(power.co2MaterialShare)} of the petrol figure`, status: "assumption", basis: "Within it, the result is reported as no material saving under these assumptions, not as a precise figure." },
    { key: "hubCost", label: "Hub cost (swap cabinets and battery stock)", value: "Each hub's own", status: "synthetic", basis: "Synthetic round figures, only to exercise pledge matching. Not investment figures." },
    { key: "spiro", label: "Spiro Nigeria", value: "About 84,000 swaps; Ogun, Lagos, Oyo, Benue", status: "reported", basis: "Reported: edgeX, 9 October 2026. Reference only; used in no calculation." },
  ];
}
