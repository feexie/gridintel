/* Runs `next <arguments>` with GRIDINTEL_RENDER=request: every data screen rendered on request,
   built into .next-request. Used to build and serve the request path beside the ordinary
   build, so that both stay tested (ADR 0012).

     node scripts/next-on-request.mjs build
     node scripts/next-on-request.mjs start -p 3212 */

import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, GRIDINTEL_RENDER: "request" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
