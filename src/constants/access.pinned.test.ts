import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import type { ScreenGrant } from "../services/spatial/viewer.ts";
import { canOpen, grantFor, opensScreen } from "./access.ts";
import { PEOPLE_KEY, REPORTS, sectors } from "./navigation.ts";

/* ==========================================================
   THE ACCESS FIXTURE, FROZEN BEFORE NAV-B MOVES ANYTHING
   (docs/design/NAV-B-PLAN.md section 4, safeguard A; Founder,
   25 November 2026)

   Written once at step 0 with the access functions as they were
   then: for every old permission key alone and for the five viewer
   types, whether each sample of every old address opens, and which
   old keys each grant opens. From step 1 on, the same questions are
   asked of the View ID grants (each old key translated) at the
   address each old one redirects to, and the answers must be the
   same, row by row; the one named exception is About this build,
   opened to every signed-in viewer (Founder's answer 5).

   The routes as they stood at step 0 are frozen beside it, so the
   redirect table can be checked to cover every one of them.

   GRIDINTEL_PIN=write rewrites both files; never set it after step 0.
========================================================== */

const PINNED = new URL("./__pinned__/", import.meta.url);
const ACCESS_FILE = new URL("access-before-nav-b.json", PINNED);
const ROUTES_FILE = new URL("routes-before-nav-b.json", PINNED);
const WRITE = process.env.GRIDINTEL_PIN === "write";

