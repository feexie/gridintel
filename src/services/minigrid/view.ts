import type { GenerationAsset } from "@/domain";
import type { CalculatedKpi, ClassTotals, KpiComparison } from "../../analytics/index.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { MetricUnit, MetricView, ReportedComparisonView } from "../operations/views.ts";
import type { SiteReport } from "./performance.ts";
import type { ClassRowView, MinigridPortfolioView, MinigridSiteView, ReportStandingView, SiteCardView, SiteFindingView } from "./views.ts";
import { combineClassTotals, convertUnit, toEpochMs } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { describeBasis } from "../operations/levels.ts";
import { kpiMetric, sourcingView } from "../operations/metric.ts";
import { sitePerformance, sitePortfolio } from "./performance.ts";

/* ==========================================================
   SERVICES — MINI-GRID READ MODELS

   "Which sites are underperforming and why?" and, for whoever funds
   or reports on them, "do the reported figures match the records?"

   The PORTFOLIO puts the sites side by side on the same few
   figures, and lists what stands out, found by fixed rules that are
   printed with each finding. The SITE view is one site in full.

   Every figure is the site performance service's own, turned into a
   MetricView. Nothing is calculated here: the rules below compare,
   order and select figures that analytics has already produced.

   THE RULES FOR WHAT STANDS OUT
     report_differs    a site's report states a figure that is on the
                       same basis as the calculation and differs from
                       it by more than the agreement tolerance
     fuel_per_kwh      of the sites with a generator, the one that
                       burns the most fuel per kWh, when that is at
                       least a fifth more than the least
     pv_held_back      at least half of the PV energy available to a
                       site was curtailed
     uncollected       the site that left the most revenue
                       uncollected, with the classes that owe it
     class_pays_least  across the portfolio, the customer class that
                       paid the smallest share of what it was billed
========================================================== */

/** A reported figure agrees with the records when it is within this fraction of the reported value. */
export const AGREEMENT_TOLERANCE = 0.01;
const FUEL_MARGIN = 1.2;
const HELD_BACK_SHARE = 0.5;

const CLASS_LABEL: Record<string, string> = {
  residential: "Households",
  commercial: "Shops and businesses",
  productive_use: "Productive use (mills, workshops)",
  public: "Public institutions",
  not_recorded: "Class not recorded",
};

const CLAIM_LABEL: Partial<Record<CalculatedKpi["metric"], string>> = {
  energy_generated: "Energy generated",
  renewable_fraction: "Renewable fraction",
  availability: "Availability",
  energy_billed: "Energy sold",
  connection_count: "Connections",
  revenue_collected: "Revenue collected",
  collection_efficiency: "Collection efficiency",
  generator_runtime: "Generator running hours",
};

const CAUSE_WORDS: Record<string, string> = {
  fault: "Fault",
  planned_maintenance: "Planned maintenance",
  load_shedding: "Low battery (load shed)",
  upstream_supply: "Loss of upstream supply",
  weather: "Weather",
  vandalism: "Vandalism",
  other: "Other",
  unknown: "Not recorded",
};

const UNIT: Partial<Record<CalculatedKpi["unit"], MetricUnit>> = {
  kWh: "kWh",
  count: "count",
  currency: "currency",
  hours_per_day: "hours_per_day",
  interruptions_per_customer: "interruptions_per_customer",
  kWh_per_kWp: "kWh_per_kWp",
  kWh_per_m2: "kWh_per_m2",
  kWh_per_connection: "kWh_per_connection",
  litres: "litres",
  litres_per_kWh: "litres_per_kWh",
  cycles: "cycles",
};

/** A site figure as a MetricView, in its own unit; a percentage becomes a fraction. */
function figure(label: string, kpi: CalculatedKpi, options: { note?: string; currency?: string | null } = {}): MetricView {
  const view = kpiMetric(label, kpi, { unit: UNIT[kpi.unit], note: options.note ?? null });
  return kpi.unit === "currency" ? { ...view, currency: options.currency ?? null } : view;
}

function classRows(totals: readonly ClassTotals[]): ClassRowView[] {
  // Largest shortfall first; the screen neither orders nor cuts.
  return [...totals]
    .sort((a, b) => b.notCollected - a.notCollected || b.revenueBilled - a.revenueBilled || (a.customerClass < b.customerClass ? -1 : 1))
    .map((one) => ({ ...one, label: CLASS_LABEL[one.customerClass] ?? one.customerClass }));
}

