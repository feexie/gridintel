import type { KpiKey, ReportedKpi, ScopeRef } from "@/domain";
import type { RepositoryResult } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — REPORTED FIGURES

   Reported figures are returned exactly as stored: no unit
   conversion, and figures from different sources for the same
   metric and scope are all returned, never reconciled.
========================================================== */

export interface ReportedKpiQuery {
  /** Only these metrics; all metrics when absent. */
  metrics?: readonly KpiKey[];
  /** Only figures for these resolved scopes; all figures when absent. */
  scopes?: readonly ScopeRef[];
}

export interface ReportedKpiRepository {
  listReportedKpis(query: ReportedKpiQuery): Promise<RepositoryResult<ReportedKpi>>;
}
