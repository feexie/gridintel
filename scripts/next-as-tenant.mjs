/* Runs `next <arguments>` as a tenant deployment (GRIDINTEL_MODE=tenant, ADR 0020), built into
   .next-tenant, with the in-memory identity adapter: the build and server the tenant browser
   tests run against (playwright.tenant.config.ts). A tenant deployment on Vercel is built with
   GRIDINTEL_MODE=tenant alone, into .next, and signs in through Supabase.

     node scripts/next-as-tenant.mjs build
     node scripts/next-as-tenant.mjs start -p 3214 */

import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, GRIDINTEL_MODE: "tenant", GRIDINTEL_DIST_DIR: ".next-tenant", GRIDINTEL_AUTH: "memory", GRIDINTEL_E2E_HTTP: "1" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