/** What a site figure's basis counts, in words. */
function basisWords(comparison: KpiComparison, side: "reported" | "calculated"): string | null {
  const basis = side === "reported" ? comparison.reported.basis : comparison.calculated.basis;
  if (basis === null) return null;
  const parts = [describeBasis({ interruptionClasses: basis.interruptionClasses, plannedInterruptions: basis.plannedInterruptions, collection: basis.collection })].filter((part): part is string => part !== null);
  if (basis.shareOf !== undefined) parts.push(`a share of ${basis.shareOf === "energy_generated" ? "energy generated" : "energy sent out"}`);
  if (basis.connections !== undefined) parts.push(basis.connections === "active" ? "active accounts only" : "every account on the register, whatever its status");
  if (basis.energySold !== undefined) parts.push(basis.energySold === "billed" ? "energy of the charges raised" : "energy recorded by customer meters");
  return parts.length === 0 ? "nothing that changes this figure" : parts.join("; ");
}

function comparisonView(comparison: KpiComparison, currency: string | null): ReportedComparisonView {
  const { reported, calculated } = comparison;
  const label = CLAIM_LABEL[reported.metric] ?? reported.metric.replaceAll("_", " ");
  const ratio = reported.unit === "percent" || reported.unit === "fraction";
  return {
    label,
    reported: {
      label: `${label} (reported)`,
      value: reported.unit === "percent" ? convertUnit(reported.value, "percent", "fraction") : reported.value,
      unit: ratio ? "fraction" : (UNIT[reported.unit] ?? (reported.unit === "hours" ? "hours" : "count")),
      currency: reported.unit === "currency" ? (reported.currency ?? null) : null,
      status: "ok",
      origin: "reported",
      derivation: `As published by ${reported.source.name}.`,
      method: null,
      inputs: [],
      estimatedInputs: [],
      missingInputs: [],
      warnings: [],
      note: null,
    },
    calculated: figure(`${label} (calculated)`, calculated, { currency }),
    reportedBasis: basisWords(comparison, "reported"),
    calculatedBasis: basisWords(comparison, "calculated"),
    sameBasis: comparison.sameBasis,
    comparable: comparison.comparable,
    variance: comparison.variance.absolute,
    varianceUnit: comparison.variance.absoluteUnit,
    reasons: comparison.issues.filter((issue) => issue.blocking).map((issue) => issue.message),
    caveats: comparison.issues.filter((issue) => !issue.blocking).map((issue) => issue.message),
    ruleFinding: null,
    document: reported.document?.title ?? null,
  };
}

/** Whether a comparable claim differs from the records by more than the tolerance. */
function differs(comparison: KpiComparison): boolean {
  const { relative, absolute } = comparison.variance;
  // A claim of zero has no relative difference: any difference from it counts.
  return comparison.comparable && (relative === null ? absolute !== null && absolute !== 0 : Math.abs(relative) > AGREEMENT_TOLERANCE);
}

function reportStanding(report: SiteReport): ReportStandingView {
  const comparable = report.comparisons.filter((comparison) => comparison.comparable);
  const differ = comparable.filter(differs).length;
  return {
    claims: report.comparisons.length,
    agree: comparable.length - differ,
    differ,
    notComparable: report.comparisons.length - comparable.length,
    document: report.comparisons[0]?.reported.document?.title ?? null,
  };
}

function plantWords(assets: readonly GenerationAsset[]): string {
  // Always in the same order: PV, battery, generator.
  const parts: string[] = [
    ...assets.flatMap((asset) => (asset.kind === "solar_pv" ? [`${asset.capacityKwp} kWp PV`] : [])),
    ...assets.flatMap((asset) => (asset.kind === "battery" ? [`${asset.energyCapacityKwh} kWh battery`] : [])),
    ...assets.flatMap((asset) => (asset.kind === "generator" ? [`${asset.ratingKva} kVA ${asset.fuel} generator`] : [])),
  ];
  if (!assets.some((asset) => asset.kind === "generator")) parts.push("no generator");
  return parts.join(" · ");
}

