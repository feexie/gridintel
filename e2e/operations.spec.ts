import { expect, test, type Page } from "@playwright/test";
import { OPERATIONS, ROUTES } from "./routes";

/** The tile of a headline figure, by the figure's label. */
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();

test("every screen carries the SYNTHETIC DATA label", async ({ page }) => {
  // One navigation per route, in a real browser and beside the other tests: allow for each.
  test.setTimeout(ROUTES.length * 6_000);
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

  // Each level links to the one below from its revenue-gap rows and from its table; either will do.
  await page.getByRole("link", { name: "Riverside 33/11 kV injection substation" }).first().click();
  await expect(page).toHaveURL(/\/substations\/SS-RIV$/);

  await page.getByRole("link", { name: "Old Town 11 kV feeder" }).first().click();
  await expect(page).toHaveURL(/\/feeders\/FD-OLD$/);
  await expect(page.getByText("NERC service band")).toBeVisible();

  await page.getByRole("link", { name: "Riverbank transformer" }).first().click();
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
  await expect(feeders.getByText("Cash basis: received in the period ÷ billed in the period.")).toBeVisible();
  // The marker printed on the collection cells is the one the footnote starts with.
  const footnote = feeders.locator("li", { hasText: "Cash basis: received in the period" });
  const marker = (await footnote.locator("span").first().innerText()).trim();
  await expect(feeders.getByRole("row", { name: /Market Road/ })).toContainText(marker);
  // Feeders now carry a realistic number of transformers, so feeder loading has no caveat.
  await expect(page.getByText("carries only three transformers")).toHaveCount(0);
});

test("feeder loading is that of a loaded 11 kV feeder, with no caveat", async ({ page }) => {
  for (const [feeder, peak] of [["FD-MKT", "78.5%"], ["FD-OLD", "80.9%"], ["FD-GOV", "72.3%"], ["FD-FRM", "53.8%"]]) {
    await page.goto(`${OPERATIONS}/feeders/${feeder}`);
    await expect(tile(page, "Peak loading"), feeder).toContainText(peak);
    await expect(page.getByText("artefact of the small model"), feeder).toHaveCount(0);
  }
});

test("government accounts are shown as their own customer class, with their own collection efficiency", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-GOV`);
  const classes = page.locator('[data-table="customer-class"]');
  const government = classes.getByRole("row", { name: /^Government \(MDA\)/ });
  await expect(government).toContainText("90");
  await expect(government).toContainText("19.8%");
  await expect(classes.getByRole("row", { name: /^Residential/ })).toContainText(/95\.\d%/);
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
  await expect(row).toContainText("3.0 h");
  await expect(row).toContainText("6.9 h");
  // The total, with load shedding, is the headline figure and is far larger.
  await expect(tile(page, "SAIDI")).toContainText("208.7 h");
});

test("a report that books 33 kV line faults as upstream shows as a variance on the same basis", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-HIL`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  // Comparable, because both count network interruptions; different, because the report leaves the line faults out.
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("1.9 h");
  await expect(row).toContainText("22.8 h");
  await expect(row).toContainText("+20.9 h");
  await expect(row).not.toContainText("Not comparable");
  await expect(page.getByText("including the lines that feed its substations")).toBeVisible();
  // The substation summary does not say how it classifies, so the row says what the variance may be.
  await expect(row).toContainText("The variance may reflect a difference in classification rather than in what happened.");
  await expect(row.locator("[data-reference-rule]")).toHaveCount(0);
});

