import { expect, test, type Page } from "@playwright/test";
import { TEST_PEOPLE } from "../../src/composition/identityFixture";
import { DEMO_WORKSPACE_COOKIE } from "../../src/constants/views";
import { totpCode } from "../../src/repositories/memory/totp";

/* NAV-B safeguard C on a tenant deployment (Founder, 25 November 2026): the workspace is the
   signed-in person's organization only. ?workspace= and the demo workspace cookie are ignored
   entirely: they change nothing in the frame and open nothing. */

type Person = (typeof TEST_PEOPLE)[keyof typeof TEST_PEOPLE] & { totpSecret: string };

async function signIn(page: Page, person: Person) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  await page.getByLabel(/^Code/).fill(totpCode(person.totpSecret, Date.now()));
  await page.getByRole("button", { name: /Sign in|Finish/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const frame = (page: Page) => page.locator("[data-workspace-header]").innerHTML();
const rail = (page: Page) => page.locator("[data-rail]").innerHTML();

test("?workspace= and the demo cookie change nothing in the DisCo's frame and open nothing", async ({ page, context, baseURL }) => {
  await signIn(page, TEST_PEOPLE.discoAdmin);
  await page.goto("/dashboard");
  const [header, links] = [await frame(page), await rail(page)];
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "utility");
  await expect(page.locator("[data-switcher], [data-demo-badge]")).toHaveCount(0);

  await context.addCookies([{ name: DEMO_WORKSPACE_COOKIE, value: "minigrid", url: baseURL! }]);
  for (const address of ["/dashboard?workspace=minigrid", "/dashboard?workspace=regulator", "/dashboard"]) {
    await page.goto(address);
    await expect(page.locator("[data-workspace-frame]"), address).toHaveAttribute("data-workspace-type", "utility");
    expect(await frame(page), address).toBe(header);
    expect(await rail(page), address).toBe(links);
  }
  // Nothing of another organization opens with them.
  for (const address of ["/dashboard/intelligence/minigrid?workspace=minigrid", "/dashboard/oversight/monitoring?workspace=regulator"]) {
    expect((await page.request.get(address)).status(), address).toBe(403);
  }
});

/* The isolation fix of NAV-B step 6 (accepted by the Founder, 26 November 2026; ADR 0021 amended):
   a tenant's Home figures are worked for each request alone, never kept for another, and the
   mini-grid portfolio is read only for a mini-grid operator. The operator signs in first, so a
   figure kept from its request would show on the DisCo's Home after it. */
test("one organization's figures never appear on another's Home, whoever signed in before", async ({ browser }) => {
  const operator = await browser.newContext();
  const operatorPage = await operator.newPage();
  await signIn(operatorPage, TEST_PEOPLE.minigridAdmin);
  await operatorPage.goto("/dashboard");
  await expect(operatorPage.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "minigrid");
  await expect(operatorPage.locator("body")).not.toContainText("Savanna Electricity Distribution");
  // The operator's own portfolio is read for the operator.
  for (const figure of await operatorPage.locator('[data-figure="minigrid.sites-agreeing"]').all()) await expect(figure).not.toHaveAttribute("data-status", "not_available");
  await operator.close();

  const disco = await browser.newContext();
  const discoPage = await disco.newPage();
  await signIn(discoPage, TEST_PEOPLE.discoAdmin);
  for (const address of ["/dashboard", "/dashboard/initiatives/meter-every-customer"]) {
    await discoPage.goto(address);
    await expect(discoPage.locator("[data-workspace-frame]"), address).toHaveAttribute("data-workspace-type", "utility");
    await expect(discoPage.locator("body"), address).not.toContainText("Demonstration Mini-grid Operator");
    // The operator's portfolio is never read for the DisCo: wherever the figure is named, it says so.
    for (const figure of await discoPage.locator('[data-figure="minigrid.sites-agreeing"]').all()) await expect(figure, address).toHaveAttribute("data-status", "not_available");
    // The applications queue counted is the DisCo's own.
    for (const figure of await discoPage.locator('[data-figure="metering.pending-applications"]').all()) await expect(figure, address).toContainText("at this DisCo");
  }
  await disco.close();
});