function nameplate(asset: GenerationAsset): string {
  switch (asset.kind) {
    case "solar_pv":
      return `${asset.capacityKwp} kWp`;
    case "battery":
      return `${asset.energyCapacityKwh} kWh, ${asset.powerKw} kW${asset.chemistry === undefined ? "" : `, ${asset.chemistry.replaceAll("_", " ")}`}`;
    case "generator":
      return `${asset.ratingKva} kVA, ${asset.ratedPowerKw} kW, ${asset.fuel}`;
    case "inverter":
      return `${asset.ratingKva} kVA, ${asset.role} inverter`;
  }
}

const KIND_LABEL: Record<GenerationAsset["kind"], string> = { solar_pv: "Solar PV array", battery: "Battery", generator: "Generator", inverter: "Inverter" };

function card(report: SiteReport): SiteCardView {
  const { site, assets, performance } = report;
  const { energy, pv, generator, availability, commercial } = performance;
  const currency = commercial.currency;
  return {
    id: site.id,
    name: site.name,
    plant: plantWords(assets),
    connections: figure("Active connections", commercial.connections),
    renewableFraction: figure("Renewable fraction", energy.renewableFraction, { note: "Share of energy generated." }),
    fuelPerKwh: generator === null ? null : figure("Fuel per kWh", generator.specificFuelConsumption, { note: "Litres of fuel for each kWh the generator made." }),
    availability: figure("Availability", availability.all.availability, { note: "Every recorded interruption counted, planned or not." }),
    energySoldPerConnection: figure("Energy sold per connection", commercial.energySoldPerConnection, { note: "Energy billed in the month, per active connection." }),
    collectionEfficiency: figure("Collection efficiency", commercial.collectionEfficiency, { note: "Cash basis.", currency }),
    performanceRatio: pv === null ? null : figure("PV performance ratio", pv.performanceRatio, { note: "Counts curtailment as a loss." }),
    curtailedShare: pv === null ? null : figure("PV curtailed", pv.curtailedShare, { note: "Share of the PV energy that was available. The controller's estimate." }),
    report: reportStanding(report),
    variances: report.comparisons.filter(differs).map((comparison) => comparisonView(comparison, currency)),
  };
}

