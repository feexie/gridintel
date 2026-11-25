import type { PlannedCommunity, ReferenceBasis } from "@/domain";
import type { Methodology } from "../../analytics/core/methodology.ts";
import { demandFromReference, MINIGRID_DEMAND_REFERENCE } from "../../analytics/planning/minigrid/demand.ts";
import { MINIGRID_PUE_GAP_REFERENCE, pueGap } from "../../analytics/planning/minigrid/pueGap.ts";
import { MINIGRID_REFERENCE_BASIS, referenceBasisFrom } from "../../analytics/planning/minigrid/reference.ts";
import { MINIGRID_SIZING_REFERENCE, sizeSystem } from "../../analytics/planning/minigrid/sizing.ts";
import { capexFactorsToToday, type CapexFactors, MINIGRID_SUBSIDY_GAP_REFERENCE, scaleReferenceCapex, subsidyGapScenarios } from "../../analytics/planning/minigrid/subsidyGap.ts";
import { MINIGRID_TARIFF_RESPONSE_REFERENCE, tariffResponse } from "../../analytics/planning/minigrid/tariff.ts";
import type { PlannedCommunityRepository } from "../../repositories/ports/minigridPlanning.ts";
import type { ReferenceSiteRepository } from "../../repositories/ports/reference.ts";
import { attributionOf } from "../minigrid/reference.ts";
import { DEFAULT_PLAN_SETTINGS, minigridInputs, type MinigridPlanSettings } from "./minigridInputs.ts";
import type { MinigridMethodView, MinigridPlanFigure, MinigridPlanView } from "./minigridViews.ts";

/* ==========================================================
   SERVICES — PLANNING: THE MINI-GRID PLANNER (Phase MG-PLAN-A)

   A plan for a community from the reference sites: demand, the
   system, utilisation, the tariff response, the subsidy gap and the
   productive-use gap (docs/design/MG-PLAN.md 3). The community is
   the organization's record (synthetic in the demonstration); the
   benchmarks are real, published reference data, credited and with
   the number of sites they rest on. No route, screen or menu entry
   uses it yet: the screens follow NAV-B.
========================================================== */

/** What each method may not be read as claiming (MG-PLAN.md 3.4). */
export const NOT_CLAIMED: { method: string; claims: string }[] = [
  { method: "Demand", claims: "True or unconstrained demand; a load profile; that the no-diversity upper bound is a P90 or a design day; anything beyond 5 years; that the class split is the source's own." },
  { method: "Sizing", claims: "An hour-by-hour dispatch or a loss-of-load probability; a cost; an EPC design; anything for a site without coordinates." },
  { method: "Tariff response", claims: "A price elasticity measured at one site as a general law; an effect on collection or revenue at RMG01; a figure where the events disagree." },
  { method: "Subsidy gap", claims: "A grant amount, a programme's eligibility, a lender's decision; an opex from RMG01; today's cost from 2019 prices without the planner's price change and rate; from the fixed-budget gap, anything about tariffs." },
  { method: "Productive-use gap", claims: "That a productive user exists or would pay; the equipment as demand." },
  { method: "All", claims: "A benchmark from one site called typical; any figure without the number of reference sites it rests on." },
];

const methodView = <P>(method: Methodology<P>): MinigridMethodView => ({ id: method.id, version: method.version, name: method.name, disclaimer: method.disclaimer });
const kwh = (value: number | null, digits = 2) => (value === null ? "No figure" : `${value.toFixed(digits)} kWh`);
const pct = (value: number | null, digits = 1) => (value === null ? "No figure" : `${(value * 100).toFixed(digits)}%`);
const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-GB")}`;
const months = (value: number | null) => (value === null ? "Never" : `${value.toFixed(1)} months`);

/** The reference sites as planning bases; a site whose records give none is left out. */
export async function referenceBases(repo: ReferenceSiteRepository): Promise<ReferenceBasis[]> {
  const bases: ReferenceBasis[] = [];
  for (const site of await repo.sites()) {
    const records = await repo.records(site.id);
    const basis = records === null ? null : referenceBasisFrom(records);
    if (basis) bases.push(basis);
  }
  return bases;
}

