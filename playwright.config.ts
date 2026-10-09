import { defineConfig, devices } from "@playwright/test";
import { BUILT_PORT, REQUEST_PORT } from "./e2e/routes";

/* Browser tests for flows the unit tests cannot see: what a screen actually shows.

   They run against two production builds of the same application (ADR 0012), so run
   `npm run build:request` and `npm run build` first, as `npm run verify` does:

   - the ordinary build, where the dataset is fixed and the network screens are built ahead of
     time. Every test of what a screen shows runs against this one;
   - the request build, where every data screen is rendered on request behind the warm-up.
     The readiness test and the page-time budget run against this one, so that the path a real
     adapter will take stays tested. */

export default defineConfig({
  testDir: "./e2e",
  // Asks for every route once, so no test pays for loading a route's code.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // One worker on a developer's machine, to keep memory down beside two servers; the default in CI.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // A navigation can take longer than the default 5 s on a busy machine. How fast a page
  // answers is held to its own budget in timing.spec.ts; these tests are about what it shows.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${BUILT_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: /timing\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1500, height: 900 } } },
    // Page timings are measured last and alone, so no other test is loading the servers.
    { name: "timing", testMatch: /timing\.spec\.ts/, dependencies: ["chromium"] },
  ],
  webServer: [
    {
      command: `npx next start -p ${BUILT_PORT}`,
      url: `http://localhost:${BUILT_PORT}/dashboard`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${REQUEST_PORT}`,
      env: { GRIDINTEL_RENDER: "request" },
      // Answers 200 only once the warm-up has finished.
      url: `http://localhost:${REQUEST_PORT}/api/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
