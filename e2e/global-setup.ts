import type { FullConfig } from "@playwright/test";
import { ROUTES } from "./routes";

/* The server computes its screens once at start-up. Until it has, a data route answers with a
   "preparing data" page, which is not what these tests are about (readiness.spec.ts covers it
   on a server of its own). So the tests wait here until the server says it is ready, and then
   ask for each route once, so that no test pays for loading a route's code. The page-time
   budget is measured separately, after the tests, in timing.spec.ts. */

const READY_TIMEOUT_MS = 90_000;

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const ready = await fetch(`${baseURL}/api/ready`);
    if (ready.ok) break;
    if (Date.now() > deadline) throw new Error(`The server was not ready after ${READY_TIMEOUT_MS / 1000} s: ${await ready.text()}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  for (const route of ROUTES) {
    const response = await fetch(`${baseURL}${route}`);
    if (!response.ok) throw new Error(`${route} answered ${response.status} before the tests started`);
  }
}
