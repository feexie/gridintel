import type { KpiBasis, KpiKey, KpiUnit, ReportedKpi, ScopeRef } from "@/domain";
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
     reported and calculated values can be compared. The report
     states the basis of each figure: its reliability figures count
     network interruptions only (no load shedding, no loss of upstream
     supply); its losses are a fraction of energy input; collection is
     on a cash basis, except for Old Town, whose collection efficiency
     is on an accrual basis and so cannot be compared with the
     calculated cash-basis figure.
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
    description: "The utility's own reporting. Each figure states its basis.",
  },
};

/** Headline figures as the synthetic monthly report states them. */
interface Headline {
  scope: ScopeRef;
  metric: KpiKey;
  value: number;
  unit: KpiUnit;
  basis: KpiBasis;
}

const LOSS_BASIS = "energy_input_net_of_transfers_out" as const;
const NETWORK_ONLY: KpiBasis = { interruptionClasses: ["network"], plannedInterruptions: "included" };

const REPORTED_HEADLINES: readonly Headline[] = [
  ...headlines({ kind: "region", id: DEMO_REGION_ID }, { atcc: 26.0, collection: 88.0 }),
  ...headlines({ kind: "substation", id: DEMO_SUBSTATION_ID }, { atcc: 27.0, collection: 91.0, saidiHours: 3.0, saifi: 0.9 }),
  ...headlines({ kind: "feeder", id: "FD-MKT" }, { atcc: 16.0, collection: 94.0, saidiHours: 0.2, saifi: 0.1 }),
  ...headlines({ kind: "feeder", id: "FD-OLD" }, { atcc: 52.0, collection: 72.0, saidiHours: 5.0, saifi: 1.4 }, "accrual"),
  ...headlines({ kind: "substation", id: "SS-HIL" }, { atcc: 33.0, collection: 74.0, saidiHours: 1.9, saifi: 0.8 }),
  ...headlines({ kind: "feeder", id: "FD-GOV" }, { atcc: 30.0, collection: 76.0, saidiHours: 2.7, saifi: 1.0 }),
  ...headlines({ kind: "feeder", id: "FD-FRM" }, { atcc: 61.0, collection: 55.0, saidiHours: 0.4, saifi: 0.2 }),
];

function headlines(
  scope: ScopeRef,
  figures: { atcc: number; collection: number; saidiHours?: number; saifi?: number },
  collectionEfficiencyBasis: "cash" | "accrual" = "cash",
): Headline[] {
  return [
    { scope, metric: "atcc", value: figures.atcc, unit: "percent", basis: { lossBasis: LOSS_BASIS, collection: "cash" } },
    { scope, metric: "collection_efficiency", value: figures.collection, unit: "percent", basis: { collection: collectionEfficiencyBasis } },
    ...(figures.saidiHours === undefined
      ? []
      : [{ scope, metric: "saidi" as const, value: figures.saidiHours, unit: "hours" as const, basis: NETWORK_ONLY }]),
    ...(figures.saifi === undefined
      ? []
      : [{ scope, metric: "saifi" as const, value: figures.saifi, unit: "interruptions_per_customer" as const, basis: NETWORK_ONLY }]),
  ];
}

function reported(
  scope: ScopeRef,
  metric: KpiKey,
  value: number,
  unit: KpiUnit,
  document: typeof STUDY | typeof MONTHLY_REPORT,
  basis: KpiBasis,
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
    basis,
    methodology: document.methodology,
    reportedAt: DEMO_CLOCK,
    provenance: demoProvenance(REPORT_SOURCE, id),
  };
}

export function buildDemoReportedKpis(technicalLossKwh: ReadonlyMap<string, number>): ReportedKpi[] {
  const study = [...technicalLossKwh.entries()].map(([key, kwh]) => {
    const [kind, id] = key.split(":");
    return reported({ kind: kind as ScopeRef["kind"], id }, "technical_loss", Math.round(kwh), "kWh", STUDY, { lossBasis: LOSS_BASIS });
  });
  const headlines = REPORTED_HEADLINES.map((figure) =>
    reported(figure.scope, figure.metric, figure.value, figure.unit, MONTHLY_REPORT, figure.basis),
  );
  return [...study, ...headlines].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
