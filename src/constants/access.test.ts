import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server.js";
import { accessProxy } from "../proxy.ts";
import type { ScreenGrant, ViewerContext } from "../services/spatial/viewer.ts";
import { admitsRead, canOpen, grantFor, holdsSector, keyFor, landingFor, REFUSED_PATH, reportsFor, workspaceRail } from "./access.ts";
import { departmentOf, departmentsFor } from "./departments.ts";
import { PEOPLE_KEY, PEOPLE_PATH } from "./navigation.ts";
import { REPORTS } from "./navigation.ts";
import { PLATFORM_DEFAULT, RAILS, VIEWS, WORKSPACE_TYPES, workspaceViews } from "./views.ts";

const EVERYTHING: ScreenGrant = { kind: "everything" };
/** A viewer allowed only Utility > Revenue. */
const REVENUE_ONLY: ScreenGrant = { kind: "listed", keys: ["utility.revenue"] };
/** An example department from ADR 0018: the Utility Overview, its GIS Map and Revenue. */
const REVENUE_DEPARTMENT: ScreenGrant = { kind: "listed", keys: ["utility.overview", "utility.map", "utility.revenue"] };

const ROUTES = [
  "/dashboard",
  "/dashboard/intelligence/utility",
  "/dashboard/intelligence/utility/map",
  "/dashboard/intelligence/utility/ai",
  "/dashboard/intelligence/utility/executive",
  "/dashboard/intelligence/utility/operations",
  "/dashboard/intelligence/utility/operations/feeders/FD-OLD",
  "/dashboard/intelligence/utility/reliability",
  "/dashboard/intelligence/utility/revenue",
  "/dashboard/intelligence/utility/assets",
  "/dashboard/intelligence/utility/events",
  "/dashboard/intelligence/minigrid",
  "/dashboard/intelligence/minigrid/map",
  "/dashboard/intelligence/minigrid/ai",
  "/dashboard/intelligence/minigrid/sites",
  "/dashboard/intelligence/minigrid/sites/MG-DRY",
  "/dashboard/reports/utility",
  "/dashboard/reports/utility/reliability/2026-09",
  "/dashboard/reports/utility/reliability/2026-09/data.csv",
  "/dashboard/reports/minigrid",
  "/dashboard/reports/minigrid/compliance/2026-09-14",
  "/dashboard/intelligence/der",
  "/dashboard/plan",
  "/dashboard/finance/metering-fund",
  "/dashboard/plan/dt",
  "/dashboard/reports",
];

const rail = (type: Parameters<typeof workspaceRail>[0], grant: ScreenGrant) => workspaceRail(type, grant).map((item) => [item.item, item.href, item.views.map((view) => view.id)]);

