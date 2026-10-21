import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { TEST_PEOPLE } from "../../src/composition/identityFixture";
import { totpCode } from "../../src/repositories/memory/totp";
import { ROUTES } from "../routes";

/* Phase 8A (ADR 0020): a tenant deployment, on the two synthetic organizations of the
   demonstration dataset. Only invited people sign in, with a password and a code from an
   authenticator app; one organization's records are never visible to the other, on any screen
   or download; a member opens what their grant holds; links are cut to the grant. */

type Person = { email: string; password: string; totpSecret?: string };

const DISCO_NAME = "Savanna Electricity Distribution (synthetic)";
const OPERATOR_NAME = "Demonstration Mini-grid Operator (synthetic)";
const UTILITY_DOWNLOADS = ["/dashboard/utility/reports/operations/2026-09/data.csv", "/dashboard/utility/reports/reliability/2026-09/data.xlsx"];
const MINIGRID_DOWNLOADS = ["/dashboard/minigrid/reports/compliance/2026-09/data.csv", "/dashboard/minigrid/reports/site-performance/2026-09/data.xlsx"];
const UTILITY_ROUTES = ROUTES.filter((route) => route.startsWith("/dashboard/utility"));
const MINIGRID_ROUTES = ROUTES.filter((route) => route.startsWith("/dashboard/minigrid"));

async function enterCode(page: Page, secret: string) {
  await page.getByLabel(/^Code/).fill(totpCode(secret, Date.now()));
  await page.getByRole("button", { name: /Sign in|Finish/ }).click();
}

async function signIn(page: Page, person: Person & { totpSecret: string }, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  await enterCode(page, person.totpSecret);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Every address in the list answers with the refusal page and 403, and shows none of the other organization's name. */
async function refusedEverywhere(page: Page, routes: readonly string[], otherName: string) {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(403);
    await expect(page.locator("[data-refused]"), route).toBeVisible();
    await expect(page.locator("body"), route).not.toContainText(otherName);
  }
}

/** What a tenant build may hold rendered ahead of time: the same for everyone, and no record of anyone's. */
const PUBLIC_FILES = ["/api/areas/state", "/api/areas/lga", "/robots.txt", "/favicon.ico", "/_global-error"];

test("a tenant build renders no page ahead of time but public files: the reference geography, the icon, the error page", () => {
  const manifest = JSON.parse(readFileSync(".next-tenant/prerender-manifest.json", "utf8")) as { routes: Record<string, unknown> };
  expect(Object.keys(manifest.routes).filter((route) => !PUBLIC_FILES.includes(route))).toEqual([]);
});

test("no one signed in reaches anything: every screen and every download leads to signing in", async ({ request }) => {
  for (const route of [...ROUTES, ...UTILITY_DOWNLOADS, ...MINIGRID_DOWNLOADS, "/dashboard/settings/people", "/dashboard/reports"]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    expect(response.headers().location, route).toBe(`/login?next=${encodeURIComponent(route)}`);
  }
  // The outlines of the states are public reference geography, as on the demonstration.
  expect((await request.get("/api/areas/state")).status()).toBe(200);
});

test("a password alone opens nothing: the code is asked for, and a wrong one is refused", async ({ page }) => {
  const person = TEST_PEOPLE.discoAdmin;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill("not-the-password-1");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-auth-error]")).toContainText("do not match an account");

  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  // With only the password, a screen sends the person back to the code.
  await page.goto("/dashboard/utility");
  await expect(page).toHaveURL(/\/login\/verify/);
  await page.getByLabel(/^Code/).fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-auth-error]")).toContainText("not right");
});

test("the DisCo's administrator sees the DisCo only: no screen, download or name of the mini-grid operator", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.discoAdmin);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-account-email]").first()).toHaveText(TEST_PEOPLE.discoAdmin.email);
  await expect(page.locator("[data-account-organization]").first()).toHaveText(DISCO_NAME);
  // The Platform Overview holds the DisCo's sector only, with no way into the other.
  await expect(page.locator("[data-sector]")).toHaveCount(1);
  await expect(page.locator('[data-sector="utility"]')).toBeVisible();
  await expect(page.locator("[data-sector-bar]")).not.toContainText("Mini-grid");
  await expect(page.locator('a[href^="/dashboard/minigrid"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(OPERATOR_NAME);
  // Every screen of the DisCo opens.
  for (const route of UTILITY_ROUTES) expect((await page.goto(route))?.status(), route).toBe(200);
  for (const route of UTILITY_DOWNLOADS) expect((await page.request.get(route)).status(), route).toBe(200);
  // None of the operator's does.
  await refusedEverywhere(page, MINIGRID_ROUTES, OPERATOR_NAME);
  for (const route of MINIGRID_DOWNLOADS) expect((await page.request.get(route)).status(), route).toBe(403);
});

