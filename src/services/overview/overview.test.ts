import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMinigridDemoRepositories } from "../../repositories/demo/minigrid/index.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "../analytics/__fixtures__/sparse.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { assetsWorkspaceView } from "../assets/view.ts";
import { eventsWorkspaceView } from "../events/view.ts";
import { executiveView } from "../executive/view.ts";
import { minigridOverviewView } from "../minigrid/overview.ts";
import { minigridPortfolioView } from "../minigrid/view.ts";
import { PLATFORM_FINDINGS_PER_SECTOR, firstOfEachRule, platformLines, platformOverviewView } from "../platform/overview.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { utilityOverviewView } from "../utility/overview.ts";

/* The overviews on the synthetic demonstration: every line is a line of the screen it leads to,
   and every figure is that screen's own object, not a copy that could drift. */

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const executive = await executiveView(runtime);
const events = await eventsWorkspaceView(runtime);
const assets = await assetsWorkspaceView(runtime);
const reliability = await reliabilityWorkspaceView(runtime);
const utility = utilityOverviewView({ executive, events, assets, reliability });

const minigridRuntime = { repos: createMinigridDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() };
const portfolio = await minigridPortfolioView(minigridRuntime);
const minigrid = minigridOverviewView(portfolio);

describe("the Utility overview", () => {
  it("lists what needs attention in the fixed order of its rules", () => {
    assert.deepEqual(
      utility.attention.map((item) => item.id),
      ["in_progress:" + events.now.interruptions.inProgress[0].outageId, "asset_risk:DT-OLD-2", "asset_risk:DT-GOV-3", "revenue:FD-GOV", "report_differs:Hillcrest 33/11 kV injection substation:SAIDI", "standing_alarms", "assets_listed"],
    );
    assert.deepEqual(utility.attention.map((item) => item.tone), ["alert", "alert", "alert", "watch", "alert", "watch", "note"]);
    assert.equal(utility.attentionNote, null);
    for (const item of utility.attention) assert.ok(item.ruleText.length > 0, item.id);
  });

  it("takes every figure from the read model of the screen the line leads to", () => {
    const [fault, riverbank, , revenue, report, alarms, listed] = utility.attention;
    // The open fault on Farm Road: the outage record's own count of customers.
    assert.equal(fault.figure, events.now.interruptions.inProgress[0].customers);
    assert.equal(fault.figure?.value, 1015);
    assert.match(fault.statement, /Farm Road 11 kV feeder, 10 transformers still without supply\.$/);
    assert.deepEqual(fault.target, { type: "workspace", workspace: "utility.events" });
    // Asset risk: the Executive read model's finding, and a link to the transformer itself.
    assert.equal(riverbank.figure, executive.assetRisk[0].findings[0].metric);
    assert.equal(riverbank.figureNote, "69 hours over rating");
    assert.deepEqual(riverbank.target, { type: "level", kind: "distribution_transformer", id: "DT-OLD-2" });
    // Revenue: the feeder first in the Executive ranking, with its money figure.
    assert.equal(revenue.figure, executive.whereToLook.money[0].money);
    assert.equal(revenue.figure?.origin, "derived");
    assert.equal(revenue.figure?.status, "calculated_with_estimates");
    // The report against the records: the Reliability workspace's own row, the largest difference
    // measured against the reported figure. Hillcrest reports a SAIDI of 1.9 h; the outage log gives 23.1 h.
    const hillcrest = reliability.comparisons.find((row) => row.statedFor === "Hillcrest 33/11 kV injection substation" && row.label === "SAIDI");
    assert.ok(hillcrest);
    assert.deepEqual(report.comparisons, [hillcrest]);
    assert.equal(report.figure, null);
    assert.equal(hillcrest.reported.value, 1.9);
    assert.equal(Number(hillcrest.calculated.value?.toFixed(1)), 23.1);
    for (const row of reliability.comparisons) assert.ok(Math.abs(row.relativeVariance ?? 0) <= Math.abs(hillcrest.relativeVariance ?? 0), `${row.statedFor} ${row.label}`);
    assert.equal(report.statement, "Hillcrest 33/11 kV injection substation: the SAIDI its report states is furthest from the outage log. 11 of the 12 reliability figures reported differ.");
    assert.deepEqual(report.target, { type: "workspace", workspace: "utility.reliability" });
    // The two counts are the lengths of lists their own screens show.
    assert.equal(alarms.figure?.value, events.now.alarms.length);
    assert.equal(alarms.figure?.value, 4);
    assert.equal(listed.figure?.value, assets.attention.length);
    assert.equal(listed.figure?.value, 10);
    assert.match(listed.statement, /^Of 55 in-service assets checked:/);
    assert.ok(listed.ruleText.includes(assets.attentionRule));
  });

  it("gives the loss split and the headline figures as the Executive read model holds them", () => {
    assert.ok(executive.losses);
    assert.equal(utility.lossSplit?.total, executive.losses.atcc);
    assert.deepEqual(utility.lossSplit?.parts.map((part) => part.key), ["technical", "commercial", "collection"]);
    assert.equal(utility.lossSplit?.parts[1].metric, executive.losses.parts.commercial);
    assert.deepEqual(utility.headline, [executive.losses.atcc, executive.losses.collectionEfficiency, executive.revenueGap.notRealised]);
    assert.equal(utility.sourcing.synthetic, true);
    assert.deepEqual(utility.workspaces.map((link) => link.label), ["Executive", "Operations", "Reliability", "Revenue", "Assets", "Events / Alarms"]);
  });

  it("on a source that holds almost nothing, lists nothing and does not read that as nothing wrong", async () => {
    const sparse: OperationsRuntime = { repos: sparseRepositories(), now: SPARSE_AS_OF, period: SPARSE_PERIOD, caveats: {}, cache: createMemoryCache() };
    const view = utilityOverviewView({ executive: await executiveView(sparse), events: await eventsWorkspaceView(sparse), assets: await assetsWorkspaceView(sparse), reliability: await reliabilityWorkspaceView(sparse) });
    assert.equal(view.attention.filter((item) => item.figure !== null && item.figure.value === null).length, 0);
    assert.equal(view.attention.some((item) => item.rule === "revenue"), false);
    if (view.attention.length === 0) assert.notEqual(view.attentionNote, null);
  });
});

