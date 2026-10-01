import type { DataSource, KpiKey, KpiUnit, ReportedKpi, ScopeRef } from "@/domain";
import type { LegacyData } from "./legacy.ts";
import type { MappingIssue } from "./issues.ts";
import { LEGACY_DATASETS } from "./legacy.ts";
import { mappingIssue } from "./issues.ts";
import { reportedKpiId } from "./ids.ts";
import { EXECUTIVE_SOURCE, MOCK_ORGANIZATION_ID, OPERATIONS_SOURCE, mockProvenance } from "./sources.ts";

/* ==========================================================
   MOCK ADAPTER — REPORTED FIGURE MAPPING

   Legacy counts and KPIs → ReportedKpi, exactly as stated. The
   legacy data gives no period, as-of time, document or
   methodology, so those are all null. Values are never converted
   or corrected, and figures that disagree between the operations
   and executive datasets are both kept (CONFLICTING_SOURCES).

   A legacy "transformers" count never says which kind of
   transformer, so it is always transformer_count_unspecified (D11).
   A unit is only recorded where the data or its display states it;
   a figure with no stated unit is not mapped.
========================================================== */

export interface ReportedMapping {
  reportedKpis: ReportedKpi[];
  issues: MappingIssue[];
}

type Mapped = { metric: KpiKey; unit: KpiUnit; currency?: string; assumption?: string };
type Unmapped = { unmapped: string };
type FieldRules<T> = Partial<Record<keyof T & string, Mapped | Unmapped>>;

const count = (metric: KpiKey): Mapped => ({ metric, unit: "count" });
const percent = (metric: KpiKey): Mapped => ({ metric, unit: "percent" });
const naira = (metric: KpiKey): Mapped => ({
  metric,
  unit: "currency",
  currency: "NGN",
  assumption: "The legacy data states no currency; NGN is taken from the ₦ shown by the dashboard.",
});
const SAIFI: Mapped = { metric: "saifi", unit: "interruptions_per_customer" };
const SAIDI_NO_UNIT: Unmapped = { unmapped: "SAIDI with no stated unit (hours or minutes); not mapped." };

const OPERATIONS_REGION_RULES: FieldRules<LegacyData["regions"][number]> = {
  substations: count("substation_count"),
  feeders: count("feeder_count"),
  transformers: count("transformer_count_unspecified"),
  customers: count("customer_count"),
  activeOutages: count("active_outage_count"),
  activeAlarms: count("active_alarm_count"),
  saidi: SAIDI_NO_UNIT,
  saifi: SAIFI,
  atccLosses: percent("atcc"),
  collectionEfficiency: percent("collection_efficiency"),
};

const EXECUTIVE_REGION_RULES: FieldRules<LegacyData["utilityRegions"][number]> = {
  substations: count("substation_count"),
  feeders: count("feeder_count"),
  transformers: count("transformer_count_unspecified"),
  customers: count("customer_count"),
  prepaidMeters: count("prepaid_meter_count"),
  postpaidMeters: count("postpaid_meter_count"),
  postpaidCustomers: { unmapped: "There is no metric for postpaid customers; not mapped." },
  revenueBilled: naira("revenue_billed"),
  revenueCollected: naira("revenue_collected"),
  collectionEfficiency: percent("collection_efficiency"),
  technicalLosses: percent("technical_loss"),
  commercialLosses: percent("commercial_loss"),
  atccLosses: percent("atcc"),
  saidi: {
    metric: "saidi",
    unit: "hours",
    assumption: 'The legacy data states no unit; hours are taken from the "hrs" shown by the executive dashboard.',
  },
  saifi: SAIFI,
};

const SUBSTATION_RULES: FieldRules<LegacyData["substations"][number]> = {
  availableCapacityMva: { metric: "available_capacity", unit: "MVA" },
  transformers: count("transformer_count_unspecified"),
  feeders: count("feeder_count"),
};

const FEEDER_RULES: FieldRules<LegacyData["feeders"][number]> = {
  allocatedMw: { metric: "load_allocation", unit: "MW" },
  customers: count("customer_count"),
  transformers: count("transformer_count_unspecified"),
  smartMeters: count("meter_count"),
  outageHours: { metric: "outage_hours", unit: "hours" },
  saidi: SAIDI_NO_UNIT,
  saifi: SAIFI,
  technicalLoss: percent("technical_loss"),
  commercialLoss: percent("commercial_loss"),
};

const TRANSFORMER_RULES: FieldRules<LegacyData["transformers"][number]> = {
  loadPercent: percent("transformer_loading"),
  customers: count("customer_count"),
  smartMeters: count("meter_count"),
};

