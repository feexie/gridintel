import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMinigridDemoRepositories } from "../../repositories/demo/minigrid/index.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { sitePerformance } from "./performance.ts";
import { AGREEMENT_TOLERANCE, minigridPortfolioView, minigridSiteIds, minigridSiteView } from "./view.ts";

/* The Mini-grid read models on the synthetic sites: what the two screens are given. Every figure
   is checked against the site performance service, which owns it. */

const runtime = { repos: createMinigridDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: { tariffs: "Tariffs are assumptions, not current published rates." }, cache: createMemoryCache() };
const portfolio = await minigridPortfolioView(runtime);
const card = (id: string) => portfolio.sites.find((site) => site.id === id)!;
const finding = (rule: string, siteId: string | null = null) => portfolio.findings.find((found) => found.rule === rule && (found.site?.id ?? null) === siteId);
const percent = (value: number | null | undefined, digits = 1) => (value == null ? null : Number((value * 100).toFixed(digits)));

describe("the Mini-grid portfolio view", () => {
  it("puts the four sites side by side on the same figures, each the service's own", async () => {
    assert.deepEqual(portfolio.sites.map((site) => site.id), ["MG-DRY", "MG-GRN", "MG-PLM", "MG-TAM"]);
    assert.deepEqual([portfolio.operator, portfolio.completeness, portfolio.currency, portfolio.sourcing.synthetic], ["Demonstration Mini-grid Operator (synthetic)", "complete", "NGN", true]);
    const owned = (await sitePerformance({ repos: runtime.repos, siteId: "MG-DRY", period: DEMO_PERIOD, context: { computedAt: DEMO_CLOCK }, cache: runtime.cache }))!.result.performance;
    const dry = card("MG-DRY");
    assert.equal(dry.renewableFraction.value, owned.energy.renewableFraction.value);
    assert.equal(dry.fuelPerKwh?.value, owned.generator?.specificFuelConsumption.value);
    assert.equal(dry.availability.value, owned.availability.all.availability.value);
    assert.equal(dry.collectionEfficiency.value, owned.commercial.collectionEfficiency.value);
    assert.deepEqual([dry.fuelPerKwh?.unit, dry.energySoldPerConnection.unit, dry.connections.unit], ["litres_per_kWh", "kWh_per_connection", "count"]);
    assert.equal(dry.renewableFraction.method?.name, "GridIntel reference site performance");
    assert.equal(dry.plant, "45 kWp PV · 90 kWh battery · 60 kVA diesel generator");
  });

  it("says a site has no generator instead of giving it a fuel figure", () => {
    assert.equal(card("MG-GRN").fuelPerKwh, null);
    assert.match(card("MG-GRN").plant, /no generator$/);
  });

  it("counts how each site's report stands: agreeing, differing and not comparable", () => {
    assert.deepEqual(
      portfolio.sites.map((site) => [site.id, site.report.claims, site.report.agree, site.report.differ, site.report.notComparable]),
      [
        ["MG-DRY", 8, 5, 3, 0],
        ["MG-GRN", 7, 6, 0, 1],
        ["MG-PLM", 8, 6, 2, 0],
        ["MG-TAM", 8, 7, 0, 1],
      ],
    );
    assert.equal(portfolio.agreementTolerance, AGREEMENT_TOLERANCE);
    assert.deepEqual(card("MG-DRY").variances.map((row) => row.label), ["Availability", "Generator running hours", "Renewable fraction"]);
    assert.deepEqual(card("MG-TAM").variances, []);
  });

  it("gives collection by customer class over every site, the rate taken of the sums, largest shortfall first", () => {
    assert.deepEqual(portfolio.byClass.map((row) => row.customerClass), ["public", "productive_use", "residential", "commercial"]);
    const institutions = portfolio.byClass[0];
    assert.deepEqual([institutions.label, institutions.accounts, institutions.postpaidAccounts, Math.round(institutions.notCollected), percent(institutions.collectionEfficiency)], ["Public institutions", 16, 16, 286894, 21.2]);
    assert.deepEqual(portfolio.byClass.filter((row) => row.postpaidAccounts === 0).map((row) => row.notCollected), [0, 0]);
  });
});

