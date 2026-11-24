import type { PlannedCommunity, PlanningClass, ReferenceBasis } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { benchmark, benchmarkByYear, sitesLabel, YEARS } from "./benchmark.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: DEMAND FROM REFERENCE SITES
   (gridintel.planning.minigrid-demand 0.1.0; MG-PLAN.md 3.2 (1))

   The daily kWh a planned community would draw in years 1 to 5 of
   operation, P50 and P90, from what reference sites served:

   Demand(n, P) = Σ over classes [customers × class factor(n)]
                  × site kWh per reporting meter-day(n, P)
                  × ramp(n) × buying share(n) × (1 + losses)

   The P50 and P90 are the site's daily totals per reporting meter,
   so the diversity between customers on a day is in them (Founder,
   24 November 2026). The class factor is the class's share of the
   energy ÷ its share of the meter-days.

   The default basis is the reference site's use at a single tariff
   (its years of operation wholly at its first tariff, pooled), held
   flat across years 1 to 5; the ramp and the buying share carry the
   years. The planned tariff acts only through the tariff response,
   from that tariff. The site's own curve by year of operation is a
   scenario, labelled "as happened", never the default: at RMG01 it
   falls with tariff rises, an outage and lighter later meters
   (Founder, 24 November 2026).

   The no-diversity upper bound is a separate line: every customer on
   their class's P90 day at once, Σ customers × class P90 meter-day
   × ramp × buying share × (1 + losses). It is never the design day
   and never called P90.

   A suppressed-demand uplift, when given, is a separate line and is
   never folded into the P50. Every figure is served demand at the
   reference sites: a floor on true demand.
========================================================== */

export type DemandBasis = "single_tariff" | "as_happened";

export interface DemandParameters {
  /** The default is single_tariff; as_happened is a labelled, confounded scenario. */
  basis: DemandBasis;
  /** Losses between the plant and the meters. Assumption. */
  losses: number;
  /** Multiplier for demand the reference sites could not serve; 1 is off. Assumption. */
  suppressedDemandUplift: number;
}

export const MINIGRID_DEMAND_REFERENCE: Methodology<DemandParameters> = {
  id: "gridintel.planning.minigrid-demand",
  version: "0.1.0",
  name: "GridIntel reference demand for a planned mini-grid community, from reference sites",
  description:
    "Daily kWh in years 1 to 5 of operation, P50 and a diversified P90 from the reference sites' daily totals per reporting meter, scaled by class, connection ramp, buying share and losses; with a labelled no-diversity upper bound.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { basis: "single_tariff", losses: 0.1, suppressedDemandUplift: 1 },
};

export type DemandCase = "p50" | "p90";

export const SERVED_DEMAND_LABEL = "Served demand at the reference site, a floor on true demand";
/** "As happened at RMG01 (tariff rises and an outage; confounded)". */
export const asHappenedLabel = (siteCodes: readonly string[]): string => `As happened at ${siteCodes.join(", ")} (tariff rises and an outage; confounded)`;

const CLASSES: readonly PlanningClass[] = ["residential", "non_residential"];

export interface DemandYear {
  year: number;
  /** kWh a day; null when a reference figure for the year is missing. */
  p50: number | null;
  /** Diversified P90, kWh a day. */
  p90: number | null;
  /** Every customer on their class's high day at once. Never the design day, never a P90. */
  noDiversityUpperBound: number | null;
  /** P50 × the uplift; null when the uplift is off. */
  p50WithUplift: number | null;
  /** The community in meter-equivalents this year: Σ customers × class factor. */
  meterEquivalents: number | null;
  ramp: number | null;
  buyingShare: number | null;
  siteKwhPerMeterDay: { p50: number | null; p90: number | null };
  /** What is missing, when a figure is null. */
  missing: string[];
}

export interface DemandResult {
  years: DemandYear[];
  /** The reference sites the benchmarks rest on. */
  referenceSites: number;
  referenceSiteIds: string[];
  /** "1 reference site". */
  sitesLabel: string;
  label: string;
  basis: DemandBasis;
  /** The scenario's own label: null for the default, "As happened at RMG01 (…)" for the confounded curve. */
  scenarioLabel: string | null;
  /** The tariff the basis was served at; the planned tariff acts through the tariff response from it. Null when the sites' tariffs differ or the basis is as happened. */
  servedAtTariff: number | null;
  exclusions: string[];
  notes: string[];
  method: { id: string; version: string };
}

