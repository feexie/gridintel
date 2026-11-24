import type { PlannedCommunity, ReferenceBasis } from "@/domain";
import { MINIGRID_DEMAND_REFERENCE } from "../../analytics/planning/minigrid/demand.ts";
import { MINIGRID_PUE_GAP_REFERENCE } from "../../analytics/planning/minigrid/pueGap.ts";
import { LEAD_ACID, LITHIUM_IRON_PHOSPHATE, MINIGRID_SIZING_REFERENCE } from "../../analytics/planning/minigrid/sizing.ts";
import { MINIGRID_SUBSIDY_GAP_REFERENCE } from "../../analytics/planning/minigrid/subsidyGap.ts";
import type { MinigridPlanFigure } from "./minigridViews.ts";

/* ==========================================================
   SERVICES — PLANNING: THE MINI-GRID PLANNER'S INPUTS

   Every input the mini-grid methods take, held once with its status
   and its source or basis (docs/design/MG-PLAN.md 3.3), on the
   pattern of emobilityInputs.ts. Defaults are the methods' own
   parameters, read from them, so a value lives in one place. The
   reference figures are calculated on the reference sites'
   published data, each with the sites it rests on.
========================================================== */

/** What the planner is asked for; null where the planner has not given a figure. */
export interface MinigridPlanSettings {
  /** ₦ a day. No reliable reference exists (RMG01 Caveats C22). */
  opexPerDay: number | null;
  /** ₦; null to use a reference site's 2019 build cost, scaled. */
  capexNgn: number | null;
  /** Factor bringing 2019 prices to today; null until the planner states one. */
  capexToToday: number | null;
  /** ₦/kWh the subsidy gap is worked at. */
  tariff: number;
  /** The planner's own tariff elasticity; null for none. */
  userElasticity: number | null;
  periodYears: number;
  returnPerYear: number;
}

export const DEFAULT_PLAN_SETTINGS: MinigridPlanSettings = {
  opexPerDay: null,
  capexNgn: null,
  capexToToday: null,
  tariff: 350,
  userElasticity: null,
  periodYears: 10,
  returnPerYear: 0,
};

const demand = MINIGRID_DEMAND_REFERENCE.parameters;
const sizing = MINIGRID_SIZING_REFERENCE.parameters;
const pue = MINIGRID_PUE_GAP_REFERENCE.parameters;
const subsidy = MINIGRID_SUBSIDY_GAP_REFERENCE.parameters;

