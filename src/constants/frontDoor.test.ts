import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { demoWorkspaceId, railHref, routeFor, workspaceInitiativeHref } from "./frontDoor.ts";
import { INITIATIVES, initiativesFor, roleFor } from "./initiatives.ts";
import { RAILS, railFor, reportsHrefFor, VIEWS, viewOf, WORKSPACE_TYPES } from "./workspaces.ts";

describe("the initiative catalogue (ADR 0021)", () => {
  it("holds the three initiatives, with no city in a title", () => {
    assert.deepEqual(
      INITIATIVES.map((one) => one.title),
      ["Meter every customer", "Charging hubs", "Mini-grid verification"],
    );
    for (const one of INITIATIVES) assert.doesNotMatch(one.title, /Ibadan|Lagos|Abuja|Kano|:/);
  });

  it("has unique ids, and unique role ids within each initiative", () => {
    assert.equal(new Set(INITIATIVES.map((one) => one.id)).size, INITIATIVES.length);
    for (const one of INITIATIVES) assert.equal(new Set(one.roles.map((role) => role.id)).size, one.roles.length, one.id);
  });

  it("gives every initiative one public role and at least one organization role", () => {
    for (const one of INITIATIVES) {
      assert.equal(one.roles.filter((role) => role.audience === "public").length, 1, one.id);
      assert.ok(one.roles.some((role) => role.audience === "organization"), one.id);
    }
  });

  it("holds no figure: the catalogue's source has no number in a title, summary or label", () => {
    for (const one of INITIATIVES) {
      for (const text of [one.title, one.summary, ...one.roles.flatMap((role) => [role.label, role.description])]) assert.doesNotMatch(text, /\d/, text);
    }
    const source = readFileSync(new URL("./initiatives.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /(headline|progress|secondary)\s*:\s*\d/);
  });

  it("names only views that exist, and lands each organization role on an item of its workspace's rail", () => {
    for (const one of INITIATIVES) {
      for (const role of one.roles) {
        if (role.audience !== "organization") continue;
        for (const view of role.views) assert.ok(viewOf(view));
        if (role.landing.kind === "rail") {
          const item = role.landing.item;
          assert.ok(RAILS[role.workspaceType].some((entry) => entry.item === item), `${one.id}/${role.id} lands on ${item}`);
        }
      }
    }
  });

  it("puts Applications inside Meter every customer for a utility, landing there", () => {
    const meter = INITIATIVES.find((one) => one.id === "meter-every-customer")!;
    const utility = roleFor(meter, "utility")!;
    assert.deepEqual(utility.landing, { kind: "initiative" });
    assert.ok(utility.views.includes("initiative.applications"));
    assert.equal(meter.secondary, "metering.pending-applications");
  });

  it("lists each workspace type's initiatives", () => {
    assert.deepEqual(initiativesFor("utility").map((one) => one.id), ["meter-every-customer", "charging-hubs"]);
    assert.deepEqual(initiativesFor("regulator").map((one) => one.id), ["meter-every-customer", "minigrid-verification"]);
    for (const type of WORKSPACE_TYPES) assert.ok(initiativesFor(type).length > 0, type);
  });
});

describe("where a role is sent", () => {
  it("sends a public role straight to its public view", () => {
    assert.deepEqual(routeFor("meter-every-customer", "customer"), { kind: "public", view: "meter-application", href: "/preview/initiatives/meter-every-customer/customer" });
    assert.equal(routeFor("charging-hubs", "end-user")?.kind, "public");
    assert.equal(routeFor("minigrid-verification", "public")?.kind, "public");
  });

  it("sends an organization role to sign-in, offering its demo workspace at the right place", () => {
    const utility = routeFor("meter-every-customer", "utility");
    assert.equal(utility?.kind, "sign-in");
    assert.equal(utility?.kind === "sign-in" && utility.demoHref, workspaceInitiativeHref("demo-utility", "meter-every-customer"));

    const financier = routeFor("meter-every-customer", "financier");
    assert.equal(financier?.kind === "sign-in" && financier.demoHref, "/preview/workspace/demo-financier/finance");

    // Regulator on Meter every customer (brief 3c.4): to sign in, with the regulator's demo workspace.
    const regulator = routeFor("meter-every-customer", "regulator");
    assert.equal(regulator?.kind, "sign-in");
    assert.equal(regulator?.kind === "sign-in" && regulator.demoHref, "/preview/workspace/demo-regulator/initiatives/meter-every-customer");

    const operator = routeFor("minigrid-verification", "minigrid");
    assert.equal(operator?.kind === "sign-in" && operator.demoHref, "/preview/workspace/demo-minigrid/intelligence");
  });

  it("answers null for an unknown initiative or role", () => {
    assert.equal(routeFor("nowhere", "customer"), null);
    assert.equal(routeFor("meter-every-customer", "nobody"), null);
  });

  it("addresses a workspace's Home at the workspace itself", () => {
    assert.equal(railHref(demoWorkspaceId("utility"), "home"), "/preview/workspace/demo-utility");
    assert.equal(railHref(demoWorkspaceId("utility"), "plan"), "/preview/workspace/demo-utility/plan");
  });
});

describe("the slimmed rail (ADR 0021)", () => {
  it("starts with Home in every workspace type and has no Deliver or Customers", () => {
    for (const type of WORKSPACE_TYPES) {
      const rail = railFor(type);
      assert.equal(rail[0].item, "home", type);
      for (const entry of rail) assert.doesNotMatch(entry.label, /Deliver|Customers/);
    }
  });

  it("gives Oversight to a regulator only, and makes Finance a financier's main area", () => {
    for (const type of WORKSPACE_TYPES) assert.equal(RAILS[type].some((entry) => entry.item === "oversight"), type === "regulator", type);
    assert.deepEqual(RAILS.financier.map((entry) => entry.item), ["home", "finance"]);
  });

  it("lists each view in at most one rail item of a workspace type", () => {
    for (const type of WORKSPACE_TYPES) {
      const listed = RAILS[type].flatMap((entry) => entry.views);
      assert.equal(new Set(listed).size, listed.length, type);
    }
  });

  it("fills exactly one rail item per type, with a view that item lists", () => {
    for (const type of WORKSPACE_TYPES) {
      const filled = RAILS[type].filter((entry) => entry.filled !== undefined);
      assert.equal(filled.length, 1, type);
      assert.ok(filled[0].views.includes(filled[0].filled!), type);
    }
  });

  it("has unique view ids, and every view a rail lists exists", () => {
    assert.equal(new Set(VIEWS.map((view) => view.id)).size, VIEWS.length);
    for (const type of WORKSPACE_TYPES) for (const entry of RAILS[type]) for (const view of entry.views) assert.ok(viewOf(view));
  });

  it("points every view that has a page today at a dashboard address", () => {
    for (const view of VIEWS) if (view.current !== null) assert.match(view.current, /^\/dashboard(\/|$)/, view.id);
  });

  it("keeps reports inside the dashboard, never on a public address", () => {
    for (const type of WORKSPACE_TYPES) assert.match(reportsHrefFor(type), /^\/dashboard\/(.+\/)?reports$/);
  });
});
