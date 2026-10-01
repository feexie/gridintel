import type { KpiKey, KpiUnit, ReportedKpi, ScopeRef } from "@/domain";
import { DEMO_CLOCK, DEMO_PERIOD } from "./clock.ts";
import { DEMO_REGION_ID, DEMO_SUBSTATION_ID } from "./network.ts";
import { DEMO_ORGANIZATION_ID, REPORT_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — REPORTED FIGURES

   Two synthetic documents:
   - a technical-loss study, giving the energy lost in each section
     over the month. Technical loss cannot be metered directly, so
     the energy account takes it from this study as a reported input;
   - the utility's own monthly report, with headline figures that
     were written to differ from what the records support, so that
     reported and calculated values can be compared.
========================================================== */

const STUDY = {
  title: "Technical loss study, September 2026 (synthetic)",
  methodology: {
    name: "Synthetic loss study",
    description: "Losses taken from the synthetic network model: fixed loss fractions per section.",
  },
};

const MONTHLY_REPORT = {
  title: "Monthly operations report, September 2026 (synthetic)",
  methodology: {
    name: "Utility internal reporting (synthetic)",
    description: "The utility's own basis. Its reliability figures exclude load shedding and loss of upstream supply.",
  },
};

/** Headline figures as the synthetic monthly report states them. */
const REPORTED_HEADLINES: readonly { scope: ScopeRef; metric: KpiKey; value: number; unit: KpiUnit }[] = [
  ...headlines({ kind: "region", id: DEMO_REGION_ID }, { atcc: 18.5, collection: 95.0 }),
  ...headlines({ kind: "substation", id: DEMO_SUBSTATION_ID }, { atcc: 18.5, collection: 95.0, saidiHours: 5.1, saifi: 1.1 }),
  ...headlines({ kind: "feeder", id: "FD-MKT" }, { atcc: 11.0, collection: 96.0, saidiHours: 1.8, saifi: 0.4 }),
  ...headlines({ kind: "feeder", id: "FD-OLD" }, { atcc: 48.0, collection: 72.0, saidiHours: 7.2, saifi: 1.5 }),
];

function headlines(
  scope: ScopeRef,
  figures: { atcc: number; collection: number; saidiHours?: number; saifi?: number },
): { scope: ScopeRef; metric: KpiKey; value: number; unit: KpiUnit }[] {
  return [
    { scope, metric: "atcc", value: figures.atcc, unit: "percent" },
    { scope, metric: "collection_efficiency", value: figures.collection, unit: "percent" },
    ...(figures.saidiHours === undefined ? [] : [{ scope, metric: "saidi" as const, value: figures.saidiHours, unit: "hours" as const }]),
    ...(figures.saifi === undefined ? [] : [{ scope, metric: "saifi" as const, value: figures.saifi, unit: "interruptions_per_customer" as const }]),
  ];
}

function reported(
  scope: ScopeRef,
  metric: KpiKey,
  value: number,
  unit: KpiUnit,
  document: typeof STUDY | typeof MONTHLY_REPORT,
): ReportedKpi {
  const id = `rk:${REPORT_SOURCE.id}:${scope.kind}:${scope.id}:${metric}`;
  return {
    id,
    metric,
    scope,
    period: DEMO_PERIOD,
    asOf: null,
    value,
    unit,
    source: { name: "Savanna Electricity Distribution (synthetic)", kind: "gridintel_synthetic", organizationId: DEMO_ORGANIZATION_ID },
    document: { title: document.title },
    methodology: document.methodology,
    reportedAt: DEMO_CLOCK,
    provenance: demoProvenance(REPORT_SOURCE, id),
  };
}

export function buildDemoReportedKpis(technicalLossKwh: ReadonlyMap<string, number>): ReportedKpi[] {
  const study = [...technicalLossKwh.entries()].map(([key, kwh]) => {
    const [kind, id] = key.split(":");
    return reported({ kind: kind as ScopeRef["kind"], id }, "technical_loss", Math.round(kwh), "kWh", STUDY);
  });
  const headlines = REPORTED_HEADLINES.map((figure) =>
    reported(figure.scope, figure.metric, figure.value, figure.unit, MONTHLY_REPORT),
  );
  return [...study, ...headlines].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
