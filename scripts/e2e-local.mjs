/* Runs the browser tests against the ordinary build only (GRIDINTEL_E2E=local), on one worker:
   the lighter check for a machine short of memory. The request build, the readiness tests that
   start servers of their own, and the page-time budget are left to the full `npm run verify`,
   which CI runs on every push.

     node scripts/e2e-local.mjs [playwright arguments] */

import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--workers=1", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, GRIDINTEL_E2E: "local" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
