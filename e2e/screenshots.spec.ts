import { test } from "@playwright/test";

/* Not a test: captures screenshots for checkpoint reports.
   Run with: SCREENSHOTS=docs/screenshots/<phase> npx playwright test screenshots */

const target = process.env.SCREENSHOTS;
const OPERATIONS = "/dashboard/utility/operations";
const SHOTS: [string, string][] = [
  ["executive", "/dashboard/utility/executive"],
  ["reliability", "/dashboard/utility/reliability"],
  ["revenue", "/dashboard/utility/revenue"],
  ["assets", "/dashboard/utility/assets"],
  ["events", "/dashboard/utility/events"],
  ["not-found", "/no-such-page"],
  ["utility-hub", "/dashboard/utility"],
  ["operations", OPERATIONS],
  ["region", `${OPERATIONS}/regions/demo-region-northfield`],
  ["substation", `${OPERATIONS}/substations/SS-RIV`],
  ["substation-hillcrest", `${OPERATIONS}/substations/SS-HIL`],
  ["feeder-market-road", `${OPERATIONS}/feeders/FD-MKT`],
  ["feeder-old-town", `${OPERATIONS}/feeders/FD-OLD`],
  ["feeder-government-avenue", `${OPERATIONS}/feeders/FD-GOV`],
  ["feeder-farm-road", `${OPERATIONS}/feeders/FD-FRM`],
  ["transformer-riverbank", `${OPERATIONS}/transformers/DT-OLD-2`],
  ["transformer-hilltop-close", `${OPERATIONS}/transformers/DT-MKT-3`],
  ["service-point", `${OPERATIONS}/service-points/SP-OLD2-002`],
  ["service-point-prepaid", `${OPERATIONS}/service-points/SP-OLD2-004`],
  ["service-point-register-reading", `${OPERATIONS}/service-points/SP-OLD2-001`],
  ["service-point-estimated-reading", `${OPERATIONS}/service-points/SP-OLD2-005`],
  ["service-point-reading-outside-window", `${OPERATIONS}/service-points/SP-OLD6-022`],
  ["service-point-ami", `${OPERATIONS}/service-points/SP-MKT2-005`],
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
