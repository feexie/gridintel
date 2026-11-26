import { expect, test } from "@playwright/test";
import { destinationOf } from "../src/constants/moves";
import { viewAt } from "../src/constants/views";
import { LOCAL, REQUEST_BASE } from "./routes";

/* NAV-B plan, section 7 (Founder's answer 6, 25 November 2026): the 21 addresses in the GEH
   material (docs/geh/BRIEF-15.md and e2e/record-demo.ts as they stood at the baseline, 8445269)
   are walked one by one, on the public demonstration's two builds, with and without
   ?present=1. Each follows its redirect to the screen it names today, which answers, shows its
   heading, keeps the query, and is in presentation mode when asked. "/dashboard" keeps its
   address and is Home now (answer 7), with its link to the Platform Overview. */

const GEH = [
  "/dashboard",
  "/dashboard/planning",
  "/dashboard/planning/metering",
  "/dashboard/planning/metering/marketplace",
  "/dashboard/planning/metering/journey",
  "/dashboard/planning/metering/report",
  "/dashboard/planning/about-this-build",
  "/dashboard/planning/dt",
  "/dashboard/planning/e-mobility",
  "/dashboard/planning/feeders",
  "/dashboard/planning/network-expansion",
  "/dashboard/planning/pue",
  "/dashboard/planning/underserved",
  "/dashboard/planning/unserved",
  "/dashboard/utility/executive",
  "/dashboard/utility/map",
  "/dashboard/utility/reliability",
  "/dashboard/utility/revenue",
  "/dashboard/utility/reports",
  "/dashboard/utility/reports/reliability/2026-09",
  "/dashboard/minigrid/sites/MG-TAM",
];

const builds: [string, string][] = [["built ahead", ""], ...(LOCAL ? [] : ([["on request", REQUEST_BASE]] as [string, string][]))];

test.describe.configure({ timeout: 600_000 });

test("the GEH material names 21 addresses, each but Home moved by NAV-B", () => {
  expect(GEH).toHaveLength(21);
  for (const address of GEH) expect(destinationOf(address) === null, address).toBe(address === "/dashboard");
});

for (const [build, base] of builds) {
  test(`every GEH address opens the screen it names, with and without ?present=1 (${build})`, async ({ page }) => {
    for (const address of GEH) {
      const expected = (destinationOf(address) ?? address).split("?")[0];
      for (const query of ["", "?present=1"]) {
        const response = await page.goto(`${base}${address}${query}`);
        const where = `${address}${query}`;
        expect(response?.status(), where).toBe(200);
        const landed = new URL(page.url());
        // The screen it names: the same view (a report may go on to its period, as it always did).
        expect(viewAt(landed.pathname)?.id, where).toBe(viewAt(expected)?.id);
        // Its heading (the map screens keep theirs for screen readers, under the map).
        await expect(page.locator("main h1").first(), where).toBeAttached();
        if (query !== "") {
          expect(landed.searchParams.get("present"), where).toBe("1");
          const frame = page.locator("[data-present-frame]");
          if ((await frame.count()) > 0) await expect(frame.first(), where).toHaveAttribute("data-present-frame", "on");
        }
      }
    }
    // Home is where /dashboard leads, with its clear way to the former Platform Overview.
    await page.goto(`${base}/dashboard`);
    await expect(page.locator("[data-platform-overview-link] a")).toHaveAttribute("href", "/dashboard/intelligence");
  });
}
