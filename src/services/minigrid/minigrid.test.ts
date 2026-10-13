import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CalculatedKpi, KpiComparison } from "../../analytics/index.ts";
import type { SpatialContext } from "../spatial/queries.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { MINIGRID_DATA_SOURCES, createMinigridDemoRepositories } from "../../repositories/demo/minigrid/index.ts";
import { withGeoBoundaries } from "../../repositories/geoboundaries/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { mapView } from "../spatial/map.ts";
import { createSpatialRegistry } from "../spatial/module.ts";
import { totalsByArea, whatIsBehind, whatIsInside } from "../spatial/queries.ts";
import { REFERENCE_SPATIAL_MODULE } from "../spatial/reference.ts";
import { UTILITY_SPATIAL_MODULE } from "../utility/spatial.ts";
import { sitePerformance, sitePortfolio } from "./performance.ts";
import { MINIGRID_SPATIAL_MODULE, minigridSpatialModule } from "./spatial.ts";

/* Site performance on the synthetic mini-grid dataset, as the application composes it: the
   operator's own repositories, and its sites on the shared map beside the utility's network. */

const repos = createMinigridDemoRepositories();
const cache = createMemoryCache();
const context = { computedAt: DEMO_CLOCK };
const portfolio = await sitePortfolio({ repos, period: DEMO_PERIOD, context, cache });
const report = (siteId: string) => {
  const found = portfolio.result.sites.find((one) => one.site.id === siteId);
  assert.ok(found !== undefined, siteId);
  return found;
};
const value = (kpi: CalculatedKpi, decimals = 0) => (kpi.value === null ? null : Number((kpi.unit === "fraction" ? kpi.value * 100 : kpi.value).toFixed(decimals)));
const comparison = (siteId: string, metric: string) => report(siteId).comparisons.find((one) => one.metric === metric) as KpiComparison;

describe("the mini-grid portfolio", () => {
  it("is four sites, complete, and synthetic", () => {
    assert.deepEqual(portfolio.result.sites.map((one) => one.site.id), ["MG-DRY", "MG-GRN", "MG-PLM", "MG-TAM"]);
    assert.equal(portfolio.result.completeness, "complete");
    assert.equal(portfolio.sourcing.synthetic, true);
    assert.deepEqual(portfolio.sourcing.sources.map((source) => source.id), MINIGRID_DATA_SOURCES.map((source) => source.id).sort());
  });

  it("is not available, rather than empty, on repositories that hold no sites", async () => {
    const none = await sitePortfolio({ repos: createDemoRepositories(), period: DEMO_PERIOD, context });
    assert.deepEqual([none.result.sites.length, none.result.completeness], [0, "not_available"]);
    assert.equal(await sitePerformance({ repos, siteId: "MG-NOWHERE", period: DEMO_PERIOD, context }), null);
  });
});

