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
