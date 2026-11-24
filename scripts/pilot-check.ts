/* Checks a pilot's setup (Phase 8A, ADR 0020; docs/PILOT_SETUP.md). It only reads: it writes
   nothing to the Supabase project and changes nothing on either deployment.

   Run on your own machine, with the project's settings in .env.local (never committed):

     node --env-file=.env.local scripts/pilot-check.ts [demo-address] [tenant-address]

   e.g. node --env-file=.env.local scripts/pilot-check.ts https://gridintel-iota.vercel.app https://gridintel-pilot.vercel.app

   It prints PASS, FAIL or NOT CHECKED for each item, and exits with 1 if any item failed. */

import { demoVerdict, tenantVerdict } from "./pilot-check-outcomes.ts";

const [demoAddress, tenantAddress] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const ORGANIZATIONS = ["demo-disco", "demo-minigrid-operator"];
// Row-level security on each table, and the policies 0001_identity.sql makes for it.
const TABLES: Record<string, number> = { organizations: 1, memberships: 2, heartbeat: 0 };

let failed = false;
function report(outcome: "PASS" | "FAIL" | "NOT CHECKED", item: string, detail: string): void {
  if (outcome === "FAIL") failed = true;
  console.log(`${outcome.padEnd(11)}  ${item}: ${detail}`);
}

async function json(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

if (!url || !publishableKey || !secretKey) {
  console.error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set (in .env.local).");
  process.exit(2);
}
const rest = (path: string) => new URL(`/rest/v1/${path}`, url);
const asPlatform = { apikey: secretKey, "Content-Type": "application/json" };

// 1. The migration ran: the tables are there, row-level security is on, and their policies exist.
{
  const response = await fetch(rest("rpc/gridintel_setup_report"), { method: "POST", headers: asPlatform, body: "{}" });
  const body = await json(response);
  if (!response.ok) {
    report("FAIL", "Migration", `the setup report could not be read (HTTP ${response.status}): run supabase/migrations/0001_identity.sql in the SQL editor. ${JSON.stringify(body)}`);
  } else {
    const tables = body as Record<string, { rls: boolean; policies: number }>;
    for (const [table, policies] of Object.entries(TABLES)) {
      const found = tables[table];
      if (found === undefined) report("FAIL", `Table ${table}`, "missing");
      else if (!found.rls) report("FAIL", `Table ${table}`, "row-level security is off");
      else if (found.policies !== policies) report("FAIL", `Table ${table}`, `row-level security on, but ${found.policies} policies where ${policies} were expected`);
      else report("PASS", `Table ${table}`, `present, row-level security on, ${policies} ${policies === 1 ? "policy" : "policies"}`);
    }
  }
}

// 2. The two organizations are present.
{
  const response = await fetch(rest("organizations?select=id,synthetic"), { headers: asPlatform });
  const body = await json(response);
  if (!response.ok || !Array.isArray(body)) {
    report("FAIL", "Organizations", `could not be read (HTTP ${response.status}). ${JSON.stringify(body)}`);
  } else {
    const rows = body as { id: string; synthetic: boolean }[];
    for (const id of ORGANIZATIONS) {
      const row = rows.find((one) => one.id === id);
      if (row === undefined) report("FAIL", `Organization ${id}`, "missing");
      else report("PASS", `Organization ${id}`, row.synthetic ? "present, marked synthetic" : "present (not marked synthetic)");
    }
  }
}

// 3. Someone not signed in reads nothing, with the key every browser could hold.
for (const table of ["organizations", "memberships"]) {
  const response = await fetch(rest(`${table}?select=*&limit=1`), { headers: { apikey: publishableKey } });
  const body = await json(response);
  if (!response.ok) report("PASS", `Anonymous read of ${table}`, `refused (HTTP ${response.status})`);
  else if (Array.isArray(body) && body.length === 0) report("PASS", `Anonymous read of ${table}`, "answered with no rows");
  else report("FAIL", `Anonymous read of ${table}`, "answered with rows: the grants or row-level security are wrong");
}

// 4. Sign-up is off. The project's public auth settings say so.
{
  const response = await fetch(new URL("/auth/v1/settings", url), { headers: { apikey: publishableKey } });
  const body = await json(response);
  const settings = (typeof body === "object" && body !== null ? body : {}) as { disable_signup?: unknown };
  if (!response.ok || typeof settings.disable_signup !== "boolean") report("NOT CHECKED", "Sign-up", `the auth settings could not be read (HTTP ${response.status})`);
  else if (settings.disable_signup) report("PASS", "Sign-up", "off");
  else report("FAIL", "Sign-up", 'on: turn off "Allow new users to sign up" (Authentication > Sign In / Providers)');
}

// 5. The public demonstration holds no secret. Its environment cannot be read from here, but a
//    demonstration with SUPABASE_SECRET_KEY set refuses every request with 503 (composition/mode.ts).
//    It is asked for /dashboard: its / only redirects there.
// 6. The tenant deployment was built as one and asks who is signed in.
const deployments = [
  { item: "Demo holds no secret", address: demoAddress, judge: demoVerdict },
  { item: "Tenant asks for sign-in", address: tenantAddress, judge: tenantVerdict },
];
for (const { item, address, judge } of deployments) {
  if (!address) {
    report("NOT CHECKED", item, `no ${item.startsWith("Demo") ? "demo" : "tenant"} address given`);
    continue;
  }
  const response = await fetch(new URL("/dashboard", address), { redirect: "manual" });
  const { outcome, detail } = judge({ status: response.status, location: response.headers.get("location") ?? "" }, address);
  report(outcome, item, detail);
}

console.log(failed ? "\nSome items failed." : "\nNo item failed.");
process.exit(failed ? 1 : 0);
