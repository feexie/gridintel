import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server.js";
import { accessProxy } from "../proxy.ts";
import type { ScreenGrant, ViewerContext } from "../services/spatial/viewer.ts";
import { admitsRead, canOpen, grantFor, holdsSector, homeFor, keyFor, navigationFor, REFUSED_PATH, reportsFor } from "./access.ts";
import { departmentOf, departmentsFor } from "./departments.ts";
import { PEOPLE_KEY, PEOPLE_PATH } from "./navigation.ts";
import { REPORTS, sectors } from "./navigation.ts";

const EVERYTHING: ScreenGrant = { kind: "everything" };
/** A viewer allowed only Utility > Revenue. */
const REVENUE_ONLY: ScreenGrant = { kind: "listed", keys: ["utility.revenue"] };
/** An example department from ADR 0018: the Utility Overview, its GIS Map and Revenue. */
const REVENUE_DEPARTMENT: ScreenGrant = { kind: "listed", keys: ["utility.overview", "utility.map", "utility.revenue"] };

const ROUTES = [
  "/dashboard",
  "/dashboard/utility",
  "/dashboard/utility/map",
  "/dashboard/utility/ai",
  "/dashboard/utility/executive",
  "/dashboard/utility/operations",
  "/dashboard/utility/operations/feeders/FD-OLD",
  "/dashboard/utility/reliability",
  "/dashboard/utility/revenue",
  "/dashboard/utility/assets",
  "/dashboard/utility/events",
  "/dashboard/minigrid",
  "/dashboard/minigrid/map",
  "/dashboard/minigrid/ai",
  "/dashboard/minigrid/sites",
  "/dashboard/minigrid/sites/MG-DRY",
  "/dashboard/utility/reports",
  "/dashboard/utility/reports/reliability/2026-09",
  "/dashboard/utility/reports/reliability/2026-09/data.csv",
  "/dashboard/minigrid/reports",
  "/dashboard/minigrid/reports/compliance/2026-09-14",
  "/dashboard/der",
  "/dashboard/planning",
  "/dashboard/reports",
  "/dashboard/settings",
];

const shape = (navigation: ReturnType<typeof navigationFor>) => navigation.map((sector) => ({ sector: sector.id, home: sector.home, items: [...sector.opening, ...sector.workspaces].map((item) => item.label) }));