describe("what stands out, by fixed rules", () => {
  it("lists the findings in the order of the rules, each with its rule in words", () => {
    assert.deepEqual(portfolio.findings.map((found) => [found.rule, found.site?.id ?? null]), [
      ["report_differs", "MG-DRY"],
      ["report_differs", "MG-PLM"],
      ["fuel_per_kwh", "MG-DRY"],
      ["pv_held_back", "MG-GRN"],
      ["uncollected", "MG-PLM"],
      ["class_pays_least", null],
    ]);
    assert.ok(portfolio.findings.every((found) => found.ruleText.length > 0 && found.statement.length > 0));
  });

  it("which site over-reports: Dry River, on three figures, each beside the calculation on its basis", () => {
    const found = finding("report_differs", "MG-DRY")!;
    assert.match(found.statement, /differs from its records on 3 of the 8 figures/);
    assert.deepEqual(found.comparisons.map((row) => [row.label, percent(row.reported.value), percent(row.calculated.value), row.sameBasis]).filter(([label]) => label === "Renewable fraction"), [["Renewable fraction", 68, 49.6, true]]);
    assert.ok(found.comparisons.every((row) => row.comparable && row.reported.origin === "reported"));
  });

  it("which site burns diesel inefficiently: Dry River, against the least", () => {
    const found = finding("fuel_per_kwh", "MG-DRY")!;
    assert.deepEqual(found.figures.map((figure) => [figure.label, Number(figure.value?.toFixed(2))]).slice(0, 3), [
      ["Fuel per kWh, Dry River", 0.51],
      ["Fuel per kWh, Palm Landing (the least)", 0.35],
      ["Generator running hours, Dry River", 315],
    ]);
  });

  it("which site is oversized for its demand: Granite Hill, with the estimate marked as one", () => {
    const found = finding("pv_held_back", "MG-GRN")!;
    assert.deepEqual(found.figures.map((figure) => [figure.label, percent(figure.value), figure.status]).slice(0, 3), [
      ["PV curtailed", 72.4, "calculated_with_estimates"],
      ["Performance ratio", 21.8, "ok"],
      ["Performance ratio before curtailment", 79, "calculated_with_estimates"],
    ]);
    // No other site has half its PV held back.
    assert.equal(portfolio.findings.filter((one) => one.rule === "pv_held_back").length, 1);
  });

  it("where unpaid money sits: Palm Landing's credit accounts, and public institutions across the portfolio", () => {
    const palm = finding("uncollected", "MG-PLM")!;
    assert.match(palm.statement, /owed by 13 postpaid accounts/);
    assert.deepEqual(palm.classes.map((row) => [row.label, Math.round(row.notCollected), percent(row.collectionEfficiency)]), [
      ["Productive use (mills, workshops)", 147140, 64.7],
      ["Public institutions", 96001, 20.8],
    ]);
    const least = finding("class_pays_least")!;
    assert.match(least.statement, /public institutions paid the smallest share/);
    assert.equal(least.classes[0].customerClass, "public");
  });
});

