import { expect, test } from "@playwright/test";

/* The public front door (Phase NAV-A, ADR 0021): a clickable prototype under / on the
   public demonstration. It replaces nothing: "/" still leads to the dashboard. */

test("an anonymous visitor at the front door sees three initiatives, Sign in, and no rail, data bar or report", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What are you here for?");
  const cards = page.locator("[data-initiative-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.locator("h2")).toHaveText(["Meter every customer", "Charging hubs", "Mini-grid verification"]);
  await expect(page.locator("[data-sign-in]")).toHaveText("Sign in");
  await expect(page.locator("[data-rail], [data-sector-bar], [data-context]")).toHaveCount(0);
  await expect(page.locator('a[href*="/reports"]')).toHaveCount(0);
});

test("each card carries its headline with its status: NERC's reported rate with a bar, hubs not yet available, the sites synthetic", async ({ page }) => {
  await page.goto("/");
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

test("a card opens the initiative's own page, Take part opens 'Who are you?', and a customer goes straight to the meter application, with no sign-in", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-initiative-card="meter-every-customer"] h2 a').click();
  await expect(page).toHaveURL(/\/initiatives\/meter-every-customer$/);
  // The initiative's own page (brief 3c.1): what it is, who it is for, how it moves, who takes part, its figures, Take part.
  const own = page.locator('[data-initiative-page="meter-every-customer"]');
  await expect(own.getByRole("heading", { level: 1 })).toHaveText("Meter every customer");
  await expect(own.locator("[data-for-who] li")).toHaveCount(5);
  await expect(own.locator("[data-status-flow] li")).toHaveText(["1. Submitted", "2. Under review", "3. Verified", "4. Assigned (DT and feeder)", "5. Approved", "6. Funded", "7. Installed"]);
  await expect(own.locator("[data-taking-part]")).toContainText("Synthetic");
  await expect(own.locator('[data-figure="metering.national-rate"]')).toContainText("61.51%");
  // No host is shown: none has agreed in writing (brief 3c.2).
  await expect(page.locator("[data-hosted-by]")).toHaveCount(0);
  await own.locator("[data-take-part]").click();
  await expect(page).toHaveURL(/\/initiatives\/meter-every-customer\/take-part$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Who are you?");
  await expect(page.locator("[data-role]")).toHaveCount(5);
  await expect(page.locator('[data-role="regulator"]')).toHaveAttribute("data-audience", "organization");

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
  await expect(form.locator("[data-map-placeholder]")).toHaveText("Map for your pin: not open yet. It opens with the application form.");

  await form.getByRole("link", { name: "Track my application →" }).click();
  await expect(page).toHaveURL(/\/\/track$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Track my application");
});

test("the public charging network and the mini-grid summary need no sign-in and show no site's detail", async ({ page }) => {
  await page.goto("/initiatives/charging-hubs/take-part/end-user");
  await expect(page.locator('[data-public-view="charging-network"]')).toContainText("no hub and no figure");

  await page.goto("/initiatives/minigrid-verification/take-part/public");
  const summary = page.locator('[data-public-view="minigrid-summary"]');
  // Four figures of the synthetic sites, and apart from them one figure of a real reference site.
  await expect(summary.locator("[data-figure]")).toHaveCount(5);
  await expect(summary.locator("[data-summary-reference] [data-figure]")).toHaveCount(1);
  await expect(summary.locator("[data-synthetic-note]")).toBeVisible();
  await expect(page.locator('a[href*="/dashboard/intelligence/minigrid/sites/"]')).toHaveCount(0);
});

test("an organization role is sent to sign in, or to its demo workspace", async ({ page }) => {
  await page.goto("/initiatives/meter-every-customer/take-part/utility");
  const handoff = page.locator('[data-sign-in-handoff="utility"]');
  await expect(handoff).toBeVisible();
  // The sign-in address is not set on this build: the button says so and leads nowhere.
  await expect(handoff.locator("[data-sign-in-unset]")).toBeVisible();
  await expect(handoff).toContainText("Savanna Electricity Distribution (synthetic)");
  await expect(handoff.locator("[data-open-demo]")).toHaveAttribute("href", "/dashboard/initiatives/meter-every-customer?workspace=utility");

  await page.goto("/initiatives/meter-every-customer/take-part/regulator");
  await expect(page.locator('[data-sign-in-handoff="regulator"]')).toContainText("Demonstration Regulator (synthetic)");
  await expect(page.locator("[data-open-demo]")).toHaveAttribute("href", "/dashboard/initiatives/meter-every-customer?workspace=regulator");
});

test("no public page links to a report, and none has a sign-in page of its own", async ({ page, request }) => {
  for (const route of [
    "/",
    "/track",
    "/initiatives/meter-every-customer/take-part",
    "/initiatives/meter-every-customer/take-part/customer",
    "/initiatives/meter-every-customer/take-part/financier",
    "/initiatives/charging-hubs/take-part",
    "/initiatives/charging-hubs/take-part/end-user",
    "/initiatives/minigrid-verification/take-part",
    "/initiatives/minigrid-verification/take-part/public",
  ]) {
    await page.goto(route);
    await expect(page.locator('a[href*="reports"]'), route).toHaveCount(0);
    await expect(page.locator("[data-rail]"), route).toHaveCount(0);
  }
  for (const route of ["/initiatives/nowhere/take-part", "/initiatives/meter-every-customer/take-part/nobody", "/preview/login"]) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
});

test("every initiative's page shows no host, and its Take part opens its role picker", async ({ page }) => {
  for (const id of ["meter-every-customer", "charging-hubs", "minigrid-verification"]) {
    await page.goto(`/initiatives/${id}`);
    await expect(page.locator("[data-hosted-by]"), id).toHaveCount(0);
    await expect(page.locator("[data-take-part]"), id).toHaveAttribute("href", `/initiatives/${id}/take-part`);
  }
});

test("the public Home and the initiative pages carry no Prototype tag; a form that cannot be sent still says it is not open yet (Founder, 26 November 2026)", async ({ page }) => {
  for (const route of ["/", "/initiatives/meter-every-customer", "/initiatives/charging-hubs", "/initiatives/minigrid-verification"]) {
    await page.goto(route);
    await expect(page.locator("[data-public-frame] header"), route).not.toContainText("Prototype");
    await expect(page.locator("main"), route).not.toContainText("Prototype");
  }
  for (const route of ["/initiatives/meter-every-customer/take-part/customer", "/track"]) {
    await page.goto(route);
    await expect(page.locator("[data-not-open]").first(), route).toBeVisible();
    await expect(page.getByText("not open yet").first(), route).toBeVisible();
  }
});
