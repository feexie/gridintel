import { expect, test } from "@playwright/test";
import { DEMO_WORKSPACE_COOKIE } from "../src/constants/views";

/* NAV-B safeguard C on the public demonstration (Founder, 25 November 2026): ?workspace= and the
   demo workspace cookie may only choose one of the five synthetic demo workspaces in the
   catalogue; any other value is the default (the Demonstration DisCo), never trusted as given.
   The tenant's side, where both are ignored entirely, is tenant/workspace-isolation.spec.ts. */

const type = (page: import("@playwright/test").Page) => page.locator("[data-workspace-frame]").getAttribute("data-workspace-type");

test("?workspace= chooses one of the five demo workspaces, is kept, and leaves the address", async ({ page }) => {
  await page.goto("/dashboard?workspace=regulator");
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "regulator");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-rail-item]")).toHaveText(["Home", "Oversight"]);
  await page.reload();
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "regulator");
  // A screen another workspace shows is drawn in that workspace's frame.
  await page.goto("/dashboard/intelligence/utility/revenue");
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "utility");
});

test("any other value of ?workspace= or of the cookie is the default, never the value as given", async ({ page, context, baseURL }) => {
  for (const value of ["not-a-type", "demo-disco", "UTILITY", "", "<script>", "tenant", "../regulator"]) {
    await context.clearCookies();
    await page.goto(`/dashboard?workspace=${encodeURIComponent(value)}`);
    await expect(page.locator("[data-workspace-frame]"), value).toHaveAttribute("data-workspace-type", "utility");
    await context.clearCookies();
    await context.addCookies([{ name: DEMO_WORKSPACE_COOKIE, value: encodeURIComponent(value), url: baseURL! }]);
    await page.goto("/dashboard");
    await expect(page.locator("[data-workspace-frame]"), value).toHaveAttribute("data-workspace-type", "utility");
  }
  expect(await type(page)).toBe("utility");
});

test("the switcher lists the other four demo workspaces, and choosing one opens its Home", async ({ page }) => {
  await page.goto("/dashboard");
  await page.locator("[data-switcher] summary").click();
  await expect(page.locator("[data-switch-to]")).toHaveCount(4);
  await page.locator('[data-switch-to="financier"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "financier");
  await expect(page.locator("[data-rail-item]")).toHaveText(["Home", "Finance"]);
});