describe("which screens a viewer may open", () => {
  it("gives every sector and every screen its own permission key", () => {
    const keys = sectors.flatMap((sector) => [sector.id, ...[...sector.opening, ...sector.workspaces].map((item) => item.key)]);
    assert.equal(new Set(keys).size, keys.length);
    for (const sector of sectors) for (const item of [...sector.opening, ...sector.workspaces]) assert.ok(item.key.startsWith(`${sector.id}.`), item.key);
    assert.equal(keyFor("/dashboard/utility/operations/feeders/FD-OLD"), "utility.operations");
    assert.equal(keyFor("/dashboard/minigrid/sites/MG-DRY"), "minigrid.sites");
    assert.equal(keyFor("/dashboard/utility"), "utility.overview");
    assert.equal(keyFor("/dashboard/utility/no-such-screen"), "utility");
    assert.equal(keyFor("/dashboard/reports"), "platform.reports");
    assert.equal(keyFor("/dashboard/utility/reports/reliability/2026-09/data.csv"), "utility.reports.reliability");
    assert.equal(keyFor("/dashboard/utility/reports"), "utility.reports");
    assert.equal(keyFor(REFUSED_PATH), null);
  });

  it("opens everything to the public demonstration, whose menu is the whole catalogue", () => {
    for (const route of ROUTES) assert.equal(canOpen(EVERYTHING, route), true, route);
    assert.deepEqual(navigationFor(EVERYTHING), sectors);
    assert.equal(homeFor(navigationFor(EVERYTHING)), "/dashboard");
  });

  it("shows a viewer allowed only Utility > Revenue that one item, and refuses every other route", () => {
    assert.deepEqual(shape(navigationFor(REVENUE_ONLY)), [{ sector: "utility", home: "/dashboard/utility/revenue", items: ["Revenue"] }]);
    assert.equal(homeFor(navigationFor(REVENUE_ONLY)), "/dashboard/utility/revenue");
    for (const route of ROUTES) assert.equal(canOpen(REVENUE_ONLY, route), route === "/dashboard/utility/revenue", route);
    // The screens below Revenue are Revenue's; the refusal page is open to anyone.
    assert.equal(canOpen(REVENUE_ONLY, "/dashboard/utility/revenue/anything-below"), true);
    assert.equal(canOpen(REVENUE_ONLY, REFUSED_PATH), true);
  });

  it("gives a department its set of screens: the revenue department sees the Utility Overview, GIS Map and Revenue", () => {
    assert.deepEqual(shape(navigationFor(REVENUE_DEPARTMENT)), [{ sector: "utility", home: "/dashboard/utility", items: ["Overview", "GIS Map", "Revenue"] }]);
    assert.deepEqual(
      ROUTES.filter((route) => canOpen(REVENUE_DEPARTMENT, route)),
      ["/dashboard/utility", "/dashboard/utility/map", "/dashboard/utility/revenue"],
    );
  });

  it("opens a whole sector with the sector's key, and nothing with an empty list", () => {
    const minigrid: ScreenGrant = { kind: "listed", keys: ["minigrid"] };
    assert.deepEqual(shape(navigationFor(minigrid)), [{ sector: "minigrid", home: "/dashboard/minigrid", items: ["Overview", "GIS Map", "AI Assistant", "Sites", "Reports"] }]);
    assert.deepEqual(ROUTES.filter((route) => canOpen(minigrid, route)), [
      "/dashboard/minigrid",
      "/dashboard/minigrid/map",
      "/dashboard/minigrid/ai",
      "/dashboard/minigrid/sites",
      "/dashboard/minigrid/sites/MG-DRY",
      "/dashboard/minigrid/reports",
      "/dashboard/minigrid/reports/compliance/2026-09-14",
      "/dashboard/reports",
    ]);
    const none: ScreenGrant = { kind: "listed", keys: [] };
    assert.deepEqual(navigationFor(none), []);
    assert.equal(homeFor(navigationFor(none)), null);
    assert.equal(ROUTES.filter((route) => canOpen(none, route)).length, 0);
  });

  it("gives every report its own key below its sector's Reports screen", () => {
    const keys = REPORTS.map((report) => report.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const report of REPORTS) assert.equal(report.key, `${report.sector}.reports.${report.id}`);
  });

  it("shows a regulator given only the reliability report that report, under Utility > Reports, and refuses everything else", () => {
    const regulator: ScreenGrant = { kind: "listed", keys: ["utility.reports.reliability"] };
    assert.deepEqual(shape(navigationFor(regulator)), [{ sector: "utility", home: "/dashboard/utility/reports", items: ["Reports"] }]);
    assert.deepEqual(reportsFor(regulator).map((report) => report.key), ["utility.reports.reliability"]);
    assert.deepEqual(ROUTES.filter((route) => canOpen(regulator, route)), [
      "/dashboard/utility/reports",
      "/dashboard/utility/reports/reliability/2026-09",
      "/dashboard/utility/reports/reliability/2026-09/data.csv",
      "/dashboard/reports",
    ]);
    // Another report of the same sector stays closed to them.
    assert.equal(canOpen(regulator, "/dashboard/utility/reports/operations"), false);
  });

  it("shows a mini-grid regulator or funder given only the compliance report that report and nothing of the utility's", () => {
    const funder: ScreenGrant = { kind: "listed", keys: ["minigrid.reports.compliance"] };
    assert.deepEqual(shape(navigationFor(funder)), [{ sector: "minigrid", home: "/dashboard/minigrid/reports", items: ["Reports"] }]);
    assert.deepEqual(reportsFor(funder).map((report) => report.key), ["minigrid.reports.compliance"]);
    assert.equal(canOpen(funder, "/dashboard/utility/reports/reliability/2026-09"), false);
    assert.equal(canOpen(funder, "/dashboard/minigrid/sites"), false);
  });

  it("opens every report of a sector with its Reports key, and the list of all reports to anyone who may open one", () => {
    const management: ScreenGrant = { kind: "listed", keys: ["utility.reports"] };
    assert.deepEqual(reportsFor(management).map((report) => report.id), ["reliability", "operations", "daily-brief"]);
    assert.equal(canOpen(management, "/dashboard/utility/reports/reliability/2026-09"), true);
    assert.equal(canOpen(management, "/dashboard/minigrid/reports"), false);
    assert.equal(canOpen(REVENUE_ONLY, "/dashboard/reports"), false);
    assert.equal(canOpen(management, "/dashboard/reports"), true);
  });

  it("refuses at the proxy, with 403 and the refusal page, the routes a viewer may not open", () => {
    const viewer: ViewerContext = { viewerId: "user@revenue", organizationId: "savanna", access: { kind: "everything" }, screens: REVENUE_ONLY };
    const check = accessProxy(() => viewer);
    const allowed = check(new NextRequest("http://localhost/dashboard/utility/revenue"));
    assert.equal(allowed.headers.get("x-middleware-next"), "1");
    for (const route of ["/dashboard", "/dashboard/utility", "/dashboard/utility/executive", "/dashboard/minigrid/sites/MG-DRY"]) {
      const refused = check(new NextRequest(`http://localhost${route}`));
      assert.equal(refused.status, 403, route);
      assert.equal(refused.headers.get("x-middleware-rewrite"), `http://localhost${REFUSED_PATH}`, route);
    }
  });
});

