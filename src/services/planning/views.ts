import type { AssumptionUnit, CaseId, MitigationKey } from "./assumptions.ts";

/* View models of the Metering planner. Every figure is formatted here and carries where it came
   from: reported (with its source and date), calculated (with its method), an assumption or a
   placeholder (with its basis). The screen displays them; it calculates nothing. */

export type FigureOrigin = "reported" | "calculated" | "assumption" | "placeholder" | "test_scenario" | "synthetic";

export interface ShownFigure {
  key: string;
  label: string;
  /** Formatted; "Not available" when the source does not give it. */
  value: string;
  origin: FigureOrigin;
  /** The source and date, the method, or the basis of the assumption. */
  basis: string;
}

export interface CitationView {
  id: string;
  title: string;
  url: string | null;
  published: string | null;
  standing: "primary" | "secondary";
  locator: string | null;
}

export interface AssumptionInputView {
  key: string;
  label: string;
  unit: AssumptionUnit;
  unitLabel: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  basis: string;
  origin: "assumption" | "placeholder";
  group: string;
  changed: boolean;
}

export interface StressRowView {
  key: string;
  label: string;
  /** What the shock is, in words. */
  shock: string;
  solvent: boolean;
  /** What the fund still owes at month 120 with the launch charge; "Nothing" when solvent. */
  owedAtEnd: string;
  /** The charge this case would need for every meter to repay in 60 months. */
  chargeNeeded: string;
  /** Whether the charge needed stays under the cap for the typical band. */
  underCap: boolean;
  verdict: string;
  /** Who carries a shortfall: investors (never more than their capital and its return) and what lies beyond them; null when solvent. */
  split: string | null;
}

export interface BandView {
  band: string;
  /** Tariff in N/kWh, or "Not available". */
  tariff: string;
  tariffOrigin: FigureOrigin;
  tariffBasis: string;
  consumption: string;
  bill: string;
  customerShare: string;
  chargeShareOfBill: string;
  underCap: boolean | null;
  typical: boolean;
}

export interface YearRowView {
  year: string;
  meteredShare: string;
  fundMeters: string;
  publicMeters: string;
  capex: string;
  capitalDrawn: string;
  recoveries: string;
  netCash: string;
  owed: string;
  estimatedBills: string;
  estimatedBillsRemoved: string;
}

export interface ChartSeries {
  label: string;
  values: number[];
}

export interface InvestorView {
  label: string;
  repaid: boolean;
  /** The capital investors put in. */
  capital: string;
  /** The fund's shortfall: what it still owes at month 120, before the buffers. */
  loss: string;
  absorbedByFirstLoss: string;
  absorbedByReserve: string;
  /** The capital investors put in and never get back, with its share of their capital: never more than 100%. */
  investorLoss: string;
  /** The return due to investors that is never paid: the rest of what they are owed after the buffers. */
  returnUnpaid: string;
  /** The shortfall beyond investors, which nobody in the structure carries. */
  uncovered: string;
  irr: string;
  payback: string;
}

/** Initial investment against break-even, for one way of funding the meters. */
export interface InvestmentView {
  label: string;
  figures: ShownFigure[];
  /** Investors' cash back less cash in, added up month by month, in naira billion, months 0 to 120. */
  cumulative: number[];
  peakMonth: number;
  breakEvenMonth: number | null;
  paybackMonth: number | null;
}

export interface StructureView {
  /** The two results side by side: the fund alone, and the GridIntel structure. */
  fundAlone: string;
  structure: string;
  /** The shocks the structure fails, each split into the fund's shortfall, investors' loss and what is uncovered; null when it fails none. */
  failures: string | null;
  /** Public money per meter in the structure, beside the per-meter cost reported for PMI, and what the same money meters here. */
  publicPerMeter: { line: string; figures: ShownFigure[] } | null;
  tone: "ok" | "warning";
  figures: ShownFigure[];
  how: string;
  /** How many of the four shocks investors come through repaid in full, e.g. "3 of 4". */
  survived: string;
  shocks: { key: string; label: string; survives: boolean; outcome: string }[];
  investor: { base: InvestorView; stressed: InvestorView };
  /** The lowest share of inflation passed into tariffs at which investors are repaid in full, under inflation and under all three shocks. */
  inflationLine: string;
  protection: { title: string; text: string; requirement: boolean }[];
  receipt: { band: string; charge: string; monthsLeft: string; note: string };
  /** The charge in naira for each band under the structure, A to E, and Lifeline. */
  bandCharges: { band: string; charge: string }[];
}