describe("each site shows the condition it was designed to", () => {
  it("Tamarind Cross: a well-run solar-hybrid", () => {
    const { energy, pv, generator, availability, commercial } = report("MG-TAM").performance;
    assert.deepEqual([value(energy.energyGenerated), value(energy.renewableFraction, 1), value(energy.distributionLoss, 1)], [11904, 94.7, 7]);
    assert.deepEqual([value(pv!.performanceRatio, 1), value(pv!.specificYield, 1)], [74.4, 112.7]);
    assert.equal(value(generator!.runtime), 21);
    assert.equal(value(availability.all.availability, 2), 99.69);
    assert.deepEqual([value(commercial.connections), value(commercial.collectionEfficiency, 1), value(commercial.energySoldPerConnection, 1)], [465, 96, 22.5]);
    assert.equal(energy.energyGenerated.status, "ok");
  });

  it("Dry River: half its energy from the generator, and the worst availability", () => {
    const { energy, generator, availability, storage } = report("MG-DRY").performance;
    assert.deepEqual([value(energy.renewableFraction, 1), value(energy.generatorShare, 1)], [49.6, 50.4]);
    assert.deepEqual([value(generator!.runtime), value(generator!.fuelUsed), value(generator!.specificFuelConsumption, 2)], [315, 2290, 0.51]);
    assert.deepEqual([value(availability.all.availability, 2), availability.interruptions, value(availability.all.hoursOfSupply, 1)], [95.83, 7, 23]);
    assert.deepEqual(Object.keys(availability.hoursLostByCause ?? {}), ["fault"]);
    assert.equal(value(storage!.equivalentFullCycles, 1), 18.1);
  });

  it("Dry River: six meters with a gap make energy delivered and the losses unavailable, never smaller", () => {
    const { energy, commercial } = report("MG-DRY").performance;
    assert.deepEqual([energy.energyDelivered.status, energy.distributionLoss.status, commercial.consumptionPerConnection.status], ["insufficient_data", "insufficient_data", "insufficient_data"]);
    assert.deepEqual(energy.deliveredCoverage, { connections: 300, recorded: 294, unmetered: 0, incomplete: 6 });
    // What rests on the powerhouse meters and on the charges is still given.
    assert.equal(value(energy.energySentOut), 8547);
    assert.equal(value(commercial.energySoldPerConnection, 1), 25.9);
  });

  it("a cycle-charging generator burns 0.35 litres per kWh; Dry River's, following a small night load, burns 0.51", () => {
    const fuel = (siteId: string) => value(report(siteId).performance.generator!.specificFuelConsumption, 2);
    assert.deepEqual([fuel("MG-TAM"), fuel("MG-PLM"), fuel("MG-DRY")], [0.35, 0.35, 0.51]);
    // Palm Landing's generator makes the same energy in half the hours it ran when it followed the load.
    const palm = report("MG-PLM").performance;
    assert.deepEqual([value(palm.generator!.runtime), value(palm.energy.generatorGeneration)], [150, 3600]);
    // Its battery is the weak point: charged only a third of the way, it averages well under half full.
    assert.equal(value(palm.storage!.stateOfChargeMean), 38);
  });

  it("Palm Landing: what is not collected is owed by its credit accounts, most of it by public institutions, never by prepaid households", () => {
    const classes = Object.fromEntries(report("MG-PLM").performance.commercial.byClass.map((one) => [one.customerClass, one]));
    assert.deepEqual(Object.keys(classes), ["commercial", "productive_use", "public", "residential"]);
    assert.deepEqual([classes.residential.postpaidAccounts, classes.residential.collectionEfficiency, classes.commercial.collectionEfficiency], [0, 1, 1]);
    assert.deepEqual([classes.productive_use.accounts, classes.productive_use.postpaidAccounts, Math.round(classes.productive_use.notCollected)], [8, 8, 147140]);
    // Mills and workshops on credit pay most of their bill; public institutions pay about a fifth, as at every site.
    assert.equal(Number(((classes.productive_use.collectionEfficiency as number) * 100).toFixed(1)), 64.7);
    assert.deepEqual([classes.public.postpaidAccounts, Number(((classes.public.collectionEfficiency as number) * 100).toFixed(1)), Math.round(classes.public.notCollected)], [5, 20.8, 96001]);
    for (const one of portfolio.result.sites) {
      const institutions = one.performance.commercial.byClass.find((candidate) => candidate.customerClass === "public");
      assert.ok((institutions?.collectionEfficiency as number) > 0.15 && (institutions?.collectionEfficiency as number) < 0.25, one.site.id);
    }
    // At every site what is not collected is owed by postpaid accounts alone.
    for (const one of portfolio.result.sites) {
      for (const group of one.performance.commercial.byClass.filter((candidate) => candidate.postpaidAccounts === 0)) assert.equal(group.notCollected, 0, `${one.site.id} ${group.customerClass}`);
    }
  });

  it("Palm Landing: 24 disconnected accounts are kept out of the connection count", () => {
    const { energy, commercial } = report("MG-PLM").performance;
    assert.deepEqual([value(commercial.collectionEfficiency, 1), value(commercial.connections), value(commercial.connectionsAll)], [88.3, 393, 417]);
    assert.deepEqual([value(commercial.revenueBilled), value(commercial.revenueCollected)], [2076678, 1833537]);
    assert.deepEqual(commercial.chargesByBasis, { meter_reading: 13, prepaid_vend: 1221, estimated: 0 });
    assert.deepEqual([value(energy.distributionLoss, 1), value(energy.renewableFraction, 1)], [14, 62.3]);
  });

  it("Granite Hill: low demand, so most of what the array could give is curtailed and the performance ratio is low", () => {
    const { energy, pv, generator, commercial } = report("MG-GRN").performance;
    assert.deepEqual([value(energy.energyGenerated), value(energy.curtailment)], [1917, 5039]);
    assert.deepEqual([value(pv!.performanceRatio, 1), value(pv!.performanceRatioBeforeCurtailment, 1)], [21.8, 79]);
    assert.equal(pv!.performanceRatioBeforeCurtailment.status, "calculated_with_estimates");
    assert.equal(generator, null);
    assert.deepEqual([energy.generatorGeneration.value, energy.renewableFraction.value], [0, 1]);
    assert.deepEqual([value(commercial.energySoldPerConnection, 1), value(commercial.revenuePerConnection)], [11.6, 3019]);
  });

  it("gives every site a storage loss that is calculated with an estimate, and a round-trip efficiency near 90%", () => {
    for (const one of portfolio.result.sites) {
      const storage = one.performance.storage!;
      assert.equal(storage.storageLoss.status, "calculated_with_estimates", one.site.id);
      assert.ok((storage.roundTripEfficiency.value as number) > 0.88 && (storage.roundTripEfficiency.value as number) < 0.92, one.site.id);
    }
  });
});

