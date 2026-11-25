import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { destinationOf } from "../src/constants/moves";

/* NAV-B safeguard A, by direct URL request, for the public demonstration's one viewer (Founder,
   25 November 2026): the public viewer holds every screen, so every address of the frozen access
   fixture opens; nothing is refused. There are no accounts: no sign-in page and no People
   screen (ADR 0020), which answer "not found". An address that is no view is "not found" too. */

const FIXTURE = JSON.parse(readFileSync(new URL("../src/constants/__pinned__/access-before-nav-b.json", import.meta.url), "utf8")) as { addresses: string[] };
const NO_ACCOUNTS = ["/dashboard/settings/people"];

test.describe.configure({ timeout: 600_000 });

test("the public viewer opens every address directly, and is refused none", async ({ request }) => {
  const wrong: string[] = [];
  for (const old of FIXTURE.addresses) {
    // Where the address is now: its new address when it moved (the redirect itself is old-addresses.spec.ts's).
    const address = destinationOf(old) ?? old;
    const status = (await request.get(address, { maxRedirects: 0 })).status();
    const ok = NO_ACCOUNTS.includes(address) ? status === 404 : status !== 403 && status !== 404 && status < 500;
    if (!ok) wrong.push(`${address}: answered ${status}`);
  }
  expect(wrong).toEqual([]);
});

test("an address that is no view is answered not found, not opened and not refused", async ({ request }) => {
  for (const address of ["/dashboard/no-such-screen", "/dashboard/intelligence/utility/no-such-screen", "/dashboard/planning/no-such-planner"]) {
    expect((await request.get(address)).status(), address).toBe(404);
  }
});
