import type { LossesView, MetricView, RevenueGapRow, RevenueGapView, SourcingView } from "../operations/views.ts";

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

export interface RevenueWorkspaceView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  sourcing: SourcingView;
  /** The portfolio's revenue gap, and each feeder's. */
  gap: RevenueGapView;
  gapByFeeder: RevenueGapRow[];
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
