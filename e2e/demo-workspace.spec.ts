import { expect, test } from "@playwright/test";

/* The demo workspaces (Phase NAV-A, ADR 0021): one per workspace type, read-only, synthetic, open
   without signing in and badged DEMO on every screen; the organization's name and mark at the top
   left, the switcher, the slimmed rail. */

const WORKSPACES = [
  { id: "demo-utility", name: "Savanna Electricity Distribution (synthetic)", rail: ["Home", "Intelligence", "Plan", "Finance"], filled: "intelligence" },
  { id: "demo-minigrid", name: "Demonstration Mini-grid Operator (synthetic)", rail: ["Home", "Intelligence", "Plan"], filled: "intelligence" },
  { id: "demo-der", name: "Demonstration DER Developer (synthetic)", rail: ["Home", "Intelligence", "Plan"], filled: "plan" },
  { id: "demo-financier", name: "Demonstration Financier (synthetic)", rail: ["Home", "Finance"], filled: "finance" },
  { id: "demo-regulator", name: "Demonstration Regulator (synthetic)", rail: ["Home", "Oversight"], filled: "oversight" },
];

test("an organization role's 'Open the demo workspace' lands in the workspace at that initiative, badged DEMO", async ({ page }) => {
  await page.goto("/preview/initiatives/meter-every-customer/utility");
  await page.locator("[data-open-demo]").click();
  await expect(page).toHaveURL(/\/preview\/workspace\/demo-utility\/initiatives\/meter-every-customer$/);
  await expect(page.locator("[data-workspace-name]")).toHaveText("Savanna Electricity Distribution (synthetic)");
  await expect(page.locator("[data-demo-badge]")).toBeVisible();
  const initiative = page.locator('[data-workspace-initiative="meter-every-customer"]');
  await expect(initiative.locator('[data-view="initiative.applications"]')).toContainText("Applications");
  await expect(initiative.locator('[data-figure="metering.pending-applications"]')).toContainText("Synthetic");
});

test("each demo workspace has its name, the fallback mark, DEMO, and the rail of its type, with no Deliver or Customers", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/preview/workspace/${workspace.id}`);
    await expect(page.locator("[data-workspace-name]"), workspace.id).toHaveText(workspace.name);
    await expect(page.locator("[data-fallback-mark]").first(), workspace.id).toBeVisible();
    await expect(page.locator("[data-demo-badge]"), workspace.id).toBeVisible();
    await expect(page.locator("[data-demo-note]"), workspace.id).toContainText("synthetic data, read-only");
    await expect(page.locator("[data-rail] [data-rail-item]"), workspace.id).toHaveText(workspace.rail);
    await expect(page.locator("[data-rail-foot]"), workspace.id).toContainText("Reports");
    await expect(page.locator("[data-rail-foot]"), workspace.id).toContainText("Not signed in · demo");
    await expect(page.locator("[data-initiative-card]").first(), workspace.id).toBeVisible();
  }
});

test("the switcher changes the header's name and the rail", async ({ page }) => {
  await page.goto("/preview/workspace/demo-utility");
  await page.locator("[data-switcher] summary").click();
  await page.locator('[data-switch-to="demo-regulator"]').click();
  await expect(page).toHaveURL(/\/preview\/workspace\/demo-regulator$/);
  await expect(page.locator("[data-workspace-name]")).toHaveText("Demonstration Regulator (synthetic)");
  await expect(page.locator("[data-rail] [data-rail-item]")).toHaveText(["Home", "Oversight"]);
});

test("one rail item per workspace type shows its existing screen inside the frame; the others list where their screens are today", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/preview/workspace/${workspace.id}/${workspace.filled}`);
    await expect(page.locator("[data-filled]"), workspace.id).toBeVisible();
    await expect(page.locator(`[data-rail-item="${workspace.filled}"]`), workspace.id).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/preview/workspace/demo-utility/plan");
  await expect(page.locator("[data-filled]")).toHaveCount(0);
  await expect(page.locator('[data-view="plan.metering-allocation"] a')).toHaveAttribute("href", "/dashboard/planning/metering/allocation");
});

test("a rail item a workspace type does not have, and an unknown workspace, are not found", async ({ request }) => {
  for (const route of ["/preview/workspace/demo-regulator/finance", "/preview/workspace/demo-financier/oversight", "/preview/workspace/someone-else", "/preview/workspace/demo-utility/initiatives/minigrid-verification"]) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
});

test("a demo workspace carries out nothing: it has no form and no button that acts", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/preview/workspace/${workspace.id}`);
    await expect(page.locator("main form"), workspace.id).toHaveCount(0);
  }
});
