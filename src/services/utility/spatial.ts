import type { AssetKind, AssetRef, EntityLocation, LocatedRef, ScopeRef } from "@/domain";
import type { Completeness } from "../../repositories/ports/index.ts";
import type { AreaContribution, NotLocated } from "../../analytics/index.ts";
import type { Sourcing } from "../analytics/sourcing.ts";
import type { MetricView, SourcingView } from "../operations/views.ts";
import type { AreaMeasure, LayerDefinition, LayerFigure, SpatialEntity, SpatialModule, SpatialRuntime } from "../spatial/module.ts";
import type { LegendEntryView } from "../spatial/views.ts";
import { registryLocations, traceAsset } from "../../analytics/index.ts";
import { openInterruptions } from "../analytics/openInterruptions.ts";
import { eventsWorkspaceView } from "../events/view.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { loadTopology } from "../analytics/topology.ts";
import { allAlarmsBlock, loadRegistry, loadingBlock, lossesBlock, reliabilityBlock, revenueGapBlock, timeZoneOf } from "../operations/levels.ts";
import { registryCount, unavailable } from "../operations/metric.ts";
import { entityKey } from "../spatial/module.ts";

/* ==========================================================
   SERVICES — UTILITY: WHAT IT REGISTERS WITH THE SPATIAL PLATFORM

   The distribution network as located entities, how it is traced,
   the figures it can total by area, and its map layers. Every
   figure on a layer is taken from the read-model block that the
   drill-down screens already show (loading, losses, revenue gap,
   reliability, alarms, open interruptions). Nothing is calculated
   for the map.

   ENTITIES. Substations, power transformers, feeders, distribution
   transformers and service points, each with the location its
   registry record holds. A power transformer is shown at its
   substation. A feeder is its route.

   LAYERS.
     the network     substations, feeder routes, transformers, and a
                     transformer's service points; each with its key
                     figures for when it is selected
     themes          transformers coloured by peak loading, ATC&C,
                     revenue not realised or band compliance: one at
                     a time
     overlays        interruptions in progress, and source alarms
                     standing, each marking only what it concerns
     districts       revenue not realised totalled by district, with
                     what belongs to no district kept apart

   WHERE A LEGEND CLASS COMES FROM. Each theme states its classes in
   its legend, in words that carry the thresholds, and assigns the
   class here from the service's own figure. The thresholds are
   display bands, not findings: "above rating" is the loading
   methodology's own threshold; the others only sort a figure into
   three groups so that it can be coloured.
========================================================== */

const KIND_LABEL: Record<string, string> = {
  substation: "Substation",
  power_transformer: "Power transformer",
  feeder: "Feeder",
  distribution_transformer: "Distribution transformer",
  service_point: "Service point",
};

const NOT_LOCATED: Record<NotLocated["reason"], string> = {
  no_location_recorded: "The registry holds no location for it.",
  location_not_usable: "The location the registry holds cannot be drawn.",
  parent_not_located: "It takes its substation's location, and the substation has none.",
};

const RANK: Record<Completeness, number> = { complete: 0, partial: 1, not_available: 2 };

