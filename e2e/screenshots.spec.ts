import { test } from "@playwright/test";

/* Not a test: captures screenshots for checkpoint reports.
   Run with: SCREENSHOTS=docs/screenshots/<phase> npx playwright test screenshots */

const target = process.env.SCREENSHOTS;
const OPERATIONS = "/dashboard/utility/operations";
const SHOTS: [string, string][] = [
  ["executive", "/dashboard/utility/executive"],
  ["operations", OPERATIONS],
  ["region", `${OPERATIONS}/regions/demo-region-northfield`],
  ["substation", `${OPERATIONS}/substations/SS-RIV`],
  ["feeder-market-road", `${OPERATIONS}/feeders/FD-MKT`],
  ["feeder-old-town", `${OPERATIONS}/feeders/FD-OLD`],
  ["transformer-riverbank", `${OPERATIONS}/transformers/DT-OLD-2`],
  ["service-point", `${OPERATIONS}/service-points/SP-OLD2-002`],
];

test.describe("screenshots", () => {
  test.skip(!target, "set SCREENSHOTS to a folder to capture");
  for (const [name, route] of SHOTS) {
    test(name, async ({ page }) => {
      await page.goto(route);
      // The page scrolls inside <main>; size the window to its content so one image shows it all.
      const height = await page.evaluate(() => (document.querySelector("main")?.scrollHeight ?? 800) + 120);
      await page.setViewportSize({ width: 1500, height: Math.min(Math.max(height, 700), 6000) });
      await page.screenshot({ path: `${target}/${name}.png` });
    });
  }
});
