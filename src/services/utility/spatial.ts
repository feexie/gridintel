import type { AssetKind, AssetRef, EntityLocation, LocatedRef, ScopeRef } from "@/domain";
import type { Completeness } from "../../repositories/ports/index.ts";
import type { AreaContribution, NotLocated } from "../../analytics/index.ts";
import type { AreaMeasure, LayerDefinition, SpatialEntity, SpatialModule, SpatialRuntime } from "../spatial/module.ts";
import { registryLocations, traceAsset } from "../../analytics/index.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { loadTopology } from "../analytics/topology.ts";
import { registryCount } from "../operations/metric.ts";
import { entityKey } from "../spatial/module.ts";

/* ==========================================================
   SERVICES — UTILITY: WHAT IT REGISTERS WITH THE SPATIAL PLATFORM

   The distribution network as located entities, how it is traced,
   the figures it can total by area, and its map layers. Everything
   comes from services and analytics that already exist; nothing is
   calculated for the map.

   ENTITIES. Substations, power transformers, feeders, distribution
   transformers and service points, each with the location its
   registry record holds. A power transformer is shown at its
   substation. A feeder is its route.

   LAYERS. The network itself: substations, feeder routes and
   distribution transformers. The layers that colour it by a figure
   (loading, ATC&C, revenue not realised, band compliance), open
   outages and standing alarms are registered here in Phase 7b.
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

const NETWORK_LAYERS: LayerDefinition[] = [
  {
    id: "utility.substations",
    title: "Substations",
    description: "Injection substations. A substation's power transformers are shown with it.",
    shape: "point",
    entityKind: "substation",
    legend: [],
    onByDefault: true,
  },
  {
    id: "utility.feeders",
    title: "Feeder routes",
    description: "The route of each feeder as the registry holds it. A schematic route shows what is connected, not where the line runs.",
    shape: "line",
    entityKind: "feeder",
    legend: [],
    onByDefault: true,
  },
  {
    id: "utility.transformers",
    title: "Distribution transformers",
    description: "Every distribution transformer in service.",
    shape: "point",
    entityKind: "distribution_transformer",
    legend: [],
    onByDefault: true,
  },
];

export const UTILITY_SPATIAL_MODULE: SpatialModule = {
  id: "utility",
  title: "Utility Intelligence",
  entities,
  trace,
  measures: [REVENUE_NOT_REALISED],
  layers: NETWORK_LAYERS,
};