async function entities(runtime: SpatialRuntime) {
  const { snapshot, coverage } = await loadTopology(runtime.repos.registry, runtime.now, runtime.cache);
  const { located, notLocated } = registryLocations(snapshot);
  const at = new Map<string, EntityLocation>(located.map((location) => [entityKey(location.entity), location]));
  const why = new Map<string, NotLocated["reason"]>(notLocated.map((missing) => [entityKey(missing.entity), missing.reason]));

  const held: SpatialEntity[] = [];
  const add = (kind: AssetKind, records: readonly { id: string; name?: string; lifecycle: string }[]) => {
    for (const record of records) {
      if (record.lifecycle !== "in_service") continue;
      const ref = { kind, id: record.id };
      const location = at.get(entityKey(ref)) ?? null;
      const reason = why.get(entityKey(ref));
      held.push({
        ref,
        name: record.name ?? record.id,
        kindLabel: KIND_LABEL[kind],
        location,
        notLocatedReason: location !== null ? null : NOT_LOCATED[reason ?? "no_location_recorded"],
      });
    }
  };
  add("substation", snapshot.substations);
  add("power_transformer", snapshot.powerTransformers);
  add("feeder", snapshot.feeders);
  add("distribution_transformer", snapshot.distributionTransformers);
  add("service_point", snapshot.servicePoints);

  const lists = [coverage.substations, coverage.powerTransformers, coverage.feeders, coverage.distributionTransformers, coverage.servicePoints];
  const trail = new SourceTrail()
    .add(snapshot.substations)
    .add(snapshot.powerTransformers)
    .add(snapshot.feeders)
    .add(snapshot.distributionTransformers)
    .add(snapshot.servicePoints);
  return {
    entities: held,
    completeness: lists.reduce<Completeness>((worst, one) => (RANK[one] > RANK[worst] ? one : worst), "complete"),
    sourcing: await trail.resolve(runtime.repos.sources),
  };
}

async function trace(runtime: SpatialRuntime, ref: LocatedRef, sees: (ref: LocatedRef) => boolean) {
  if (!(ref.kind in KIND_LABEL)) return null;
  const { index, snapshot, coverage } = await loadTopology(runtime.repos.registry, runtime.now, runtime.cache);
  const traced = traceAsset(index, snapshot, ref as AssetRef);
  if (traced === null) return null;

  const downstream: LocatedRef[] = [
    ...traced.downstream.feeders.map((id) => ({ kind: "feeder", id })),
    ...traced.downstream.distributionTransformers.map((id) => ({ kind: "distribution_transformer", id })),
    ...traced.downstream.servicePoints.map((id) => ({ kind: "service_point", id })),
  ];
  // The connections behind it that this viewer sees; the subject itself when it is one.
  const points = new Set(
    [...traced.downstream.servicePoints, ...(ref.kind === "service_point" ? [ref.id] : [])].filter((id) => sees({ kind: "service_point", id })),
  );
  const accounts =
    coverage.customers !== "complete"
      ? null
      : snapshot.customers.filter((customer) => customer.accountStatus === "active" && customer.servicePointId !== undefined && points.has(customer.servicePointId)).length;

  return {
    upstream: traced.upstream.map((asset) => ({ kind: asset.kind, id: asset.id })),
    downstream,
    downstreamKnown: traced.downstreamKnown,
    facts: [
      registryCount("Connections behind it", points.size, "Service points supplied through it, from the current registry topology."),
      registryCount(
        "Active accounts behind it",
        accounts,
        accounts === null
          ? "The registry does not hold every customer account, so the accounts behind it cannot be counted."
          : "Active accounts connected behind it in the registry. It is not a count of customers without supply.",
      ),
    ],
  };
}

/* ---------------- Measure ---------------- */