const pct = (share: number, digits = 0) => `${(share * 100).toFixed(digits)}%`;
const naira = (value: number, digits = 0) => `₦${value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const list = (values: readonly (number | null)[], format: (value: number) => string) => values.map((value) => (value === null ? "no figure" : format(value))).join(", ");

export function minigridInputs(community: PlannedCommunity, bases: readonly ReferenceBasis[], settings: MinigridPlanSettings): MinigridPlanFigure[] {
  const sites = bases.map((basis) => basis.siteCode).join(", ");
  const n = `${bases.length} reference site${bases.length === 1 ? "" : "s"} (${sites})`;
  const each = (label: string, pick: (basis: ReferenceBasis) => string) => bases.map((basis) => `${basis.siteCode}: ${pick(basis)}`).join("; ") || label;
  const capex = bases.find((basis) => basis.capex !== null)?.capex ?? null;
  return [
    { key: "siteMeterDay", label: "Site kWh per reporting meter-day, years 1 to 5, P50 and P90", value: each("no reference", (basis) => `P50 ${list(basis.siteKwhPerMeterDay.p50, (v) => v.toFixed(3))}; P90 ${list(basis.siteKwhPerMeterDay.p90, (v) => v.toFixed(3))}`), status: "calculated", basis: `Calculated on reported data, ${n}: the day's sum of the meters ÷ meters reporting (Site_Daily), across each year of operation, with the days left out listed.` },
    { key: "classFactor", label: "Class factors (share of energy ÷ share of meter-days), years 1 to 5", value: each("no reference", (basis) => `residential ${list(basis.classFactor.residential, (v) => v.toFixed(2))}; non-residential ${list(basis.classFactor.non_residential, (v) => v.toFixed(2))}`), status: "calculated", basis: `Calculated on reported data, ${n} (Meter_Daily). Customers with no class in the source are residential, as the dataset's authors counted them.` },
    { key: "classP90", label: "Class P90 meter-day, for the no-diversity upper bound only", value: each("no reference", (basis) => `residential ${basis.classP90MeterDay.residential?.toFixed(2) ?? "no figure"} kWh, non-residential ${basis.classP90MeterDay.non_residential?.toFixed(2) ?? "no figure"} kWh`), status: "calculated", basis: `Calculated on reported data, ${n} (Meter_Daily). Never the design day.` },
    { key: "ramp", label: "Connection ramp, years 1 to 5", value: each("no reference", (basis) => list(basis.ramp, (v) => v.toFixed(2))), status: "calculated", basis: `Calculated on reported data, ${n}: accounts created to the end of the year ÷ accounts with a year created (Customers).` },
    { key: "buying", label: "Buying customers ÷ accounts, years 1 to 5", value: each("no reference", (basis) => list(basis.buyingShare, (v) => v.toFixed(2))), status: "calculated", basis: `Calculated on reported data, ${n}: customers who bought credit in the year ÷ accounts created to date (Payments, PAY; Customers). It stands in for "retention" and is not called that.` },
    { key: "customers", label: "Customers by class in the planned community", value: `${community.customers.residential} residential, ${community.customers.non_residential} non-residential`, status: "synthetic", basis: "The planner's figure; here a synthetic community." },
    { key: "losses", label: "Losses", value: pct(demand.losses), status: "assumption", basis: `The reference meter gap (${each("none", (basis) => (basis.meterGap ? `${pct(basis.meterGap.low, 1)} to ${pct(basis.meterGap.high, 1)}` : "no figure"))}) is shown beside it and not used: it includes unmetered own use and theft.` },
    { key: "uplift", label: "Suppressed-demand uplift", value: demand.suppressedDemandUplift === 1 ? "Off (1.0)" : String(demand.suppressedDemandUplift), status: "assumption", basis: "Supply of 10 to 12 hours a day was reported at RMG01 in May 2023. Shown as a separate line, never in the P50." },
    { key: "sun", label: "Peak sun hours, average and rainy season", value: `${community.solar.averagePeakSunHours} average, ${community.solar.rainySeasonPeakSunHours} in ${community.solar.rainySeasonMonth}`, status: "reported", basis: "NASA POWER climatology at the planned site, as EMOB-A. A reference site with its location withheld has none." },
    { key: "pr", label: "PV performance ratio", value: String(sizing.performanceRatio), status: "assumption", basis: "As EMOB-A." },
    { key: "battery", label: "Battery chemistry, depth of discharge, round-trip efficiency", value: `${LEAD_ACID.name} ${LEAD_ACID.depthOfDischarge} / ${LEAD_ACID.roundTripEfficiency}; ${LITHIUM_IRON_PHOSPHATE.name} ${LITHIUM_IRON_PHOSPHATE.depthOfDischarge} / ${LITHIUM_IRON_PHOSPHATE.roundTripEfficiency}`, status: "assumption", basis: `The chemistry is an input (here ${sizing.chemistry.name}). Lithium iron phosphate as EMOB-A.` },
    { key: "nightShare", label: "Night share of daily energy", value: pct(sizing.nightShare), status: "assumption", basis: "The reference data has daily values only (RMG01 Caveats C06)." },
    { key: "oversized", label: "Oversized threshold", value: `${pct(sizing.oversizedThreshold)} at year 1 P50`, status: "assumption", basis: "Year-1 P50 utilisation below it flags the system oversized, with the year and why." },
    { key: "tariffs", label: "Tariff options", value: `${each("none", (basis) => basis.tariffs.map((tariff) => naira(tariff)).join(", "))}${settings.tariff ? `; the gap worked at ${naira(settings.tariff)}` : ""}`, status: "reported", basis: "The reference sites' tariffs as reported (RMG01's change dates are approximate), and the planner's own." },
    { key: "elasticity", label: "Tariff elasticity", value: settings.userElasticity === null ? "−1 (fixed budget) and each reference change's own; no user figure" : `−1, each reference change's own, and the planner's ${settings.userElasticity}`, status: "assumption", basis: "The fixed budget is an assumption; each change's own e is calculated on reported use, with its confounders. Where the changes disagree, the range and never a single figure." },
    { key: "capex", label: "Reference capex", value: capex ? `${naira(capex.totalNgn, 2)} (${capex.priceYear}) by category` : "No reference build cost", status: "reported", basis: "RMG01 CAPEX, actual costs (Caveats C21): storage, generation, distribution and metering, and the other costs." },
    { key: "capexToToday", label: "Capex scaling to today", value: settings.capexToToday === null ? "Not set" : `× ${settings.capexToToday}`, status: settings.capexToToday === null ? "placeholder" : "assumption", basis: "The planner's factor bringing 2019 prices to today. No subsidy gap from a reference cost is given until it is set." },
    { key: "opex", label: "Opex a day", value: settings.opexPerDay === null ? "Not set" : naira(settings.opexPerDay), status: settings.opexPerDay === null ? "placeholder" : "assumption", basis: "No reliable reference (RMG01 Caveats C22): never RMG01's figure alone. No subsidy gap is given until it is set." },
    { key: "period", label: "Period, return", value: `${settings.periodYears} years, ${pct(settings.returnPerYear)} a year`, status: "assumption", basis: `Years after year 5 hold year 5; ${subsidy.daysPerYear} days a year, ${subsidy.daysPerMonth} days a month.` },
    { key: "target", label: "Target utilisation", value: pct(pue.targetUtilisation), status: "assumption", basis: "For the productive-use gap." },
    { key: "equipment", label: "Productive equipment kW and hours", value: "Examples", status: "assumption", basis: "Illustration only; never the community's demand." },
  ];
}
