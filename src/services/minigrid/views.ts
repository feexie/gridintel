import type { MetricView, ReportedComparisonView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — MINI-GRID VIEW MODELS

   What the Mini-grid screens receive. Plain, serialisable data. The
   UI formats and lays these out; it calculates, ranks and filters
   nothing. Every number that is a KPI is a MetricView, with its
   status, its origin and the trail back to source and method.
========================================================== */

/** A fact that stands out across the portfolio, found by a fixed, printed rule. */
export interface SiteFindingView {
  /** The rule's key, e.g. "report_differs". */
  rule: string;
  /** What kind of finding it is, in words: the rule's title. */
  title: string;
  /** The site it is about; null for a finding about the portfolio as a whole. */
  site: { id: string; name: string } | null;
  /** One sentence: what was found. */
  statement: string;
  /** The figures behind the statement, each with its status and origin. */
  figures: MetricView[];
  /** For a finding about a report: each claim that differs, beside the calculation on its basis. */
  comparisons: ReportedComparisonView[];
  /** For a finding about money not collected: the customer classes that owe it. */
  classes: ClassRowView[];
  /** The rule, in words, so that a reader can see why this is listed and something else is not. */
  ruleText: string;
}

/** How a site's report stands against its records, in counts. */
export interface ReportStandingView {
  /** Figures the report states that a calculation exists for. */
  claims: number;
  /** On the same basis, and within the tolerance of the records. */
  agree: number;
  /** On the same basis, and outside it. */
  differ: number;
  /** No calculation on the claim's basis, or the claim states none. */
  notComparable: number;
  document: string | null;
}

export interface SiteCardView {
  id: string;
  name: string;
  /** Nameplate, in words: "100 kWp PV · 240 kWh battery · 50 kVA diesel generator". */
  plant: string;
  connections: MetricView;
  renewableFraction: MetricView;
  /** null for a site with no generator. */
  fuelPerKwh: MetricView | null;
  availability: MetricView;
  energySoldPerConnection: MetricView;
  collectionEfficiency: MetricView;
  performanceRatio: MetricView | null;
  /** The share of available PV energy that was curtailed; null for a site with no PV. */
  curtailedShare: MetricView | null;
  report: ReportStandingView;
  /** The claims that differ from the records, each beside the calculation on its basis. */
  variances: ReportedComparisonView[];
}

export interface ClassRowView {
  customerClass: string;
  label: string;
  accounts: number;
  prepaidAccounts: number;
  postpaidAccounts: number;
  revenueBilled: number;
  revenueCollected: number;
  notCollected: number;
  /** Collected ÷ billed; null for a class that was billed nothing. */
  collectionEfficiency: number | null;
}

export interface MinigridPortfolioView {
  operator: string | null;
  /** How complete the list of sites is; anything but "complete" means a site may exist that is not shown. */
  completeness: "complete" | "partial" | "not_available";
  findings: SiteFindingView[];
  sites: SiteCardView[];
  /** Billing and collection by customer class over every site, the rate taken of the sums. */
  byClass: ClassRowView[];
  currency: string | null;
  /** The tolerance within which a claim agrees with the records, as a fraction. */
  agreementTolerance: number;
  tariffCaveat: string | null;
  sourcing: SourcingView;
}

/* ---------------- One site ---------------- */

/** One line of the energy flow: a metered or calculated figure, and how it enters the chain. */
export interface FlowRowView {
  metric: MetricView;
  /** "source" adds to the chain, "less" is taken from it, "equals" is what is left or metered at that point. */
  role: "source" | "less" | "equals";
}

export interface InterruptionRowView {
  id: string;
  /** ISO timestamps; null when the source did not record one. */
  from: string | null;
  to: string | null;
  hours: number | null;
  cause: string;
  planned: boolean | null;
  customersAffected: number | null;
  note: string | null;
}

export interface TierRowView {
  tier: string;
  accounts: number;
  activeAccounts: number;
  /** null when a charge of the tier states no energy. */
  energySoldKwh: number | null;
  revenueBilled: number;
  revenueCollected: number;
}

export interface SocDayView {
  /** The day's first instant, ISO. */
  day: string;
  /** Percent; null on a day with no reading. */
  lowest: number | null;
  mean: number | null;
  highest: number | null;
}

export interface MinigridSiteView {
  id: string;
  name: string;
  operator: string | null;
  commissioned: string | null;
  /** Each asset with its nameplate, in words. */
  assets: { id: string; kind: string; label: string; nameplate: string }[];
  energy: {
    /** PV and generator, as energy and as shares of energy generated. */
    mix: { label: string; energy: MetricView; share: MetricView; series: "renewable" | "generator" }[];
    flow: FlowRowView[];
    renewableFraction: MetricView;
    siteLoss: MetricView;
    distributionLoss: MetricView;
    /** How many of the site's connections have a meter that recorded the whole period. */
    deliveredCoverage: { connections: number; recorded: number; unmetered: number; incomplete: number };
  };
  /** null for a site with no PV array. */
  pv: { figures: MetricView[]; curtailedShare: MetricView; performanceRatio: MetricView; performanceRatioBeforeCurtailment: MetricView } | null;
  /** null for a site with no battery. */
  storage: { nameplate: string; figures: MetricView[]; byDay: SocDayView[] } | null;
  /** null for a site with no generator. */
  generator: { nameplate: string; figures: MetricView[] } | null;
  availability: {
    figures: MetricView[];
    withoutPlanned: MetricView;
    interruptions: InterruptionRowView[];
    hoursLostByCause: { cause: string; hours: number }[] | null;
    provisional: boolean;
    excludedExposures: number;
  };
  commercial: {
    figures: MetricView[];
    collectionEfficiency: MetricView;
    byClass: ClassRowView[];
    byTier: TierRowView[];
    currency: string | null;
    tariffCaveat: string | null;
  };
  report: ReportStandingView;
  comparisons: ReportedComparisonView[];
  /** Said once above the comparison: the report's methodology has not been verified as equivalent. null when no figure states one. */
  comparisonNote: string | null;
  sourcing: SourcingView;
}