describe("the Mini-grid overview", () => {
  it("is the portfolio's own findings, line for line and in the same order", () => {
    assert.deepEqual(
      minigrid.attention.map((item) => item.id),
      portfolio.findings.map((found) => `${found.rule}:${found.site?.id ?? "portfolio"}`),
    );
    assert.deepEqual(minigrid.attention.map((item) => item.id), ["report_differs:MG-DRY", "report_differs:MG-PLM", "fuel_per_kwh:MG-DRY", "pv_held_back:MG-GRN", "uncollected:MG-PLM", "class_pays_least:portfolio"]);
    const [differs, , fuel] = minigrid.attention;
    assert.equal(differs.statement, portfolio.findings[0].statement);
    assert.equal(differs.comparisons, portfolio.findings[0].comparisons);
    assert.equal(differs.figure, null);
    assert.deepEqual(differs.target, { type: "site", id: "MG-DRY" });
    assert.equal(fuel.figure, portfolio.findings[2].figures[0]);
    assert.equal(fuel.more.length, portfolio.findings[2].figures.length - 1);
    assert.equal(fuel.ruleText, portfolio.findings[2].ruleText);
  });

  it("leads a report-against-records line with its largest difference, measured against the reported figure", () => {
    const [dryRiver] = minigrid.attention;
    const sizes = dryRiver.comparisons.map((row) => Math.abs(row.relativeVariance ?? Number.POSITIVE_INFINITY));
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));
    // Dry River reports 190 generator hours; the controller logged 315, two thirds more. Its
    // renewable fraction, 68% reported against 49.6% calculated, is a quarter less.
    assert.deepEqual(dryRiver.comparisons.map((row) => row.label), ["Generator running hours", "Renewable fraction", "Availability"]);
    assert.match(dryRiver.ruleText, /largest difference is shown first/);
  });

  it("gives each site's figures as its card holds them", () => {
    assert.deepEqual(minigrid.sites.map((site) => site.id), ["MG-DRY", "MG-GRN", "MG-PLM", "MG-TAM"]);
    for (const [index, site] of minigrid.sites.entries()) {
      assert.equal(site.renewableFraction, portfolio.sites[index].renewableFraction);
      assert.equal(site.collectionEfficiency, portfolio.sites[index].collectionEfficiency);
    }
    assert.equal(minigrid.completeness, "complete");
    assert.equal(minigrid.sourcing.synthetic, true);
  });
});

describe("the Platform overview", () => {
  const platform = platformOverviewView([utility, minigrid]);

  it("shows each sector's largest report-against-records difference and the first line of each other rule, up to the limit, and says how many there are", () => {
    assert.equal(PLATFORM_FINDINGS_PER_SECTOR, 3);
    assert.deepEqual(platform.sectors.map((sector) => [sector.sector, sector.findingsTotal, sector.findingsMore]), [["utility", 7, 4], ["minigrid", 6, 3]]);
    assert.deepEqual(platform.sectors[0].findings.map((item) => item.rule), ["in_progress", "asset_risk", "report_differs"]);
    assert.deepEqual(platform.sectors[1].findings.map((item) => item.id), ["report_differs:MG-DRY", "fuel_per_kwh:MG-DRY", "pv_held_back:MG-GRN"]);
    // The lines are the sector's own objects.
    assert.equal(platform.sectors[0].findings[0], utility.attention[0]);
    assert.match(platform.selectionRule, /up to 3 lines/);
    assert.match(platform.selectionRule, /largest difference between a report and the records/);
    assert.equal(platform.sourcing.synthetic, true);
  });

  it("never adds one sector's figures to another's", () => {
    // Two organizations, two sets of records: the platform holds them side by side only.
    assert.equal(Object.keys(platform).includes("totals"), false);
    assert.notEqual(platform.sectors[0].organization, platform.sectors[1].organization);
  });

  it("chooses by rule, not by position", () => {
    const line = (rule: string, id: string) => ({ ...utility.attention[0], rule, id });
    assert.deepEqual(firstOfEachRule([line("a", "1"), line("a", "2"), line("b", "3"), line("c", "4"), line("d", "5")], 3).map((item) => item.id), ["1", "3", "4"]);
    assert.deepEqual(firstOfEachRule([], 3), []);
  });

  it("puts the largest report difference among the lines wherever its rule stands, and keeps the Overview's order", () => {
    const line = (rule: string, id: string, relative: number | null = null) => ({ ...utility.attention[0], rule, id, comparisons: relative === null ? [] : [{ ...utility.attention[4].comparisons[0], relativeVariance: relative }] });
    const lines = [line("a", "1"), line("b", "2"), line("c", "3"), line("report_differs", "4", 0.2), line("report_differs", "5", -0.9)];
    assert.deepEqual(platformLines(lines, 3).map((item) => item.id), ["1", "2", "5"]);
    assert.deepEqual(platformLines(lines.slice(0, 3), 3).map((item) => item.id), ["1", "2", "3"]);
  });
});
