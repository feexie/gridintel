import type { ReferenceCapex } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { monthsToRepayAt, monthsToRepayWithReturnAt } from "../loan.ts";
import { kwhAtTariff } from "./tariff.ts";
import type { DemandCase, DemandResult } from "./demand.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: THE SUBSIDY GAP
   (gridintel.planning.minigrid-subsidy-gap 0.1.0; MG-PLAN.md 3.2 (4))

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
   It is labelled "2019 reference cost, scaled".
========================================================== */

export interface SubsidyGapParameters {
  daysPerYear: number;
  daysPerMonth: number;
}

export const MINIGRID_SUBSIDY_GAP_REFERENCE: Methodology<SubsidyGapParameters> = {
  id: "gridintel.planning.minigrid-subsidy-gap",
  version: "0.1.0",
  name: "GridIntel reference subsidy gap for a planned mini-grid",
  description: "Capex minus net revenue over a period, in total and per connection, with the months net revenue takes to repay the capex at 0% and at a stated return.",
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

export interface ScaledCapex {
  label: string;
  storageNgn: number;
  generationNgn: number;
  distributionAndMeteringNgn: number;
  otherNgn: number;
  totalNgn: number;
  /** The factor that brings 2019 prices to today. Assumption. */
  toToday: number;
  priceYear: number;
}

/** A reference site's build cost scaled to a planned system, then brought to today by a stated factor. */
export function scaleReferenceCapex(reference: ReferenceCapex, planned: { pvKwp: number; batteryKwh: number; connections: number }, toToday: number): ScaledCapex {
  const storage = (reference.storageNgn / reference.storageKwh) * planned.batteryKwh;
  const generation = (reference.generationNgn / reference.pvKwp) * planned.pvKwp;
  const distribution = (reference.distributionAndMeteringNgn / reference.connections) * planned.connections;
  const scaled = storage + generation + distribution;
  const other = reference.otherNgn * (scaled / (reference.storageNgn + reference.generationNgn + reference.distributionAndMeteringNgn));
  return {
    label: SCALED_CAPEX_LABEL,
    storageNgn: storage * toToday,
    generationNgn: generation * toToday,
    distributionAndMeteringNgn: distribution * toToday,
    otherNgn: other * toToday,
    totalNgn: (scaled + other) * toToday,
    toToday,
    priceYear: reference.priceYear,
  };
}