test("the mini-grid operator's administrator sees the operator only, its map drawn from its own records", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.minigridAdmin);
  await expect(page.locator("[data-account-organization]").first()).toHaveText(OPERATOR_NAME);
  await expect(page.locator("[data-sector]")).toHaveCount(1);
  await expect(page.locator('[data-sector="minigrid"]')).toBeVisible();
  await expect(page.locator('a[href^="/dashboard/utility"]')).toHaveCount(0);
  for (const route of [...MINIGRID_ROUTES, "/dashboard/minigrid/sites/MG-GRN"]) {
    expect((await page.goto(route))?.status(), route).toBe(200);
    await expect(page.locator("body"), route).not.toContainText(DISCO_NAME);
  }
  for (const route of MINIGRID_DOWNLOADS) expect((await page.request.get(route)).status(), route).toBe(200);
  await refusedEverywhere(page, UTILITY_ROUTES, DISCO_NAME);
  for (const route of UTILITY_DOWNLOADS) expect((await page.request.get(route)).status(), route).toBe(403);
  // The list of every report holds the operator's own.
  await page.goto("/dashboard/reports");
  await expect(page.locator("[data-report]")).toHaveCount(2);
});

test("a member of the revenue department opens their three screens, and the links in them are cut to that", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.discoRevenue);
  // Their start is the Utility Overview: the Platform Overview is not theirs.
  await expect(page).toHaveURL(/\/dashboard\/utility$/);
  const menu = page.locator("aside").first();
  await expect(menu).toContainText("Revenue");
  await expect(menu).not.toContainText("Executive");
  // The ways in hold Revenue and the map; no link anywhere leads to a screen they may not open.
  await expect(page.locator("[data-ways-in] a")).toHaveText([/GIS Map/, /Revenue/]);
  for (const closed of ["executive", "operations", "reliability", "assets", "events", "ai", "reports"]) {
    await expect(page.locator(`main a[href^="/dashboard/utility/${closed}"]`), closed).toHaveCount(0);
  }
  await expect(page.locator("[data-account]").first()).not.toContainText("People");
  expect((await page.goto("/dashboard/utility/revenue"))?.status()).toBe(200);
  await refusedEverywhere(page, ["/dashboard", "/dashboard/utility/executive", "/dashboard/utility/operations/feeders/FD-OLD", "/dashboard/settings/people"], OPERATOR_NAME);
  expect((await page.request.get(UTILITY_DOWNLOADS[0])).status()).toBe(403);
});

test("a person with no authenticator app is asked to add one before anything opens", async ({ page }) => {
  const person = TEST_PEOPLE.discoNew;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/enrol/);
  await page.goto("/dashboard/utility");
  await expect(page).toHaveURL(/\/login\/enrol/);
  const secret = (await page.locator("[data-totp-secret]").textContent())!.trim();
  await enterCode(page, secret);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an administrator invites someone: the link works once, and the person opens only what they were given until removed", async ({ page, browser }) => {
  await signIn(page, TEST_PEOPLE.discoAdmin);
  await page.locator("[data-account]").first().getByRole("link", { name: "People" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings\/people$/);
  await expect(page.locator("[data-member]")).toHaveCount(3);
  await expect(page.locator("[data-people]")).not.toContainText(TEST_PEOPLE.minigridAdmin.email);
  await page.locator("[data-invite]").getByLabel("Email address").fill("invited@disco.test");
  await page.locator("[data-invite]").getByLabel("May open").selectOption({ label: "Revenue department" });
  await page.locator("[data-invite]").getByRole("button", { name: "Invite" }).click();
  const link = (await page.locator("[data-invite-link] code").textContent())!.trim();
  expect(link).toMatch(/\/auth\/confirm\?token_hash=[0-9a-f]{64}&type=invite$/);

  const invited = await (await browser.newContext()).newPage();
  await invited.goto(link);
  await expect(invited).toHaveURL(/\/login\/set-password$/);
  await invited.getByLabel("Password", { exact: true }).fill("a-new-password-for-test");
  await invited.getByLabel("The same password again").fill("a-new-password-for-test");
  await invited.getByRole("button", { name: "Continue" }).click();
  await expect(invited).toHaveURL(/\/login\/enrol$/);
  await enterCode(invited, (await invited.locator("[data-totp-secret]").textContent())!.trim());
  await expect(invited).toHaveURL(/\/dashboard\/utility$/);
  expect((await invited.goto("/dashboard/utility/executive"))?.status()).toBe(403);

  // The link was used: it does not sign anyone in again.
  const again = await (await browser.newContext()).newPage();
  await again.goto(link);
  await expect(again).toHaveURL(/\/login\?error=invite$/);

  // Removed, the person opens nothing from their next request.
  await page.reload();
  const row = page.locator('[data-member="invited@disco.test"]');
  await expect(row).toContainText("Revenue department");
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator('[data-member="invited@disco.test"]')).toHaveCount(0);
  await invited.goto("/dashboard/utility/revenue");
  await expect(invited).toHaveURL(/\/login\?next=/);
});

test("signing out ends the session", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.minigridAdmin);
  await page.locator("[data-account]").first().getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard/minigrid");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fminigrid$/);
});