export interface MeteringFundView {
  caseId: CaseId;
  cases: { id: CaseId; label: string; href: string; current: boolean }[];
  discos: { id: string; label: string; current: boolean }[];
  /** The scope the case covers, e.g. "Nigeria, all 11 DisCos" or "GEH Brief 15 test scenario". */
  scope: string;
  headline: { sentence: string; figure: string; figureLabel: string; tone: "ok" | "warning"; how: string };
  /** Brief 15's two impact measures: customers metered within five years, and estimated bills removed. */
  impact: {
    metered: { label: string; value: string };
    bills: { label: string; value: string };
    byYear: { year: string; meteredShare: string; billsRemoved: string }[];
    how: string;
  };
  /** When the charge breaks the cap: what holding it at the cap leaves unpaid, and the public money that would close it. */
  atCap: { sentence: string; how: string } | null;
  repaymentLine: string;
  cashPositiveLine: string;
  gap: { sentence: string; figures: ShownFigure[]; how: string };
  startingPoint: ShownFigure[];
  references: ShownFigure[];
  costPerMeter: { figure: string; how: string; parts: ShownFigure[] };
  stress: StressRowView[];
  stressHow: string;
  bands: BandView[];
  bandsNote: string;
  years: YearRowView[];
  /** The calendar months the model's years cover, when the case has dates. */
  yearsNote: string;
  charts: {
    balance: { title: string; unit: string; months: number; base: ChartSeries; stressed: ChartSeries; how: string };
    meters: { title: string; unit: string; years: string[]; fund: ChartSeries; public: ChartSeries };
    sources: { title: string; unit: string; years: string[]; series: ChartSeries[] };
  };
  structure: StructureView | null;
  /** Initial investment against break-even: the fund alone, and the GridIntel structure. */
  investment: { fundAlone: InvestmentView; structure: InvestmentView | null; how: string };
  positioning: string;
  miniGrids: string;
  pmiRule: string;
  fairnessRule: string;
  modelOrigin: string;
  assumptions: AssumptionInputView[];
  mitigations: { key: MitigationKey; label: string; effect: string; on: boolean }[];
  /** The address of this case with every assumption at its default. */
  resetHref: string;
  citations: CitationView[];
  methodology: { id: string; version: string; disclaimer: string };
  sourcing: { synthetic: false; sources: { id: string; name: string; kind: string; dated?: string }[] };
}

export interface AllocationRowView {
  id: string;
  name: string;
  customers: string;
  metered: string;
  unmetered: string;
  gapShare: string;
  meteringRate: string;
  installsQ1: string;
  installsQ2: string;
  monthsTo100: string;
  collection: string;
  atcc: string;
  need: string;
  needMissing: string[];
  risk: string;
  riskMissing: string[];
  proRata: string;
  publicMeters: string;
  privateMeters: string;
  recommended: string;
  /** Recommended less pro-rata, signed. */
  change: string;
  pilot: boolean;
}

/** DisCo allocation (M3): where the first meters and the first private capital go. */
export interface AllocationView {
  headline: string;
  headlineHow: string;
  firstMillion: string;
  scoresHow: string;
  splitHow: string;
  rows: AllocationRowView[];
  pilot: { disco: string; sentence: string; figures: ShownFigure[]; note: string };
  rule: string;
  inputs: { key: string; label: string; value: number; defaultValue: number; min: number; max: number; step: number; unit: string; basis: string }[];
  discos: { id: string; label: string; current: boolean }[];
  citations: CitationView[];
  methodology: { id: string; version: string; disclaimer: string };
}