describe("which screens a viewer may open", () => {
  it("gives every screen its own permission key, its View ID, in its sector's domain", () => {
    const keys = VIEWS.map((view) => view.id);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keyFor("/dashboard/intelligence/utility/operations/feeders/FD-OLD"), "utility.operations");
    assert.equal(keyFor("/dashboard/intelligence/minigrid/sites/MG-DRY"), "minigrid.sites");
    assert.equal(keyFor("/dashboard/intelligence/utility"), "utility.overview");
    assert.equal(keyFor("/dashboard/intelligence/utility/no-such-screen"), null);
    assert.equal(keyFor("/dashboard/reports"), "platform.reports");
    assert.equal(keyFor("/dashboard/reports/utility/reliability/2026-09/data.csv"), "utility.reports.reliability");
    assert.equal(keyFor("/dashboard/reports/utility"), "utility.reports");
    assert.equal(keyFor(REFUSED_PATH), "platform.refused");
    assert.equal(keyFor("/dashboard/plan"), "plan.overview");
    assert.equal(keyFor("/dashboard/finance/metering-fund"), "finance.metering-fund");
    assert.equal(keyFor("/dashboard/plan/metering-allocation"), "plan.metering-allocation");
    assert.equal(keyFor("/dashboard/plan/charging-hubs"), "plan.charging-hubs");
  });

  it("opens everything to the public demonstration, whose rail is each workspace type's whole rail", () => {
    for (const route of ROUTES) assert.equal(canOpen(EVERYTHING, route), true, route);
    for (const type of WORKSPACE_TYPES) assert.deepEqual(workspaceRail(type, EVERYTHING).map((item) => item.item), RAILS[type].map((entry) => entry.item), type);
    // Where a viewer starts is Home (NAV-B step 6).
    assert.equal(landingFor(EVERYTHING), "/dashboard");
  });

  it("gives each workspace type its rail, each view in one item only, cut to the grant (NAV-B step 6)", () => {
    for (const type of WORKSPACE_TYPES) {
      const rail = workspaceRail(type, EVERYTHING);
      assert.equal(rail[0].item, "home", type);
      const ids = rail.flatMap((item) => item.views.map((view) => view.id));
      assert.equal(new Set(ids).size, ids.length, `${type}: a view listed twice`);
      for (const item of rail) for (const view of item.views) assert.ok(canOpen(EVERYTHING, view.href), `${type}: ${view.id}`);
    }
    assert.deepEqual(workspaceRail("utility", EVERYTHING).map((item) => item.item), ["home", "intelligence", "plan", "finance"]);
    assert.deepEqual(workspaceRail("regulator", EVERYTHING).map((item) => item.item), ["home", "oversight"]);
    // The revenue department: Intelligence only, with its two views, and no link it would be refused at.
    const revenue = workspaceRail("utility", REVENUE_DEPARTMENT);
    assert.deepEqual(revenue.map((item) => [item.item, item.href, item.views.map((view) => view.id)]), [["intelligence", "/dashboard/intelligence/utility", ["utility.revenue", "utility.map"]]]);
    assert.equal(landingFor(REVENUE_DEPARTMENT), "/dashboard/intelligence/utility");
    assert.equal(landingFor({ kind: "listed", keys: [] }), null);
  });

  it("shows a viewer allowed only Utility > Revenue that one item, and refuses every other route", () => {
    assert.deepEqual(rail("utility", REVENUE_ONLY), [["intelligence", "/dashboard/intelligence/utility/revenue", ["utility.revenue"]]]);
    assert.equal(landingFor(REVENUE_ONLY), "/dashboard/intelligence/utility/revenue");
    for (const route of ROUTES) assert.equal(canOpen(REVENUE_ONLY, route), route === "/dashboard/intelligence/utility/revenue", route);
    // The screens below Revenue are Revenue's; the refusal page is open to anyone.
    assert.equal(canOpen(REVENUE_ONLY, "/dashboard/intelligence/utility/revenue/anything-below"), true);
    assert.equal(canOpen(REVENUE_ONLY, REFUSED_PATH), true);
  });

  it("gives a department its set of screens: the revenue department sees the Utility Overview, GIS Map and Revenue", () => {
    assert.deepEqual(rail("utility", REVENUE_DEPARTMENT), [["intelligence", "/dashboard/intelligence/utility", ["utility.revenue", "utility.map"]]]);
    assert.deepEqual(
      ROUTES.filter((route) => canOpen(REVENUE_DEPARTMENT, route)),
      ["/dashboard/intelligence/utility", "/dashboard/intelligence/utility/map", "/dashboard/intelligence/utility/revenue"],
    );
  });

  it("opens a whole sector with the sector's key, and nothing with an empty list", () => {
    const minigrid: ScreenGrant = { kind: "listed", keys: ["minigrid"] };
    assert.deepEqual(rail("minigrid", minigrid), [["intelligence", "/dashboard/intelligence/minigrid", ["minigrid.sites", "minigrid.map", "minigrid.ai"]]]);
    assert.equal(landingFor(minigrid), "/dashboard/intelligence/minigrid");
    assert.deepEqual(ROUTES.filter((route) => canOpen(minigrid, route)), [
      "/dashboard/intelligence/minigrid",
      "/dashboard/intelligence/minigrid/map",
      "/dashboard/intelligence/minigrid/ai",
      "/dashboard/intelligence/minigrid/sites",
      "/dashboard/intelligence/minigrid/sites/MG-DRY",
      "/dashboard/reports/minigrid",
      "/dashboard/reports/minigrid/compliance/2026-09-14",
      "/dashboard/reports",
    ]);
    const none: ScreenGrant = { kind: "listed", keys: [] };
    for (const type of WORKSPACE_TYPES) assert.deepEqual(workspaceRail(type, none), [], type);
    assert.equal(landingFor(none), null);
    assert.equal(ROUTES.filter((route) => canOpen(none, route)).length, 0);
  });

  it("starts a viewer without Home where the old menu did: their sector's first screen, or their sector's reports, never the list of every report", () => {
    const at = (sectors: string[], keys: string[]) => landingFor(grantFor(sectors, keys, false));
    assert.equal(at(["minigrid"], ["minigrid"]), "/dashboard/intelligence/minigrid");
    assert.equal(at(["utility"], ["utility.revenue"]), "/dashboard/intelligence/utility/revenue");
    assert.equal(at(["utility"], ["utility.overview", "utility.map", "utility.revenue"]), "/dashboard/intelligence/utility");
    assert.equal(at(["utility"], ["utility.reports.reliability"]), "/dashboard/reports/utility");
    assert.equal(at(["minigrid"], ["minigrid.reports.compliance"]), "/dashboard/reports/minigrid");
  });

  it("gives every report its own key below its sector's Reports screen", () => {
    const keys = REPORTS.map((report) => report.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const report of REPORTS) assert.equal(report.key, `${report.sector}.reports.${report.id}`);
  });

  it("shows a regulator given only the reliability report that report, under Utility > Reports, and refuses everything else", () => {
    const regulator: ScreenGrant = { kind: "listed", keys: ["utility.reports.reliability"] };
    // The rail shows no item; the report is reached from Reports at the rail's foot.
    assert.deepEqual(rail("regulator", regulator), []);
    assert.equal(landingFor(regulator), "/dashboard/reports/utility");
    assert.deepEqual(reportsFor(regulator).map((report) => report.key), ["utility.reports.reliability"]);
    assert.deepEqual(ROUTES.filter((route) => canOpen(regulator, route)), [
      "/dashboard/reports/utility",
      "/dashboard/reports/utility/reliability/2026-09",
      "/dashboard/reports/utility/reliability/2026-09/data.csv",
      "/dashboard/reports",
    ]);
    // Another report of the same sector stays closed to them.
    assert.equal(canOpen(regulator, "/dashboard/reports/utility/operations"), false);
  });

  it("shows a mini-grid regulator or funder given only the compliance report that report and nothing of the utility's", () => {
    const funder: ScreenGrant = { kind: "listed", keys: ["minigrid.reports.compliance"] };
    assert.deepEqual(rail("financier", funder), []);
    assert.equal(landingFor(funder), "/dashboard/reports/minigrid");
    assert.deepEqual(reportsFor(funder).map((report) => report.key), ["minigrid.reports.compliance"]);
    assert.equal(canOpen(funder, "/dashboard/reports/utility/reliability/2026-09"), false);
    assert.equal(canOpen(funder, "/dashboard/intelligence/minigrid/sites"), false);
  });

  it("opens every report of a sector with its Reports key, and the list of all reports to anyone who may open one", () => {
    const management: ScreenGrant = { kind: "listed", keys: ["utility.reports"] };
    assert.deepEqual(reportsFor(management).map((report) => report.id), ["reliability", "operations", "daily-brief"]);
    assert.equal(canOpen(management, "/dashboard/reports/utility/reliability/2026-09"), true);
    assert.equal(canOpen(management, "/dashboard/reports/minigrid"), false);
    assert.equal(canOpen(REVENUE_ONLY, "/dashboard/reports"), false);
    assert.equal(canOpen(management, "/dashboard/reports"), true);
  });

  it("refuses at the proxy, with 403 and the refusal page, the routes a viewer may not open", () => {
    const viewer: ViewerContext = { viewerId: "user@revenue", organizationId: "savanna", access: { kind: "everything" }, screens: REVENUE_ONLY };
    const check = accessProxy(() => viewer);
    const allowed = check(new NextRequest("http://localhost/dashboard/intelligence/utility/revenue"));
    assert.equal(allowed.headers.get("x-middleware-next"), "1");
    for (const route of ["/dashboard", "/dashboard/intelligence/utility", "/dashboard/intelligence/utility/executive", "/dashboard/intelligence/minigrid/sites/MG-DRY"]) {
      const refused = check(new NextRequest(`http://localhost${route}`));
      assert.equal(refused.status, 403, route);
      assert.equal(refused.headers.get("x-middleware-rewrite"), `http://localhost${REFUSED_PATH}`, route);
    }
  });
});

