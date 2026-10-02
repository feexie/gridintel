import { expect, test, type Page } from "@playwright/test";

const OPERATIONS = "/dashboard/utility/operations";
const ROUTES = [
  "/dashboard/utility/executive",
  OPERATIONS,
  `${OPERATIONS}/regions/demo-region-northfield`,
  `${OPERATIONS}/substations/SS-RIV`,
  `${OPERATIONS}/feeders/FD-MKT`,
  `${OPERATIONS}/feeders/FD-OLD`,
  `${OPERATIONS}/transformers/DT-OLD-2`,
  `${OPERATIONS}/service-points/SP-OLD2-001`,
];

/** The tile of a headline figure, by the figure's label. */
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();

test("every screen carries the SYNTHETIC DATA label", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole("note").getByText("SYNTHETIC DATA", { exact: true }), route).toBeVisible();
    await expect(page.getByRole("note"), route).toContainText("describes no real network");
  }
});

test("drills from region to service point, one URL per level", async ({ page }) => {
  await page.goto(OPERATIONS);
  await page.getByRole("link", { name: "Northfield Region" }).click();
  await expect(page).toHaveURL(/\/regions\/demo-region-northfield$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Northfield Region");

  await page.getByRole("link", { name: "Riverside 33/11 kV injection substation" }).click();
  await expect(page).toHaveURL(/\/substations\/SS-RIV$/);

  await page.getByRole("link", { name: "Old Town 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/feeders\/FD-OLD$/);
  await expect(page.getByText("NERC service band")).toBeVisible();

  await page.getByRole("link", { name: "Riverbank transformer" }).click();
  await expect(page).toHaveURL(/\/transformers\/DT-OLD-2$/);
  await expect(tile(page, "Peak loading")).toContainText("Over rating");

  await page.getByRole("link", { name: "SP-OLD2-001", exact: true }).click();
  await expect(page).toHaveURL(/\/service-points\/SP-OLD2-001$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("SP-OLD2-001");

  // The path back is in the breadcrumb, and each level is a link.
  const crumbs = page.getByRole("navigation", { name: "Drill-down path" });
  await expect(crumbs).toContainText("Northfield Region");
  await crumbs.getByRole("link", { name: "Old Town 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/feeders\/FD-OLD$/);
});

test("a deep link opens its level directly, and an unknown asset says so", async ({ page }) => {
  await page.goto(`${OPERATIONS}/transformers/DT-MKT-3`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Hilltop Close transformer");
  await page.goto(`${OPERATIONS}/feeders/NOPE`);
  await expect(page.getByText("Not in the registry")).toBeVisible();
});

test("Source & method opens on a figure calculated with estimates", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const atcc = tile(page, "ATC&C");
  await expect(atcc).toContainText("Estimated inputs");
  await expect(atcc.getByText("GridIntel reference ATC&C")).toBeHidden();
  await atcc.locator("summary").click();
  await expect(atcc.getByText("GridIntel reference ATC&C")).toBeVisible();
  await expect(atcc).toContainText("energyBilled");
  await expect(atcc).toContainText("% estimated");
  await expect(atcc).toContainText("[synthetic]");
});

test("Source & method on commercial loss says it is a derived residual", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const commercial = tile(page, "Commercial loss");
  await expect(commercial).toContainText("Derived");
  await commercial.locator("summary").click();
  await expect(commercial).toContainText("A residual: what is left after subtracting other figures");
  await expect(commercial).toContainText("Energy input − technical loss − energy billed");
  await expect(commercial).toContainText("technicalLoss");
  await expect(commercial).toContainText("100.0% estimated");
});

test("table caveats are visible as a marker and a footnote, not only on hover", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const feeders = page.locator("section", { has: page.getByRole("heading", { name: /^Feeders/ }) });
  await expect(feeders.getByText("Each feeder in this dataset carries only three transformers")).toBeVisible();
  await expect(feeders.getByText("Cash basis: received in the period ÷ billed in the period.")).toBeVisible();
  // The marker printed on the peak-loading cells is the one the footnote starts with.
  const footnote = feeders.locator("li", { hasText: "Each feeder in this dataset" });
  const marker = (await footnote.locator("span").first().innerText()).trim();
  await expect(feeders.getByRole("row", { name: /Market Road/ })).toContainText(marker);
});

test("a reported figure on another basis is not comparable, with the reason and no difference", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const row = page.getByRole("row", { name: /^Collection efficiency/ });
  await expect(row).toContainText("Not comparable");
  await expect(row).toContainText("none on this basis");
  await expect(row).toContainText('reported "accrual", calculated "cash"');
  await expect(row).not.toContainText("pp");
  await expect(row).not.toContainText("with caveats");
});

test("reported SAIDI is set beside the network-only calculation, on the same basis", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("network interruptions only");
  await expect(row).toContainText("5.1 h");
  await expect(row).toContainText("5.7 h");
  // The total, with load shedding, is the headline figure and is far larger.
  await expect(tile(page, "SAIDI")).toContainText("216.0 h");
});

test("a region is accounted as the sum of its sections, and alarms are an explicit not-available state", async ({ page }) => {
  await page.goto(`${OPERATIONS}/regions/demo-region-northfield`);
  await expect(page.getByText("Summed over 1 electrical section(s): SS-RIV.")).toBeVisible();
  await expect(tile(page, "ATC&C")).toContainText("22.4%");
  const alarms = page.locator("section", { has: page.getByRole("heading", { name: "Alarms" }) });
  await expect(alarms).toContainText("Not available");
  await expect(alarms).toContainText("no alarms are shown rather than an invented list");
});

test("an unmetered connection shows no measured energy and an estimated bill", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-002`);
  await expect(page.getByText("None. Consumption at this connection is not measured.")).toBeVisible();
  await expect(tile(page, "Energy recorded")).toContainText("Not available");
  await expect(page.getByRole("row", { name: /Estimated bills \(no meter\)/ })).toContainText("Estimated");
});

test("every screen answers within 500 ms once the server has warmed", async ({ request }) => {
  // The first request to a route also loads its code; the target is for the screen itself.
  for (const route of ROUTES) await request.get(route);
  for (const route of ROUTES) {
    // The best of three: other tests share this server, and the target is the screen's own time.
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const started = Date.now();
      const response = await request.get(route);
      expect(response.ok(), route).toBe(true);
      best = Math.min(best, Date.now() - started);
    }
    expect(best, `${route} took too long`).toBeLessThan(500);
  }
});