describe("a site report's claims beside the records", () => {
  it("compares a claim only with the calculation on its own basis", () => {
    for (const one of portfolio.result.sites) {
      for (const compared of one.comparisons.filter((candidate) => candidate.comparable)) {
        assert.equal(compared.sameBasis, true);
        assert.deepEqual(compared.calculated.scope, { kind: "site", id: one.site.id });
      }
    }
    assert.equal(report("MG-TAM").comparisons.length, 8);
    assert.equal(report("MG-GRN").comparisons.length, 7);
  });

  it("Dry River overstates its renewable fraction and its uptime, and understates its generator's hours", () => {
    assert.equal(Number(comparison("MG-DRY", "renewable_fraction").variance.absolute?.toFixed(1)), -18.4);
    assert.equal(comparison("MG-DRY", "renewable_fraction").variance.absoluteUnit, "percentage_points");
    assert.equal(comparison("MG-DRY", "generator_runtime").variance.absolute, 125);
    // Its uptime is stated without planned interruptions, and is set beside the calculation without them.
    const uptime = comparison("MG-DRY", "availability");
    assert.equal(uptime.calculated.basis.plannedInterruptions, "excluded");
    assert.equal(Number(uptime.variance.absolute?.toFixed(2)), -3.67);
  });

  it("Palm Landing overstates collection; its connection count is every account, as it says, and agrees on that basis", () => {
    assert.equal(Number(comparison("MG-PLM", "collection_efficiency").variance.absolute?.toFixed(1)), -8.7);
    assert.equal(Math.round(comparison("MG-PLM", "revenue_collected").variance.absolute as number), -181463);
    const connections = comparison("MG-PLM", "connection_count");
    assert.deepEqual([connections.calculated.basis.connections, connections.calculated.value, connections.variance.absolute], ["all", 417, 0]);
  });

  it("gives no variance where the basis differs or is not stated", () => {
    const accrual = comparison("MG-TAM", "collection_efficiency");
    assert.deepEqual([accrual.comparable, accrual.variance.absolute], [false, null]);
    assert.ok(accrual.issues.some((issue) => issue.code === "BASIS_MISMATCH"));
    const unstated = comparison("MG-GRN", "availability");
    assert.deepEqual([unstated.comparable, unstated.variance.absolute], [false, null]);
    assert.ok(unstated.issues.some((issue) => issue.code === "BASIS_UNSPECIFIED"));
  });

  it("Tamarind Cross's other claims agree with its records", () => {
    for (const metric of ["energy_generated", "renewable_fraction", "availability", "energy_billed", "connection_count", "generator_runtime"]) {
      const compared = comparison("MG-TAM", metric);
      assert.ok(compared.comparable && Math.abs(compared.variance.relative as number) < 0.005, metric);
    }
  });
});

/* ---------------- On the shared map ---------------- */

