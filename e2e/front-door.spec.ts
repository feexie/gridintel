import { expect, test } from "@playwright/test";

/* The public front door (Phase NAV-A, ADR 0021): a clickable prototype under /preview on the
   public demonstration. It replaces nothing: "/" still leads to the dashboard. */

test("an anonymous visitor at the front door sees three initiatives, Sign in, and no rail, data bar or report", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What are you here for?");
  const cards = page.locator("[data-initiative-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.locator("h2")).toHaveText(["Meter every customer", "Charging hubs", "Mini-grid verification"]);
  await expect(page.locator("[data-sign-in]")).toHaveText("Sign in");
  await expect(page.locator("[data-rail], [data-sector-bar], [data-context]")).toHaveCount(0);
  await expect(page.locator('a[href*="/reports"]')).toHaveCount(0);
});

test("each card carries its headline with its status: NERC's reported rate with a bar, hubs not yet available, the sites synthetic", async ({ page }) => {
  await page.goto("/preview");
  const meter = page.locator('[data-initiative-card="meter-every-customer"]');
  await expect(meter.locator('[data-figure="metering.national-rate"]')).toContainText("61.51%");
  await expect(meter.locator('[data-figure="metering.national-rate"]')).toContainText("Reported");
  await expect(meter.locator("[data-progress]")).toHaveCount(1);
  await expect(meter).toContainText("NERC, Second Quarter 2026 Report");
  await expect(meter.locator('[data-figure="metering.pending-applications"]')).toContainText("Synthetic");

  const hubs = page.locator('[data-initiative-card="charging-hubs"]');
  await expect(hubs.locator('[data-figure="charging.hubs"]')).toHaveAttribute("data-status", "not_available");
  await expect(hubs).toContainText("Not yet available");
  await expect(hubs.locator("[data-progress]")).toHaveCount(0);

  const sites = page.locator('[data-initiative-card="minigrid-verification"]');
  await expect(sites.locator('[data-figure="minigrid.sites-agreeing"]')).toContainText(/\d+ of \d+/);
  await expect(sites.locator('[data-figure="minigrid.sites-agreeing"]')).toContainText("Synthetic");
});

test("a card opens 'Who are you?', and a customer goes straight to the meter application, with no sign-in", async ({ page }) => {
  await page.goto("/preview");
  await page.locator('[data-initiative-card="meter-every-customer"] h2 a').click();
  await expect(page).toHaveURL(/\/preview\/initiatives\/meter-every-customer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Who are you?");
  await expect(page.locator("[data-role]")).toHaveCount(4);

  await page.locator('[data-role="customer"]').click();
  await expect(page).toHaveURL(/\/customer$/);
  const form = page.locator('[data-public-view="meter-application"]');
  for (const label of ["Full name", "Phone number", "Email", "State", "LGA or area", "Address", "Nearest landmark", "DisCo", "Meter maker", "Existing account number"]) {
    await expect(form.getByLabel(label, { exact: false }).first()).toBeVisible();
  }
  await expect(form.getByRole("option", { name: "No preference" })).toHaveCount(1);
  await expect(form.getByRole("option", { name: "Ibadan" })).toHaveCount(1);
  // Nothing can be filled in or sent: every control sits in a disabled fieldset.
  await expect(form.locator("fieldset[disabled]")).toHaveCount(1);
  await expect(form.getByLabel("Full name")).toBeDisabled();
  await expect(form.getByRole("button", { name: "Send application" })).toBeDisabled();
  await expect(form.locator("[data-not-open]")).toBeVisible();

  await form.getByRole("link", { name: "Track my application →" }).click();
  await expect(page).toHaveURL(/\/preview\/track$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Track my application");
});

test("the public charging network and the mini-grid summary need no sign-in and show no site's detail", async ({ page }) => {
  await page.goto("/preview/initiatives/charging-hubs/end-user");
  await expect(page.locator('[data-public-view="charging-network"]')).toContainText("no hub and no figure");

  await page.goto("/preview/initiatives/minigrid-verification/public");
  const summary = page.locator('[data-public-view="minigrid-summary"]');
  await expect(summary.locator("[data-figure]")).toHaveCount(4);
  await expect(summary.locator("[data-synthetic-note]")).toBeVisible();
  await expect(page.locator('a[href*="/dashboard/minigrid/sites/"]')).toHaveCount(0);
});

test("an organization role is sent to sign in, or to its demo workspace", async ({ page }) => {
  await page.goto("/preview/initiatives/meter-every-customer/utility");
  const handoff = page.locator('[data-sign-in-handoff="utility"]');
  await expect(handoff).toBeVisible();
  // The sign-in address is not set on this build: the button says so and leads nowhere.
  await expect(handoff.locator("[data-sign-in-unset]")).toBeVisible();
  await expect(handoff).toContainText("Savanna Electricity Distribution (synthetic)");
  await expect(handoff.locator("[data-open-demo]")).toHaveAttribute("href", "/preview/workspace/demo-utility/initiatives/meter-every-customer");
});

test("no public page links to a report, and none has a sign-in page of its own", async ({ page, request }) => {
  for (const route of [
    "/preview",
    "/preview/track",
    "/preview/initiatives/meter-every-customer",
    "/preview/initiatives/meter-every-customer/customer",
    "/preview/initiatives/meter-every-customer/financier",
    "/preview/initiatives/charging-hubs",
    "/preview/initiatives/charging-hubs/end-user",
    "/preview/initiatives/minigrid-verification",
    "/preview/initiatives/minigrid-verification/public",
  ]) {
    await page.goto(route);
    await expect(page.locator('a[href*="reports"]'), route).toHaveCount(0);
    await expect(page.locator("[data-rail]"), route).toHaveCount(0);
  }
  for (const route of ["/preview/initiatives/nowhere", "/preview/initiatives/meter-every-customer/nobody", "/preview/login"]) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
});

test("the current front page and menu are unchanged: / still leads to the Platform Overview", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-sector-bar]")).toBeVisible();
});
