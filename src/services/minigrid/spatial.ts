import type { EntityLocation, LocatedRef } from "@/domain";
import type { Sourced } from "../analytics/sourcing.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { MetricView } from "../operations/views.ts";
import type { ModuleEntities, SpatialEntity, SpatialModule } from "../spatial/module.ts";
import { siteCustomers } from "../../analytics/index.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { kpiMetric, registryCount } from "../operations/metric.ts";
import { entityKey } from "../spatial/module.ts";
import { siteMethodName } from "./method.ts";
import { loadSites, sitePerformance } from "./performance.ts";

/* ==========================================================
   SERVICES — MINI-GRID: ITS PLACE ON THE SPATIAL PLATFORM

   The Mini-grid module's registration: its sites as entities, and
   one layer that draws them, each with its key figures for the
   period. It re-implements nothing: the map, the spatial questions
   and the viewer's scope are the platform's.

   A site hangs from no substation, so nothing supplies it and its
   trace has no upstream. What it supplies, its connections, are
   counted and not drawn: they have no recorded location.

   A mini-grid operator's records are its own set of repositories,
   apart from any distribution utility's (ADR 0015). The module is
   therefore given where its sites come from when it is created.
   Created with nothing, it is the module with NO SOURCE CONNECTED:
   it holds no site and invents none, and its empty list is said to
   be "not available", never "there are no sites".
========================================================== */

/** What the module reads its sites through: the mini-grid operator's repositories, clock and cache. */
export type SiteRuntime = Pick<OperationsRuntime, "repos" | "now" | "period" | "cache">;

export const MINIGRID_SITE_KIND = "minigrid_site";

const NOT_CONNECTED = "No source of mini-grid sites is connected, so there is nothing to show. Sites appear here when one is.";
const CONNECTED = "Mini-grid sites, each with its key figures for the period. A site is supplied by no substation: it generates its own energy.";

async function entities(runtime: SiteRuntime): Promise<ModuleEntities> {
  const { snapshot, coverage } = await loadSites(runtime.repos.sites, runtime.now, runtime.cache);
  const held: SpatialEntity[] = [...snapshot.sites]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((site) => {
      const ref: LocatedRef = { kind: MINIGRID_SITE_KIND, id: site.id };
      const location: EntityLocation | null =
        site.location === undefined ? null : { entity: ref, geometry: { type: "point", point: site.location }, basis: site.locationBasis ?? "unspecified", provenance: site.provenance };
      return { ref, name: site.name, kindLabel: "Mini-grid site", location, notLocatedReason: location === null ? "The site register holds no location for this site." : null };
    });
  return { entities: held, completeness: coverage.sites, sourcing: await new SourceTrail().add(snapshot.sites).resolve(runtime.repos.sources) };
}

/** A site's key figures, each the figure of the site performance service, with its status and origin. */
async function keyFigures(runtime: SiteRuntime, shown: readonly SpatialEntity[]): Promise<Sourced<Map<string, MetricView[]>>> {
  const trail = new SourceTrail();
  const figures = new Map<string, MetricView[]>();
  for (const entity of shown) {
    const report = await sitePerformance({ repos: runtime.repos, siteId: entity.ref.id, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
    if (report === null) continue;
    trail.addSourcing(report.sourcing);
    const { energy, pv, availability, commercial } = report.result.performance;
    figures.set(entityKey(entity.ref), [
      kpiMetric("Energy generated", energy.energyGenerated, { unit: "kWh" }),
      kpiMetric("Renewable fraction", energy.renewableFraction, { note: "Share of energy generated." }),
      ...(pv === null ? [] : [kpiMetric("PV performance ratio", pv.performanceRatio, { note: "Counts curtailment as a loss." })]),
      kpiMetric("Availability", availability.all.availability, { note: availability.provisional ? "Provisional: includes an interruption still open." : "Every recorded interruption counted, planned or not." }),
      // Active connections are in the site's trace, as a count from the register; they are not repeated here.
      siteMethodName(kpiMetric("Collection efficiency", commercial.collectionEfficiency, { note: "Cash basis: money received in the period over charges raised in it." }), commercial.collectionEfficiency),
    ]);
  }
  return { result: figures, sourcing: await trail.resolve(runtime.repos.sources) };
}

/**
 * The Mini-grid module. `sites` gives the runtime its sites are read through; it is asked on each
 * use, so the module holds no adapter, and the composition root may check who is asking before it
 * answers. Without it the module has no source connected.
 */
export function minigridSpatialModule(sites?: () => SiteRuntime | Promise<SiteRuntime>): SpatialModule {
  return {
    id: "minigrid",
    title: "Mini-grid Intelligence",
    entities: async () => (sites === undefined ? { entities: [], completeness: "not_available", sourcing: { sources: [], synthetic: false, unknownSources: [] } } : entities(await sites())),
    async trace(_runtime, ref) {
      if (sites === undefined || ref.kind !== MINIGRID_SITE_KIND) return null;
      const runtime = await sites();
      const { index, coverage } = await loadSites(runtime.repos.sites, runtime.now, runtime.cache);
      if (!index.siteById.has(ref.id)) return null;
      const active = siteCustomers(index, ref.id).filter((customer) => customer.accountStatus === "active").length;
      const complete = coverage.customers === "complete" && coverage.servicePoints === "complete";
      return {
        // Nothing supplies a site, and its connections have no recorded place to draw.
        upstream: [],
        downstream: [],
        downstreamKnown: true,
        noUpstreamReason: "No substation: the site generates its own energy.",
        noDownstreamReason: "Its own connections, counted below. They have no recorded location, so none is drawn.",
        facts: [registryCount("Active connections", complete ? active : null, complete ? null : "The site register is not complete, so the count is not known.")],
      };
    },
    measures: [],
    layers: [
      {
        id: "minigrid.sites",
        title: "Mini-grid sites",
        description: sites === undefined ? NOT_CONNECTED : CONNECTED,
        shape: "point",
        entityKinds: [MINIGRID_SITE_KIND],
        legend: [],
        onByDefault: false,
        ...(sites === undefined ? {} : { details: async (_runtime, shown) => keyFigures(await sites(), shown) }),
      },
    ],
  };
}

/** The module with no source of sites connected. */
export const MINIGRID_SPATIAL_MODULE: SpatialModule = minigridSpatialModule();
