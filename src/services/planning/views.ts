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

export interface MeteringFundView {
  caseId: CaseId;
  cases: { id: CaseId; label: string; href: string; current: boolean }[];
  discos: { id: string; label: string; current: boolean }[];
  /** The scope the case covers, e.g. "Nigeria, all 11 DisCos" or "GEH Brief 15 test scenario". */
  scope: string;
  headline: { sentence: string; figure: string; figureLabel: string; tone: "ok" | "warning"; how: string };
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
