import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server.js";
import { accessProxy } from "../proxy.ts";
import type { ScreenGrant, ViewerContext } from "../services/spatial/viewer.ts";
import { canOpen, homeFor, keyFor, navigationFor, REFUSED_PATH } from "./access.ts";
import { sectors } from "./navigation.ts";

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
    assert.equal(keyFor("/dashboard/reports"), "platform");
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
    assert.deepEqual(shape(navigationFor(minigrid)), [{ sector: "minigrid", home: "/dashboard/minigrid", items: ["Overview", "GIS Map", "AI Assistant", "Sites"] }]);
    assert.deepEqual(ROUTES.filter((route) => canOpen(minigrid, route)), ["/dashboard/minigrid", "/dashboard/minigrid/map", "/dashboard/minigrid/ai", "/dashboard/minigrid/sites", "/dashboard/minigrid/sites/MG-DRY"]);
    const none: ScreenGrant = { kind: "listed", keys: [] };
    assert.deepEqual(navigationFor(none), []);
    assert.equal(homeFor(navigationFor(none)), null);
    assert.equal(ROUTES.filter((route) => canOpen(none, route)).length, 0);
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