/** The plan for one community on the given reference bases. */
export function minigridPlan(community: PlannedCommunity, bases: readonly ReferenceBasis[], settings: MinigridPlanSettings = DEFAULT_PLAN_SETTINGS) {
  const demand = demandFromReference(community, bases);
  // What happened at the reference sites, year by year: a labelled scenario, never the default.
  const asHappened = demandFromReference(community, bases, { ...MINIGRID_DEMAND_REFERENCE.parameters, basis: "as_happened" });
  const sizing = sizeSystem(demand, { average: community.solar.averagePeakSunHours, rainySeason: community.solar.rainySeasonPeakSunHours });
  const productiveUse = sizing === null ? null : pueGap(demand, sizing);
  // The tariff response is worked from year 2's P50 at the tariff the demand basis was served at (₦165 at RMG01).
  const firstTariff = demand.servedAtTariff ?? bases[0]?.tariffs[0] ?? settings.tariff;
  const baseKwh = demand.years[1]?.p50 ?? null;
  const tariffs = [...new Set([...bases.flatMap((basis) => basis.tariffs), settings.tariff])].sort((a, b) => a - b);
  const tariff = baseKwh === null ? null : tariffResponse({ baseKwh, baseTariff: firstTariff, tariffs, userElasticity: settings.userElasticity, bases });
  const connections = community.customers.residential + community.customers.non_residential;
  const reference = bases.find((basis) => basis.capex !== null)?.capex ?? null;
  // No factor to today until both the planner's price change and today's rate are set: never a silent 0%.
  const toToday: CapexFactors | null =
    reference === null || settings.ngnPerUsdToday === null || settings.equipmentPriceChange === null ? null : capexFactorsToToday(reference.ngnPerUsd, settings.ngnPerUsdToday.rate, settings.equipmentPriceChange);
  const scaled = reference === null || sizing === null ? null : scaleReferenceCapex(reference, { pvKwp: sizing.pvKwp, batteryKwh: sizing.batteryKwh, connections }, toToday);
  const capexNgn = settings.capexNgn ?? scaled?.today?.totalNgn ?? null;
  // The planned tariff acts only through the tariff response, from the tariff demand was served at, under each
  // tariff scenario side by side: the fixed budget (the middle case), each usable reference change, the user's.
  const baseTariff = demand.servedAtTariff ?? settings.tariff;
  const gaps =
    capexNgn === null || settings.opexPerDay === null
      ? null
      : subsidyGapScenarios(
          { capexNgn, demand, demandCase: "p50", losses: MINIGRID_DEMAND_REFERENCE.parameters.losses, tariff: settings.tariff, opexPerDay: settings.opexPerDay.ngn, periodYears: settings.periodYears, returnPerYear: settings.returnPerYear, connections },
          baseTariff,
          tariff?.scenarios ?? [{ kind: "fixed_budget", label: "Fixed budget (e = −1), the middle case", elasticity: -1, middle: true }],
        );
  return { demand, asHappened, sizing, productiveUse, tariff, scaledCapex: scaled, toToday, capexNgn, gaps, baseTariff, connections };
}

