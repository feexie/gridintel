import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { destinationOf, ELSEWHERE, MOVES } from "../src/constants/moves";
import { viewAt } from "../src/constants/views";
import { LOCAL, REQUEST_BASE } from "./routes";

/* NAV-B safeguard B, redirect integrity (Founder, 25 November 2026), on the public
   demonstration's two builds: the ordinary one (screens built ahead of time) and the one that
   renders on request. The tenant's build has its own (tenant/old-addresses.spec.ts).

   Every legacy address that moved, with real ids (each sample of the access fixture frozen
   before NAV-B moved anything):
   - answers 308 with its new address, the rest of the address carried;
   - carries the query (?present=1 and any other);
   - reaches its page in that one step: the new address is not itself redirected by a move. */

const FIXTURE = JSON.parse(readFileSync(new URL("../src/constants/__pinned__/access-before-nav-b.json", import.meta.url), "utf8")) as { addresses: string[] };
/** The prototype's /preview addresses (NAV-B step 7), each with real values. */
const PREVIEW = ELSEWHERE.map((row) => row.from.replace(":initiative", "meter-every-customer").replace(":role", "customer"));
const MOVED = [...FIXTURE.addresses.filter((address) => destinationOf(address) !== null), ...PREVIEW];
const QUERY = "present=1&keep=this";

const builds: [string, string | undefined][] = [["built ahead", undefined], ...(LOCAL ? [] : ([["on request", REQUEST_BASE]] as [string, string][]))];

/** The Location of a redirect, as an address on the same server. */
const located = (location: string | undefined) => {
  const url = new URL(location ?? "", "http://x");
  return `${url.pathname}${url.search}`;
};

async function walk(request: APIRequestContext, base: string) {
  const wrong: string[] = [];
  for (const old of MOVED) {
    for (const address of [old, `${old}?${QUERY}`]) {
      const expected = destinationOf(address)!;
      const response = await request.get(`${base}${address}`, { maxRedirects: 0 });
      if (response.status() !== 308) {
        wrong.push(`${address}: answered ${response.status()}, not 308`);
        continue;
      }
      const to = located(response.headers().location);
      if (to !== expected) wrong.push(`${address}: led to ${to}, not ${expected}`);
      const landed = await request.get(`${base}${to}`, { maxRedirects: 0 });
      // One step: the page itself (a report may still send a bare address on to its default period, the page's own redirect).
      // People answers "not found" on the public demonstration, which has no accounts (ADR 0020).
      const noAccounts = viewAt(to.split("?")[0])?.id === "platform.people";
      if (landed.status() === 308) wrong.push(`${address}: ${to} is itself redirected (a chain)`);
      else if (noAccounts ? landed.status() !== 404 : landed.status() >= 400) wrong.push(`${address}: ${to} answered ${landed.status()}`);
    }
  }
  return wrong;
}

test.describe.configure({ timeout: 600_000 });

for (const [build, base] of builds) {
  test(`every moved address answers 308 to its new one, query carried, in one step (${build})`, async ({ request, baseURL }) => {
    expect(MOVED.length).toBeGreaterThan(0);
    expect(await walk(request, base ?? (baseURL as string))).toEqual([]);
  });
}

test("no move leads to an address another move redirects", () => {
  for (const move of MOVES) {
    const to = destinationOf(move.from)!;
    expect(destinationOf(to), `${move.from} → ${to}`).toBeNull();
  }
});