const base = withGeoBoundaries(createDemoRepositories());
// As the composition root does: the platform's list of data sources includes the operator's.
const runtime = { repos: { ...base, sources: { listDataSources: async () => [...(await base.sources.listDataSources()), ...MINIGRID_DATA_SOURCES] } }, now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const sites = minigridSpatialModule(() => ({ repos, now: DEMO_CLOCK, period: DEMO_PERIOD, cache }));
const spatial: SpatialContext = { runtime, registry: createSpatialRegistry([UTILITY_SPATIAL_MODULE, sites, REFERENCE_SPATIAL_MODULE]), viewer: { viewerId: "public-demo", organizationId: null, access: { kind: "everything" } } };

describe("mini-grid sites on the spatial platform", () => {
  it("fill the layer registered for them: four sites, located, complete and synthetic", async () => {
    const map = await mapView(spatial, { layers: ["minigrid.sites"] });
    const [layer] = map.layers;
    assert.deepEqual(layer.features.map((feature) => [feature.entity.kind, feature.entity.id, feature.entity.name]), [
      ["minigrid_site", "MG-DRY", "Dry River"],
      ["minigrid_site", "MG-GRN", "Granite Hill"],
      ["minigrid_site", "MG-PLM", "Palm Landing"],
      ["minigrid_site", "MG-TAM", "Tamarind Cross"],
    ]);
    assert.deepEqual([layer.coverage, layer.onByDefault, layer.notLocated.length, layer.sourcing.synthetic], ["complete", false, 0, true]);
    assert.ok(layer.features.every((feature) => feature.entity.geometry?.type === "point" && feature.entity.module === "minigrid"));
  });

  it("show each site's key figures as the site performance service gives them, with status and method", async () => {
    const map = await mapView(spatial, { layers: ["minigrid.sites"] });
    const dry = map.layers[0].features.find((feature) => feature.entity.id === "MG-DRY");
    const figure = (label: string) => dry?.details.find((detail) => detail.label === label);
    const { energy, availability, commercial } = report("MG-DRY").performance;
    assert.deepEqual(dry?.details.map((detail) => detail.label), ["Energy generated", "Renewable fraction", "PV performance ratio", "Availability", "Collection efficiency"]);
    assert.equal(figure("Renewable fraction")?.value, energy.renewableFraction.value);
    assert.equal(figure("Availability")?.value, availability.all.availability.value);
    assert.equal(figure("Collection efficiency")?.value, commercial.collectionEfficiency.value);
    assert.deepEqual(dry?.trace?.facts.map((fact) => [fact.label, fact.value, fact.unit]), [["Active connections", commercial.connections.value, "count"]]);
    assert.deepEqual([figure("Energy generated")?.unit, figure("Energy generated")?.status, figure("Energy generated")?.origin], ["kWh", "ok", "calculated"]);
    assert.equal(figure("Energy generated")?.method?.name, "GridIntel reference site performance");
    assert.equal(figure("Collection efficiency")?.method?.name, "GridIntel reference collection");
  });

  it("trace a site to nothing upstream: no substation supplies it", async () => {
    const behind = await whatIsBehind(spatial, { kind: "minigrid_site", id: "MG-PLM" });
    assert.deepEqual([behind?.upstream.length, behind?.downstream.length], [0, 0]);
    assert.deepEqual(behind?.facts.map((fact) => [fact.label, fact.value]), [["Active connections", 393]]);
    assert.deepEqual([behind?.noUpstreamReason, behind?.noDownstreamReason], ["No substation: the site generates its own energy.", "Its own connections, counted below. They have no recorded location, so none is drawn."]);
    // It is in no area, and the reason given is the true one.
    assert.deepEqual([behind?.areas, behind?.areasReason], [[], "Synthetic data is not placed in real states or LGAs, and no synthetic district covers it."]);
    assert.equal(await whatIsBehind(spatial, { kind: "minigrid_site", id: "MG-NOWHERE" }), null);
  });

  it("are never said to be inside a real state, and take no part in the utility's totals", async () => {
    const states = (await runtime.repos.spatial.listAreas({ kinds: ["state"] })).records;
    for (const state of states) {
      const inside = await whatIsInside(spatial, state.id);
      assert.equal(inside?.inside.some((group) => group.kind === "minigrid_site"), false, state.name);
    }
    const totals = await totalsByArea(spatial, "utility.revenue_not_realised");
    assert.equal(totals?.rows.length, 3);
  });

  it("leave the map's opening view to the layers that are on when it opens", async () => {
    const utility = await mapView(spatial, { layers: ["utility.substations", "utility.transformers"] });
    const framed = await mapView(spatial, { layers: ["utility.substations", "utility.transformers", "minigrid.sites"], frame: ["utility.substations", "utility.transformers"] });
    const unframed = await mapView(spatial, { layers: ["utility.substations", "utility.transformers", "minigrid.sites"] });
    assert.deepEqual(framed.bounds, utility.bounds);
    assert.ok((unframed.bounds?.south as number) < 6 && (unframed.bounds?.north as number) > 12);
    assert.equal(framed.layers[2].features.length, 4);
  });

  it("with no source connected, hold an empty place that says so", async () => {
    const map = await mapView({ ...spatial, registry: createSpatialRegistry([UTILITY_SPATIAL_MODULE, MINIGRID_SPATIAL_MODULE, REFERENCE_SPATIAL_MODULE]), runtime: { ...runtime, cache: createMemoryCache() } }, { layers: ["minigrid.sites"] });
    assert.deepEqual([map.layers[0].features.length, map.layers[0].coverage], [0, "not_available"]);
    assert.match(map.layers[0].description, /No source of mini-grid sites is connected/);
  });
});
