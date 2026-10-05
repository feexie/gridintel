import type { AlarmSubjectView, MetricView, ReliabilityView, ReportedComparisonView, RuleFindingView, SourcingView, SupplyView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — RELIABILITY WORKSPACE VIEW MODEL

   What the Reliability screen receives. Its job: "Which feeders fail
   their customers, why, and is it ours to fix?"
========================================================== */

export interface FeederReliabilityRow {
  /** Position by network-attributable SAIDI, highest first. */
  rank: number;
  id: string;
  name: string;
  substationName: string;
  customers: MetricView;
  /** The part of SAIDI and SAIFI attributed to the distribution network: what the rank is by. */
  networkSaidi: MetricView;
  networkSaifi: MetricView;
  /** Shown beside it, never ranked by. */
  upstreamSaidiHours: number | null;
  loadSheddingSaidiHours: number | null;
  totalSaidi: MetricView;
  /** Hours of supply per day and day-by-day compliance with the feeder's service band. */
  supply: SupplyView;
}

/** The portfolio's interruptions in one group of a breakdown. */
export interface BreakdownRowView {
  key: string;
  label: string;
  /** A word on the group where one is needed, e.g. which side of the boundary an origin point is on. */
  note: string | null;
  saidiHours: number | null;
  saifi: number | null;
  /** Share of all customer-hours interrupted. */
  share: number | null;
}

/** An element interruptions began at. */
export interface OriginRowView {
  subject: AlarmSubjectView;
  /** The part of the system it is, in words. */
  originPoint: string;
  attribution: "network" | "upstream_supply" | "load_management" | "other";
  attributionLabel: string;
  /** Interruptions that began there in the period. */
  interruptions: number;
  /** What they added to the portfolio's SAIDI. */
  saidiHours: number | null;
}

export interface ReliabilityWorkspaceView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  sourcing: SourcingView;
  /** The portfolio's indices, their split by attribution class and its hours of supply. */
  portfolio: ReliabilityView;
  /** Every feeder, ranked by network-attributable SAIDI. */
  feeders: FeederReliabilityRow[];
  byCause: BreakdownRowView[];
  byOriginPoint: BreakdownRowView[];
  /** The elements interruptions other than load shedding began at, most interruptions first. */
  origins: OriginRowView[];
  originsNote: string;
  /** Every reported reliability figure beside the calculation on its basis, each naming the scope it is stated for. */
  comparisons: ReportedComparisonView[];
  /** What each feeder report's attribution rule changes. */
  ruleFindings: RuleFindingView[];
  method: { id: string; version: string };
}
