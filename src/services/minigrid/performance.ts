import type { AssetRef, GenerationAsset, IsoTimestamp, MinigridSite, Period } from "@/domain";
import type { GridIntelRepositories, SiteRegistryCoverage, SiteRegistrySnapshot, SiteRepository } from "../../repositories/ports/index.ts";
import type { CalculationContext, KpiComparison, SiteIndex, SitePerformance } from "../../analytics/index.ts";
import type { ServiceCache } from "../analytics/cache.ts";
import type { Sourced } from "../analytics/sourcing.ts";
import { buildSiteIndex, comparableSiteKpis, compareOnBasis, computeSitePerformance, siteCustomers, siteMeters, siteServicePoints, toEpochMs } from "../../analytics/index.ts";
import { NO_CACHE, resultKey } from "../analytics/cache.ts";
import { SourceTrail } from "../analytics/sourcing.ts";

/* ==========================================================
   SERVICES — MINI-GRID SITE PERFORMANCE

   For one site and one period: gathers the site's meter intervals,
   its plant telemetry, its interruption log, its accounts' charges
   and payments, and the figures a report states for it, and hands
   them to analytics. Analytics does every calculation; this only
   gathers the inputs and says where they came from.

   Reported figures are set beside the calculated figure on the
   same basis and are never merged with it (ADR 0007).

   The repositories given are the mini-grid operator's own. Nothing
   here reads a distribution network.
========================================================== */

export interface LoadedSites {
  index: SiteIndex;
  snapshot: SiteRegistrySnapshot;
  coverage: SiteRegistryCoverage;
}

export function loadSites(sites: SiteRepository, asOf: IsoTimestamp, cache: ServiceCache = NO_CACHE): Promise<LoadedSites> {
  return cache.get(`sites|${asOf}`, async () => {
    const result = await sites.getSnapshot({ asOf });
    return { index: buildSiteIndex(result.snapshot), snapshot: result.snapshot, coverage: result.coverage };
  });
}

export interface SiteReport {
  site: MinigridSite;
  /** The site's in-service generation and storage assets. */
  assets: GenerationAsset[];
  performance: SitePerformance;
  /** Each figure a report states for the site and period, beside the calculation on its basis. */
  comparisons: KpiComparison[];
}

interface SiteParams {
  repos: GridIntelRepositories;
  siteId: string;
  period: Period;
  context: CalculationContext;
  cache?: ServiceCache;
}

function samePeriod(a: Period | null, b: Period): boolean {
  return a !== null && toEpochMs(a.start) === toEpochMs(b.start) && toEpochMs(a.end) === toEpochMs(b.end);
}

async function compute(params: SiteParams): Promise<Sourced<SiteReport> | null> {
  const { repos, siteId, period, context } = params;
  const { index, snapshot, coverage } = await loadSites(repos.sites, period.end, params.cache);
  const site = index.siteById.get(siteId);
  if (site === undefined) return null;
  const trail = new SourceTrail().add([site]);

  const assets = [...(index.assetsBySite.get(siteId) ?? [])];
  trail.add(assets);
  const points = siteServicePoints(index, siteId);
  const meters = [
    ...assets.flatMap((asset) => [...siteMeters(index, "generation", asset.id), ...siteMeters(index, "storage", asset.id)]),
    ...siteMeters(index, "site_output", siteId),
    ...points.flatMap((sp) => siteMeters(index, "service_point", sp.id)),
  ];
  const intervals = await repos.observations.listIntervalEnergy({ meterIds: meters.map((meter) => meter.id), period });
  trail.add(intervals.records);

  const sources: AssetRef[] = [{ kind: "site", id: siteId }, ...assets.map((asset): AssetRef => ({ kind: "generation_asset", id: asset.id }))];
  const telemetry = await repos.observations.listTelemetry({ sources, from: period.start, asOf: period.end });
  trail.add(telemetry.records);

  const outages = await repos.events.listOutages({ period });
  const own = outages.records.filter((outage) => outage.exposures.some((exposure) => "id" in exposure.affected && exposure.affected.kind === "site" && exposure.affected.id === siteId));
  trail.add(own);

  const customers = siteCustomers(index, siteId);
  trail.add(customers);
  const customerIds = customers.map((customer) => customer.id);
  const billing = await repos.billing.listBillingRecords({ period, customerIds });
  const payments = await repos.billing.listPayments({ period, customerIds });
  trail.add(billing.records).add(payments.records);

  // The operator's currency. With none recorded no record matches it, so revenue is unavailable rather than assumed.
  const currency = snapshot.organizations.find((organization) => organization.id === site.operatorOrganizationId)?.currency ?? "unknown";
  const performance = computeSitePerformance({
    index,
    siteId,
    period,
    intervals: intervals.records,
    telemetry: telemetry.records,
    outages: own,
    outagesAvailable: outages.completeness !== "not_available",
    billingRecords: billing.records,
    payments: payments.records,
    billingAvailable: billing.completeness !== "not_available",
    currency,
    registryComplete: [coverage.generationAssets, coverage.servicePoints, coverage.meters, coverage.customers].every((held) => held === "complete"),
    computedAt: context.computedAt,
  });

  const reported = await repos.reported.listReportedKpis({ scopes: [{ kind: "site", id: siteId }] });
  const stated = reported.records.filter((kpi) => samePeriod(kpi.period, period));
  trail.add(stated);
  const candidates = comparableSiteKpis(performance);
  const comparisons = stated.flatMap((kpi) => {
    const sameMetric = candidates.filter((candidate) => candidate.metric === kpi.metric);
    return sameMetric.length === 0 ? [] : [compareOnBasis(kpi, sameMetric)];
  });

  return { result: { site, assets, performance, comparisons }, sourcing: await trail.resolve(repos.sources) };
}

/** One site's performance for the period; null when the site is not in the registry. */
export function sitePerformance(params: SiteParams): Promise<Sourced<SiteReport> | null> {
  return (params.cache ?? NO_CACHE).get(resultKey("site-performance", { kind: "site", id: params.siteId }, params.period, params.context.computedAt), () => compute(params));
}

export interface SitePortfolio {
  /** Every site in the registry, in id order. */
  sites: SiteReport[];
  /** How complete the list of sites is. Anything but "complete" means a site may exist that is not listed. */
  completeness: SiteRegistryCoverage["sites"];
}

/** Every site the repositories hold, each with its own performance. Nothing is summed across sites here. */
export async function sitePortfolio(params: Omit<SiteParams, "siteId">): Promise<Sourced<SitePortfolio>> {
  const { index, coverage } = await loadSites(params.repos.sites, params.period.end, params.cache);
  const trail = new SourceTrail();
  const sites: SiteReport[] = [];
  for (const siteId of [...index.siteById.keys()].sort()) {
    const report = await sitePerformance({ ...params, siteId });
    if (report === null) continue;
    trail.addSourcing(report.sourcing);
    sites.push(report.result);
  }
  return { result: { sites, completeness: coverage.sites }, sourcing: await trail.resolve(params.repos.sources) };
}
