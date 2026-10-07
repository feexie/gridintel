import type { LossesView, MetricView, RevenueGapPartView, RevenueGapRow, RevenueGapView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — REVENUE WORKSPACE VIEW MODEL

   What the Revenue screen receives. Its job: "Where is revenue not
   realised, who is not paying, and is the loss commercial or
   collection?"
========================================================== */

/** Billing and collection of one customer class, as the Operations screens give it. */
export type CustomerClassRow = LossesView["byCustomerClass"][number];

export interface FeederRevenueRow {
  id: string;
  name: string;
  band: string | null;
  /** The feeder's losses as shares of its energy input: technical, commercial, collection, and their sum. */
  losses: LossesView;
  /** The same two losses in money, monthly. */
  commercialGap: MetricView;
  collectionGap: MetricView;
  notRealised: MetricView;
  /** Billing and collection by customer class on this feeder, largest shortfall first. */
  byCustomerClass: CustomerClassRow[];
}

/**
 * How the commercial gap is valued, as a listing. The sections valued whole (the distribution
 * transformers) are ordered by amount and cut to the largest few unless all are asked for; the
 * screen neither orders nor cuts. The residuals above them are few and are never cut.
 */
export interface ValuationView {
  /** Largest amount first; a section with no amount is last. */
  sections: RevenueGapPartView[];
  /** How many sections there are, whichever listing is shown. */
  sectionsTotal: number;
  /** The cut-off of the short listing. */
  limit: number;
  /** True when every section is in `sections`. */
  complete: boolean;
  residuals: RevenueGapPartView[];
}

export interface RevenueWorkspaceView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  sourcing: SourcingView;
  /** The portfolio's revenue gap, and each feeder's. */
  gap: RevenueGapView;
  gapByFeeder: RevenueGapRow[];
  /** The valuation of the portfolio's commercial gap, section by section. */
  valuation: ValuationView;
  /** The portfolio's billing and collection. */
  revenueBilled: MetricView;
  revenueCollected: MetricView;
  collectionEfficiency: MetricView;
  collectionBasis: "cash";
  /** By customer class across the portfolio, largest shortfall first. */
  byCustomerClass: CustomerClassRow[];
  /** Every feeder, in registry order. */
  feeders: FeederRevenueRow[];
}
