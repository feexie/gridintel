import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { TENANT_ORGANIZATIONS, TEST_PEOPLE } from "../../src/composition/identityFixture";
import { canOpen, grantFor } from "../../src/constants/access";
import { destinationOf, ELSEWHERE } from "../../src/constants/moves";
import { totpCode } from "../../src/repositories/memory/totp";

/* NAV-B safeguard B on a tenant deployment (Founder, 25 November 2026): every legacy address
   that moved answers 308 with its new one before anyone is asked to sign in, the query carried;
   and access still applies after the redirect. The new address asks someone not signed in to
   sign in, and refuses a view a grant does not hold, exactly as a direct visit would. */

const FIXTURE = JSON.parse(readFileSync(new URL("../../src/constants/__pinned__/access-before-nav-b.json", import.meta.url), "utf8")) as { addresses: string[] };
/** The prototype's /preview workspace addresses (NAV-B step 7) lead into the dashboard here too; ?workspace= is then ignored (safeguard C). */
const PREVIEW = ELSEWHERE.filter((row) => row.to.startsWith("/dashboard")).map((row) => row.from.replace(":initiative", "meter-every-customer").replace(":role", "customer"));
const MOVED = [...FIXTURE.addresses.filter((address) => destinationOf(address) !== null), ...PREVIEW];

const located = (location: string | undefined) => {
  const url = new URL(location ?? "", "http://x");
  return `${url.pathname}${url.search}`;
};

/** True when two addresses are the same page with the same query, whatever the order of its parameters
    (a redirect puts the carried query first and the destination's own ?workspace= after it). */
const same = (a: string, b: string) => {
  const [x, y] = [new URL(a, "http://x"), new URL(b, "http://x")];
  const params = (url: URL) => [...url.searchParams].map(([key, value]) => `${key}=${value}`).sort().join("&");
  return x.pathname === y.pathname && params(x) === params(y);
};

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

test.describe.configure({ timeout: 600_000 });

test("someone not signed in: every moved address answers 308 to its new one, query carried, and the new one asks for sign-in", async ({ request }) => {
  const wrong: string[] = [];
  for (const old of MOVED) {
    const address = `${old}?present=1`;
    const first = await request.get(address, { maxRedirects: 0 });
    const to = located(first.headers().location);
    if (first.status() !== 308 || !same(to, destinationOf(address)!)) wrong.push(`${address}: ${first.status()} to ${to}`);
    const second = await request.get(to, { maxRedirects: 0 });
    if (second.status() !== 307 || !located(second.headers().location).startsWith("/login?next=")) wrong.push(`${to}: ${second.status()}, not the sign-in page`);
  }
  expect(wrong).toEqual([]);
});

test("the revenue member, after each redirect, gets exactly what a direct visit gives: its views open, the rest refused", async ({ page }) => {
  const person = TEST_PEOPLE.discoRevenue;
  await signIn(page, person);
  const organization = TENANT_ORGANIZATIONS.find((one) => one.id === person.organizationId)!;
  const grant = grantFor(organization.sectors, person.screens, false);
  const wrong: string[] = [];
  for (const old of MOVED) {
    const response = await page.request.get(old);
    const open = canOpen(grant, destinationOf(old)!);
    const status = response.status();
    if (open ? status === 403 || status >= 500 : status !== 403) wrong.push(`${old}: ${open ? "should open" : "should be refused"}, answered ${status} at ${response.url()}`);
  }
  expect(wrong).toEqual([]);
});