export async function minigridPlanView(communities: PlannedCommunityRepository, references: ReferenceSiteRepository, settings: MinigridPlanSettings = DEFAULT_PLAN_SETTINGS): Promise<MinigridPlanView | null> {
  const [community] = await communities.communities();
  if (!community) return null;
  const bases = await referenceBases(references);
  const plan = minigridPlan(community, bases, settings);
  const { demand, sizing, productiveUse, tariff, gaps } = plan;
  const sites = `${demand.sitesLabel}: ${bases.map((basis) => basis.siteCode).join(", ")}`;
  const referenceSources = await references.sources();

  const sizingFigures: MinigridPlanFigure[] = sizing
    ? [
        { key: "pv", label: "PV", value: `${sizing.pvKwp.toFixed(2)} kWp`, status: "calculated", basis: `For the design day, on ${community.solar.averagePeakSunHours} sun hours (NASA POWER) at PR ${MINIGRID_SIZING_REFERENCE.parameters.performanceRatio}; ${sites}.` },
        { key: "battery", label: "Battery", value: `${sizing.batteryKwh.toFixed(2)} kWh, ${sizing.chemistry}`, status: "calculated", basis: "The design day's night share ÷ depth of discharge." },
        { key: "pvEnergy", label: "PV energy on an average day", value: kwh(sizing.pvEnergyAverageKwh), status: "calculated", basis: "kWp × sun hours × PR." },
        { key: "rainy", label: `Rainy season (${community.solar.rainySeasonMonth})`, value: `PV makes ${pct(sizing.rainySeason.pvEnergyShare)} of what the design day needs and serves ${pct(sizing.rainySeason.servedShare)} of it; ${kwh(sizing.rainySeason.shortfallKwh)} short`, status: "calculated", basis: `On ${community.solar.rainySeasonPeakSunHours} sun hours: the day share first, then the battery at its round-trip efficiency.` },
      ]
    : [];

  const gapFigures: MinigridPlanFigure[] = [];
  const scaledCapex = plan.scaledCapex;
  if (scaledCapex) {
    const factors = scaledCapex.toToday;
    gapFigures.push({
      key: "scaledCapex",
      label: scaledCapex.label,
      value: scaledCapex.today === null ? `${naira(scaledCapex.atPriceYear.totalNgn)} at ${scaledCapex.priceYear} prices; not brought to today` : naira(scaledCapex.today.totalNgn),
      status: scaledCapex.today === null ? "placeholder" : "calculated",
      basis: `The reference build cost scaled: storage per kWh, generation per kWp, distribution and metering per connection (${naira(scaledCapex.perConnectionNgn)} a meter bought, ${scaledCapex.connectionsBasis.meters} meters${scaledCapex.perAccountNgn === null ? "" : `; ${naira(scaledCapex.perAccountNgn)} over the ${scaledCapex.connectionsBasis.accounts} accounts, shown beside it`}, at ${scaledCapex.priceYear} prices), the other costs in proportion${factors === null ? "; not brought to today until the equipment price change and today's ₦ a US dollar are set" : `; to today × ${factors.storage.toFixed(2)} storage, × ${factors.generation.toFixed(2)} generation, × ${factors.distributionAndMetering.toFixed(2)} distribution and metering, × ${factors.other.toFixed(2)} other (${naira(scaledCapex.atPriceYear.totalNgn)} at ${scaledCapex.priceYear} prices)`}.`,
    });
  }
  const gapScenarios = (gaps ?? []).map((one) => {
    const result = one.result;
    const negative = result.netRevenueNgn !== null && result.netRevenueNgn < 0;
    return {
      label: one.label,
      elasticity: one.elasticity.toFixed(2),
      middle: one.middle,
      gap: {
        key: `gap:${one.kind}`,
        label: `Subsidy gap, ${one.label}`,
        value: result.gapNgn === null || result.gapPerConnectionNgn === null ? "No figure" : `${naira(result.gapNgn)}, ${naira(result.gapPerConnectionNgn)} a connection`,
        status: result.gapNgn === null ? ("not_available" as const) : ("calculated" as const),
        basis: `Capex − net revenue over ${settings.periodYears} years at ${naira(settings.tariff)}/kWh, P50, the tariff acting through e = ${one.elasticity.toFixed(2)} from ₦${plan.baseTariff}; opex ${naira(settings.opexPerDay?.ngn ?? 0)} a day (${settings.opexPerDay?.source ?? ""})${negative ? `; net revenue is below zero (${naira(result.netRevenueNgn ?? 0)}), so the gap exceeds the capex` : ""}. Display only: not a grant amount.`,
      },
      repay: { key: `repay:${one.kind}`, label: "Months to repay from net revenue", value: `${months(result.monthsToRepay.atZero)} at 0%; ${months(result.monthsToRepay.atReturn)} at ${pct(result.monthsToRepay.returnPerYear, 0)} a year`, status: "calculated" as const, basis: "On year 5's net revenue a day, with the shared loan arithmetic." },
      note: one.note,
    };
  });
  if (gaps === null) {
    const unset = [
      settings.opexPerDay === null ? "opex a day (no reliable reference exists)" : null,
      plan.capexNgn === null ? "capex, or both the equipment price change since 2019 (in US dollar terms) and today's ₦ a US dollar to bring the reference cost to today" : null,
    ].filter(Boolean);
    gapFigures.push({ key: "gap", label: "Subsidy gap", value: "Not calculated", status: "placeholder", basis: `Not calculated until set: ${unset.join("; ")}.` });
  }

  const citations = await communities.citations();
  return {
    community: { id: community.id, name: community.name, customers: `${community.customers.residential} residential, ${community.customers.non_residential} non-residential`, point: `${community.latitude}° N, ${community.longitude}° E`, status: "synthetic" },
    references: sites,
    inputs: minigridInputs(community, bases, settings),
    demand: {
      label: demand.label,
      rows: demand.years.map((one) => ({
        year: `Year ${one.year}`,
        p50: kwh(one.p50),
        p90: kwh(one.p90),
        noDiversityUpperBound: kwh(one.noDiversityUpperBound),
        p50WithUplift: one.p50WithUplift === null ? null : kwh(one.p50WithUplift),
        ramp: one.ramp === null ? "No figure" : one.ramp.toFixed(2),
        buyingShare: one.buyingShare === null ? "No figure" : one.buyingShare.toFixed(2),
      })),
      scenario: {
        label: plan.asHappened.scenarioLabel ?? "",
        rows: plan.asHappened.years.map((one) => ({ year: `Year ${one.year}`, p50: kwh(one.p50), p90: kwh(one.p90) })),
      },
      exclusions: demand.exclusions,
      notes: demand.notes,
      method: methodView(MINIGRID_DEMAND_REFERENCE),
    },
    sizing: sizing
      ? {
          designDay: `Year ${sizing.designDay.year}, diversified ${sizing.designDay.case.toUpperCase()}: ${kwh(sizing.designDay.kwh)} a day`,
          figures: sizingFigures,
          utilisation: sizing.utilisation.map((one) => ({ year: `Year ${one.year}`, p50: pct(one.p50), p90: pct(one.p90) })),
          oversized: sizing.oversized?.reason ?? null,
          method: methodView(MINIGRID_SIZING_REFERENCE),
        }
      : null,
    productiveUse:
      productiveUse && productiveUse.productiveKwhPerDay !== null
        ? {
            figure: { key: "pue", label: `Daytime productive load to reach ${pct(productiveUse.target, 0)} in year ${productiveUse.year}`, value: `${kwh(productiveUse.productiveKwhPerDay)} a day`, status: "calculated", basis: "Target × PV energy on an average day − what the demand needs from PV; direct from PV, no battery (an assumption)." },
            examples: productiveUse.examples.map((one) => `${one.name}: ${one.kwhPerDay} kWh a day (illustration only)`),
            method: methodView(MINIGRID_PUE_GAP_REFERENCE),
          }
        : null,
    tariff: {
      base: tariff ? `From year 2's P50, ${kwh(tariff.baseKwh)} a day, at ₦${tariff.baseTariff}/kWh, the tariff the demand basis was served at` : "No figure",
      scenarios: (tariff?.scenarios ?? []).map((scenario) => ({
        label: scenario.label,
        elasticity: scenario.elasticity.toFixed(2),
        middle: scenario.middle,
        rows: scenario.rows.map((row) => ({ tariff: `₦${row.tariff}`, kwhPerDay: kwh(row.kwhPerDay), revenuePerDay: naira(row.revenuePerDay) })),
        confounders: scenario.change ? [`Before ${scenario.change.before} (${scenario.change.days.before} days); after ${scenario.change.after} (${scenario.change.days.after} days).`, ...scenario.change.confounders] : [],
      })),
      range: tariff ? `e = ${tariff.range.low.toFixed(2)} to ${tariff.range.high.toFixed(2)}` : "No figure",
      notUsable: (tariff?.unusable ?? []).map((one) => ({
        label: one.label,
        elasticity: `${one.elasticity >= 0 ? "+" : ""}${one.elasticity.toFixed(2)}`,
        reason: one.reason,
        confounders: one.change ? [`Before ${one.change.before} (${one.change.days.before} days); after ${one.change.after} (${one.change.days.after} days).`, ...one.change.confounders] : [],
      })),
      note: tariff?.note ?? null,
      method: methodView(MINIGRID_TARIFF_RESPONSE_REFERENCE),
    },
    subsidyGap: { figures: gapFigures, scenarios: gapScenarios, method: methodView(MINIGRID_SUBSIDY_GAP_REFERENCE) },
    notClaimed: NOT_CLAIMED,
    attribution: referenceSources.map(attributionOf),
    sourcing: {
      synthetic: true,
      sources: [...(await communities.sources()), ...referenceSources].map((source) => ({ id: source.id, name: source.name, kind: source.kind })),
      citations: citations.map((citation) => ({ id: citation.id, title: citation.title, url: citation.url })),
    },
  };
}

/** The methods the planner rests on, with their versions. */
export const MINIGRID_PLANNING_METHODS = [MINIGRID_REFERENCE_BASIS, MINIGRID_DEMAND_REFERENCE, MINIGRID_SIZING_REFERENCE, MINIGRID_TARIFF_RESPONSE_REFERENCE, MINIGRID_SUBSIDY_GAP_REFERENCE, MINIGRID_PUE_GAP_REFERENCE].map((method) => ({ id: method.id, version: method.version }));
