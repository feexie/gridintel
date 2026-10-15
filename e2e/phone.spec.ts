import { expect, test } from "@playwright/test";

/* Phase UI-B: the screens rebuilt in direction C, phone first. At 390 px no screen scrolls sideways
   as a whole page; a wide table scrolls inside its own frame; the SYNTHETIC DATA bar is on every
   screen; and what a phone folds is open on a wider screen, never removed. */

/** The rebuilt screens, in the order they were rebuilt. */
const OPERATIONS = "/dashboard/utility/operations";
const REBUILT = [
  "/dashboard/utility/executive",
  "/dashboard/utility/executive/all",
  "/dashboard/utility/events",
  OPERATIONS,
  `${OPERATIONS}/regions/demo-region-northfield`,
  `${OPERATIONS}/substations/SS-HIL`,
  `${OPERATIONS}/feeders/FD-FRM`,
  `${OPERATIONS}/transformers/DT-OLD-2`,
  `${OPERATIONS}/transformers/DT-OLD-2/all`,
  `${OPERATIONS}/service-points/SP-OLD2-001`,
  `${OPERATIONS}/service-points/SP-MKT2-005`,
];

for (const route of REBUILT) {
  test(`at 390 px ${route} does not slide sideways, and its tables scroll inside their own frames`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const bar = page.getByRole("note", { name: "About the data on this screen" });
    await expect(bar.getByText("SYNTHETIC DATA", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Open everything a phone folds, so that nothing hidden is wider than the screen either.
    await page.evaluate(() => document.querySelectorAll("main details").forEach((node) => node.setAttribute("open", "")));
    const main = page.locator("main");
    expect(await main.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    // Every frame fits the screen; what is wider scrolls inside it.
    const frames = await page.locator("[data-table-frame]").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
    for (const right of frames) expect(right).toBeLessThanOrEqual(391);
  });
}

test("a phone folds the tables behind one tap; a wider screen shows them open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/utility/executive");
  const tables = page.locator('[data-wide-open="band-compliance"]');
  await expect(tables.locator('[data-table="band-compliance"]')).toBeHidden();
  await tables.locator("summary").click();
  await expect(tables.locator('[data-table="band-compliance"]')).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(page.locator('[data-table="band-compliance"]')).toBeVisible();
  await expect(page.locator('[data-wide-open="band-compliance"] > summary')).toBeHidden();
});

test("on a phone, source and method open under the figure at full width, not as a box beside it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/utility/executive");
  const tile = page.locator('[data-metric="Revenue not realised"]').first();
  await tile.locator("summary").click();
  const trail = tile.locator("details > div");
  await expect(trail).toBeVisible();
  const [tileBox, trailBox] = [await tile.boundingBox(), await trail.boundingBox()];
  expect(trailBox !== null && tileBox !== null && trailBox.y + trailBox.height <= tileBox.y + tileBox.height + 1).toBe(true);
});
