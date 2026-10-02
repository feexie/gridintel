import { defineConfig, devices } from "@playwright/test";

/* Browser tests for flows the unit tests cannot see: what a screen actually shows.
   They run against the production build, so run `npm run build` first. */

const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
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
