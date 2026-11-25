import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { canOpen, grantFor, opensView, resolves } from "./access.ts";
import { INITIATIVES } from "./initiatives.ts";
import { REPORTS, sectors } from "./navigation.ts";
import { METERING_SCREENS, PLANNERS, plannerHref } from "./planning.ts";
import { DOMAINS, hrefOf, reportPeriodAt, OLD_KEYS, RAILS, translateKey, viewAt, viewOf, VIEWS, WORKSPACE_TYPES } from "./views.ts";

/* The View catalogue (NAV-B, safeguard A; Founder, 25 November 2026): one entry per screen, each
   with a unique id that is its permission key, an explicit permission, a domain and its one
   address; the single source of every address, every screen list and every permission. */

const SRC = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Every source file under src/, but the tests. */
function sources(): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) found.push({ path: relative(SRC, path).split(sep).join("/"), text: readFileSync(path, "utf8") });
    }
  };
  walk(SRC);
  return found;
}

describe("the View catalogue: permission integrity (safeguard A)", () => {
  it("gives every view a unique id (A.1)", () => {
    const ids = VIEWS.map((view) => view.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("gives every view an explicit permission and a domain (A.2); 'viewer' and 'domain' only where named", () => {
    for (const view of VIEWS) {
      assert.ok(["own", "domain", "viewer"].includes(view.permission), view.id);
      assert.ok(DOMAINS.includes(view.domain), view.id);
    }
    assert.deepEqual(VIEWS.filter((view) => view.permission === "viewer").map((view) => view.id), ["platform.about-this-build", "platform.refused"]);
    assert.deepEqual(VIEWS.filter((view) => view.permission === "domain").map((view) => view.id), ["platform.settings", "platform.intelligence-ai", "platform.intelligence-analytics"]);
  });

  it("denies by default (A.3): an unknown key opens nothing, an unmapped old key translates to nothing, an address that is no view opens to no one", () => {
    const unknown = { kind: "listed" as const, keys: ["no-such-key", "utility.no-such-view", "planning.no-such-planner"] };
    assert.deepEqual(VIEWS.filter((view) => opensView(unknown, view)).map((view) => view.id), ["platform.about-this-build", "platform.refused"]);
    for (const key of ["no-such-key", "utility.no-such-view", "planning.no-such-planner", "", "platform.no"]) assert.deepEqual(translateKey(key), [], key);
    assert.deepEqual(grantFor(["utility"], ["no-such-key"], false), { kind: "listed", keys: [] });
    for (const path of ["/dashboard/no-such-screen", "/dashboard/intelligence/utility/no-such-screen", "/dashboard/planning/no-such-planner", "/preview", "/dashboard2"]) {
      assert.equal(resolves(path), false, path);
      assert.equal(canOpen({ kind: "everything" }, path), false, path);
    }
  });

  it("translates every old key to views the catalogue holds", () => {
    for (const [key, ids] of Object.entries(OLD_KEYS)) for (const id of ids) assert.ok(viewOf(id), `${key} → ${id}`);
  });
});

describe("the View catalogue: route resolution", () => {
  it("resolves each view's address to the view, and the view to its address", () => {
    for (const view of VIEWS) {
      if (view.address === null) {
        assert.throws(() => hrefOf(view.id), view.id);
        continue;
      }
      assert.equal(hrefOf(view.id), view.address, view.id);
      assert.equal(viewAt(view.address)?.id, view.id, view.id);
    }
  });

  it("resolves an address below a view to it, unless the view is exact; the most specific view wins", () => {
    assert.equal(viewAt("/dashboard/intelligence/utility/operations/feeders/FD-OLD")?.id, "utility.operations");
    assert.equal(viewAt("/dashboard/intelligence/minigrid/sites/reference/rmg01")?.id, "minigrid.sites");
    assert.equal(viewAt("/dashboard/reports/utility/reliability/2026-09/data.csv")?.id, "utility.reports.reliability");
    assert.equal(viewAt("/dashboard/plan/metering-allocation")?.id, "plan.metering-allocation");
    assert.equal(viewAt("/dashboard/finance/metering-fund")?.id, "finance.metering-fund");
    assert.equal(viewAt("/dashboard/intelligence/utility/")?.id, "utility.overview");
    assert.equal(viewAt("/dashboard/intelligence/utility/x"), null);
    assert.equal(hrefOf("utility.operations", "feeders", "FD 1"), "/dashboard/intelligence/utility/operations/feeders/FD%201");
  });
});

describe("the View catalogue is the single source of screens and addresses", () => {
  it("is the only module under src/ that writes a /dashboard address", () => {
    const writers = sources().filter((file) => !["constants/views.ts", "constants/moves.ts"].includes(file.path) && /["'`]\/dashboard/.test(file.text)).map((file) => file.path);
    assert.deepEqual(writers, []);
  });

  it("is the only module that matches a /dashboard address with a pattern of its own (a regular expression)", () => {
    const matchers = sources().filter((file) => !["constants/views.ts", "constants/moves.ts"].includes(file.path) && file.text.includes(String.raw`\/dashboard`)).map((file) => file.path);
    assert.deepEqual(matchers, []);
  });

  it("finds a report's period from its address", () => {
    assert.equal(reportPeriodAt(`${hrefOf("utility.reports.reliability")}/2026-09`), "2026-09");
    assert.equal(reportPeriodAt(hrefOf("utility.reports.reliability")), null);
    assert.equal(reportPeriodAt(`${hrefOf("utility.reports.reliability")}/2026-09/data.csv`), null);
    assert.equal(reportPeriodAt(`${hrefOf("utility.revenue")}/2026-09`), null);
  });

  it("is the only module that builds a screen's address from a home: everything else asks hrefOf", () => {
    const builders = sources().filter((file) => /(PLATFORM|UTILITY|MINIGRID|DER|PLANNING)_HOME\}\//.test(file.text)).map((file) => file.path);
    assert.deepEqual(builders, []);
  });

  it("gives the old menu, the reports, the planners and the Metering screens their ids and addresses from it", () => {
    for (const sector of sectors) for (const item of [...sector.opening, ...sector.workspaces]) assert.equal(item.href, hrefOf(item.key), item.key);
    for (const report of REPORTS) assert.equal(report.href, hrefOf(report.key), report.key);
    for (const planner of PLANNERS) assert.equal(plannerHref(planner.id), hrefOf(planner.view), planner.id);
    for (const screen of METERING_SCREENS) assert.equal(screen.href, hrefOf(screen.view), screen.id);
  });

  it("lists in every rail and every initiative role only views it holds", () => {
    for (const type of WORKSPACE_TYPES) for (const entry of RAILS[type]) for (const id of entry.views) assert.ok(viewOf(id), `${type}: ${id}`);
    for (const initiative of INITIATIVES) for (const role of initiative.roles) if (role.audience === "organization") for (const id of role.views) assert.ok(viewOf(id), `${initiative.id}: ${id}`);
  });
});
