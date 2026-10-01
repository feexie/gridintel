import type { ReportedKpi, ScopeRef } from "@/domain";
import type { ReportedKpiRepository } from "../../repositories/ports/index.ts";
import type { CalculatedKpi, CalculationContext, KpiComparison, MonetaryInput } from "../../analytics/index.ts";
import { calculateCollectionEfficiency, compareKpi, missingMoney } from "../../analytics/index.ts";
import { reportedMoney } from "./inputs.ts";

/* ==========================================================
   SERVICES — REGIONAL COLLECTION EFFICIENCY

   Fetches a region's reported revenue, has analytics calculate
   collection efficiency from it, and compares the result with every
   reported collection-efficiency figure for the region.

   Revenue from different sources is never combined: one
   calculation is made per source that reports revenue. A missing
   revenue figure stays missing, so that calculation is
   insufficient_data; nothing is filled in.
========================================================== */

export interface CollectionCalculation {
  /** The DataSource the revenue figures came from. */
  sourceSystem: string;
  calculated: CalculatedKpi;
  /** One per reported collection-efficiency figure for the region, from any source. */
  comparisons: KpiComparison[];
}

export interface RegionCollectionResult {
  scope: ScopeRef;
  calculations: CollectionCalculation[];
  /** Reported figures that could not be used, and why. */
  skipped: { kpiId: string; reason: string }[];
}

function bySource(kpis: readonly ReportedKpi[]): Map<string, ReportedKpi[]> {
  const groups = new Map<string, ReportedKpi[]>();
  for (const kpi of kpis) {
    const source = kpi.provenance.sourceSystem;
    groups.set(source, [...(groups.get(source) ?? []), kpi]);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export async function regionCollectionEfficiency(params: {
  reported: ReportedKpiRepository;
  regionId: string;
  context: CalculationContext;
}): Promise<RegionCollectionResult> {
  const scope: ScopeRef = { kind: "region", id: params.regionId };
  const { records } = await params.reported.listReportedKpis({
    metrics: ["revenue_billed", "revenue_collected", "collection_efficiency"],
    scopes: [scope],
  });
  const reportedEfficiency = records.filter((kpi) => kpi.metric === "collection_efficiency");
  const revenue = records.filter((kpi) => kpi.metric !== "collection_efficiency");

  const result: RegionCollectionResult = { scope, calculations: [], skipped: [] };

  for (const [sourceSystem, kpis] of bySource(revenue)) {
    const billed = kpis.filter((kpi) => kpi.metric === "revenue_billed");
    const collected = kpis.filter((kpi) => kpi.metric === "revenue_collected");
    if (billed.length > 1 || collected.length > 1) {
      for (const kpi of kpis) {
        result.skipped.push({ kpiId: kpi.id, reason: `${sourceSystem} reports more than one figure for ${kpi.metric}.` });
      }
      continue;
    }
    if (billed[0] && collected[0] && JSON.stringify(billed[0].period) !== JSON.stringify(collected[0].period)) {
      for (const kpi of kpis) {
        result.skipped.push({ kpiId: kpi.id, reason: `${sourceSystem} reports billed and collected for different periods.` });
      }
      continue;
    }

    const converted: Partial<Record<"billed" | "collected", MonetaryInput>> = {};
    for (const [name, kpi] of [["billed", billed[0]], ["collected", collected[0]]] as const) {
      if (kpi === undefined) continue;
      const conversion = reportedMoney(kpi);
      if (conversion.ok) converted[name] = conversion.input;
      else result.skipped.push({ kpiId: kpi.id, reason: conversion.reason });
    }
    const present = converted.billed ?? converted.collected;
    if (present === undefined) continue;

    const missing = (metric: string) =>
      missingMoney(present.currency, present.scale, `reported:${sourceSystem}:${scope.kind}:${scope.id}:${metric}`);
    const calculated = calculateCollectionEfficiency({
      scope,
      period: (billed[0] ?? collected[0]).period,
      revenueBilled: converted.billed ?? missing("revenue_billed"),
      revenueCollected: converted.collected ?? missing("revenue_collected"),
      context: params.context,
    });
    result.calculations.push({
      sourceSystem,
      calculated,
      comparisons: reportedEfficiency.map((kpi) => compareKpi(kpi, calculated)),
    });
  }

  return result;
}
