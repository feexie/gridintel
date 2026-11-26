import { expect, test } from "@playwright/test";

/* The demo workspaces (ADR 0021 decision 6; NAV-B steps 6 and 7): one per workspace type, each the
   dashboard itself, read-only, synthetic, open without signing in and badged DEMO on every screen;
   the organization's name and mark at the top left, the switcher, the slimmed rail. A link names
   one with ?workspace= (safeguard C: one of the five, else the default). */

const WORKSPACES = [
  { type: "utility", name: "Savanna Electricity Distribution (synthetic)", rail: ["Home", "Intelligence", "Plan", "Finance"] },
  { type: "minigrid", name: "Demonstration Mini-grid Operator (synthetic)", rail: ["Home", "Intelligence", "Plan"] },
  { type: "der", name: "Demonstration DER Developer (synthetic)", rail: ["Home", "Intelligence", "Plan"] },
  { type: "financier", name: "Demonstration Financier (synthetic)", rail: ["Home", "Finance"] },
  { type: "regulator", name: "Demonstration Regulator (synthetic)", rail: ["Home", "Oversight"] },
];

test("an organization role's 'Open the demo workspace' lands in the workspace at that initiative, badged DEMO", async ({ page }) => {
  await page.goto("/initiatives/meter-every-customer/take-part/utility");
  await expect(page.locator("[data-open-demo]")).toHaveAttribute("href", "/dashboard/initiatives/meter-every-customer?workspace=utility");
  await page.locator("[data-open-demo]").click();
  await expect(page).toHaveURL(/\/dashboard\/initiatives\/meter-every-customer$/);
  await expect(page.locator("[data-workspace-name]")).toHaveText("Savanna Electricity Distribution (synthetic)");
  await expect(page.locator("[data-demo-badge]")).toBeVisible();
  const initiative = page.locator('[data-workspace-initiative="meter-every-customer"]');
  await expect(initiative.locator('[data-view="initiative.applications"]')).toContainText("Applications");
  await expect(initiative.locator('[data-figure="metering.pending-applications"]')).toContainText("Synthetic");
  // The workspace counts its own DisCo's queue, and the national rate says it is national (brief 3c.3).
  await expect(initiative.locator('[data-figure="metering.pending-applications"]')).toContainText("Applications pending at this DisCo");
  await expect(initiative.locator('[data-figure="metering.national-rate"]')).toContainText("National (NERC)");
  // The header names the initiative once; the card under it has no title and no link to itself.
  await expect(page.getByRole("main").getByText("Meter every customer", { exact: true })).toHaveCount(1);
  await expect(initiative.locator("[data-card-open]")).toHaveCount(0);
});

test("each demo workspace has its name, the fallback mark, DEMO, and the rail of its type, with no Deliver or Customers", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/dashboard?workspace=${workspace.type}`);
    await expect(page.locator("[data-workspace-name]"), workspace.type).toHaveText(workspace.name);
    await expect(page.locator("[data-fallback-mark]").first(), workspace.type).toBeVisible();
    await expect(page.locator("[data-demo-badge]"), workspace.type).toBeVisible();
    await expect(page.locator("[data-demo-note]"), workspace.type).toContainText("synthetic data, read-only");
    await expect(page.locator("[data-rail] [data-rail-item]"), workspace.type).toHaveText(workspace.rail);
    await expect(page.locator("[data-rail]"), workspace.type).not.toContainText(/Deliver|Customers/);
    await expect(page.locator("[data-rail-account]"), workspace.type).toContainText("Not signed in · demo");
    await expect(page.locator("[data-initiative-card]").first(), workspace.type).toBeVisible();
  }
});

test("the switcher changes the header's name and the rail", async ({ page }) => {
  await page.goto("/dashboard?workspace=utility");
  await page.locator("[data-switcher] summary").click();
  await page.locator('[data-switch-to="regulator"]').click();
  // The address names the workspace now shown, never the one left.
  await expect(page).toHaveURL(/\/dashboard\?workspace=regulator$/);
  await expect(page.locator("[data-workspace-name]")).toHaveText("Demonstration Regulator (synthetic)");
  await expect(page.locator("[data-rail] [data-rail-item]")).toHaveText(["Home", "Oversight"]);
  // A reload keeps it.
  await page.reload();
  await expect(page.locator("[data-workspace-name]")).toHaveText("Demonstration Regulator (synthetic)");
});

test("every rail item of every demo workspace leads to a screen that exists, in that workspace's frame", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/dashboard?workspace=${workspace.type}`);
    const hrefs = await page.locator("[data-rail] [data-rail-item]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") as string));
    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(response?.status(), `${workspace.type}: ${href}`).toBe(200);
      await expect(page.locator("[data-workspace-frame]"), `${workspace.type}: ${href}`).toHaveAttribute("data-workspace-type", workspace.type);
      await expect(page.getByText("Coming Soon"), href).toHaveCount(0);
    }
  }
});

test("an unknown demo workspace or initiative is not found", async ({ request }) => {
  for (const route of ["/preview/workspace/someone-else", "/dashboard/initiatives/nowhere", "/dashboard/initiatives/nowhere?workspace=utility"]) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
});

test("a demo workspace carries out nothing: its Home has no form and no button that acts", async ({ page }) => {
  for (const workspace of WORKSPACES) {
    await page.goto(`/dashboard?workspace=${workspace.type}`);
    await expect(page.locator("main form"), workspace.type).toHaveCount(0);
  }
});
