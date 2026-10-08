import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { REQUEST_BASE, ROUTES } from "./routes";

/* The page-time budget: every route answers within 500 ms, as the MEDIAN OF FIVE requests,
   once the server has warmed. It is held on both builds: on the request build it is a budget
   for the engine, which renders each screen from its result cache; on the ordinary build the
   network screens are files and it is a budget for serving them. This project runs after all
   the others, on its own, so no other test is using the servers while it measures. The medians
   are written to test-results/timings.json for the checkpoint report. */

const BUDGET_MS = 500;

test("every route answers within the budget on both builds, median of five", async ({ request, baseURL }) => {
  test.setTimeout(240_000);
  const medians: Record<string, Record<string, number>> = {};
  for (const [build, base] of [["built ahead", baseURL as string], ["on request", REQUEST_BASE]] as const) {
    // The first request to a route also loads its code; the budget is for the screen itself.
    for (const route of ROUTES) await request.get(`${base}${route}`);
    medians[build] = {};
    for (const route of ROUTES) {
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const started = performance.now();
        const response = await request.get(`${base}${route}`);
        expect(response.ok(), `${build}: ${route}`).toBe(true);
        times.push(performance.now() - started);
      }
      medians[build][route] = Math.round(times.sort((a, b) => a - b)[2]);
    }
  }

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/timings.json", JSON.stringify(medians, null, 2));
  for (const [build, routes] of Object.entries(medians)) {
    for (const [route, median] of Object.entries(routes)) {
      expect(median, `${build}: ${route}: median of five was ${median} ms`).toBeLessThan(BUDGET_MS);
    }
  }
});
