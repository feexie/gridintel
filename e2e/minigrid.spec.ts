import { expect, test, type Page } from "@playwright/test";

/* The Mini-grid workspace: the sites side by side, what stands out among them, and one site in full. */

const SITES = "/dashboard/minigrid";
const site = (id: string) => `${SITES}/sites/${id}`;
const finding = (page: Page, key: string) => page.locator(`[data-finding="${key}"]`);
const card = (page: Page, id: string) => page.locator(`[data-site="${id}"]`);
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();

test("on a phone, a funder sees which site over-reports, which burns diesel inefficiently, which is oversized, and where unpaid money sits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SITES);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sites");
  await expect(page.getByRole("note").getByText("SYNTHETIC DATA", { exact: true })).toBeVisible();

  // Which site over-reports: Dry River, with each claim beside the calculation on its basis.
  const overReports = finding(page, "report_differs:MG-DRY");
  await expect(overReports).toContainText("Dry River's report differs from its records on 3 of the 8 figures it states.");
  await expect(overReports.locator('[data-variance="Renewable fraction"]')).toContainText("reported 68.0%, calculated 49.6% (-18.4 pp)");
  await expect(overReports.locator('[data-variance="Generator running hours"]')).toContainText("reported 190.0 h, calculated 315.0 h (+125.0 h)");

  // Which burns diesel inefficiently: Dry River, against the least.
  const diesel = finding(page, "fuel_per_kwh:MG-DRY");
  await expect(diesel).toContainText("Dry River's generator burns the most fuel for each kWh it makes");
  await expect(diesel.locator('[data-figure="Fuel per kWh, Dry River"]')).toContainText("0.51 L/kWh");
  await expect(diesel.locator('[data-figure="Fuel per kWh, Palm Landing (the least)"]')).toContainText("0.35 L/kWh");

  // Which is oversized for its demand: Granite Hill.
  const oversized = finding(page, "pv_held_back:MG-GRN");
  await expect(oversized).toContainText("Granite Hill took less than half of the PV energy available to it");
  await expect(oversized.locator('[data-figure="PV curtailed"]')).toContainText("72.4%");
  await expect(oversized.locator('[data-figure="Performance ratio before curtailment"]')).toContainText("79.0%");

  // Where unpaid money sits: Palm Landing's credit accounts, its institutions paying least.
  const unpaid = finding(page, "uncollected:MG-PLM");
  await expect(unpaid).toContainText("owed by 13 postpaid accounts; its prepaid accounts cannot owe");
  await expect(unpaid.locator('[data-owes="public"]')).toContainText("₦96,001 not collected; paid 20.8% of what they were billed (5 postpaid accounts)");
  await expect(unpaid.locator('[data-owes="productive_use"]')).toContainText("₦147,140 not collected; paid 64.7%");
  await expect(finding(page, "class_pays_least:portfolio")).toContainText("public institutions paid the smallest share of what they were billed");

  // Every finding prints its rule, and nothing is wider than the screen.
  await expect(page.locator("[data-finding]")).toHaveCount(6);
  for (const text of await page.locator("[data-finding] p:last-child").allTextContents()) expect(text).toMatch(/^Rule: /);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the four sites are side by side on the same figures, each with its status and origin", async ({ page }) => {
  await page.goto(SITES);
  await expect(page.locator("[data-site]")).toHaveCount(4);
  const dry = card(page, "MG-DRY");
  await expect(dry).toContainText("45 kWp PV · 90 kWh battery · 60 kVA diesel generator");
  await expect(dry.locator('[data-figure="Renewable fraction"]')).toContainText("49.6%");
  await expect(dry.locator('[data-figure="Fuel per kWh"]')).toContainText("0.51 L/kWh");
  await expect(dry.locator('[data-figure="Availability"]')).toContainText("95.8%");
  await expect(dry.locator('[data-figure="Energy sold per connection"]')).toContainText("25.9 kWh");
  await expect(dry.locator('[data-figure="Collection efficiency"]')).toContainText("97.3%");
  await expect(dry.locator("[data-report-standing]")).toHaveText("5 agree · 3 differ · 0 not comparable");
  // A site with no generator has no fuel figure, and says why. An estimate is marked as one.
  await expect(card(page, "MG-GRN").locator('[data-figure="Fuel per kWh"]')).toContainText("no generator");
  await expect(card(page, "MG-GRN").locator('[data-figure="PV curtailed"]').locator('[aria-label="Estimated inputs"]')).toBeVisible();
  await expect(card(page, "MG-TAM").locator("[data-report-standing]")).toHaveText("7 agree · 0 differ · 1 not comparable");
  await expect(page.getByText("agrees when it is within 1% of its own value. Each mark beside a figure is its status")).toBeVisible();

  // Collection by class over every site: only postpaid accounts owe.
  const classes = page.locator('[data-table="class-portfolio"]');
  await expect(classes.locator('[data-row="public"]')).toContainText("21.2%");
  await expect(classes.locator('[data-row="residential"]')).toContainText("100.0%");
  await expect(page.getByText("Tariffs are assumptions, not current published rates.")).toBeVisible();

  // The sites are on the shared map, and a card leads to its site.
  await expect(page.locator("path.gi-kind-minigrid_site")).toHaveCount(4);
  await expect(page.locator("path.gi-outline-state")).toHaveCount(37);
  await dry.getByRole("link", { name: "Dry River" }).click();
  await expect(page).toHaveURL(/\/dashboard\/minigrid\/sites\/MG-DRY$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dry River");
});

