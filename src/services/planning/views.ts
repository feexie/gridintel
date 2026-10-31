import type { AssumptionUnit, CaseId, MitigationKey } from "./assumptions.ts";

/* View models of the Metering planner. Every figure is formatted here and carries where it came
   from: reported (with its source and date), calculated (with its method), an assumption or a
   placeholder (with its basis). The screen displays them; it calculates nothing. */

export type FigureOrigin = "reported" | "calculated" | "assumption" | "placeholder" | "test_scenario";

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
  /** What the fund still owes at month 120, before the buffers. */
  loss: string;
  absorbedByFirstLoss: string;
  absorbedByReserve: string;
  investorLoss: string;
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
