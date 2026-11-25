import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import type { ScreenGrant } from "../services/spatial/viewer.ts";
import { canOpen, grantFor, opensView } from "./access.ts";
import { translateKey, viewAt, VIEWS, type ViewId } from "./views.ts";

/* ==========================================================
   THE ACCESS FIXTURE, FROZEN BEFORE NAV-B MOVED ANYTHING
   (docs/design/NAV-B-PLAN.md section 4, safeguard A; Founder,
   25 November 2026)

   access-before-nav-b.json was written once, at step 0 (commit
   8a72b2e), with the access functions as they were then: for 38 old
   permission keys alone and six viewer grants, which of 61 real
   samples of every old /dashboard address opened. It is never
   rewritten.

   Now the same questions are asked of the View ID grants (each old
   key translated, views.ts OLD_KEYS; the roles' grants rebuilt by
   grantFor from the same memberships) at the address each old one
   leads to. Every answer must be the same, except where the
   Founder approved a widening, named here; nothing may be narrowed
   and nothing else widened.
========================================================== */

const PINNED = new URL("./__pinned__/", import.meta.url);

type Fixture = { keys: string[]; addresses: string[]; opens: Record<string, string[]>; screens: Record<string, string[]> };
const frozen = JSON.parse(readFileSync(new URL("access-before-nav-b.json", PINNED), "utf8")) as Fixture;
const frozenRoutes = JSON.parse(readFileSync(new URL("routes-before-nav-b.json", PINNED), "utf8")) as string[];

/** The memberships of the six viewer types, as at step 0 (a DisCo holds "utility"; a mini-grid operator "minigrid"). */
const ROLES: Record<string, () => ScreenGrant> = {
  "demo public viewer": () => ({ kind: "everything" }),
  "disco administrator": () => grantFor(["utility"], null, true),
  "disco member, every screen": () => grantFor(["utility"], null, false),
  "disco revenue member (partial)": () => grantFor(["utility"], ["utility.overview", "utility.map", "utility.revenue"], false),
  "disco member, no grants": () => grantFor(["utility"], [], false),
  "mini-grid administrator": () => grantFor(["minigrid"], null, true),
};

const grantOf = (name: string): ScreenGrant => (name.startsWith("key:") ? { kind: "listed", keys: translateKey(name.slice(4)) } : ROLES[name]());

/** Where an old address leads now. Identity until the first screen moves (step 2 reads moves.ts). */
const destination = (address: string) => address;

/** The widenings the Founder approved (25 November 2026); every other difference fails. */
const WIDENINGS: { reason: string; applies: (grant: string, view: ViewId) => boolean }[] = [
  { reason: "About this build is open to every signed-in viewer (answer 5)", applies: (_grant, view) => view === "platform.about-this-build" },
  {
    reason: "A Utility organization's default domains are utility and planning (answer 2)",
    applies: (grant, view) => (grant === "disco administrator" || grant === "disco member, every screen") && VIEWS.find((one) => one.id === view)?.domain === "planning",
  },
];
const widening = (grant: string, view: ViewId | undefined) => (view === undefined ? undefined : WIDENINGS.find((one) => one.applies(grant, view)));

/** Every page and route handler under src/app, as an address pattern. */
function appRoutes(): string[] {
  const root = new URL("../app/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "page.tsx" || entry.name === "route.ts") found.push(`/${relative(root, dir).split(sep).filter((part) => part !== "" && !/^\(.*\)$/.test(part)).join("/")}`);
    }
  };
  walk(root);
  return [...new Set(found)].sort();
}

describe("the access fixture frozen before NAV-B: every old key at every old address", () => {
  it("was frozen over 38 keys, six viewer types and 61 addresses", () => {
    assert.equal(frozen.keys.length, 38);
    assert.equal(frozen.addresses.length, 61);
    assert.equal(Object.keys(frozen.opens).length, 38 + 6);
  });

  it("gives every grant the same answer at every old address, but for the approved widenings", () => {
    const differences: string[] = [];
    for (const [name, opened] of Object.entries(frozen.opens)) {
      const grant = grantOf(name);
      for (const address of frozen.addresses) {
        const before = opened.includes(address);
        const after = canOpen(grant, destination(address));
        if (before === after) continue;
        const why = !before && after ? widening(name, viewAt(destination(address))?.id) : undefined;
        if (why === undefined) differences.push(`${name} at ${address}: ${before ? "open" : "refused"} before, ${after ? "open" : "refused"} now`);
      }
    }
    assert.deepEqual(differences, []);
  });

  it("opens no view newly to any viewer type, but for the approved widenings (safeguard A.4)", () => {
    for (const name of Object.keys(ROLES)) {
      const before = new Set(frozen.opens[name].map((address) => viewAt(destination(address))?.id));
      const grant = grantOf(name);
      const newly = VIEWS.filter((view) => view.address !== null && opensView(grant, view) && !before.has(view.id)).filter((view) => widening(name, view.id) === undefined);
      // Views that did not exist before NAV-B have no "before"; they have no page yet in step 1.
      assert.deepEqual(newly.map((view) => view.id), [], name);
    }
  });

  it("narrows no viewer type's views: every view open before is open now", () => {
    for (const name of Object.keys(ROLES)) {
      const grant = grantOf(name);
      for (const address of frozen.opens[name]) assert.ok(canOpen(grant, destination(address)), `${name}: ${address}`);
    }
  });

  it("still knows every route that existed at step 0", () => {
    const now = appRoutes();
    for (const route of frozenRoutes) assert.ok(now.includes(route), `the route ${route} is gone, with no redirect yet`);
  });
});
