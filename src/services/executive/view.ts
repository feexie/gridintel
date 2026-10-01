import type { ScopeRef } from "@/domain";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { LoadingView, LossesView, MetricView, ReliabilityView } from "../operations/views.ts";
import type { BandComplianceRow, ExecutiveView, LookItem, TransformerLoadingRow } from "./views.ts";
import { feedersOfSubstation, transformersOnFeeder } from "../../analytics/index.ts";
import { ALARMS, loadRegistry, loadingBlock, lossesBlock, reliabilityBlock, timeZoneOf } from "../operations/levels.ts";

/* ==========================================================
   SERVICES — EXECUTIVE READ MODEL

   "What is happening across the portfolio, and where should I look
   first?" Everything here comes from the same services as the
   Operations drill-down, so a figure on this screen is the figure
   the drill-down shows.

   WHERE TO LOOK is a ranked list of facts produced by fixed rules,
   applied in a fixed order. There is no scoring model, no weighting
   and no generated text: each item names the rule that selected it
   and carries the figure with its own status, origin and method.
   Figures without a value are never ranked.
========================================================== */

const WHERE_TO_LOOK_METHOD =
  "Fixed rules in a fixed order: (1) every transformer loaded above its rating, highest peak first; " +
  "(2) the feeder with the highest ATC&C; (3) every feeder that fell below its service-band minimum, most days first; " +
  "(4) the feeder with the lowest collection efficiency; (5) the transformer with the highest commercial loss; " +
  "(6) the feeder with the highest network-attributable SAIDI. Figures with no value are not ranked. No weighting, no AI.";

interface FeederFacts {
  id: string;
  name: string;
  losses: LossesView;
  reliability: ReliabilityView;
}

interface TransformerFacts {
  id: string;
  name: string;
  feederName: string;
  losses: LossesView;
  loading: LoadingView | null;
}