/** Every page and route handler under src/app, as an address pattern. */
function appRoutes(): string[] {
  const root = new URL("../app/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "page.tsx" || entry.name === "route.ts") {
        const segments = relative(root, dir).split(sep).filter((part) => part !== "" && !/^\(.*\)$/.test(part));
        found.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(root);
  return [...new Set(found)].sort();
}

/** The viewer types of safeguard A, as their grants stood at step 0 (DisCo: sectors ["utility"]). */
export const ROLE_GRANTS: Record<string, ScreenGrant> = {
  "demo public viewer": { kind: "everything" },
  "disco administrator": grantFor(["utility"], null, true),
  "disco member, every screen": grantFor(["utility"], null, false),
  "disco revenue member (partial)": grantFor(["utility"], ["utility.overview", "utility.map", "utility.revenue"], false),
  "disco member, no grants": grantFor(["utility"], [], false),
  "mini-grid administrator": grantFor(["minigrid"], null, true),
};

/** Every permission key there was at step 0. */
export const OLD_KEYS: string[] = [
  ...new Set([
    ...sectors.flatMap((sector) => [sector.id, ...sector.opening.map((item) => item.key), ...sector.workspaces.map((item) => item.key)]),
    ...REPORTS.map((report) => report.key),
    "platform.reports",
    PEOPLE_KEY,
  ]),
].sort();

const OPS = "/dashboard/utility/operations";
/** A real sample of every old /dashboard address (the routes of step 0, with ids the demonstration holds). */
export const OLD_ADDRESSES: string[] = [
  "/dashboard",
  "/dashboard/refused",
  "/dashboard/reports",
  "/dashboard/settings",
  "/dashboard/settings/people",
  "/dashboard/intelligence/ai",
  "/dashboard/intelligence/analytics",
  "/dashboard/der",
  "/dashboard/utility",
  "/dashboard/utility/map",
  "/dashboard/utility/ai",
  "/dashboard/utility/executive",
  "/dashboard/utility/executive/all",
  OPS,
  `${OPS}/regions/demo-region-northfield`,
  `${OPS}/substations/SS-RIV`,
  `${OPS}/feeders/FD-MKT`,
  `${OPS}/transformers/DT-OLD-2`,
  `${OPS}/transformers/DT-OLD-2/all`,
  `${OPS}/service-points/SP-OLD2-001`,
  "/dashboard/utility/reliability",
  "/dashboard/utility/revenue",
  "/dashboard/utility/revenue/all",
  "/dashboard/utility/assets",
  "/dashboard/utility/assets/all",
  "/dashboard/utility/events",
  "/dashboard/utility/reports",
  "/dashboard/utility/reports/reliability",
  "/dashboard/utility/reports/reliability/2026-09",
  "/dashboard/utility/reports/reliability/2026-09/data.csv",
  "/dashboard/utility/reports/reliability/2026-09/data.xlsx",
  "/dashboard/utility/reports/operations/2026-09",
  "/dashboard/utility/reports/daily-brief/2026-09-30",
  "/dashboard/minigrid",
  "/dashboard/minigrid/map",
  "/dashboard/minigrid/ai",
  "/dashboard/minigrid/sites",
  "/dashboard/minigrid/sites/MG-DRY",
  "/dashboard/minigrid/sites/reference/rmg01",
  "/dashboard/minigrid/reports",
  "/dashboard/minigrid/reports/site-performance",
  "/dashboard/minigrid/reports/site-performance/2026-09",
  "/dashboard/minigrid/reports/site-performance/2026-09/data.csv",
  "/dashboard/minigrid/reports/site-performance/2026-09/data.xlsx",
  "/dashboard/minigrid/reports/compliance/2026-09",
  "/dashboard/planning",
  "/dashboard/planning/about-this-build",
  "/dashboard/planning/metering",
  "/dashboard/planning/metering/allocation",
  "/dashboard/planning/metering/dt",
  "/dashboard/planning/metering/marketplace",
  "/dashboard/planning/metering/monitoring",
  "/dashboard/planning/metering/journey",
  "/dashboard/planning/metering/report",
  "/dashboard/planning/dt",
  "/dashboard/planning/feeders",
  "/dashboard/planning/network-expansion",
  "/dashboard/planning/unserved",
  "/dashboard/planning/underserved",
  "/dashboard/planning/pue",
  "/dashboard/planning/e-mobility",
];

/** The pattern of a frozen route an address is a sample of. */
const matches = (pattern: string, address: string) => new RegExp(`^${pattern.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\./g, "\\.")}$`).test(address);

type Fixture = {
  keys: string[];
  addresses: string[];
  /** For each grant (a role, or "key:<old key>"): the addresses it opens. */
  opens: Record<string, string[]>;
  /** For each grant: the old keys (screens) it opens. */
  screens: Record<string, string[]>;
};

function compute(): Fixture {
  const grants: Record<string, ScreenGrant> = { ...ROLE_GRANTS, ...Object.fromEntries(OLD_KEYS.map((key) => [`key:${key}`, { kind: "listed", keys: [key] } as ScreenGrant])) };
  return {
    keys: OLD_KEYS,
    addresses: OLD_ADDRESSES,
    opens: Object.fromEntries(Object.entries(grants).map(([name, grant]) => [name, OLD_ADDRESSES.filter((address) => canOpen(grant, address))])),
    screens: Object.fromEntries(Object.entries(grants).map(([name, grant]) => [name, OLD_KEYS.filter((key) => opensScreen(grant, key))])),
  };
}

if (WRITE) {
  writeFileSync(ACCESS_FILE, `${JSON.stringify(compute(), null, 1)}\n`);
  writeFileSync(ROUTES_FILE, `${JSON.stringify(appRoutes(), null, 1)}\n`);
}

describe("the access fixture frozen before NAV-B (step 0)", () => {
  const frozen = JSON.parse(readFileSync(ACCESS_FILE, "utf8")) as Fixture;
  const routes = JSON.parse(readFileSync(ROUTES_FILE, "utf8")) as string[];

  it("has a sample of every /dashboard route that existed at step 0", () => {
    for (const route of routes.filter((one) => one.startsWith("/dashboard"))) {
      assert.ok(frozen.addresses.some((address) => matches(route, address)), `no sample of ${route}`);
    }
  });

  it("still gives, at step 0, exactly the answers it froze", () => {
    assert.deepEqual(compute(), frozen);
    assert.deepEqual(appRoutes(), routes);
  });
});