describe("a member's grant (Phase 8A, ADR 0020)", () => {
  it("holds every screen of the organization's sectors and the platform's when the membership lists none", () => {
    const grant = grantFor(["utility"], null, false);
    assert.ok(grant.kind === "listed");
    // What the catalogue shows a Utility workspace, and the platform's own screens (Founder, 25 November 2026).
    assert.deepEqual(new Set(grant.keys), new Set([...PLATFORM_DEFAULT, ...workspaceViews("utility")]));
    assert.equal(canOpen(grant, "/dashboard/intelligence/utility/revenue"), true);
    assert.equal(canOpen(grant, "/dashboard/plan/metering-allocation"), true);
    assert.equal(canOpen(grant, "/dashboard/plan/unserved"), false, "a mini-grid planner stays with its own type");
    assert.equal(canOpen(grant, "/dashboard/oversight/monitoring"), false, "Oversight is a regulator's");
    assert.equal(canOpen(grant, "/dashboard/account/people"), false, "People is an administrator's only");
    assert.equal(canOpen(grant, "/dashboard/intelligence/minigrid/sites"), false);
    assert.equal(holdsSector(grant, "utility"), true);
    assert.equal(holdsSector(grant, "planning"), true);
    assert.equal(holdsSector(grant, "minigrid"), false);
  });

  it("gives every workspace type, by default, exactly the views its catalogue shows it: its rail's, its landings, its Reports foot and its initiatives'", () => {
    for (const [sectors, type] of [[["utility"], "utility"], [["minigrid"], "minigrid"], [["der"], "der"]] as const) {
      const grant = grantFor(sectors, null, false);
      assert.ok(grant.kind === "listed");
      const own = (keys: readonly string[]) => keys.filter((key) => !PLATFORM_DEFAULT.includes(key as never)).sort();
      assert.deepEqual(own(grant.keys), own(workspaceViews(type)), type);
      for (const entry of RAILS[type]) for (const id of entry.views) assert.ok(grant.keys.includes(id), `${type}: ${id} is in its rail`);
    }
    assert.ok(!workspaceViews("utility").some((id) => id.startsWith("oversight.") || ["plan.unserved", "plan.underserved", "plan.pue"].includes(id)));
    assert.ok(workspaceViews("regulator").includes("oversight.monitoring"));
  });

  it("drops a key of a sector the organization does not hold, whatever the membership says", () => {
    const grant = grantFor(["minigrid"], ["minigrid.sites", "utility", "utility.revenue", "platform.reports"], false);
    assert.deepEqual(grant, { kind: "listed", keys: ["minigrid.sites", "platform.reports"] });
    assert.equal(holdsSector(grant, "utility"), false);
    for (const path of ["/dashboard/intelligence/utility", "/dashboard/intelligence/utility/revenue", "/dashboard/reports/utility/operations/2026-09/data.csv"]) assert.equal(canOpen(grant, path), false, path);
  });

  it("gives the people screen to an administrator only, and no membership can list it for itself", () => {
    const member = grantFor(["utility"], ["utility.revenue", PEOPLE_KEY], false);
    assert.equal(canOpen(member, PEOPLE_PATH), false);
    const administrator = grantFor(["utility"], ["utility.revenue"], true);
    assert.equal(keyFor(PEOPLE_PATH), PEOPLE_KEY);
    assert.equal(canOpen(administrator, PEOPLE_PATH), true);
  });

  it("offers an administrator the departments of their organization's sectors, and names a membership's", () => {
    assert.deepEqual(departmentsFor(["minigrid"]).map((one) => one.sector), ["minigrid", "minigrid"]);
    assert.equal(departmentOf(["utility"], ["utility.revenue", "utility.overview", "utility.map"])?.label, "Revenue department");
    assert.equal(departmentOf(["utility"], null)?.label, "Every screen");
    assert.equal(departmentOf(["utility"], ["utility.revenue"]), null);
  });
});

