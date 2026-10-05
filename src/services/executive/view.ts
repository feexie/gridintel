import type { ScopeRef } from "@/domain";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { LoadingView, LossesView, MetricView, ReliabilityView, ReportedComparisonView, RevenueGapRow, RevenueGapView } from "../operations/views.ts";
import type { AttentionSubject, FeederSignals, TransformerSignals } from "./attention.ts";
import type { BandComplianceRow, ExecutiveView, TransformerLoadingRow, WhereToLookView } from "./views.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { feedersOfSubstation, transformersOnFeeder } from "../../analytics/index.ts";
import { alarmsBlock, loadRegistry, loadingBlock, lossesBlock, reliabilityBlock, revenueGapBlock, timeZoneOf } from "../operations/levels.ts";
import { ATTENTION_METHOD, MONEY_RANK_LIMIT, attention } from "./attention.ts";

/* ==========================================================
   SERVICES — EXECUTIVE READ MODEL

   "What is happening across the portfolio, and where should I look
   first?" Everything here comes from the same services as the
   Operations drill-down, so a figure on this screen is the figure
   the drill-down shows. What to look at first is decided by the
   fixed rules in attention.ts.

   REPORTED FIGURES. A reported figure is compared only at the scope
   it is stated for. When nothing is reported for the portfolio
   itself, the comparisons shown are those of the electrical sections
   the portfolio is made of, each labelled with the section it is
   stated for. A substation's reported figure is never set beside a
   portfolio calculation.

   THE CUT-OFF. The money ranking is cut to its top few here, in the
   read model, unless all feeders are asked for. The view says how
   many feeders there are and whether the list is complete, so the
   screen neither counts nor cuts.
========================================================== */

/** Which money-ranked feeders a view lists: the top few, or every one. */
export type FeederListing = "top" | "all";

/** The ranked list, cut to what is asked for. `ranked` is money-ranked feeders first, then the rest. */
export function whereToLookView(ranked: readonly AttentionSubject[], feeders: FeederListing): WhereToLookView {
  const everyFeeder = ranked.filter((entry) => entry.group === "money");
  const money = feeders === "all" ? everyFeeder : everyFeeder.slice(0, MONEY_RANK_LIMIT);
  return {
    money,
    moneyTotal: everyFeeder.length,
    moneyLimit: MONEY_RANK_LIMIT,
    complete: money.length === everyFeeder.length,
    other: ranked.filter((entry) => entry.group === "other"),
  };
}

/** The whole view with the ranking uncut: computed once, whichever listing is asked for. */
type Portfolio = Omit<ExecutiveView, "whereToLook"> & { ranked: AttentionSubject[] };

interface FeederFacts {
  id: string;
  name: string;
  losses: LossesView;
  reliability: ReliabilityView;
  gap: RevenueGapView;
}

interface TransformerFacts {
  id: string;
  name: string;
  feederName: string;
  losses: LossesView;
  loading: LoadingView | null;
  gap: RevenueGapView;
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

function feederSignals(feeder: FeederFacts): FeederSignals {
  const supply = feeder.reliability.supply;
  return {
    id: feeder.id,
    name: feeder.name,
    revenueNotRealised: feeder.gap.notRealised,
    atcc: feeder.losses.atcc,
    collectionEfficiency: feeder.losses.collectionEfficiency,
    networkSaidi: networkSaidi(feeder.reliability),
    supply: { band: supply.band, minimumHours: supply.minimumHours, averageHours: supply.averageHours, daysBelowMinimum: supply.daysNonCompliant },
    saidiRuleFinding: feeder.reliability.ruleFindings.find((found) => found.figure === "SAIDI" && found.statedFor.id === feeder.id) ?? null,
  };
}

function transformerSignals(dt: TransformerFacts): TransformerSignals {
  return {
    id: dt.id,
    name: dt.name,
    feederName: dt.feederName,
    peakLoading: dt.loading?.peak ?? null,
    hoursOverRating: dt.loading?.hoursOverRating ?? null,
    commercialLoss: dt.losses.parts.commercial,
    commercialGap: dt.gap.commercial,
  };
}

const stated = (rows: ReportedComparisonView[], name: string): ReportedComparisonView[] => rows.map((row) => ({ ...row, statedFor: name }));

export async function executiveView(runtime: OperationsRuntime, feeders: FeederListing = "top"): Promise<ExecutiveView> {
  const key = `view:executive-portfolio|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  const { ranked, ...portfolio } = await (runtime.cache ?? NO_CACHE).get(key, () => portfolioView(runtime));
  return { ...portfolio, whereToLook: whereToLookView(ranked, feeders) };
}

async function portfolioView(runtime: OperationsRuntime): Promise<Portfolio> {
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
        losses: await lossesBlock(runtime, scope),
        reliability: await reliabilityBlock(runtime, scope, timeZone),
        gap: await revenueGapBlock(runtime, loaded, scope),
      });
      for (const dt of transformersOnFeeder(index, feeder.id)) {
        const dtScope: ScopeRef = { kind: "distribution_transformer", id: dt.id };
        transformers.push({
          id: dt.id,
          name: dt.name,
          feederName: feeder.name,
          losses: await lossesBlock(runtime, dtScope),
          loading: await loadingBlock(runtime, { kind: "distribution_transformer", id: dt.id }),
          gap: await revenueGapBlock(runtime, loaded, dtScope),
        });
      }
    }
  }

  // The portfolio is the organization; a region stands in when the registry names none.
  const portfolio: ScopeRef = organization
    ? { kind: "organization", id: organization.id }
    : { kind: "region", id: snapshot.regions[0]?.id ?? "" };
  let losses = await lossesBlock(runtime, portfolio);
  let reliability = await reliabilityBlock(runtime, portfolio, timeZone);

  // Nothing reported for the portfolio itself: show what is reported for its sections, labelled.
  if (losses.reported.length === 0 || reliability.reported.length === 0) {
    const lossRows: ReportedComparisonView[] = [];
    const reliabilityRows: ReportedComparisonView[] = [];
    for (const section of losses.sections) {
      const scope: ScopeRef = { kind: section.kind as "substation" | "feeder" | "distribution_transformer", id: section.id };
      const name =
        (section.kind === "substation"
          ? index.substationById.get(section.id)?.name
          : section.kind === "feeder"
            ? index.feederById.get(section.id)?.name
            : index.transformerById.get(section.id)?.name) ?? section.id;
      lossRows.push(...stated((await lossesBlock(runtime, scope)).reported, name));
      reliabilityRows.push(...stated((await reliabilityBlock(runtime, scope, timeZone)).reported, name));
    }
    if (losses.reported.length === 0) losses = { ...losses, reported: lossRows };
    if (reliability.reported.length === 0) reliability = { ...reliability, reported: reliabilityRows };
  }

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

  const gapByFeeder: RevenueGapRow[] = feeders.map((feeder) => ({
    kind: "feeder",
    id: feeder.id,
    name: feeder.name,
    commercial: feeder.gap.commercial,
    collection: feeder.gap.collection,
    notRealised: feeder.gap.notRealised,
  }));

  const look = attention(feeders.map(feederSignals), transformers.map(transformerSignals));
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
    assetRisk: look.assetRisk,
    ranked: look.ranked,
    whereToLookMethod: ATTENTION_METHOD,
    losses,
    lossesNote: null,
    revenueGap: await revenueGapBlock(runtime, loaded, portfolio),
    gapByFeeder,
    reliability,
    bandCompliance,
    transformerLoading,
    alarms: await alarmsBlock(runtime, loaded, portfolio),
  };
}
