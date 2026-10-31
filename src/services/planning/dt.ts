import type { DataSource } from "@/domain";
import type { OperationsRuntime } from "../operations/levels.ts";
import { metersWithRole, servicePointsOnTransformer } from "../../analytics/index.ts";
import { DT_SEQUENCING_REFERENCE, rankDts, revolve, shuffledOrder, type DtFacts } from "../../analytics/planning/dtSequencing.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { sectionLosses } from "../analytics/losses.ts";
import { loadTopology } from "../analytics/topology.ts";
import { startingCostPerMeter } from "./allocation.ts";
import { formatCount, formatNaira } from "./metering.ts";
import type { DtSequencingView, ShownFigure } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: DT SEQUENCING INSIDE ONE DISCO (M4)

   Which distribution transformers the fund meters first, on the
   synthetic demonstration network (docs/geh/DESIGN.md, section 5).
   Each DT's unmetered customers, estimated billing and commercial
   loss come from the network's records through the existing loss and
   revenue-gap services; the method is analytics/planning/dtSequencing.
   Every figure rests on synthetic records and is marked so.
========================================================== */

export const DT_SEQUENCING_PATH = "/dashboard/planning/metering/dt";

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The ranking's own inputs, with their defaults and basis. */
export const DT_INPUTS = [
  { key: "estRecovered", label: "Estimated billing recovered once metered", defaultValue: 15, min: 0, max: 100, step: 1, unit: "%", basis: "The Metering Fund's collection gain: metered customers stop disputing estimated bills. Assumption." },
  { key: "lossRecovered", label: "Unmetered customers' commercial loss recovered once metered", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%", basis: "The DT's commercial loss is shared across its connections; this share of the unmetered customers' part is billed once they are metered. Assumption, set by the user." },
  { key: "budget", label: "Budget a month for meters", defaultValue: 5_000_000, min: 0, max: 1_000_000_000, step: 500_000, unit: "₦", basis: "The same in both orders. Assumption, set by the user." },
  { key: "months", label: "Months shown", defaultValue: 36, min: 12, max: 120, step: 12, unit: "months", basis: "The revolving chart's span." },
] as const;

function readInputs(query: Query): Record<string, number> {
  const values: Record<string, number> = {};
  for (const spec of DT_INPUTS) {
    const raw = first(query[spec.key]);
    const parsed = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
    values[spec.key] = Number.isFinite(parsed) && parsed >= spec.min && parsed <= spec.max ? parsed : spec.defaultValue;
  }
  return values;
}

const percent = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;

export async function dtSequencingView(runtime: OperationsRuntime, query: Query): Promise<DtSequencingView> {
  const values = readInputs(query);
  const { repos, period, now, cache } = runtime;
  const context = { computedAt: now };
  const { index, snapshot } = await loadTopology(repos.registry, now, cache);

  const costPerMeter = startingCostPerMeter();

  const sources = new Map<string, DataSource>();
  let synthetic = false;
  const facts: (DtFacts & { name: string; feeder: string; atcc: number | null })[] = [];
  for (const dt of snapshot.distributionTransformers) {
    const scope = { kind: "distribution_transformer" as const, id: dt.id };
    const points = servicePointsOnTransformer(index, dt.id);
    const unmetered = points.filter((sp) => metersWithRole(index, "service_point", sp.id).length === 0).length;
    const losses = await sectionLosses({ repos, scope, period, context, cache });
    const gap = await scopeRevenueGap({ repos, scope, period, context, cache });
    for (const one of [...losses.sourcing.sources, ...gap.sourcing.sources]) sources.set(one.id, one);
    synthetic ||= losses.sourcing.synthetic || gap.sourcing.synthetic;
    const billing = losses.result.billing;
    // No boundary meter on the DT: its loss cannot be measured and is not available, never 0.
    const boundary = losses.result.account.boundary.input.netKwh !== null;
    facts.push({
      id: dt.id,
      name: dt.name,
      feeder: index.feederById.get(dt.feederId)?.name ?? dt.feederId,
      connections: points.length,
      unmetered,
      estimatedBillingPerMonth: billing.accountsInScope === null ? null : billing.byBasis.estimated.amount,
      commercialLossPerMonth: boundary ? gap.result.commercial.amount : null,
      atcc: boundary && losses.result.atcc.atcc.value !== null ? losses.result.atcc.atcc.value : null,
    });
  }

  const recovery = { estimatedBilling: values.estRecovered / 100, commercialLoss: values.lossRecovered / 100 };
  const ranked = rankDts(facts, costPerMeter, recovery);
  const toMeter = ranked.filter((dt) => dt.rank !== null);
  const random = shuffledOrder(toMeter);
  const rankedRun = revolve(toMeter, values.budget, values.months);
  const randomRun = revolve(random, values.budget, values.months);
  const factById = new Map(facts.map((one) => [one.id, one]));

  const totalCapex = toMeter.reduce((sum, dt) => sum + dt.capex, 0);
  const totalRecovered = toMeter.reduce((sum, dt) => sum + dt.recoveredPerYear, 0);
  const totalUnmetered = toMeter.reduce((sum, dt) => sum + dt.unmetered, 0);
  const firstFive = toMeter.slice(0, 5);
  const fiveCapex = firstFive.reduce((sum, dt) => sum + dt.capex, 0);
  const fiveRecovered = firstFive.reduce((sum, dt) => sum + dt.recoveredPerYear, 0);
  const year1 = Math.min(12, values.months);
  const allMetered = (month: number | null) => (month === null ? `not within ${values.months} months` : `in month ${month}`);

  const headline =
    toMeter.length === 0
      ? "Every customer on this network is metered: there is nothing to sequence."
      : `Metering the 5 highest-ranked DTs first recovers ${percent(fiveRecovered / totalRecovered)} of the revenue for ${percent(fiveCapex / totalCapex)} of the CAPEX.`;
  const revolvingLine =
    toMeter.length === 0
      ? ""
      : `With ${formatNaira(values.budget)} a month and recoveries spent on more meters, the ranked order meters every DT ${allMetered(rankedRun.monthAllMetered)}; a random order ${allMetered(randomRun.monthAllMetered)}. In year 1 the ranked order recovers ${formatNaira(rankedRun.months[year1].recovered)}, a random order ${formatNaira(randomRun.months[year1].recovered)}.`;

  const figures: ShownFigure[] = [
    { key: "dts", label: "DTs with unmetered customers", value: `${toMeter.length} of ${facts.length}`, origin: "synthetic", basis: "Service points with no meter of their own, on the synthetic network" },
    { key: "unmetered", label: "Unmetered customers", value: formatCount(totalUnmetered), origin: "synthetic", basis: "Counted from the synthetic network's records" },
    { key: "capex", label: "CAPEX to meter them all", value: formatNaira(totalCapex), origin: "calculated", basis: `Unmetered customers × ${formatNaira(costPerMeter)} a meter, the Metering Fund's cost at the start` },
    { key: "recovered", label: "Revenue recovered a year once all are metered", value: formatNaira(totalRecovered), origin: "calculated", basis: "On synthetic billing and loss records, with the recovery shares below" },
  ];

  const name = (id: string) => factById.get(id)?.name ?? id;
  return {
    network: `${snapshot.organizations[0]?.name ?? "Synthetic network"}, ${facts.length} DTs on ${new Set(facts.map((one) => one.feeder)).size} feeders`,
    headline,
    headlineHow:
      "How this is calculated: each DT's revenue recovered a year = 12 × (estimated billing a month × the share recovered + commercial loss a month × unmetered ÷ connections × the share recovered). CAPEX = unmetered customers × the cost of a meter. DTs are ranked by recovered a year ÷ CAPEX. Synthetic network, September 2026.",
    revolvingLine,
    figures,
    rows: ranked.map((dt) => {
      const one = factById.get(dt.id)!;
      return {
        id: dt.id,
        rank: dt.rank === null ? "—" : String(dt.rank),
        name: one.name,
        feeder: one.feeder,
        connections: formatCount(one.connections),
        unmetered: formatCount(dt.unmetered),
        estimatedBilling: one.estimatedBillingPerMonth === null ? "Not available" : formatNaira(one.estimatedBillingPerMonth),
        loss: one.commercialLossPerMonth === null ? "Not available" : formatNaira(one.commercialLossPerMonth),
        atcc: one.atcc === null ? "Not available" : percent(one.atcc, 1),
        capex: dt.rank === null ? "Nothing to meter" : formatNaira(dt.capex),
        recovered: dt.rank === null ? "—" : formatNaira(dt.recoveredPerYear),
        perNaira: dt.perNaira === null ? "—" : `₦${dt.perNaira.toFixed(2)}`,
        missing: dt.missing.map((part) => (part === "commercial loss" ? "commercial loss (no boundary meter)" : part)),
      };
    }),
    rowsHow:
      "Ranked by revenue recovered a year per naira of CAPEX. A DT with no boundary meter has its loss not available, never 0: it is ranked on estimated billing alone and the row says so. A DT with every customer metered is not ranked.",
    chart: {
      title: "Revolving effect: recovered revenue, ranked order against a random order, same budget",
      unit: "₦ million",
      months: values.months,
      base: { label: "Ranked by revenue per naira", values: rankedRun.months.map((month) => month.recovered / 1e6) },
      stressed: { label: "A fixed random order", values: randomRun.months.map((month) => month.recovered / 1e6) },
      how: `How this is calculated: each month the budget, plus what the meters already installed recover, buys meters in the order shown; a meter recovers from the month after it is installed. The random order is a fixed shuffle (seed ${DT_SEQUENCING_REFERENCE.parameters.shuffleSeed}), the same on every run. First five in the random order: ${random.slice(0, 5).map((dt) => name(dt.id)).join(", ")}.`,
    },
    fairness:
      "This order is for the fund's own meters, where revenue repays the capital. Public meters on this DisCo's share go to the DTs with the most unmetered customers first, whatever the revenue: poor residential customers are never last in the queue.",
    inputs: DT_INPUTS.map((spec) => ({ key: spec.key, label: spec.label, value: values[spec.key], defaultValue: spec.defaultValue, min: spec.min, max: spec.max, step: spec.step, unit: spec.unit, basis: spec.basis })),
    methodology: { id: DT_SEQUENCING_REFERENCE.id, version: DT_SEQUENCING_REFERENCE.version, disclaimer: DT_SEQUENCING_REFERENCE.disclaimer },
    sourcing: { synthetic, sources: [...sources.values()].map((one) => ({ id: one.id, name: one.name, kind: one.kind })) },
  };
}