describe("a member's grant (Phase 8A, ADR 0020)", () => {
  it("holds every screen of the organization's sectors and the platform's when the membership lists none", () => {
    const grant = grantFor(["utility"], null, false);
    assert.deepEqual(grant, { kind: "listed", keys: ["platform", "utility"] });
    assert.equal(canOpen(grant, "/dashboard/utility/revenue"), true);
    assert.equal(canOpen(grant, "/dashboard/minigrid/sites"), false);
    assert.equal(holdsSector(grant, "utility"), true);
    assert.equal(holdsSector(grant, "minigrid"), false);
  });

  it("drops a key of a sector the organization does not hold, whatever the membership says", () => {
    const grant = grantFor(["minigrid"], ["minigrid.sites", "utility", "utility.revenue", "platform.reports"], false);
    assert.deepEqual(grant, { kind: "listed", keys: ["minigrid.sites", "platform.reports"] });
    assert.equal(holdsSector(grant, "utility"), false);
    for (const path of ["/dashboard/utility", "/dashboard/utility/revenue", "/dashboard/utility/reports/operations/2026-09/data.csv"]) assert.equal(canOpen(grant, path), false, path);
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
    assert.equal(admitsRead(disco, "utility", "/dashboard/utility/executive"), true);
    assert.equal(admitsRead(disco, "minigrid", "/dashboard/minigrid/sites"), false);
    // Asked from a screen of its own the grant opens, the other organization's records are still not read.
    assert.equal(admitsRead(operator, "utility", "/dashboard/minigrid"), false);
    assert.equal(admitsRead(revenue, "utility", "/dashboard/utility/revenue"), true);
    assert.equal(admitsRead(revenue, "utility", "/dashboard/utility/executive"), false);
    // The utility's Overview reads other workspaces' records to put itself together.
    assert.equal(admitsRead(revenue, "utility", "/dashboard/utility"), true);
    assert.equal(admitsRead(disco, "utility", null), false);
    assert.equal(admitsRead({ kind: "everything" }, "minigrid", "/dashboard/minigrid"), true);
  });
});
