import { test } from "@playwright/test";

/* Not a test: captures screenshots for checkpoint reports.
   Run with: SCREENSHOTS=docs/screenshots/<phase> npx playwright test screenshots
   One module's screens only: add -g <part of their names>, e.g. -g minigrid
   The folder is not committed (.gitignore): the files are attached to the phase's GitHub release. */

const target = process.env.SCREENSHOTS;
const OPERATIONS = "/dashboard/intelligence/utility/operations";
const SHOTS: [string, string][] = [
  // NAV-B: the public layer at "/", Home, the Platform Overview under Intelligence, each demo workspace.
  ["public-home", "/"],
  ["public-initiative", "/initiatives/meter-every-customer"],
  ["public-take-part", "/initiatives/meter-every-customer/take-part"],
  ["public-apply-for-a-meter", "/initiatives/meter-every-customer/take-part/customer"],
  ["home-utility", "/dashboard?workspace=utility"],
  ["home-minigrid", "/dashboard?workspace=minigrid"],
  ["home-der", "/dashboard?workspace=der"],
  ["home-financier", "/dashboard?workspace=financier"],
  ["home-regulator", "/dashboard?workspace=regulator"],
  ["initiative-in-workspace", "/dashboard/initiatives/meter-every-customer?workspace=utility"],
  ["plan", "/dashboard/plan?workspace=utility"],
  ["finance-metering-fund", "/dashboard/finance/metering-fund?workspace=utility"],
  ["oversight-monitoring", "/dashboard/oversight/monitoring?workspace=regulator"],
  ["about-this-build", "/dashboard/about-this-build"],
  ["platform-overview", "/dashboard/intelligence"],
  ["utility-overview", "/dashboard/intelligence/utility"],
  ["utility-map", "/dashboard/intelligence/utility/map"],
  ["utility-assistant-planned", "/dashboard/intelligence/utility/ai"],
  ["minigrid-overview", "/dashboard/intelligence/minigrid"],
  ["minigrid-map", "/dashboard/intelligence/minigrid/map"],
  ["executive", "/dashboard/intelligence/utility/executive"],
  ["reliability", "/dashboard/intelligence/utility/reliability"],
  ["revenue", "/dashboard/intelligence/utility/revenue"],
  ["assets", "/dashboard/intelligence/utility/assets"],
  ["events", "/dashboard/intelligence/utility/events"],
  ["not-found", "/no-such-page"],
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
  ["minigrid-portfolio", "/dashboard/intelligence/minigrid/sites"],
  ["minigrid-site-dry-river", "/dashboard/intelligence/minigrid/sites/MG-DRY"],
  ["minigrid-site-granite-hill", "/dashboard/intelligence/minigrid/sites/MG-GRN"],
  ["minigrid-site-palm-landing", "/dashboard/intelligence/minigrid/sites/MG-PLM"],
  ["minigrid-site-tamarind-cross", "/dashboard/intelligence/minigrid/sites/MG-TAM"],
  ["reports-utility", "/dashboard/reports/utility"],
  ["reports-minigrid", "/dashboard/reports/minigrid"],
  ["report-reliability-month", "/dashboard/reports/utility/reliability/2026-09"],
  ["report-reliability-day", "/dashboard/reports/utility/reliability/2026-09-14"],
  ["report-reliability-year-not-available", "/dashboard/reports/utility/reliability/2026"],
  ["report-compliance-month", "/dashboard/reports/minigrid/compliance/2026-09"],
  ["report-compliance-day", "/dashboard/reports/minigrid/compliance/2026-09-14"],
  ["report-operations-month", "/dashboard/reports/utility/operations/2026-09"],
  ["report-operations-day", "/dashboard/reports/utility/operations/2026-09-14"],
  ["report-daily-brief-day", "/dashboard/reports/utility/daily-brief/2026-09-14"],
  ["report-daily-brief-last-day", "/dashboard/reports/utility/daily-brief/2026-09-30"],
  ["report-daily-brief-month-not-available", "/dashboard/reports/utility/daily-brief/2026-09"],
  ["report-site-performance-month", "/dashboard/reports/minigrid/site-performance/2026-09"],
  ["report-site-performance-day", "/dashboard/reports/minigrid/site-performance/2026-09-14"],
];

/** Reports printed to PDF by the browser's own print, as "Save as PDF" does. */
const PDFS: [string, string][] = [
  ["report-reliability-2026-09", "/dashboard/reports/utility/reliability/2026-09"],
  ["report-reliability-2026-09-14", "/dashboard/reports/utility/reliability/2026-09-14"],
  ["report-compliance-2026-09", "/dashboard/reports/minigrid/compliance/2026-09"],
  ["report-compliance-2026-09-14", "/dashboard/reports/minigrid/compliance/2026-09-14"],
  ["report-operations-2026-09", "/dashboard/reports/utility/operations/2026-09"],
  ["report-operations-2026-09-14", "/dashboard/reports/utility/operations/2026-09-14"],
  ["report-daily-brief-2026-09-14", "/dashboard/reports/utility/daily-brief/2026-09-14"],
  ["report-daily-brief-2026-09-30", "/dashboard/reports/utility/daily-brief/2026-09-30"],
  ["report-site-performance-2026-09", "/dashboard/reports/minigrid/site-performance/2026-09"],
  ["report-site-performance-2026-09-14", "/dashboard/reports/minigrid/site-performance/2026-09-14"],
];

/** Screens also captured at the width of a phone: every screen but the page for an unknown address. */
const PHONE = SHOTS.map(([name]) => name).filter((name) => name !== "not-found");

test.describe("screenshots", () => {
  test.skip(!target, "set SCREENSHOTS to a folder to capture");
  // The map with an asset selected, the district totals on and the open fault marked.
  test("map-trace", async ({ page }) => {
    await page.goto("/dashboard/intelligence/utility/map");
    await page.locator(".leaflet-container path.gi-point").first().waitFor();
    await page.locator("[data-select-asset]").selectOption("distribution_transformer:DT-OLD-2");
    await page.locator('[data-layer="utility.districts"] input').check();
    await page.locator('[data-layer="reference.lgas"] input').check();
    await page.locator("[data-incident] input").check();
    await page.locator("path.gi-outline-lga").first().waitFor({ state: "attached" });
    const height = await page.evaluate(() => (document.querySelector("main")?.scrollHeight ?? 800) + 120);
    await page.setViewportSize({ width: 1500, height: Math.min(Math.max(height, 700), 6000) });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${target}/map-trace.png` });
  });
  for (const [name, route] of PDFS) {
    test(`${name}-pdf`, async ({ page }) => {
      await page.goto(route);
      await page.pdf({ path: `${target}/${name}.pdf`, preferCSSPageSize: true });
    });
  }
  for (const [name, route] of SHOTS.filter(([shot]) => PHONE.includes(shot))) {
    test(`${name}-phone`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);
      await page.waitForTimeout(1500);
      const height = await page.evaluate(() => (document.querySelector("main")?.scrollHeight ?? 800) + 320);
      await page.setViewportSize({ width: 390, height: Math.min(Math.max(height, 844), 16000) });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${target}/${name}-phone.png` });
    });
  }
  for (const [name, route] of SHOTS) {
    test(name, async ({ page }) => {
      await page.goto(route);
      // The page scrolls inside <main>; size the window to its content so one image shows it all.
      const height = await page.evaluate(() => (document.querySelector("main")?.scrollHeight ?? 800) + 120);
      await page.setViewportSize({ width: 1500, height: Math.min(Math.max(height, 700), 6000) });
      // A map is drawn in the browser, after the page arrives.
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${target}/${name}.png` });
    });
  }
});
