import type { FullConfig } from "@playwright/test";
import { ROUTES } from "./routes";

/* The server computes its screens once at start-up, and a request that arrives while it is
   doing so waits for it. That wait is several seconds, longer than a browser assertion allows,
   so a test that happened to start first used to fail now and then. Each route is therefore
   asked for once before any test runs. The page-time budget is measured separately, after the
   tests, in timing.spec.ts. */

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  for (const route of ROUTES) {
    const response = await fetch(`${baseURL}${route}`);
    if (!response.ok) throw new Error(`${route} answered ${response.status} before the tests started`);
  }
}