test("a site in full: energy flow, PV, battery, generator, availability and commercial, each figure with source and method", async ({ page }) => {
  await page.goto(site("MG-TAM"));
  await expect(page.getByRole("note").getByText("SYNTHETIC DATA", { exact: true })).toBeVisible();
  await expect(page.locator("[data-assets]")).toContainText("Solar PV array: 100 kWp");
  await expect(page.locator("[data-assets]")).toContainText("PV inverter: 100 kVA");
  await expect(page.locator("[data-assets]")).toContainText("Battery inverter: 80 kVA");
  await expect(page.locator("[data-mix]")).toContainText("Solar PV 94.7%");
  const flow = page.locator('[data-table="energy-flow"]');
  await expect(flow.locator("tbody tr")).toHaveCount(8);
  await expect(flow.locator('[data-row="Energy generated"]')).toContainText("11,904 kWh");
  await expect(flow.locator('[data-row="Energy sent out"]')).toContainText("11,245 kWh");
  await expect(flow.locator('[data-row="Station use"]')).toContainText("Derived");

  await expect(tile(page, "Performance ratio")).toContainText("74.4%");
  await expect(tile(page, "Fuel per kWh")).toContainText("0.35 L/kWh");
  await expect(tile(page, "Running hours")).toContainText("21.0 h");
  await expect(tile(page, "Equivalent full cycles")).toContainText("17.4");
  await expect(tile(page, "Storage loss")).toContainText("Estimated inputs");
  await expect(page.locator("[data-soc-chart] [title]")).toHaveCount(30);
  await expect(tile(page, "Availability")).toContainText("99.7%");
  await expect(page.locator('[data-table="interruptions"] tbody tr')).toHaveCount(2);
  await expect(tile(page, "Collection efficiency")).toContainText("96.0%");
  // Collection is named for what it does on a site, not for the utility figure it shares a methodology with.
  await expect(tile(page, "Collection efficiency")).toContainText("GridIntel reference collection");
  await expect(tile(page, "Collection efficiency")).not.toContainText("ATC&C");

  // Source and method behind a figure: its inputs, each with its origin, and the methodology.
  await tile(page, "Renewable fraction").locator("summary").click();
  await expect(tile(page, "Renewable fraction")).toContainText("GridIntel reference site performance");
  await expect(tile(page, "Renewable fraction")).toContainText("pvGeneration");
  await expect(tile(page, "Renewable fraction")).toContainText("Synthetic mini-grid meter data [synthetic]");

  // Its place on the shared map, selected, with the other sites and the state outlines.
  await expect(page.locator("path.gi-kind-minigrid_site")).toHaveCount(4);
  await expect(page.locator("path.gi-selected")).toHaveCount(1);
  await expect(page.locator("[data-selected]")).toHaveAttribute("data-selected", "minigrid_site:MG-TAM");
  await expect(page.locator("[data-selected] [data-trace]")).toContainText("Synthetic data is not placed in real states or LGAs, and no synthetic district covers it.");
  await expect(page.locator("[data-selected] [data-trace]")).toContainText("No substation: the site generates its own energy.");
  await expect(page.locator("[data-selected] [data-trace]")).toContainText("Its own connections, counted below.");
});

