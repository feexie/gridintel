import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { TENANT_ORGANIZATIONS, TEST_PEOPLE } from "../../src/composition/identityFixture";
import { canOpen, grantFor, resolves } from "../../src/constants/access";
import { destinationOf } from "../../src/constants/moves";
import { totpCode } from "../../src/repositories/memory/totp";

/* NAV-B safeguard A, by direct URL request (Founder, 25 November 2026): a hidden link is not a
   protected page, so every address is asked for directly, by each kind of viewer of a tenant
   deployment, and each must get exactly what its grant allows: the page where the grant opens
   it, the refusal (403) everywhere else, and the sign-in page when no one is signed in.

   The addresses are every sample of the access fixture frozen before NAV-B moved anything
   (src/constants/__pinned__/access-before-nav-b.json); as screens move, the new addresses join
   them. What each viewer should get is computed from the View catalogue and their grant. */

const FIXTURE = JSON.parse(readFileSync(new URL("../../src/constants/__pinned__/access-before-nav-b.json", import.meta.url), "utf8")) as { addresses: string[] };
/** Each frozen address where it is now (the redirect itself is old-addresses.spec.ts's). */
const ADDRESSES = FIXTURE.addresses.map((address) => destinationOf(address) ?? address);

type Person = (typeof TEST_PEOPLE)[keyof typeof TEST_PEOPLE] & { totpSecret: string };

function grantOf(person: Person) {
  const organization = TENANT_ORGANIZATIONS.find((one) => one.id === person.organizationId)!;
  return grantFor(organization.sectors, person.screens, person.role === "admin");
}

async function signIn(page: Page, person: Person) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  await page.getByLabel(/^Code/).fill(totpCode(person.totpSecret, Date.now()));
  await page.getByRole("button", { name: /Sign in|Finish/ }).click();
  // Someone whose grant opens no screen is told so at /login/continue (Phase 8A); everyone else lands in the dashboard.
  await expect(page).toHaveURL(person.screens !== null && person.screens.length === 0 ? /\/login\/continue/ : /\/dashboard/);
}

/** Every address, asked for directly: open where the grant opens it, 403 everywhere else. */
async function answersExactly(request: APIRequestContext, person: Person) {
  const grant = grantOf(person);
  const wrong: string[] = [];
  for (const address of ADDRESSES) {
    const response = await request.get(address, { maxRedirects: 0 });
    const open = canOpen(grant, address);
    const status = response.status();
    // Open: the page, a redirect it makes itself (a report to its default period), or "not found" from the page (People
    // answers it to anyone but an administrator). Refused: 403 and the refusal page.
    // An address that is no view (a page NAV-B removed) is not found for everyone.
    const ok = !resolves(address) ? status === 404 : open ? status !== 403 && status < 500 : status === 403;
    if (!ok) wrong.push(`${address}: ${!resolves(address) ? "should be not found" : open ? "should open" : "should be refused"}, answered ${status}`);
  }
  expect(wrong, person.email).toEqual([]);
}

test.describe.configure({ timeout: 600_000 });

test("an unauthenticated visitor gets the sign-in page at every address, and no page", async ({ request }) => {
  for (const address of ADDRESSES) {
    const response = await request.get(address, { maxRedirects: 0 });
    expect(response.status(), address).toBe(307);
    expect(response.headers().location, address).toBe(`/login?next=${encodeURIComponent(address)}`);
  }
});

test("a member with no grants opens only what every viewer may, and is refused everything else", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.discoNone);
  await answersExactly(page.request, TEST_PEOPLE.discoNone);
});

test("a member with a partial grant (the revenue department) opens exactly its views", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.discoRevenue);
  await answersExactly(page.request, TEST_PEOPLE.discoRevenue);
});

test("the DisCo's administrator opens every view of its domains and People, and none of the mini-grid operator's", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.discoAdmin);
  await answersExactly(page.request, TEST_PEOPLE.discoAdmin);
});

test("the mini-grid operator's administrator opens every view of its domain, and none of the DisCo's", async ({ page }) => {
  await signIn(page, TEST_PEOPLE.minigridAdmin);
  await answersExactly(page.request, TEST_PEOPLE.minigridAdmin);
});