describe("the Mini-grid site view", () => {
  it("gives the energy flow in order, from generation to the customers' meters, and it adds up", async () => {
    const view = (await minigridSiteView(runtime, "MG-TAM"))!;
    assert.deepEqual(view.energy.flow.map((row) => [row.role, row.metric.label]), [
      ["source", "PV generation"],
      ["source", "Generator generation"],
      ["equals", "Energy generated"],
      ["less", "Net into storage"],
      ["less", "Station use"],
      ["equals", "Energy sent out"],
      ["less", "Distribution loss"],
      ["equals", "Energy delivered"],
    ]);
    const value = (label: string) => view.energy.flow.find((row) => row.metric.label === label)!.metric.value as number;
    assert.ok(Math.abs(value("PV generation") + value("Generator generation") - value("Energy generated")) < 1e-6);
    assert.ok(Math.abs(value("Energy generated") - value("Net into storage") - value("Station use") - value("Energy sent out")) < 1e-6);
    assert.ok(Math.abs(value("Energy sent out") - value("Distribution loss") - value("Energy delivered")) < 1e-6);
    assert.deepEqual(view.energy.flow.filter((row) => row.metric.origin === "derived").map((row) => row.metric.label), ["Station use", "Distribution loss"]);
    assert.deepEqual(view.energy.mix.map((part) => [part.label, percent(part.share.value)]), [["Solar PV", 94.7], ["Generator", 5.3]]);
  });

  it("shows a gap as insufficient data with what is missing, never as zero", async () => {
    const view = (await minigridSiteView(runtime, "MG-DRY"))!;
    const delivered = view.energy.flow.at(-1)!.metric;
    assert.deepEqual([delivered.value, delivered.status], [null, "insufficient_data"]);
    assert.ok(delivered.missingInputs.some((name) => name.includes("M-DRY-007")));
    assert.deepEqual(view.energy.deliveredCoverage, { connections: 300, recorded: 294, unmetered: 0, incomplete: 6 });
    assert.equal(view.energy.siteLoss.status, "insufficient_data");
  });

  it("has no generator panel for a site without one, and a battery chart of thirty days", async () => {
    const granite = (await minigridSiteView(runtime, "MG-GRN"))!;
    assert.equal(granite.generator, null);
    assert.equal(granite.storage?.byDay.length, 30);
    assert.ok(granite.storage!.byDay.every((day) => day.lowest !== null && day.highest !== null && day.lowest <= (day.mean as number) && (day.mean as number) <= day.highest));
    assert.deepEqual(granite.assets.map((asset) => [asset.label, asset.nameplate]).filter(([label]) => label.endsWith("inverter")), [["Battery inverter", "40 kVA"], ["PV inverter", "60 kVA"]]);
  });

  it("lists the interruptions as the log holds them, and the hours lost by cause", async () => {
    const view = (await minigridSiteView(runtime, "MG-PLM"))!;
    assert.deepEqual(view.availability.interruptions.map((row) => [row.cause, row.hours, row.planned, row.customersAffected]), [
      ["Weather", 6, false, 393],
      ["Planned maintenance", 3, true, 393],
    ]);
    assert.deepEqual(view.availability.hoursLostByCause, [{ cause: "Weather", hours: 6 }, { cause: "Planned maintenance", hours: 3 }]);
    assert.ok((view.availability.withoutPlanned.value as number) > (view.availability.figures[0].value as number));
  });

  it("gives revenue in the operator's currency, collection by class, and the tariff caveat", async () => {
    const view = (await minigridSiteView(runtime, "MG-PLM"))!;
    const billed = view.commercial.figures.find((figure) => figure.label === "Revenue billed")!;
    assert.deepEqual([billed.unit, billed.currency, Math.round(billed.value as number)], ["currency", "NGN", 2076678]);
    assert.deepEqual(view.commercial.byClass.map((row) => [row.customerClass, row.postpaidAccounts]), [["productive_use", 8], ["public", 5], ["residential", 0], ["commercial", 0]]);
    assert.equal(view.commercial.tariffCaveat, "Tariffs are assumptions, not current published rates.");
    assert.equal(view.commercial.byTier.length, 5);
  });

  it("sets every claim of the report beside the calculation, saying what each counts or why they cannot be compared", async () => {
    const view = (await minigridSiteView(runtime, "MG-TAM"))!;
    assert.equal(view.comparisons.length, 8);
    // That the report's methodology is unverified is said once for the table, and on no row.
    assert.match(view.comparisonNote ?? "", /^The report's methodology \(".+"\) has not been verified as equivalent to the GridIntel reference methods the calculations use\. This applies to every figure below\.$/);
    assert.ok(view.comparisons.every((row) => row.caveats.every((caveat) => !/verified as equivalent/.test(caveat))));
    // Collection on a site is named for what it does there; the methodology's id is as recorded.
    assert.deepEqual([view.commercial.collectionEfficiency.method?.name, view.commercial.collectionEfficiency.method?.id], ["GridIntel reference collection", "gridintel.atcc.reference"]);
    assert.equal(view.comparisons.find((row) => row.label === "Collection efficiency")?.calculated.method?.name, "GridIntel reference collection");
    const accrual = view.comparisons.find((row) => row.label === "Collection efficiency")!;
    assert.deepEqual([accrual.comparable, accrual.variance, accrual.reportedBasis], [false, null, "collection on an accrual basis"]);
    assert.ok(accrual.reasons.length > 0);
    const connections = view.comparisons.find((row) => row.label === "Connections")!;
    assert.deepEqual([connections.comparable, connections.reportedBasis, connections.variance], [true, "active accounts only", 0]);
    const granite = (await minigridSiteView(runtime, "MG-GRN"))!;
    assert.equal(granite.comparisons.find((row) => row.label === "Availability")?.reportedBasis, null);
  });

  it("is null for a site that is not in the register, and the list of sites is the register's", async () => {
    assert.equal(await minigridSiteView(runtime, "MG-NOWHERE"), null);
    assert.deepEqual(await minigridSiteIds(runtime), ["MG-DRY", "MG-GRN", "MG-PLM", "MG-TAM"]);
  });

  it("on repositories with no sites, the portfolio says so and lists nothing", async () => {
    const none = await minigridPortfolioView({ repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} });
    assert.deepEqual([none.sites.length, none.findings.length, none.completeness, none.operator], [0, 0, "not_available", null]);
  });
});
