/* View models of the E-mobility planner. Every figure is formatted here and carries its status:
   reported (with its source and date), calculated (with its method), an assumption, a placeholder,
   synthetic, or not available. A screen displays them; it calculates nothing. */

export type EmobilityStatus = "reported" | "calculated" | "assumption" | "placeholder" | "synthetic" | "not_available";

export interface EmobilityFigure {
  key: string;
  label: string;
  /** Formatted; says why when there is no figure. */
  value: string;
  status: EmobilityStatus;
  /** The source and date, the method, or the basis. */
  basis: string;
}

export interface MethodView {
  id: string;
  version: string;
  name: string;
  disclaimer: string;
}

export interface SourcingView {
  synthetic: boolean;
  sources: { id: string; name: string; kind: string }[];
  citations: { id: string; title: string; url: string | null }[];
}

export interface DemandHubView {
  hubId: string;
  hub: string;
  status: string;
  swapsNow: string;
  kwhPerSwap: string;
  rows: { adoption: string; months: string; swapsPerDay: string; vehicles: string; kwhPerDay: string; kwhPerDayUpper: string; chargingKw: string }[];
  notCounted: string | null;
}

export interface DemandView {
  headline: string;
  how: string;
  hubs: DemandHubView[];
  method: MethodView;
}

export interface SiteHubView {
  hubId: string;
  hub: string;
  transformer: string;
  rating: string;
  observedPeak: string;
  feeder: string;
  band: string;
  tariff: string;
  hoursOfSupply: string;
  horizons: { months: string; dtLoad: string; headroom: string; hubDraw: string; fits: string; limits: string }[];
  /** "Fits now and at 48 months", "Fits now; not at 24 months (DT rating)", … */
  finding: string;
}

export interface SitesView {
  headline: string;
  how: string;
  hubs: SiteHubView[];
  order: { rank: string; hub: string; reasons: string[] }[];
  orderHow: string;
  methods: MethodView[];
}

export interface PowerOptionView {
  option: string;
  energy: string;
  rainySeason: string;
  costPerKwh: EmobilityFigure;
  costPerSwap: EmobilityFigure;
  dieselLitres: string;
  co2Avoided: EmobilityFigure;
  sizes: string;
  payback: EmobilityFigure;
}

export interface PowerHubView {
  hubId: string;
  hub: string;
  energy: string;
  peakSunHours: string;
  options: PowerOptionView[];
}

export interface PowerView {
  headline: string;
  how: string;
  hubs: PowerHubView[];
  method: MethodView;
}

export interface FinanceView {
  headline: string;
  how: string;
  pledges: { id: string; funder: string; kind: string; pledged: string; returnAsked: string; tenor: string; feeders: string; hubs: string; placed: string; queued: string; hasQueued: boolean }[];
  hubs: { hubId: string; hub: string; cost: EmobilityFigure; escrowPerDay: string; fundedBy: string; monthsToRepay: string }[];
  waiting: string[];
  method: MethodView;
}

export interface VerifyView {
  headline: string;
  how: string;
  hubs: { hubId: string; hub: string; installedOn: string; days: string; figures: EmobilityFigure[] }[];
  method: MethodView;
}

export interface EmobilityView {
  demand: DemandView;
  sites: SitesView;
  power: PowerView;
  finance: FinanceView;
  verify: VerifyView;
  inputs: EmobilityFigure[];
  sourcing: SourcingView;
}
