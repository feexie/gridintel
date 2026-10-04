import { defineConfig, devices } from "@playwright/test";

/* Browser tests for flows the unit tests cannot see: what a screen actually shows.
   They run against the production build, so run `npm run build` first. */

const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  // Asks for every route once, so no test races the server's start-up warm-up.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // A navigation can take longer than the default 5 s on a busy machine. How fast a page
  // answers is held to its own budget in timing.spec.ts; these tests are about what it shows.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: /timing\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1500, height: 900 } } },
    // Page timings are measured last and alone, so no other test is loading the server.
    { name: "timing", testMatch: /timing\.spec\.ts/, dependencies: ["chromium"] },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