const REVENUE_NOT_REALISED: AreaMeasure = {
  id: "utility.revenue_not_realised",
  label: "Revenue not realised",
  definition:
    "Each distribution transformer's own revenue not realised in the period (commercial gap plus collection gap, counting only the parts that are positive), " +
    "given whole to the area the transformer stands in. It follows where transformers are, not where customers live. An estimate; not an amount owed, and not annualised.",
  unit: "currency",
  entityKind: "distribution_transformer",
  async contributions(runtime, transformers) {
    const trail = new SourceTrail();
    const contributions: AreaContribution[] = [];
    let currency: string | null = null;
    for (const transformer of transformers) {
      const scope: ScopeRef = { kind: "distribution_transformer", id: transformer.ref.id };
      const { result, sourcing } = await scopeRevenueGap({ repos: runtime.repos, scope, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
      trail.addSourcing(sourcing);
      currency ??= result.currency;
      contributions.push({ entity: transformer.ref, value: result.notRealised, estimated: result.status === "calculated_with_estimates" });
    }
    return { result: { contributions, currency }, sourcing: await trail.resolve(runtime.repos.sources) };
  },
  whole: {
    async value(runtime) {
      const { snapshot } = await loadTopology(runtime.repos.registry, runtime.now, runtime.cache);
      const organization = snapshot.organizations[0];
      // The portfolio is the organization; a region stands in when the registry names none.
      const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: snapshot.regions[0]?.id ?? "" };
      const { result } = await scopeRevenueGap({ repos: runtime.repos, scope: portfolio, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
      return result.notRealised;
    },
    remainderNote:
      "What the portfolio's figure holds that no transformer carries: each feeder's and substation's own residual, and customers supplied at 11 kV. " +
      "Because each section counts only its positive parts, it also holds whatever that changes between the sections and the whole. It belongs to no area.",
  },
};

/* ---------------- Figures for layers ---------------- */

type Figures = Map<string, LayerFigure>;
type Details = Map<string, MetricView[]>;

/** Collects the sources of the blocks a layer drew on. */
class ViewTrail {
  private readonly sources = new Map<string, SourcingView["sources"][number]>();
  private synthetic = false;
  add(sourcing: SourcingView): void {
    this.synthetic ||= sourcing.synthetic;
    for (const source of sourcing.sources) this.sources.set(source.id, source);
  }
  /** As a service sourcing: the ids are resolved again by whoever merges it. */
  async resolve(runtime: SpatialRuntime): Promise<Sourcing> {
    const known = new Map((await runtime.repos.sources.listDataSources()).map((source) => [source.id, source]));
    const ids = [...this.sources.keys()].sort();
    const used = ids.flatMap((id) => known.get(id) ?? []);
    return { sources: used, synthetic: this.synthetic || used.some((source) => source.kind === "synthetic"), unknownSources: ids.filter((id) => !known.has(id)) };
  }
}

const scopeOf = (entity: SpatialEntity): ScopeRef => ({ kind: entity.ref.kind as ScopeRef["kind"], id: entity.ref.id });

/** A layer's figures: one metric per entity from a block, and its class from the layer's rule. */
async function figuresFrom(
  runtime: SpatialRuntime,
  held: readonly SpatialEntity[],
  read: (entity: SpatialEntity) => Promise<{ metric: MetricView; sourcing: SourcingView } | null>,
  classify: (metrics: readonly MetricView[]) => string[],
) {
  const trail = new ViewTrail();
  const read_: { entity: SpatialEntity; metric: MetricView }[] = [];
  for (const entity of held) {
    const figure = await read(entity);
    if (figure === null) continue;
    trail.add(figure.sourcing);
    read_.push({ entity, metric: figure.metric });
  }
  const classes = classify(read_.map((one) => one.metric));
  const result: Figures = new Map(read_.map((one, i) => [entityKey(one.entity.ref), { metric: one.metric, classKey: classes[i] }]));
  return { result, sourcing: await trail.resolve(runtime) };
}

const NO_FIGURE: LegendEntryView = { key: "no_figure", label: "No figure: the data does not support one", tone: "no_data" };

/** Sorts each value into one of three bands by fixed thresholds; a figure with no value is "no_figure". */
function bands(low: string, middle: string, high: string, lowBelow: number, highAbove: number) {
  return (metrics: readonly MetricView[]): string[] =>
    metrics.map((metric) => (metric.value === null ? NO_FIGURE.key : metric.value > highAbove ? high : metric.value >= lowBelow ? middle : low));
}

/** Sorts values into thirds by rank among those given: the highest third, the middle and the lowest. */
function thirds(values: readonly (number | null)[]): (string | null)[] {
  const ranked = values.flatMap((value) => (value === null ? [] : [value])).sort((a, b) => b - a);
  if (ranked.length === 0) return values.map(() => NO_FIGURE.key);
  const top = ranked[Math.max(0, Math.ceil(ranked.length / 3) - 1)];
  const bottom = ranked[Math.max(0, Math.ceil((2 * ranked.length) / 3) - 1)];
  return values.map((value) => (value === null ? NO_FIGURE.key : value >= top ? "highest" : value >= bottom ? "middle" : "lowest"));
}

const THIRDS_LEGEND: LegendEntryView[] = [
  { key: "highest", label: "Highest third of those shown", tone: "alert" },
  { key: "middle", label: "Middle third", tone: "watch" },
  { key: "lowest", label: "Lowest third", tone: "good" },
  NO_FIGURE,
];

/**
 * Days on which a feeder's hours of supply were below its band's minimum, as a figure of its
 * own. A service band is a feeder's: a transformer is given its feeder's figure, and the label
 * says so. It is not the transformer's own hours of supply.
 */
async function daysBelowBand(runtime: SpatialRuntime, entity: SpatialEntity, timeZone: string | undefined): Promise<{ metric: MetricView; sourcing: SourcingView }> {
  const ofFeeder = entity.ref.kind === "distribution_transformer";
  const feederId = ofFeeder ? (await loadRegistry(runtime)).index.transformerById.get(entity.ref.id)?.feederId : entity.ref.id;
  const reliability = await reliabilityBlock(runtime, { kind: "feeder", id: feederId ?? "" }, timeZone);
  const supply = reliability.supply;
  const label = ofFeeder ? "Days its feeder was below the band minimum" : "Days below the band minimum";
  if (supply.band === null || supply.minimumHours === null || supply.daysNonCompliant === null) {
    return { metric: unavailable(label, "count", supply.note ?? "No service band is recorded for its feeder, or hours of supply could not be calculated."), sourcing: reliability.sourcing };
  }
  return {
    metric: {
      ...supply.averageHours,
      label,
      value: supply.daysNonCompliant,
      unit: "count",
      status: supply.status,
      derivation: `Days in the period on which ${ofFeeder ? "the feeder's" : "the"} hours of supply were below the Band ${supply.band} minimum of ${supply.minimumHours} h, of ${supply.days.length} days.${ofFeeder ? " The band is the feeder's, so this is the feeder's figure, not the transformer's own." : ""}`,
      inputs: [],
      note: reliability.provisional,
    },
    sourcing: reliability.sourcing,
  };
}

const THEME = "utility.transformer_theme";
const TRANSFORMERS = ["distribution_transformer"] as const;

const THEMES: LayerDefinition[] = [
  {
    id: "utility.transformers.loading",
    title: "Transformers by peak loading",
    description: "Each distribution transformer by the highest loading observed in the period, as a share of its rating.",
    shape: "point",
    entityKinds: TRANSFORMERS,
    exclusiveGroup: THEME,
    legend: [
      { key: "over", label: "Above rating (over 100%)", tone: "alert" },
      { key: "high", label: "80% to 100% of rating", tone: "watch" },
      { key: "normal", label: "Below 80% of rating", tone: "good" },
      NO_FIGURE,
    ],
    onByDefault: true,
    figures: (runtime, held) =>
      figuresFrom(
        runtime,
        held,
        async (entity) => {
          const loading = await loadingBlock(runtime, { kind: "distribution_transformer", id: entity.ref.id });
          return loading === null ? null : { metric: loading.peak, sourcing: loading.sourcing };
        },
        bands("normal", "high", "over", 0.8, 1),
      ),
  },
  {
    id: "utility.transformers.atcc",
    title: "Transformers by ATC&C loss",
    description: "Each distribution transformer by its aggregate technical, commercial and collection loss in the period.",
    shape: "point",
    entityKinds: TRANSFORMERS,
    exclusiveGroup: THEME,
    legend: [
      { key: "high", label: "Over 50%", tone: "alert" },
      { key: "middle", label: "25% to 50%", tone: "watch" },
      { key: "low", label: "Below 25%", tone: "good" },
      NO_FIGURE,
    ],
    onByDefault: false,
    figures: (runtime, held) =>
      figuresFrom(
        runtime,
        held,
        async (entity) => {
          const losses = await lossesBlock(runtime, scopeOf(entity));
          return { metric: losses.atcc, sourcing: losses.sourcing };
        },
        bands("low", "middle", "high", 0.25, 0.5),
      ),
  },
  {
    id: "utility.transformers.revenue",
    title: "Transformers by revenue not realised",
    description: "Each distribution transformer by its own revenue not realised in the period. Ranked among the transformers shown, not against a threshold.",
    shape: "point",
    entityKinds: TRANSFORMERS,
    exclusiveGroup: THEME,
    legend: THIRDS_LEGEND,
    onByDefault: false,
    async figures(runtime, held) {
      const loaded = await loadRegistry(runtime);
      return figuresFrom(
        runtime,
        held,
        async (entity) => {
          const gap = await revenueGapBlock(runtime, loaded, scopeOf(entity));
          return { metric: gap.notRealised, sourcing: gap.sourcing };
        },
        (metrics) => thirds(metrics.map((metric) => metric.value)) as string[],
      );
    },
  },
  {
    id: "utility.transformers.band",
    title: "Transformers by band compliance",
    description: "Each distribution transformer by the days on which its feeder's hours of supply were below the minimum of the feeder's service band. A band is a feeder's: every transformer on a feeder shows that feeder's figure.",
    shape: "point",
    entityKinds: TRANSFORMERS,
    exclusiveGroup: THEME,
    legend: [
      { key: "often", label: "Feeder below its band minimum on more than 5 days", tone: "alert" },
      { key: "some", label: "Feeder below it on 1 to 5 days", tone: "watch" },
      { key: "met", label: "Feeder met its band minimum every day", tone: "good" },
      NO_FIGURE,
    ],
    onByDefault: false,
    async figures(runtime, held) {
      const timeZone = timeZoneOf((await loadRegistry(runtime)).snapshot);
      return figuresFrom(runtime, held, (entity) => daysBelowBand(runtime, entity, timeZone), bands("met", "some", "often", 1, 5));
    },
  },
];

/* ---------------- Key figures of the network's own layers ---------------- */

/** The key figures of substations, feeders and transformers, from the blocks their drill-down screens show. */
async function keyFigures(runtime: SpatialRuntime, held: readonly SpatialEntity[]) {
  const loaded = await loadRegistry(runtime);
  const timeZone = timeZoneOf(loaded.snapshot);
  const trail = new ViewTrail();
  const result: Details = new Map();
  for (const entity of held) {
    const scope = scopeOf(entity);
    const figures: MetricView[] = [];
    if (entity.ref.kind === "feeder" || entity.ref.kind === "distribution_transformer") {
      const loading = await loadingBlock(runtime, { kind: entity.ref.kind, id: entity.ref.id });
      if (loading !== null) {
        trail.add(loading.sourcing);
        figures.push(loading.peak, loading.asOf);
      }
    }
    const losses = await lossesBlock(runtime, scope);
    const gap = await revenueGapBlock(runtime, loaded, scope);
    const reliability = await reliabilityBlock(runtime, scope, timeZone);
    trail.add(losses.sourcing);
    trail.add(gap.sourcing);
    trail.add(reliability.sourcing);
    figures.push(losses.atcc, gap.notRealised, { ...reliability.saidi, note: reliability.provisional ?? reliability.saidi.note });
    if (entity.ref.kind !== "substation") figures.push((await daysBelowBand(runtime, entity, timeZone)).metric);
    result.set(entityKey(entity.ref), figures);
  }
  return { result, sourcing: await trail.resolve(runtime) };
}

const NETWORK_LAYERS: LayerDefinition[] = [
  {
    id: "utility.substations",
    title: "Substations",
    description: "Injection substations. A substation's power transformers are shown with it.",
    shape: "point",
    entityKinds: ["substation"],
    legend: [],
    onByDefault: true,
    details: keyFigures,
  },
  {
    id: "utility.feeders",
    title: "Feeder routes",
    description: "The route of each feeder as the registry holds it. A schematic route shows what is connected, not where the line runs.",
    shape: "line",
    entityKinds: ["feeder"],
    legend: [],
    onByDefault: true,
    details: keyFigures,
  },
  {
    id: "utility.transformers",
    title: "Distribution transformers",
    description: "Every distribution transformer in service, with its key figures.",
    shape: "point",
    entityKinds: TRANSFORMERS,
    legend: [],
    onByDefault: true,
    details: keyFigures,
  },
  {
    id: "utility.service_points",
    title: "Service points",
    description: "Connections. There are thousands, so they are drawn only for one transformer or feeder at a time.",
    shape: "point",
    entityKinds: ["service_point"],
    legend: [],
    onByDefault: false,
  },
];

/* ---------------- Overlays ---------------- */

/** The registry asset an alarm's subject is on: the asset a monitor is attached to, for a device. */
function assetOn(loaded: Awaited<ReturnType<typeof loadRegistry>>, kind: string | null, id: string): LocatedRef | null {
  if (kind === null) return null;
  if (kind === "edge_device") {
    const device = loaded.snapshot.edgeDevices.find((candidate) => candidate.id === id);
    return device === undefined || device.attachedTo.kind === "edge_device" ? null : assetOn(loaded, device.attachedTo.kind, device.attachedTo.id);
  }
  if (kind === "meter") return null;
  return { kind, id };
}

const OVERLAYS: LayerDefinition[] = [
  {
    id: "utility.open_outages",
    title: "Interruptions in progress",
    description: "The transformers and connections the outage log says are without supply at the as-of time, under an interruption its source says is open.",
    shape: "mixed",
    entityKinds: ["distribution_transformer", "service_point"],
    legend: [{ key: "off", label: "Without supply: interruption in progress", tone: "alert" }],
    onByDefault: true,
    onlyWithFigure: true,
    async figures(runtime) {
      const open = await openInterruptions({ repos: runtime.repos, period: runtime.period, asOf: runtime.now, cache: runtime.cache });
      const result: Figures = new Map();
      for (const outage of open.result.outages.filter((candidate) => candidate.state === "in_progress")) {
        for (const exposure of outage.exposures) {
          if (!("id" in exposure.affected)) continue;
          const counted = exposure.customerCountBasis;
          result.set(entityKey(exposure.affected), {
            classKey: "off",
            metric: {
              label: "Customers without supply here",
              value: exposure.customersAffected,
              unit: "count",
              currency: null,
              status: exposure.customersAffected === null ? "insufficient_data" : "ok",
              origin: counted === "recorded" ? "measured" : counted === "estimated" ? "estimated" : "calculated",
              derivation:
                counted === "recorded"
                  ? "Counted for this interruption and written in the outage record."
                  : counted === "estimated"
                    ? "A judgement written in the outage record, with no count and no model behind it."
                    : "Read from the network model by the outage system: the accounts connected under this element.",
              method: null,
              inputs: [],
              estimatedInputs: counted === "estimated" && exposure.customersAffected !== null ? [{ name: "Customers without supply here", share: 1 }] : [],
              missingInputs: exposure.customersAffected === null ? ["the number of customers affected, which the outage record does not give"] : [],
              warnings: [],
              note: `Interruption ${outage.outageId}, since ${exposure.interruptedAt}. Not restored at the as-of time.`,
            },
          });
        }
      }
      return { result, sourcing: open.sourcing };
    },
  },
  {
    id: "utility.standing_alarms",
    title: "Source alarms standing",
    description: "The assets a source system's alarm is standing on at the as-of time. An alarm on a monitor is shown on the asset it monitors.",
    shape: "mixed",
    entityKinds: ["substation", "feeder", "distribution_transformer"],
    legend: [{ key: "alarm", label: "A source alarm is standing", tone: "watch" }],
    onByDefault: true,
    onlyWithFigure: true,
    async figures(runtime) {
      const loaded = await loadRegistry(runtime);
      const organization = loaded.snapshot.organizations[0];
      const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: loaded.snapshot.regions[0]?.id ?? "" };
      const alarms = await allAlarmsBlock(runtime, loaded, portfolio);
      const standing = new Map<string, string[]>();
      for (const alarm of alarms.recorded.active) {
        const on = assetOn(loaded, alarm.subject.assetKind, alarm.subject.id);
        // A power transformer is drawn with its substation.
        const drawnOn = on?.kind === "power_transformer" ? { kind: "substation", id: loaded.snapshot.powerTransformers.find((pt) => pt.id === on.id)?.substationId ?? "" } : on;
        if (drawnOn === null) continue;
        const words = `${alarm.code}: ${alarm.message}${alarm.subject.assetKind === "edge_device" ? " (on its monitor)" : on?.kind === "power_transformer" ? ` (on ${alarm.subject.label})` : ""}`;
        standing.set(entityKey(drawnOn), [...(standing.get(entityKey(drawnOn)) ?? []), words]);
      }
      const result: Figures = new Map(
        [...standing].map(([key, list]) => [
          key,
          {
            classKey: "alarm",
            metric: {
              label: "Source alarms standing",
              value: list.length,
              unit: "count",
              currency: null,
              status: "ok",
              origin: "measured",
              derivation: "Alarms a source system recorded as raised and not cleared at the as-of time. Observed, not derived by GridIntel.",
              method: null,
              inputs: [],
              estimatedInputs: [],
              missingInputs: [],
              warnings: [],
              note: list.join(" · "),
            },
          },
        ]),
      );
      const trail = new ViewTrail();
      trail.add(alarms.sourcing);
      return { result, sourcing: await trail.resolve(runtime) };
    },
  },
];

const DISTRICTS: LayerDefinition = {
  id: "utility.districts",
  title: "Revenue not realised by district",
  description: "The demonstration's three synthetic districts, each with the revenue not realised at the transformers in it. What belongs to no district is shown separately.",
  shape: "area",
  entityKinds: [],
  areas: { kind: "other", measureId: REVENUE_NOT_REALISED.id, classify: thirds, delivery: "inline" },
  legend: THIRDS_LEGEND,
  onByDefault: false,
};

/** Interruptions in progress, as the Events / Alarms screen lists them. */
async function incidents(runtime: SpatialRuntime) {
  const events = await eventsWorkspaceView(runtime);
  const trail = new ViewTrail();
  trail.add(events.sourcing);
  return {
    result: {
      incidents: events.now.interruptions.inProgress.map((row) => ({
        id: row.outageId,
        title: `${row.cause}${row.planned ? " (planned)" : ""}`,
        since: row.interruptedAt,
        beganAt: `${row.beganAt.kindLabel}: ${row.beganAt.label}`,
        origin: row.beganAt.assetKind === null ? null : { kind: row.beganAt.assetKind, id: row.beganAt.id },
        facts: [row.customers],
      })),
      completeness: events.now.interruptions.completeness,
    },
    sourcing: await trail.resolve(runtime),
  };
}

export const UTILITY_SPATIAL_MODULE: SpatialModule = {
  id: "utility",
  title: "Utility Intelligence",
  entities,
  trace,
  incidents,
  measures: [REVENUE_NOT_REALISED],
  layers: [...NETWORK_LAYERS, ...THEMES, ...OVERLAYS, DISTRICTS],
};