describe("the data layer's check (Phase 8A)", () => {
  it("reads a sector's records only for a grant that holds the sector and opens the address asked for", () => {
    const disco = grantFor(["utility"], null, false);
    const revenue = grantFor(["utility"], ["utility.overview", "utility.map", "utility.revenue"], false);
    const operator = grantFor(["minigrid"], null, true);
    assert.equal(admitsRead(disco, "utility", "/dashboard/intelligence/utility/executive"), true);
    assert.equal(admitsRead(disco, "minigrid", "/dashboard/intelligence/minigrid/sites"), false);
    // Asked from a screen of its own the grant opens, the other organization's records are still not read.
    assert.equal(admitsRead(operator, "utility", "/dashboard/intelligence/minigrid"), false);
    assert.equal(admitsRead(revenue, "utility", "/dashboard/intelligence/utility/revenue"), true);
    assert.equal(admitsRead(revenue, "utility", "/dashboard/intelligence/utility/executive"), false);
    // The utility's Overview reads other workspaces' records to put itself together.
    assert.equal(admitsRead(revenue, "utility", "/dashboard/intelligence/utility"), true);
    assert.equal(admitsRead(disco, "utility", null), false);
    assert.equal(admitsRead({ kind: "everything" }, "minigrid", "/dashboard/intelligence/minigrid"), true);
  });
});