/** The entry with the highest (or lowest) value; entries without a value are left out. Ties go to the lower id. */
function extreme<T extends { id: string }>(entries: readonly T[], pick: (entry: T) => MetricView, direction: "highest" | "lowest"): T | null {
  let best: T | null = null;
  for (const entry of [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const value = pick(entry).value;
    if (value === null) continue;
    const bestValue = best === null ? null : (pick(best).value as number);
    if (bestValue === null || (direction === "highest" ? value > bestValue : value < bestValue)) best = entry;
  }
  return best;
}

function networkSaidi(reliability: ReliabilityView): MetricView {
  const network = reliability.attribution.find((row) => row.key === "network");
  return {
    ...reliability.saidi,
    label: "SAIDI, network-attributable",
    value: network?.saidiHours ?? null,
    derivation: "The part of SAIDI attributed to the distribution network: faults, planned work and weather. Load shedding and loss of upstream supply are not in it.",
  };
}

function whereToLook(feeders: readonly FeederFacts[], transformers: readonly TransformerFacts[]): LookItem[] {
  const items: Omit<LookItem, "rank">[] = [];

  const overloaded = transformers
    .filter((dt) => dt.loading !== null && (dt.loading.hoursOverRating ?? 0) > 0 && dt.loading.peak.value !== null)
    .sort((a, b) => (b.loading?.peak.value as number) - (a.loading?.peak.value as number) || (a.id < b.id ? -1 : 1));
  for (const dt of overloaded) {
    items.push({
      rule: "Transformer loaded above its rating",
      title: "Transformer over rating",
      subject: { kind: "distribution_transformer", id: dt.id, name: dt.name },
      metric: dt.loading!.peak,
      detail: { label: "hours over rating", value: dt.loading!.hoursOverRating as number, unit: "hours" },
    });
  }

  const worstAtcc = extreme(feeders, (feeder) => feeder.losses.atcc, "highest");
  if (worstAtcc) {
    items.push({
      rule: "Feeder with the highest ATC&C",
      title: "Highest ATC&C among feeders",
      subject: { kind: "feeder", id: worstAtcc.id, name: worstAtcc.name },
      metric: worstAtcc.losses.atcc,
      detail: null,
    });
  }

  const failing = feeders
    .filter((feeder) => (feeder.reliability.supply.daysNonCompliant ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.reliability.supply.daysNonCompliant as number) - (a.reliability.supply.daysNonCompliant as number) || (a.id < b.id ? -1 : 1),
    );
  for (const feeder of failing) {
    items.push({
      rule: "Feeder below its service-band minimum on at least one day",
      title: `Below Band ${feeder.reliability.supply.band} minimum of ${feeder.reliability.supply.minimumHours} h`,
      subject: { kind: "feeder", id: feeder.id, name: feeder.name },
      metric: feeder.reliability.supply.averageHours,
      detail: { label: "days below minimum", value: feeder.reliability.supply.daysNonCompliant as number, unit: "days" },
    });
  }

  const worstCollection = extreme(feeders, (feeder) => feeder.losses.collectionEfficiency, "lowest");
  if (worstCollection) {
    items.push({
      rule: "Feeder with the lowest collection efficiency",
      title: "Lowest collection efficiency among feeders (cash basis)",
      subject: { kind: "feeder", id: worstCollection.id, name: worstCollection.name },
      metric: worstCollection.losses.collectionEfficiency,
      detail: null,
    });
  }

  const worstCommercial = extreme(transformers, (dt) => dt.losses.parts.commercial, "highest");
  if (worstCommercial) {
    items.push({
      rule: "Transformer with the highest commercial loss",
      title: "Highest commercial loss among transformers",
      subject: { kind: "distribution_transformer", id: worstCommercial.id, name: worstCommercial.name },
      metric: worstCommercial.losses.parts.commercial,
      detail: null,
    });
  }

  const network = feeders.map((feeder) => ({ ...feeder, networkSaidi: networkSaidi(feeder.reliability) }));
  const worstNetwork = extreme(network, (feeder) => feeder.networkSaidi, "highest");
  if (worstNetwork) {
    items.push({
      rule: "Feeder with the highest network-attributable SAIDI",
      title: "Highest network-attributable SAIDI among feeders",
      subject: { kind: "feeder", id: worstNetwork.id, name: worstNetwork.name },
      metric: worstNetwork.networkSaidi,
      detail: null,
    });
  }

  return items.map((item, i) => ({ ...item, rank: i + 1 }));
}

export async function executiveView(runtime: OperationsRuntime): Promise<ExecutiveView> {
  const loaded = await loadRegistry(runtime);
  const { index, snapshot, coverage } = loaded;
  const timeZone = timeZoneOf(snapshot);
  const organization = snapshot.organizations[0];

  const feeders: FeederFacts[] = [];
  const transformers: TransformerFacts[] = [];
  for (const substation of snapshot.substations) {
    for (const feeder of feedersOfSubstation(index, substation.id)) {
      const scope: ScopeRef = { kind: "feeder", id: feeder.id };
      feeders.push({
        id: feeder.id,
        name: feeder.name,
        losses: await lossesBlock(runtime, scope, null),
        reliability: await reliabilityBlock(runtime, scope, timeZone),
      });
      for (const dt of transformersOnFeeder(index, feeder.id)) {
        transformers.push({
          id: dt.id,
          name: dt.name,
          feederName: feeder.name,
          losses: await lossesBlock(runtime, { kind: "distribution_transformer", id: dt.id }, null),
          loading: await loadingBlock(runtime, { kind: "distribution_transformer", id: dt.id }),
        });
      }
    }
  }

  const only = snapshot.substations.length === 1 ? snapshot.substations[0] : null;
  const losses = only
    ? await lossesBlock(
        runtime,
        { kind: "substation", id: only.id },
        `These are the figures of ${only.name}, the only substation in the portfolio. Energy accounting is done per electrical section; aggregation across substations is not implemented yet.`,
      )
    : null;

  // With one substation its figures are the portfolio's, and the utility's reported figures are
  // stated for it, so the two can be set side by side. Otherwise the organization is used.
  const reliabilityScope: ScopeRef = only
    ? { kind: "substation", id: only.id }
    : organization
      ? { kind: "organization", id: organization.id }
      : { kind: "region", id: snapshot.regions[0]?.id ?? "" };

  const bandCompliance: BandComplianceRow[] = feeders.map((feeder) => ({
    feederId: feeder.id,
    feederName: feeder.name,
    band: feeder.reliability.supply.band,
    minimumHours: feeder.reliability.supply.minimumHours,
    averageHours: feeder.reliability.supply.averageHours,
    daysFailed: feeder.reliability.supply.daysNonCompliant,
    daysMet: feeder.reliability.supply.daysCompliant,
    daysObserved: feeder.reliability.supply.days.length,
    compliantOnAverage: feeder.reliability.supply.compliantOnAverage,
  }));

  const transformerLoading: TransformerLoadingRow[] = transformers
    .filter((dt) => dt.loading !== null)
    .map((dt) => ({
      transformerId: dt.id,
      transformerName: dt.name,
      feederName: dt.feederName,
      ratedKva: dt.loading!.ratedKva,
      peak: dt.loading!.peak,
      peakAt: dt.loading!.peakAt,
      hoursOverRating: dt.loading!.hoursOverRating,
      hoursObserved: dt.loading!.hoursObserved,
      overloaded: dt.loading!.overloaded,
    }))
    .sort((a, b) => (b.peak.value ?? -1) - (a.peak.value ?? -1) || (a.transformerId < b.transformerId ? -1 : 1));

  const note = (kind: keyof typeof coverage) => (coverage[kind] === "complete" ? "" : ` (registry ${coverage[kind].replace("_", " ")})`);
  return {
    organization: organization?.name ?? null,
    period: runtime.period,
    asOf: runtime.now,
    facts: [
      { label: "Regions", value: `${snapshot.regions.length}${note("regions")}` },
      { label: "Substations", value: `${snapshot.substations.length}${note("substations")}` },
      { label: "Feeders", value: `${feeders.length}${note("feeders")}` },
      { label: "Distribution transformers", value: `${transformers.length}${note("distributionTransformers")}` },
    ],
    whereToLook: whereToLook(feeders, transformers),
    whereToLookMethod: WHERE_TO_LOOK_METHOD,
    losses,
    lossesNote: losses
      ? null
      : "Energy accounting is done per electrical section. The portfolio has more than one substation and aggregation across substations is not implemented yet; open a substation in Operations for its figures.",
    reliability: {
      ...(await reliabilityBlock(runtime, reliabilityScope, timeZone)),
      scopeNote: only ? `These are the figures of ${only.name}, the only substation in the portfolio.` : null,
    },
    bandCompliance,
    transformerLoading,
    alarms: ALARMS,
  };
}