test("the site report against the calculation: same basis or not comparable, never a variance across bases", async ({ page }) => {
  await page.goto(site("MG-DRY"));
  const report = page.locator("#report");
  await expect(report).toContainText("Monthly site performance report, September 2026 (synthetic)");
  await expect(report.locator("[data-report-standing]")).toHaveText("5 agree · 3 differ · 0 not comparable");
  const row = (label: string) => report.locator("tbody tr", { hasText: label }).first();
  await expect(row("Renewable fraction")).toContainText("68.0%");
  await expect(row("Renewable fraction")).toContainText("49.6%");
  await expect(row("Renewable fraction")).toContainText("-18.4 pp");
  await expect(row("Renewable fraction")).toContainText("Reported counts: a share of energy generated.");
  await expect(row("Availability")).toContainText("planned work excluded");
  // The report's methodology being unverified is said once above the table, on no row.
  await expect(report.locator("[data-comparison-note]")).toContainText("has not been verified as equivalent to the GridIntel reference methods the calculations use. This applies to every figure below.");
  await expect(report.locator("tbody")).not.toContainText("verified as equivalent");

  // A gap is said to be one: six meters did not report, so three figures have no value.
  await expect(page.getByText("294 of 300 connections have a meter that recorded the whole month.")).toBeVisible();
  await expect(page.locator('[data-table="energy-flow"] [data-row="Energy delivered"]')).toContainText("insufficient data");
  await expect(tile(page, "Site loss")).toContainText("Insufficient data");

  // A claim on another basis, and one that states none, get no variance.
  await page.goto(site("MG-TAM"));
  const accrual = page.locator("#report tbody tr", { hasText: "Collection efficiency" }).first();
  await expect(accrual).toContainText("Not comparable");
  await expect(accrual).toContainText("none on this basis");
  await page.goto(site("MG-GRN"));
  await expect(page.locator("#report tbody tr", { hasText: "Availability" }).first()).toContainText("basis not stated");
  // And a site with no generator says so.
  await expect(page.locator("[data-no-generator]")).toContainText("This site has no generator.");
});

test("where unpaid money sits at Palm Landing, by customer class", async ({ page }) => {
  await page.goto(site("MG-PLM"));
  const classes = page.locator('[data-table="class-site"]');
  await expect(classes.locator("tbody tr")).toHaveCount(4);
  await expect(classes.locator('[data-row="productive_use"]')).toContainText("0 / 8");
  await expect(classes.locator('[data-row="productive_use"]')).toContainText("64.7%");
  await expect(classes.locator('[data-row="public"]')).toContainText("20.8%");
  await expect(classes.locator('[data-row="public"]')).toContainText("₦96,001");
  await expect(classes.locator('[data-row="residential"]')).toContainText("364 / 0");
  await expect(classes.locator('[data-row="residential"]')).toContainText("₦0");
  await expect(page.locator('[data-table="tiers"] tbody tr')).toHaveCount(5);
});

test("a site that is not in the register is said not to be, in the dashboard frame", async ({ page }) => {
  const response = await page.goto(site("MG-NOWHERE"));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not in the site register");
  await expect(page.getByRole("note").getByText("SYNTHETIC DATA", { exact: true })).toBeVisible();
});

test("a site on the Map workspace leads to its own screen", async ({ page }) => {
  await page.goto("/dashboard/map");
  await expect(page.locator(".leaflet-container path.gi-point").first()).toBeVisible();
  await page.locator('[data-layer="minigrid.sites"] input').check();
  await page.locator("[data-select-asset]").selectOption("minigrid_site:MG-GRN");
  await expect(page.locator("[data-selected]").getByRole("link", { name: /Open the site/ })).toHaveAttribute("href", "/dashboard/minigrid/sites/MG-GRN");
});
