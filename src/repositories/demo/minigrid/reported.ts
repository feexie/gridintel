import type { KpiBasis, KpiKey, KpiUnit, ReportedKpi } from "@/domain";
import { DEMO_CLOCK, DEMO_PERIOD } from "../clock.ts";
import { demoProvenance } from "../sources.ts";
import { MINIGRID_CURRENCY, MINIGRID_ORGANIZATION_ID, MINIGRID_ORGANIZATION_NAME, SITE_REPORT_SOURCE } from "./design.ts";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES: THE MONTHLY SITE REPORT

   One synthetic document per site: the operator's monthly site
   performance report, of the kind a funder or a programme receives.
   Its figures were WRITTEN, not calculated: they are what an
   operator might claim. Some agree with the records and some do
   not, so that a claimed figure beside the calculated one shows a
   variance. Each variance below is a designed finding: do not
   retune a figure to remove it.

   Every figure states its basis, and a figure is compared only with
   the calculation on the same basis:
   - Tamarind Cross reports close to its records. Its collection
     efficiency is stated on an ACCRUAL basis, so it cannot be set
     beside the calculated cash figure.
   - Dry River overstates its renewable fraction and its uptime, and
     understates its generator's running hours.
   - Palm Landing overstates collection and revenue, and counts
     every account on its register as a connection, which it says.
   - Granite Hill reports its uptime WITHOUT saying which
     interruptions it counts, so that figure is not comparable.
========================================================== */

const DOCUMENT = "Monthly site performance report, September 2026 (synthetic)";
const METHODOLOGY = { name: "Operator's site reporting (synthetic)", description: "The operator's own reporting to its funders. Each figure states its basis." };

interface Claim {
  metric: KpiKey;
  value: number;
  unit: KpiUnit;
  basis: KpiBasis | null;
}

const ALL_INTERRUPTIONS: KpiBasis = { interruptionClasses: ["network", "upstream_supply", "load_management", "other"], plannedInterruptions: "included" };
const UNPLANNED_ONLY: KpiBasis = { ...ALL_INTERRUPTIONS, plannedInterruptions: "excluded" };
const OF_GENERATED: KpiBasis = { shareOf: "energy_generated" };

function claims(figures: {
  generatedKwh: number;
  renewablePercent: number;
  uptimePercent: number;
  uptimeBasis: KpiBasis | null;
  soldKwh: number;
  connections: number;
  connectionsBasis: "active" | "all";
  collectedNgn: number;
  collectionPercent: number;
  collectionBasis: "cash" | "accrual";
  generatorHours?: number;
}): Claim[] {
  return [
    { metric: "energy_generated", value: figures.generatedKwh, unit: "kWh", basis: {} },
    { metric: "renewable_fraction", value: figures.renewablePercent, unit: "percent", basis: OF_GENERATED },
    { metric: "availability", value: figures.uptimePercent, unit: "percent", basis: figures.uptimeBasis },
    { metric: "energy_billed", value: figures.soldKwh, unit: "kWh", basis: { energySold: "billed" } },
    { metric: "connection_count", value: figures.connections, unit: "count", basis: { connections: figures.connectionsBasis } },
    { metric: "revenue_collected", value: figures.collectedNgn, unit: "currency", basis: { collection: "cash" } },
    { metric: "collection_efficiency", value: figures.collectionPercent, unit: "percent", basis: { collection: figures.collectionBasis } },
    ...(figures.generatorHours === undefined ? [] : [{ metric: "generator_runtime" as const, value: figures.generatorHours, unit: "hours" as const, basis: {} }]),
  ];
}

const REPORTS: Record<string, Claim[]> = {
  "MG-TAM": claims({ generatedKwh: 11870, renewablePercent: 96, uptimePercent: 99.7, uptimeBasis: ALL_INTERRUPTIONS, soldKwh: 10450, connections: 465, connectionsBasis: "active", collectedNgn: 2563700, collectionPercent: 99, collectionBasis: "accrual", generatorHours: 37 }),
  "MG-DRY": claims({ generatedKwh: 8930, renewablePercent: 68, uptimePercent: 99.5, uptimeBasis: UNPLANNED_ONLY, soldKwh: 7760, connections: 300, connectionsBasis: "active", collectedNgn: 2126000, collectionPercent: 97, collectionBasis: "cash", generatorHours: 190 }),
  "MG-PLM": claims({ generatedKwh: 9370, renewablePercent: 64, uptimePercent: 98.8, uptimeBasis: ALL_INTERRUPTIONS, soldKwh: 7760, connections: 417, connectionsBasis: "all", collectedNgn: 1650000, collectionPercent: 82, collectionBasis: "cash", generatorHours: 305 }),
  "MG-GRN": claims({ generatedKwh: 1920, renewablePercent: 100, uptimePercent: 99.9, uptimeBasis: null, soldKwh: 1510, connections: 130, connectionsBasis: "active", collectedNgn: 365300, collectionPercent: 93, collectionBasis: "cash" }),
};

export function buildSiteReportedKpis(): ReportedKpi[] {
  return Object.keys(REPORTS)
    .flatMap((siteId) =>
      REPORTS[siteId].map((claim): ReportedKpi => {
        const id = `rk:${SITE_REPORT_SOURCE.id}:site:${siteId}:${claim.metric}`;
        return {
          id,
          metric: claim.metric,
          scope: { kind: "site", id: siteId },
          period: DEMO_PERIOD,
          asOf: null,
          value: claim.value,
          unit: claim.unit,
          ...(claim.unit === "currency" ? { currency: MINIGRID_CURRENCY } : {}),
          source: { name: MINIGRID_ORGANIZATION_NAME, kind: "gridintel_synthetic", organizationId: MINIGRID_ORGANIZATION_ID },
          document: { title: DOCUMENT },
          basis: claim.basis,
          methodology: METHODOLOGY,
          reportedAt: DEMO_CLOCK,
          provenance: demoProvenance(SITE_REPORT_SOURCE, id),
        };
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
