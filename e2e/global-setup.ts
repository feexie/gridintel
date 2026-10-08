import type { FullConfig } from "@playwright/test";
import { REQUEST_BASE, ROUTES } from "./routes";

/* Before the tests: ask each server for every route once, so that no test pays for loading a
   route's code. On the ordinary build the network screens are files and are there from the
   start. The request build computes its screens at start-up and answers with a "preparing
   data" page until it has (readiness.spec.ts covers that on a server of its own), so it is
   asked only once it says it is ready. The page-time budget is measured separately, after the
   tests, in timing.spec.ts. */

const READY_TIMEOUT_MS = 90_000;

export default async function globalSetup(config: FullConfig): Promise<void> {
  for (const baseURL of [config.projects[0].use.baseURL as string, REQUEST_BASE]) {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      const ready = await fetch(`${baseURL}/api/ready`);
      if (ready.ok) break;
      if (Date.now() > deadline) throw new Error(`${baseURL} was not ready after ${READY_TIMEOUT_MS / 1000} s: ${await ready.text()}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    for (const route of ROUTES) {
      const response = await fetch(`${baseURL}${route}`);
      if (!response.ok) throw new Error(`${baseURL}${route} answered ${response.status} before the tests started`);
    }
  }
}