export function demandFromReference(community: PlannedCommunity, bases: readonly ReferenceBasis[], parameters: DemandParameters = MINIGRID_DEMAND_REFERENCE.parameters): DemandResult {
  const flat = parameters.basis === "single_tariff";
  const held = (pick: (basis: ReferenceBasis) => number | null | undefined) => {
    const one = benchmark(bases, pick);
    return YEARS.map(() => one);
  };
  const p50 = flat ? held((basis) => basis.singleTariff?.p50) : benchmarkByYear(bases, (basis) => basis.siteKwhPerMeterDay.p50);
  const p90 = flat ? held((basis) => basis.singleTariff?.p90) : benchmarkByYear(bases, (basis) => basis.siteKwhPerMeterDay.p90);
  const ramp = benchmarkByYear(bases, (basis) => basis.ramp);
  const buying = benchmarkByYear(bases, (basis) => basis.buyingShare);
  const factor = Object.fromEntries(CLASSES.map((klass) => [klass, flat ? held((basis) => basis.singleTariff?.classFactor[klass]) : benchmarkByYear(bases, (basis) => basis.classFactor[klass])])) as Record<PlanningClass, ReturnType<typeof benchmarkByYear>>;
  const classP90 = Object.fromEntries(CLASSES.map((klass) => [klass, benchmark(bases, (basis) => basis.classP90MeterDay[klass])])) as Record<PlanningClass, ReturnType<typeof benchmark>>;
  const grossUp = 1 + parameters.losses;
  const uplift = parameters.suppressedDemandUplift;

  const years = YEARS.map((year): DemandYear => {
    const index = year - 1;
    const missing: string[] = [];
    const need = (value: number | null, what: string) => {
      if (value === null) missing.push(what);
      return value;
    };
    let meterEquivalents: number | null = 0;
    let upperSum: number | null = 0;
    for (const klass of CLASSES) {
      const count = community.customers[klass];
      if (count === 0) continue;
      const classFactor = need(factor[klass][index].value, `${klass} class factor`);
      meterEquivalents = classFactor === null || meterEquivalents === null ? null : meterEquivalents + count * classFactor;
      const highDay = need(classP90[klass].value, `${klass} P90 meter-day`);
      upperSum = highDay === null || upperSum === null ? null : upperSum + count * highDay;
    }
    const rampValue = need(ramp[index].value, "connection ramp");
    const buyingValue = need(buying[index].value, "buying share");
    const siteP50 = need(p50[index].value, "site P50 meter-day");
    const siteP90 = need(p90[index].value, "site P90 meter-day");
    const scale = rampValue === null || buyingValue === null ? null : rampValue * buyingValue * grossUp;
    const of = (site: number | null) => (site === null || meterEquivalents === null || scale === null ? null : meterEquivalents * site * scale);
    const p50Day = of(siteP50);
    return {
      year,
      p50: p50Day,
      p90: of(siteP90),
      noDiversityUpperBound: upperSum === null || scale === null ? null : upperSum * scale,
      p50WithUplift: uplift === 1 || p50Day === null ? null : p50Day * uplift,
      meterEquivalents,
      ramp: rampValue,
      buyingShare: buyingValue,
      siteKwhPerMeterDay: { p50: siteP50, p90: siteP90 },
      missing,
    };
  });

  const ids = [...new Set([...p50, ...p90].flatMap((one) => one.referenceSiteIds))];
  return {
    years,
    referenceSites: ids.length,
    referenceSiteIds: ids,
    sitesLabel: sitesLabel(ids.length),
    label: SERVED_DEMAND_LABEL,
    basis: parameters.basis,
    scenarioLabel: flat ? null : asHappenedLabel(bases.map((basis) => basis.siteCode)),
    servedAtTariff: flat ? servedAt(bases) : null,
    exclusions: bases.flatMap((basis) => basis.exclusions.map((line) => `${basis.siteCode}: ${line}`)),
    notes: [
      flat
        ? `Per-meter use is the reference sites' at a single tariff (${bases.map((basis) => (basis.singleTariff ? `${basis.siteCode}: years ${basis.singleTariff.years.join(" and ")} at ₦${basis.singleTariff.tariff}/kWh, ${basis.singleTariff.days} days` : `${basis.siteCode}: none`)).join("; ")}), held flat across years 1 to 5; the ramp and the buying share carry the years. A planned tariff acts only through the tariff response, from that tariff.`
        : "A scenario, never the default: the reference site's per-meter use year by year, which fell with tariff rises, an outage and lighter later meters.",
      "The P90 is the reference sites' daily totals per reporting meter, so the diversity between customers on a day is in it.",
      "The no-diversity upper bound puts every customer on their class's high day at once. It is not a P90 and is never the design day.",
      "The class split rests on the reference data's classes; customers with no class in the source are counted as residential, as the dataset's authors did.",
      "Served demand: the reference sites did not supply every hour, so true demand is higher.",
    ],
    method: { id: MINIGRID_DEMAND_REFERENCE.id, version: MINIGRID_DEMAND_REFERENCE.version },
  };
}

/** The one tariff the sites' single-tariff use was served at; null when they differ. */
function servedAt(bases: readonly ReferenceBasis[]): number | null {
  const tariffs = [...new Set(bases.map((basis) => basis.singleTariff?.tariff).filter((tariff): tariff is number => tariff !== undefined))];
  return tariffs.length === 1 ? tariffs[0] : null;
}
