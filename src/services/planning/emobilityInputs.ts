import type { DiscoId } from "@/domain";
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
   assumptions say so; the PV and BESS cost is a placeholder until an
   EPC quote; the grid emission factor is not available until a
   source is cited.
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
const IPCC = "IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol. 2";

const naira = (value: number, digits = 0) => `₦${value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function emobilityInputs(): EmobilityFigure[] {
  return [
    { key: "swapPrice", label: "Swap price", value: naira(3_000), status: "reported", basis: `${TECHCABAL}. Context only; no method uses it.` },
    { key: "addOn", label: "Add-on to recover the asset", value: `${naira(finance.addOnPerSwap)} a swap`, status: "reported", basis: `${TECHCABAL}. Goes into escrow and repays the hub's funder.` },
    { key: "dieselPrice", label: "Diesel price", value: `${naira(power.dieselPricePerLitre)} a litre`, status: "reported", basis: `${TECHCABAL}. Reported only with this cited, dated source.` },
    { key: "dieselYield", label: "Diesel yield", value: `${power.dieselKwhPerLitre} kWh a litre`, status: "assumption", basis: "Small generator at part load; to confirm with an operator." },
    { key: "dieselPerKwh", label: "Diesel cost per kWh, fuel only", value: `${naira(dieselCostPerKwh(), 2)}/kWh`, status: "calculated", basis: "Diesel price ÷ diesel yield. Fuel only: genset O&M and replacement are excluded." },
    { key: "gridTariff", label: "Grid tariff", value: "The band of each hub's feeder", status: "reported", basis: "NERC September 2026 tariff orders, Table 3, non-MD class. The synthetic DisCo lies near Yola and takes Yola DisCo's order (a dataset assumption)." },
    { key: "batteryMotorcycle", label: "Battery, motorcycle", value: `${demand.batteryKwh.motorcycle} kWh`, status: "assumption", basis: "To confirm with an operator." },
    { key: "batteryTricycle", label: "Battery, tricycle", value: `${demand.batteryKwh.tricycle} kWh`, status: "assumption", basis: "To confirm with an operator." },
    { key: "soc", label: "State of charge on return", value: pct(demand.stateOfChargeOnReturn), status: "assumption", basis: "A battery comes back a quarter full on average." },
    { key: "efficiency", label: "Charging efficiency", value: pct(demand.chargingEfficiency), status: "assumption", basis: "Charger and battery losses." },
    { key: "swapsPerVehicle", label: "Swaps a vehicle a day", value: `${demand.swapsPerVehicleDay.motorcycle} (motorcycle), ${demand.swapsPerVehicleDay.tricycle} (tricycle)`, status: "assumption", basis: "Commercial riders; to confirm with an operator." },
    { key: "adoption", label: "Adoption, slow / base / fast", value: `${pct(demand.adoptionPerYear.slow)} / ${pct(demand.adoptionPerYear.base)} / ${pct(demand.adoptionPerYear.fast)} a year`, status: "assumption", basis: "Growth in vehicles served; each case stated, never a forecast." },
    { key: "loadGrowth", label: "Existing load growth on a DT", value: `${pct(headroom.loadGrowthPerYear)} a year`, status: "assumption", basis: "Applied to the DT's observed peak at 12, 24 and 48 months." },
    { key: "powerFactor", label: "Hub load power factor", value: String(headroom.hubPowerFactor), status: "assumption", basis: "Chargers with power-factor correction." },
    { key: "coincidence", label: "Hub charging coincides with the DT's peak", value: "Yes", status: "assumption", basis: "The cautious case; off-peak charging is not modelled." },
    { key: "peakSun", label: "Peak sun hours", value: "Each hub's own, with a rainy-season case", status: "reported", basis: "NASA POWER climatology at the hub (see each hub)." },
    { key: "pr", label: "PV performance ratio", value: String(power.pvPerformanceRatio), status: "assumption", basis: "Losses from heat, dust, wiring and the inverter." },
    { key: "dod", label: "BESS depth of discharge", value: pct(power.bessDepthOfDischarge), status: "assumption", basis: "Lithium iron phosphate. BESS losses are not counted in 0.1.0." },
    { key: "daytimeShare", label: "Daytime charging share", value: pct(power.daytimeChargingShare), status: "assumption", basis: "Share of the day's charging done in sun hours; sizes PV for solar + grid and the BESS." },
    { key: "pvCost", label: "PV and BESS installed cost", value: "Not set", status: "placeholder", basis: "Placeholder until an EPC quote is supplied. No solar cost per kWh and no payback are shown until then." },
    { key: "dieselCo2", label: "Diesel CO2", value: `${power.dieselKgCo2PerLitre} kg a litre`, status: "reported", basis: `${IPCC}, Ch. 2, Table 2.2: 74,100 kg CO2/TJ × 43.0 TJ/Gg × 0.84 kg/L.` },
    { key: "petrolCo2", label: "Petrol CO2", value: `${power.petrolKgCo2PerLitre} kg a litre`, status: "reported", basis: `${IPCC}, Ch. 3, Table 3.2.1: 69,300 kg CO2/TJ × 44.3 TJ/Gg × 0.753 kg/L.` },
    { key: "petrolEconomy", label: "Petrol vehicle fuel economy", value: `${power.petrolKmPerLitre.motorcycle} km a litre (motorcycle), ${power.petrolKmPerLitre.tricycle} (tricycle)`, status: "assumption", basis: "Commercial vehicles in town use." },
    { key: "evRange", label: "Electric vehicle range per kWh", value: `${power.evKmPerKwh.motorcycle} km a kWh (motorcycle), ${power.evKmPerKwh.tricycle} (tricycle)`, status: "assumption", basis: "About 40 and 83 Wh a km." },
    { key: "gridCo2", label: "Grid emission factor", value: "Not available", status: "not_available", basis: "No cited source is held; grid options show no avoided CO2 until one is." },
    { key: "hubCost", label: "Hub cost (swap cabinets and battery stock)", value: "Each hub's own", status: "synthetic", basis: "Synthetic round figures, only to exercise pledge matching. Not investment figures." },
    { key: "spiro", label: "Spiro Nigeria", value: "About 84,000 swaps; Ogun, Lagos, Oyo, Benue", status: "reported", basis: "Reported: edgeX, 9 October 2026. Reference only; used in no calculation." },
  ];
}