test("a report that states its attribution rule is compared on that rule, with the reference figure beside it", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-FRM`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("treating as upstream: the grid, transmission stations, sub-transmission lines");
  // 0.4 h reported, 0.4 h calculated on the report's own rule; 57.1 h on the reference rule.
  await expect(row).toContainText("0.4 h");
  await expect(row.locator("[data-reference-rule]")).toContainText("On the GridIntel reference rule");
  await expect(row.locator("[data-reference-rule]")).toContainText("57.1 h");
  await expect(row).not.toContainText("may reflect a difference in classification");
  // The headline and the attribution table are still on the reference rule.
  await expect(tile(page, "SAIDI")).toContainText("441.8 h");
});

test("a region is accounted as the sum of its sections, and alarms are an explicit not-available state", async ({ page }) => {
  await page.goto(`${OPERATIONS}/regions/demo-region-northfield`);
  await expect(page.getByText("Summed over 2 electrical section(s): SS-HIL, SS-RIV.")).toBeVisible();
  await expect(tile(page, "ATC&C")).toContainText("31.5%");
  // The gap below the region is by substation, and the two rows are the region's two sections.
  const gap = page.locator("section", { has: page.getByRole("heading", { name: "Revenue gap", level: 2 }) });
  await expect(gap.getByRole("link", { name: "Riverside 33/11 kV injection substation" })).toBeVisible();
  await expect(gap.getByRole("link", { name: "Hillcrest 33/11 kV injection substation" })).toBeVisible();
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

test("an ordinary prepaid meter shows no consumption, and its vends as energy purchased", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-004`);
  await expect(page.getByText("conventional meter M-OLD2-004")).toBeVisible();
  const recorded = tile(page, "Energy recorded");
  await expect(recorded).toContainText("Not available");
  await expect(recorded).toContainText("This meter is not read");
  const purchased = tile(page, "Energy purchased");
  await expect(purchased).toContainText("kWh");
  await expect(purchased).toContainText("Measured");
  await expect(purchased).toContainText("It is not consumption and is never added to recorded consumption.");
  // No interval line: there are no intervals to count.
  await expect(page.getByText("Intervals usable")).toHaveCount(0);
});

test("a postpaid meter read by hand shows one register reading, and says when it was estimated", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-001`);
  const recorded = tile(page, "Energy recorded");
  await expect(recorded).toContainText("kWh");
  await expect(recorded).toContainText("One register reading for the month, not interval data.");
  await expect(recorded).toContainText("Measured");
  await expect(page.locator("[data-register-readings]")).toContainText("The figure is the difference, for the time between the two readings.");
  await expect(tile(page, "Energy purchased")).toHaveCount(0);

  // The reading round missed this meter: the reading, and the bill raised on it, are estimates.
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-005`);
  await expect(tile(page, "Energy recorded")).toContainText("Estimated");
  await expect(tile(page, "Energy recorded")).toContainText("The meter was not read this month");
  await expect(page.locator("[data-register-readings]")).toContainText("estimated: the meter was not read");
  await expect(page.getByRole("row", { name: /Estimated bills \(meter not read\)/ })).toBeVisible();
});

test("an AMI meter shows the sum of its intervals", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-MKT2-005`);
  await expect(page.getByText("AMI meter M-MKT2-005")).toBeVisible();
  await expect(tile(page, "Energy recorded")).toContainText("kWh");
  await expect(page.getByText("Intervals usable")).toContainText("720 of 720");
});

test("a level shows energy purchased apart from recorded consumption, which it says is not available and why", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const purchased = page.locator('[data-table="energy-purchased"]');
  await expect(purchased).toContainText("Energy purchased (prepaid vends)");
  await expect(purchased).toContainText("kWh");
  await expect(page.getByText("Purchased, not consumed")).toBeVisible();
  await expect(page.getByText("934 with a meter that records no intervals (read about once a month, or prepaid and not read at all)")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Recorded consumption/ })).toContainText("insufficient data");
  // The accounting chain does not depend on customer meters and is unchanged in status.
  await expect(tile(page, "ATC&C")).toContainText("Estimated inputs");
});

test("a long list of connections shows its first rows, with the full list one click away", async ({ page }) => {
  await page.goto(`${OPERATIONS}/transformers/DT-OLD-2`);
  const table = page.locator("section", { has: page.getByRole("heading", { name: /^Service points \(135\)/ }) });
  await expect(table.locator("tbody tr")).toHaveCount(40);
  await expect(table).toContainText("Showing the first 40 of 135.");
  await table.getByRole("link", { name: "Show all 135" }).click();
  await expect(page).toHaveURL(/\/transformers\/DT-OLD-2\?rows=all$/);
  await expect(table.locator("tbody tr")).toHaveCount(135);
});