function mapRecord<T extends { id: string }>(
  record: T,
  rules: FieldRules<T>,
  scope: ScopeRef,
  source: DataSource,
  dataset: string,
  out: ReportedMapping,
): void {
  for (const [field, rule] of Object.entries(rules) as [keyof T & string, Mapped | Unmapped][]) {
    const issueSource = { dataset, recordId: record.id, field };
    if ("unmapped" in rule) {
      out.issues.push(mappingIssue("UNMAPPED_FIELD", rule.unmapped, issueSource));
      continue;
    }
    if (rule.assumption !== undefined) out.issues.push(mappingIssue("ASSUMED_VALUE", rule.assumption, issueSource));
    out.reportedKpis.push({
      id: reportedKpiId(source.id, scope, rule.metric),
      metric: rule.metric,
      scope,
      period: null,
      asOf: null,
      value: record[field] as number,
      unit: rule.unit,
      ...(rule.currency === undefined ? {} : { currency: rule.currency }),
      source: { name: source.name, kind: "gridintel_mock", organizationId: MOCK_ORGANIZATION_ID },
      document: null,
      // The legacy mock data states no basis for any figure.
      basis: null,
      methodology: null,
      reportedAt: null,
      provenance: mockProvenance(source, record.id),
    });
  }
}

/** One warning per scope and metric that the two sources state differently. Nothing is changed. */
function conflictIssues(kpis: readonly ReportedKpi[]): MappingIssue[] {
  const groups = new Map<string, ReportedKpi[]>();
  for (const kpi of kpis) {
    if (!("id" in kpi.scope)) continue;
    const key = `${kpi.scope.kind}:${kpi.scope.id}:${kpi.metric}`;
    groups.set(key, [...(groups.get(key) ?? []), kpi]);
  }
  const issues: MappingIssue[] = [];
  for (const group of groups.values()) {
    const sources = new Set(group.map((kpi) => kpi.provenance.sourceSystem));
    const statements = new Set(group.map((kpi) => `${kpi.value} ${kpi.unit}`));
    if (sources.size < 2 || statements.size < 2) continue;
    const { scope, metric } = group[0];
    const stated = group.map((kpi) => `${kpi.provenance.sourceSystem}: ${kpi.value} ${kpi.unit}`).join("; ");
    issues.push(
      mappingIssue("CONFLICTING_SOURCES", `Sources disagree on ${metric} (${stated}); all figures are kept.`, {
        dataset: `${LEGACY_DATASETS.regions} + ${LEGACY_DATASETS.utilityRegions}`,
        recordId: "id" in scope ? scope.id : undefined,
        field: metric,
      }),
    );
  }
  return issues;
}

export function mapReported(legacy: LegacyData): ReportedMapping {
  const out: ReportedMapping = { reportedKpis: [], issues: [] };
  const regionIds = new Set(legacy.regions.map((region) => region.id));

  for (const region of legacy.regions) {
    mapRecord(region, OPERATIONS_REGION_RULES, { kind: "region", id: region.id }, OPERATIONS_SOURCE,
      LEGACY_DATASETS.regions, out);
  }
  for (const region of legacy.utilityRegions) {
    if (!regionIds.has(region.id)) {
      out.issues.push(mappingIssue("DANGLING_REFERENCE", `No region "${region.id}" exists; the id is kept as written.`,
        { dataset: LEGACY_DATASETS.utilityRegions, recordId: region.id, field: "id" }));
    }
    mapRecord(region, EXECUTIVE_REGION_RULES, { kind: "region", id: region.id }, EXECUTIVE_SOURCE,
      LEGACY_DATASETS.utilityRegions, out);
  }
  for (const substation of legacy.substations) {
    mapRecord(substation, SUBSTATION_RULES, { kind: "substation", id: substation.id }, OPERATIONS_SOURCE,
      LEGACY_DATASETS.substations, out);
  }
  for (const feeder of legacy.feeders) {
    mapRecord(feeder, FEEDER_RULES, { kind: "feeder", id: feeder.id }, OPERATIONS_SOURCE, LEGACY_DATASETS.feeders, out);
  }
  for (const transformer of legacy.transformers) {
    mapRecord(transformer, TRANSFORMER_RULES, { kind: "distribution_transformer", id: transformer.id },
      OPERATIONS_SOURCE, LEGACY_DATASETS.transformers, out);
  }

  out.issues.push(...conflictIssues(out.reportedKpis));
  return out;
}
