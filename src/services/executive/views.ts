import type { LevelKind, LossesView, MetricView, NotAvailableView, ReliabilityView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — EXECUTIVE VIEW MODEL

   What the Executive screen receives. Its job: "What is happening
   across the portfolio, and where should I look first?"
========================================================== */

export interface BandComplianceRow {
  feederId: string;
  feederName: string;
  band: string | null;
  minimumHours: number | null;
  averageHours: MetricView;
  daysFailed: number | null;
  daysMet: number | null;
  daysObserved: number;
  compliantOnAverage: boolean | null;
}

export interface TransformerLoadingRow {
  transformerId: string;
  transformerName: string;
  feederName: string;
  ratedKva: number | null;
  peak: MetricView;
  peakAt: string | null;
  hoursOverRating: number | null;
  hoursObserved: number | null;
  overloaded: boolean | null;
}

/**
 * One thing to look at first. A ranked fact, not an interpretation: the
 * rule that selected it is stated, and the figure is a MetricView with its
 * own status, origin and method.
 */
export interface LookItem {
  rank: number;
  /** The fixed rule that produced this item. */
  rule: string;
  /** What the figure is, e.g. "Highest ATC&C among feeders". */
  title: string;
  subject: { kind: LevelKind; id: string; name: string };
  metric: MetricView;
  /** A second number that belongs with the first, e.g. hours over rating. */
  detail: { label: string; value: number; unit: "hours" | "days" } | null;
}

export interface ExecutiveView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  facts: { label: string; value: string }[];
  whereToLook: LookItem[];
  /** How the list is produced, shown with it. */
  whereToLookMethod: string;
  losses: LossesView | null;
  lossesNote: string | null;
  reliability: ReliabilityView;
  bandCompliance: BandComplianceRow[];
  transformerLoading: TransformerLoadingRow[];
  alarms: NotAvailableView;
}