function findings(reports: readonly SiteReport[], portfolioClasses: readonly ClassTotals[]): SiteFindingView[] {
  const found: SiteFindingView[] = [];
  const named = (report: SiteReport) => ({ id: report.site.id, name: report.site.name });

  // report_differs: most differing claims first.
  const withVariances = reports.map((report) => ({ report, differing: report.comparisons.filter(differs) })).filter((one) => one.differing.length > 0);
  withVariances.sort((a, b) => b.differing.length - a.differing.length || (a.report.site.id < b.report.site.id ? -1 : 1));
  for (const { report, differing } of withVariances) {
    found.push({
      rule: "report_differs",
      title: "Report differs from the records",
      site: named(report),
      statement: `${report.site.name}'s report differs from its records on ${differing.length} of the ${report.comparisons.length} figures it states.`,
      figures: [],
      comparisons: differing.map((comparison) => comparisonView(comparison, report.performance.commercial.currency)),
      classes: [],
      ruleText: `A reported figure on the same basis as the calculation, and more than ${AGREEMENT_TOLERANCE * 100}% of its own value away from it.`,
    });
  }

  // fuel_per_kwh
  const burning = reports
    .flatMap((report) => (report.performance.generator?.specificFuelConsumption.value == null ? [] : [{ report, generator: report.performance.generator, litres: report.performance.generator.specificFuelConsumption.value }]))
    .sort((a, b) => b.litres - a.litres);
  if (burning.length >= 2 && burning[0].litres >= burning[burning.length - 1].litres * FUEL_MARGIN) {
    const [worst] = burning;
    const least = burning[burning.length - 1];
    found.push({
      rule: "fuel_per_kwh",
      title: "Most fuel per kWh",
      site: named(worst.report),
      statement: `${worst.report.site.name}'s generator burns the most fuel for each kWh it makes, and ran the longest.`,
      figures: [
        figure(`Fuel per kWh, ${worst.report.site.name}`, worst.generator.specificFuelConsumption),
        figure(`Fuel per kWh, ${least.report.site.name} (the least)`, least.generator.specificFuelConsumption),
        figure(`Generator running hours, ${worst.report.site.name}`, worst.generator.runtime),
        figure(`Generator's share of energy, ${worst.report.site.name}`, worst.report.performance.energy.generatorShare),
      ],
      comparisons: [],
      classes: [],
      ruleText: `Of the sites with a generator, the one with the highest fuel per kWh, when it is at least ${Math.round((FUEL_MARGIN - 1) * 100)}% above the lowest.`,
    });
  }

  // pv_held_back
  for (const report of reports) {
    const pv = report.performance.pv;
    if (pv === null || pv.curtailedShare.value === null || pv.curtailedShare.value < HELD_BACK_SHARE) continue;
    found.push({
      rule: "pv_held_back",
      title: "PV held back for want of demand",
      site: named(report),
      statement: `${report.site.name} took less than half of the PV energy available to it. Its array is not underperforming: it is larger than its demand.`,
      figures: [
        figure("PV curtailed", pv.curtailedShare, { note: "Of the PV energy available. The controller's estimate." }),
        figure("Performance ratio", pv.performanceRatio, { note: "Counts curtailment as a loss." }),
        figure("Performance ratio before curtailment", pv.performanceRatioBeforeCurtailment),
        figure("Energy sold per connection", report.performance.commercial.energySoldPerConnection),
      ],
      comparisons: [],
      classes: [],
      ruleText: `At least ${HELD_BACK_SHARE * 100}% of the PV energy available to the site was curtailed.`,
    });
  }

  // uncollected: the site with the largest sum of its classes' shortfalls.
  const owed = reports
    .map((report) => ({ report, amount: report.performance.commercial.byClass.reduce((total, one) => total + Math.max(one.notCollected, 0), 0) }))
    .filter((one) => one.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (owed.length > 0) {
    const { report } = owed[0];
    const classes = classRows(report.performance.commercial.byClass.filter((one) => one.notCollected > 0));
    const postpaid = classes.reduce((total, one) => total + one.postpaidAccounts, 0);
    found.push({
      rule: "uncollected",
      title: "Most revenue left uncollected",
      site: named(report),
      statement: `${report.site.name} left the most revenue uncollected. All of it is owed by ${postpaid} postpaid ${postpaid === 1 ? "account" : "accounts"}; its prepaid accounts cannot owe.`,
      figures: [
        figure("Collection efficiency", report.performance.commercial.collectionEfficiency, { note: "Cash basis." }),
        figure("Revenue billed", report.performance.commercial.revenueBilled, { currency: report.performance.commercial.currency }),
        figure("Revenue collected", report.performance.commercial.revenueCollected, { currency: report.performance.commercial.currency }),
      ],
      comparisons: [],
      classes,
      ruleText: "The site whose customer classes left the largest sum uncollected in the period, with the classes that owe it.",
    });
  }

  // class_pays_least
  const billed = portfolioClasses.filter((one) => one.collectionEfficiency !== null && one.notCollected > 0).sort((a, b) => (a.collectionEfficiency as number) - (b.collectionEfficiency as number));
  if (billed.length > 0) {
    const [least] = classRows([billed[0]]);
    found.push({
      rule: "class_pays_least",
      title: "Who pays least",
      site: null,
      statement: `Across the portfolio, ${least.label.toLowerCase()} paid the smallest share of what they were billed.`,
      figures: [],
      comparisons: [],
      classes: [least],
      ruleText: "The customer class with the lowest collected-over-billed across every site, among classes with a shortfall.",
    });
  }
  return found;
}

export function minigridPortfolioView(runtime: OperationsRuntime): Promise<MinigridPortfolioView> {
  return (runtime.cache ?? NO_CACHE).get(`view:minigrid-portfolio|${runtime.period.start}|${runtime.period.end}|${runtime.now}`, async () => {
    const { result, sourcing } = await sitePortfolio({ repos: runtime.repos, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
    const currencies = new Set(result.sites.map((report) => report.performance.commercial.currency));
    // Classes are added across sites only when every site is in one currency.
    const portfolioClasses = currencies.size === 1 ? combineClassTotals(result.sites.map((report) => report.performance.commercial.byClass)) : [];
    return {
      operator: result.sites[0]?.operator?.name ?? null,
      completeness: result.completeness,
      findings: findings(result.sites, portfolioClasses),
      sites: result.sites.map(card),
      byClass: classRows(portfolioClasses),
      currency: currencies.size === 1 ? [...currencies][0] : null,
      agreementTolerance: AGREEMENT_TOLERANCE,
      tariffCaveat: runtime.caveats.tariffs ?? null,
      sourcing: sourcingView(sourcing),
    };
  });
}

/** One site in full; null for a site that is not in the register. */
export function minigridSiteView(runtime: OperationsRuntime, siteId: string): Promise<MinigridSiteView | null> {
  return (runtime.cache ?? NO_CACHE).get(`view:minigrid-site|${siteId}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`, async () => {
    const found = await sitePerformance({ repos: runtime.repos, siteId, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
    if (found === null) return null;
    const report = found.result;
    const { site, assets, performance } = report;
    const { energy, pv, storage, generator, availability, commercial } = performance;
    const currency = commercial.currency;
    const battery = assets.find((asset) => asset.kind === "battery");
    const engine = assets.find((asset) => asset.kind === "generator");

    return {
      id: site.id,
      name: site.name,
      operator: report.operator?.name ?? null,
      commissioned: site.commissionedAt ?? null,
      assets: assets.map((asset) => ({ id: asset.id, kind: asset.kind, label: KIND_LABEL[asset.kind], nameplate: nameplate(asset) })),
      energy: {
        mix: [
          { label: "Solar PV", energy: figure("PV generation", energy.pvGeneration), share: figure("Renewable fraction", energy.renewableFraction), series: "renewable" },
          { label: "Generator", energy: figure("Generator generation", energy.generatorGeneration), share: figure("Generator's share", energy.generatorShare), series: "generator" },
        ],
        flow: [
          { metric: figure("PV generation", energy.pvGeneration), role: "source" },
          { metric: figure("Generator generation", energy.generatorGeneration), role: "source" },
          { metric: figure("Energy generated", energy.energyGenerated), role: "equals" },
          { metric: figure("Net into storage", energy.storageNetIntake, { note: "Energy into the battery less energy out of it: storage loss and any change in what is stored." }), role: "less" },
          { metric: figure("Station use", energy.stationUse, { note: "A residual: the powerhouse's own use and anything unaccounted for." }), role: "less" },
          { metric: figure("Energy sent out", energy.energySentOut, { note: "Metered where the powerhouse hands over to the network: the energy available to customers." }), role: "equals" },
          { metric: figure("Distribution loss", energy.distributionLossKwh, { note: "A residual: technical loss and unmetered use together." }), role: "less" },
          { metric: figure("Energy delivered", energy.energyDelivered, { note: "What customer meters recorded." }), role: "equals" },
        ],
        renewableFraction: figure("Renewable fraction", energy.renewableFraction, { note: "Share of energy generated." }),
        siteLoss: figure("Site loss", energy.siteLoss, { note: "Energy generated that reached no customer meter, as a share of energy generated." }),
        distributionLoss: figure("Distribution loss", energy.distributionLoss, { note: "Share of energy sent out." }),
        deliveredCoverage: energy.deliveredCoverage,
      },
      pv:
        pv === null
          ? null
          : {
              figures: [
                figure("In-plane irradiation", pv.irradiation, { note: "Measured on site; the input to the performance ratio." }),
                figure("Specific yield", pv.specificYield),
                figure("Curtailment", energy.curtailment, { note: "The controller's estimate. Not subtracted from metered generation, which is already net of it." }),
              ],
              curtailedShare: figure("PV curtailed", pv.curtailedShare, { note: "Of the PV energy that was available." }),
              performanceRatio: figure("Performance ratio", pv.performanceRatio, { note: "Counts curtailment as a loss, as IEC 61724 does." }),
              performanceRatioBeforeCurtailment: figure("Performance ratio before curtailment", pv.performanceRatioBeforeCurtailment, { note: "Adds the curtailment estimate back: what the array could do." }),
            },
      storage:
        storage === null
          ? null
          : {
              nameplate: battery === undefined ? "" : nameplate(battery),
              figures: [
                figure("Equivalent full cycles", storage.equivalentFullCycles, { note: "Energy out of the battery over its nameplate capacity." }),
                figure("Round-trip efficiency", storage.roundTripEfficiency),
                figure("Storage loss", storage.storageLoss, { note: "The change in stored energy is estimated from state of charge and nameplate capacity." }),
                figure("State of charge, mean", storage.stateOfChargeMean),
                figure("State of charge, lowest", storage.stateOfChargeMin),
                figure("Energy into storage", energy.storageCharge),
                figure("Energy out of storage", energy.storageDischarge),
              ],
              byDay: storage.stateOfChargeByDay.map((day) => ({ day: day.dayStart, lowest: day.lowest, mean: day.mean, highest: day.highest })),
            },
      generator:
        generator === null
          ? null
          : {
              nameplate: engine === undefined ? "" : nameplate(engine),
              figures: [
                figure("Fuel per kWh", generator.specificFuelConsumption, { note: "Litres of fuel for each kWh the generator made." }),
                figure("Running hours", generator.runtime, { note: "The advance of the hour meter over the month." }),
                figure("Fuel used", generator.fuelUsed),
                figure("Generator generation", energy.generatorGeneration),
                figure("Generator's share of energy", energy.generatorShare),
              ],
            },
      availability: {
        figures: [
          figure("Availability", availability.all.availability, { note: "Customer-weighted; every recorded interruption counted." }),
          figure("Hours of supply per day", availability.all.hoursOfSupply),
          figure("Interruptions per connection", availability.all.interruptionsPerConnection),
        ],
        withoutPlanned: figure("Availability without planned interruptions", availability.unplannedOnly.availability),
        interruptions: report.interruptions
          .flatMap((outage) =>
            outage.exposures
              .filter((exposure) => "id" in exposure.affected && exposure.affected.kind === "site" && exposure.affected.id === site.id)
              .map((exposure) => {
                const from = exposure.interruptedAt === undefined ? null : toEpochMs(exposure.interruptedAt);
                const to = exposure.restoredAt === undefined ? null : toEpochMs(exposure.restoredAt);
                return {
                  id: outage.id,
                  from: exposure.interruptedAt ?? null,
                  to: exposure.restoredAt ?? null,
                  hours: from === null || to === null ? null : (to - from) / 3_600_000,
                  cause: CAUSE_WORDS[outage.cause] ?? outage.cause,
                  planned: outage.planned,
                  customersAffected: exposure.customersAffected,
                  note: outage.notes ?? null,
                };
              }),
          )
          .sort((a, b) => ((a.from ?? "") < (b.from ?? "") ? -1 : 1)),
        hoursLostByCause:
          availability.hoursLostByCause === null
            ? null
            : Object.entries(availability.hoursLostByCause)
                .map(([cause, hours]) => ({ cause: CAUSE_WORDS[cause] ?? cause, hours: hours as number }))
                .sort((a, b) => b.hours - a.hours),
        provisional: availability.provisional,
        excludedExposures: availability.excludedExposures,
      },
      commercial: {
        figures: [
          figure("Revenue billed", commercial.revenueBilled, { currency }),
          figure("Revenue collected", commercial.revenueCollected, { currency, note: "Cash basis: money received in the month." }),
          figure("Active connections", commercial.connections),
          figure("Energy sold", commercial.energySold, { note: "Energy billed. For a prepaid account that is energy purchased, not energy used." }),
          figure("Energy sold per connection", commercial.energySoldPerConnection),
          figure("Consumption per connection", commercial.consumptionPerConnection, { note: "From customer meters." }),
          figure("Revenue per connection", commercial.revenuePerConnection, { currency }),
          figure("Productive-use share of energy sold", commercial.productiveUseShare),
        ],
        collectionEfficiency: figure("Collection efficiency", commercial.collectionEfficiency, { note: "Cash basis: received in the month against billed in the month." }),
        byClass: classRows(commercial.byClass),
        byTier: commercial.byTier.map((tier) => ({ ...tier })),
        currency,
        tariffCaveat: runtime.caveats.tariffs ?? null,
      },
      report: reportStanding(report),
      comparisons: report.comparisons.map((comparison) => comparisonView(comparison, currency)),
      sourcing: sourcingView(found.sourcing),
    };
  });
}

/** The ids of every site in the register, for building the site screens ahead of time. */
export async function minigridSiteIds(runtime: OperationsRuntime): Promise<string[]> {
  return (await sitePortfolio({ repos: runtime.repos, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache })).result.sites.map((report) => report.site.id);
}
