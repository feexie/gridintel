import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { ROUTES } from "./routes";

/* The page-time budget: every route answers within 500 ms, as the MEDIAN OF FIVE requests,
   once the server has warmed. This project runs after all the others, on its own, so no other
   test is using the server while it measures. The medians are written to
   test-results/timings.json for the checkpoint report. */

const BUDGET_MS = 500;

test("every route answers within the budget, median of five", async ({ request }) => {
  test.setTimeout(120_000);
  // The first request to a route also loads its code; the budget is for the screen itself.
  for (const route of ROUTES) await request.get(route);

  const medians: Record<string, number> = {};
  for (const route of ROUTES) {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      const response = await request.get(route);
      expect(response.ok(), route).toBe(true);
      times.push(performance.now() - started);
    }
    medians[route] = Math.round(times.sort((a, b) => a - b)[2]);
  }

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/timings.json", JSON.stringify(medians, null, 2));
  for (const [route, median] of Object.entries(medians)) {
    expect(median, `${route}: median of five was ${median} ms`).toBeLessThan(BUDGET_MS);
  }
});