export interface PlanningInputView {
  key: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  basis: string;
}

export interface DtRowView {
  id: string;
  rank: string;
  name: string;
  feeder: string;
  connections: string;
  unmetered: string;
  estimatedBilling: string;
  loss: string;
  atcc: string;
  capex: string;
  recovered: string;
  perNaira: string;
  /** The parts with no figure, left out of the DT's figure. */
  missing: string[];
}

/** DT sequencing inside one DisCo (M4), on the synthetic network. */
export interface DtSequencingView {
  network: string;
  headline: string;
  headlineHow: string;
  revolvingLine: string;
  figures: ShownFigure[];
  rows: DtRowView[];
  rowsHow: string;
  chart: { title: string; unit: string; months: number; base: ChartSeries; stressed: ChartSeries; how: string };
  fairness: string;
  inputs: PlanningInputView[];
  methodology: { id: string; version: string; disclaimer: string };
  sourcing: { synthetic: boolean; sources: { id: string; name: string; kind: string }[] };
}

export interface MonitoringRowView {
  disco: string;
  name: string;
  plannedMeters: string;
  installed: string;
  verified: string;
  /** Verified installs as a share of plan. */
  againstPlan: string;
  behind: boolean;
  trancheReleased: string;
  trancheHeld: string;
  supplyPlan: string;
  supplyActual: string;
  consumptionPlan: string;
  consumptionActual: string;
  escrowPlan: string;
  escrowActual: string;
  repaidPlan: string;
  repaidActual: string;
}

/** Monitoring (M4): plan against actual per DisCo per quarter. Actuals are synthetic. */
export interface MonitoringView {
  quarter: string;
  quarters: { id: string; label: string; href: string; current: boolean; reported: boolean }[];
  headline: string;
  headlineHow: string;
  trancheLine: string;
  /** Null when the quarter has no records yet. */
  rows: MonitoringRowView[] | null;
  notReported: string | null;
  totals: ShownFigure[];
  how: string;
  methodology: { id: string; version: string; disclaimer: string };
  sourcing: { synthetic: boolean; sources: { id: string; name: string; kind: string }[] };
}

/** About this build: what existed at the baseline and what the sprint added, from the sprint changelog. */
export interface AboutBuildView {
  baseline: { tag: string; commit: string; time: string; summary: string[] };
  sprint: { window: string; branch: string; compareUrl: string };
  rows: { time: string; commit: string; commitUrl: string; what: string }[];
  /** Rows of the changelog that could not be read, so none is dropped silently. */
  unread: number;
  how: string;
}

/** The Metering Marketplace: funders' pledges matched to approved meter applications. Every record is synthetic. */
export interface MarketplaceView {
  headline: string;
  headlineHow: string;
  /** The platform the marketplace sits in, in one line. */
  platformLine: string;
  totals: ShownFigure[];
  funders: {
    id: string;
    funder: string;
    kind: string;
    pledged: string;
    bands: string;
    discos: string;
    returnAsked: string;
    tenor: string;
    matchedMeters: string;
    placed: string;
    /** "Queued for the next allocation: ₦…", or "Nothing queued". */
    queued: string;
    hasQueued: boolean;
  }[];
  bands: { band: string; meter: string; meterCost: string; perDay: string; perMonth: string; minRecharge: string; monthsToRepay: string; fundedBy: string }[];
  bandsHow: string;
  demandBands: string[];
  demand: { disco: string; name: string; approved: string[]; matched: string; waiting: string }[];
  demandHow: string;
  matching: { funder: string; band: string; discos: string; meters: string; money: string }[];
  matchingHow: string;
  assumptions: { label: string; value: string; basis: string }[];
  methodology: { id: string; version: string; disclaimer: string };
  sourcing: { synthetic: boolean; sources: { id: string; name: string; kind: string }[] };
}
