import type { LossesView, MetricView, NotAvailableView, ReliabilityView, RevenueGapView } from "../operations/views.ts";
import type { AttentionSubject } from "./attention.ts";

/* ==========================================================
   SERVICES — EXECUTIVE VIEW MODEL

   What the Executive screen receives. Its job: "What is happening
   across the portfolio, and where should I look first?"
========================================================== */

export type { AttentionSubject, Finding } from "./attention.ts";

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

export interface FeederGapRow {
  feederId: string;
  feederName: string;
  commercial: MetricView;
  collection: MetricView;
  notRealised: MetricView;
}

export interface ExecutiveView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  facts: { label: string; value: string }[];
  /** Equipment at risk of failure. Its own group, shown first, never ranked by money. */
  assetRisk: AttentionSubject[];
  /** Feeders ranked by estimated revenue not realised, then subjects with no money figure in rule order. */
  whereToLook: AttentionSubject[];
  /** How the lists are produced and ranked, shown with them. */
  whereToLookMethod: string;
  losses: LossesView | null;
  lossesNote: string | null;
  revenueGap: RevenueGapView;
  gapByFeeder: FeederGapRow[];
  reliability: ReliabilityView;
  bandCompliance: BandComplianceRow[];
  transformerLoading: TransformerLoadingRow[];
  alarms: NotAvailableView;
}
