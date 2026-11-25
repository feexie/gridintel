import type { ReferenceCapex } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { monthsToRepayAt, monthsToRepayWithReturnAt } from "../loan.ts";
import { kwhAtTariff } from "./tariff.ts";
import type { DemandCase, DemandResult } from "./demand.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: THE SUBSIDY GAP
   (gridintel.planning.minigrid-subsidy-gap 0.2.0; MG-PLAN.md 3.2 (4))

   Capex minus net revenue over a stated period, in total and per
   connection. Display only: it is not a grant amount, and matching
   money to it stays with programme finance.

   kWh sold = demand ÷ (1 + losses), at a tariff (with a tariff
   response when one is given); net revenue a day = kWh sold × tariff
   − opex a day; years after year 5 hold year 5. Opex has no reliable
   reference, so it is always the planner's figure or a stated
   assumption.

   The months for net revenue to repay the capex use the shared loan
   arithmetic (analytics/planning/loan.ts) on the last year's net a
   day, at 0% and at a stated yearly return; "never" (null) when it
   does not repay.

   A reference site's 2019 build cost can stand in for capex, scaled:
   storage per kWh, generation per kWp, distribution and metering per
   connection, and the other costs (shared balance of system, soft
   costs) in proportion; then brought to today by a stated factor.
   It is labelled "2019 reference cost, scaled". The per-connection
   rate is on the meters bought, with the accounts in the customer
   file shown beside it.

   The factor to today (Founder, 24 November 2026): the 2019 ₦ to US
   dollars at the source's own rate, × (1 + the change in equipment
   prices since 2019 in US dollar terms), then to ₦ at a current rate
   the planner enters and cites. The change is the planner's, with its
   source; it may be given per category (storage, generation,
   distribution and metering), since battery and module prices moved
   differently from poles and cable. A category without its own figure,
   and the other costs, take the overall change. Until the change and
   the rate are both set there is no factor and no gap: never a silent
   0%.

   Side by side (0.2.0): the gap is worked under each tariff scenario
   the tariff response gives (the fixed budget, e = −1, as the middle
   case; each reference change whose e is not positive; the user's).
   A positive e is never used. At e = −1 revenue does not change with
   the tariff, so that gap is the same at any planned tariff and says
   nothing about tariffs.
========================================================== */

export interface SubsidyGapParameters {
  daysPerYear: number;
  daysPerMonth: number;
}

export const MINIGRID_SUBSIDY_GAP_REFERENCE: Methodology<SubsidyGapParameters> = {
  id: "gridintel.planning.minigrid-subsidy-gap",
  version: "0.2.0",
  name: "GridIntel reference subsidy gap for a planned mini-grid",
  description: "Capex minus net revenue over a period, in total and per connection, under each tariff scenario side by side, with the months net revenue takes to repay the capex at 0% and at a stated return.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { daysPerYear: 365, daysPerMonth: 30.4 },
};

export const SCALED_CAPEX_LABEL = "2019 reference cost, scaled";

export interface SubsidyGapInput {
  capexNgn: number;
  demand: DemandResult;
  demandCase: DemandCase;
  losses: number;
  tariff: number;
  /** When given, kWh sold responds to the tariff from the tariff the demand was served at. */
  tariffResponse: { baseTariff: number; elasticity: number } | null;
  opexPerDay: number;
  periodYears: number;
  returnPerYear: number;
  connections: number;
}

export interface SubsidyGapResult {
  years: { year: number; kwhSoldPerDay: number | null; netPerDay: number | null }[];
  /** null when a year's demand is missing. */
  netRevenueNgn: number | null;
  gapNgn: number | null;
  gapPerConnectionNgn: number | null;
  /** On the last year's net a day; null is "never". */
  monthsToRepay: { atZero: number | null; atReturn: number | null; returnPerYear: number };
  method: { id: string; version: string };
}

export function subsidyGap(input: SubsidyGapInput, parameters: SubsidyGapParameters = MINIGRID_SUBSIDY_GAP_REFERENCE.parameters): SubsidyGapResult {
  const response = input.tariffResponse;
  const years = input.demand.years.map((one) => {
    const demand = one[input.demandCase];
    const sold = demand === null ? null : demand / (1 + input.losses);
    const kwhSoldPerDay = sold === null || response === null ? sold : kwhAtTariff(sold, response.baseTariff, input.tariff, response.elasticity);
    return { year: one.year, kwhSoldPerDay, netPerDay: kwhSoldPerDay === null ? null : kwhSoldPerDay * input.tariff - input.opexPerDay };
  });
  const last = years.at(-1)?.netPerDay ?? null;
  let net: number | null = 0;
  for (let year = 1; year <= input.periodYears; year++) {
    const perDay = years[Math.min(year, years.length) - 1]?.netPerDay ?? null;
    net = net === null || perDay === null ? null : net + perDay * parameters.daysPerYear;
  }
  const gap = net === null ? null : input.capexNgn - net;
  return {
    years,
    netRevenueNgn: net,
    gapNgn: gap,
    gapPerConnectionNgn: gap === null || input.connections <= 0 ? null : gap / input.connections,
    monthsToRepay: {
      atZero: monthsToRepayAt(input.capexNgn, last, parameters.daysPerMonth),
      atReturn: monthsToRepayWithReturnAt(input.capexNgn, last, input.returnPerYear, parameters.daysPerMonth),
      returnPerYear: input.returnPerYear,
    },
    method: { id: MINIGRID_SUBSIDY_GAP_REFERENCE.id, version: MINIGRID_SUBSIDY_GAP_REFERENCE.version },
  };
}

/** Under the fixed budget (e = −1): why that gap is not a finding about tariffs. */
export const FIXED_BUDGET_GAP_NOTE =
  "At a fixed budget (e = −1) revenue does not change with the tariff, so this gap is the same at any planned tariff and is not a finding about tariffs.";

export interface GapScenario {
  kind: string;
  label: string;
  elasticity: number;
  middle: boolean;
}

export interface SubsidyGapScenarioResult extends GapScenario {
  result: SubsidyGapResult;
  /** Said under the figure: the fixed budget's note; null otherwise. */
  note: string | null;
}

/** The gap under each tariff scenario, side by side, from the tariff the demand was served at. A positive elasticity is never used. */
export function subsidyGapScenarios(
  input: Omit<SubsidyGapInput, "tariffResponse">,
  baseTariff: number,
  scenarios: readonly GapScenario[],
  parameters: SubsidyGapParameters = MINIGRID_SUBSIDY_GAP_REFERENCE.parameters,
): SubsidyGapScenarioResult[] {
  return scenarios
    .filter((scenario) => scenario.elasticity <= 0)
    .map((scenario) => ({
      ...scenario,
      result: subsidyGap({ ...input, tariffResponse: { baseTariff, elasticity: scenario.elasticity } }, parameters),
      note: scenario.elasticity === -1 ? FIXED_BUDGET_GAP_NOTE : null,
    }));
}

/** The change in equipment prices since the reference's price year, in US dollar terms: 0.1 is +10%. Per category when given; the rest take the overall figure. */
export interface EquipmentPriceChange {
  overall: number;
  byCategory?: { storage?: number; generation?: number; distributionAndMetering?: number };
  source: string;
}

export interface CapexFactors {
  storage: number;
  generation: number;
  distributionAndMetering: number;
  /** Shared balance of system and soft costs: the overall change. */
  other: number;
}

/** The factor that brings a reference's ₦ to today: ₦ → USD at the source's rate, × (1 + the USD price change), then USD → ₦ at today's. */
export function capexFactorToToday(sourceNgnPerUsd: number, todayNgnPerUsd: number, usdPriceChange: number): number {
  if (!(usdPriceChange > -1)) throw new RangeError(`A price change of ${usdPriceChange} would leave no cost`);
  return (todayNgnPerUsd / sourceNgnPerUsd) * (1 + usdPriceChange);
}

/** The factor by category; the categories without a figure of their own, and the other costs, take the overall change. */
export function capexFactorsToToday(sourceNgnPerUsd: number, todayNgnPerUsd: number, change: EquipmentPriceChange): CapexFactors {
  const at = (value: number | undefined) => capexFactorToToday(sourceNgnPerUsd, todayNgnPerUsd, value ?? change.overall);
  return {
    storage: at(change.byCategory?.storage),
    generation: at(change.byCategory?.generation),
    distributionAndMetering: at(change.byCategory?.distributionAndMetering),
    other: at(undefined),
  };
}

export interface ScaledCapex {
  label: string;
  /** Distribution and metering ₦ a meter bought, at the reference's prices. */
  perConnectionNgn: number;
  /** The same over the accounts in the customer file, shown beside it; null when not stated. */
  perAccountNgn: number | null;
  connectionsBasis: { meters: number; accounts: number | null };
  /** At the reference's prices. */
  atPriceYear: CapexParts;
  /** Brought to today; null until the factors are set (never a silent factor of 1). */
  today: CapexParts | null;
  /** The factors that bring the reference's prices to today; null until set. */
  toToday: CapexFactors | null;
  priceYear: number;
}

export interface CapexParts {
  storageNgn: number;
  generationNgn: number;
  distributionAndMeteringNgn: number;
  otherNgn: number;
  totalNgn: number;
}

const parts = (storage: number, generation: number, distribution: number, other: number): CapexParts => ({
  storageNgn: storage,
  generationNgn: generation,
  distributionAndMeteringNgn: distribution,
  otherNgn: other,
  totalNgn: storage + generation + distribution + other,
});

/** A reference site's build cost scaled to a planned system, then brought to today by the factors, when set. */
export function scaleReferenceCapex(reference: ReferenceCapex, planned: { pvKwp: number; batteryKwh: number; connections: number }, toToday: CapexFactors | null): ScaledCapex {
  const storage = (reference.storageNgn / reference.storageKwh) * planned.batteryKwh;
  const generation = (reference.generationNgn / reference.pvKwp) * planned.pvKwp;
  const distribution = (reference.distributionAndMeteringNgn / reference.connections) * planned.connections;
  const scaled = storage + generation + distribution;
  const other = reference.otherNgn * (scaled / (reference.storageNgn + reference.generationNgn + reference.distributionAndMeteringNgn));
  return {
    label: SCALED_CAPEX_LABEL,
    perConnectionNgn: reference.distributionAndMeteringNgn / reference.connections,
    perAccountNgn: reference.accounts === null ? null : reference.distributionAndMeteringNgn / reference.accounts,
    connectionsBasis: { meters: reference.connections, accounts: reference.accounts },
    atPriceYear: parts(storage, generation, distribution, other),
    today: toToday === null ? null : parts(storage * toToday.storage, generation * toToday.generation, distribution * toToday.distributionAndMetering, other * toToday.other),
    toToday,
    priceYear: reference.priceYear,
  };
}
