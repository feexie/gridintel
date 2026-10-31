import { defineConfig, devices } from "@playwright/test";
import { TENANT_PORT } from "./e2e/routes";

/* Browser tests of a tenant deployment (Phase 8A, ADR 0020): signing in with a password and a
   code, two organizations that never see each other's records, grants held where data is read,
   and links cut to the grant. They run against the tenant build (`npm run build:tenant`), served
   with the in-memory identity adapter and its seeded test people.

   A fresh server every run: the tests sign people in, enrol authenticator apps and invite
   people, and the in-memory store is the server's own. */

export default defineConfig({
  testDir: "./e2e/tenant",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${TENANT_PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1500, height: 900 },
  },
  webServer: {
    command: `node scripts/next-as-tenant.mjs start -p ${TENANT_PORT}`,
    // Answers 200 only once the warm-up has computed each organization's screens.
    url: `http://localhost:${TENANT_PORT}/api/ready`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
