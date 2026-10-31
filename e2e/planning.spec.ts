import { expect, test } from "@playwright/test";

/* The Metering Fund (GEH sprint, docs/geh/DESIGN.md, section 3): the finding first, every figure
   labelled, the assumptions recalculating through the address, and a presentation mode. */

const FUND = "/dashboard/planning/metering";

test("the Metering Fund states its finding first, with the charge, how it is calculated, and data that is not synthetic", async ({ page }) => {
  await page.goto(FUND);
  const main = page.getByRole("main");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^Metering every customer by year 5 with no upfront payment needs ₦[\d,]+ a month/);
  await expect(main.locator('[data-figure="charge"]')).toHaveText(/^₦[\d,]+$/);
  await expect(main.locator('[data-headline]')).toContainText("Meter charge a month, on token purchases");
  await expect(main.locator("[data-repayment]")).toHaveText(/^Each meter is repaid within 5 years of installation; the last meters finish repaying in month 120\.$/);
  await expect(main.locator("[data-at-cap]")).toContainText("Held at the cap, ₦261 a month");
  // Brief 15's two impact measures are headlines: metered in five years, and estimated bills removed.
  await expect(main.locator('[data-impact-figure="metered"]')).toContainText("Customers metered at the end of year 5");
  await expect(main.locator('[data-impact-figure="bills"]')).toContainText(/Estimated bills removed a year at full rollout\s*[\d.]+ million/);
  await expect(main.locator("[data-impact-years] tbody tr")).toHaveCount(2);
  // A "How this is calculated" line under each figure that a formula drives.
  expect(await main.locator("[data-how]").filter({ hasText: /^How this is calculated:/ }).count()).toBeGreaterThanOrEqual(4);
  // The bar says what the data is: published figures and assumptions, not the synthetic dataset.
  const bar = page.getByRole("note", { name: "About the data on this screen" });
  await expect(bar).toContainText("PUBLISHED FIGURES AND ASSUMPTIONS");
  await expect(bar).not.toContainText("SYNTHETIC DATA");
  // The rules and where the model comes from are on screen.
  await expect(main.locator("[data-pmi-rule]")).toContainText("Charges collected on PMI meters do not repay investors");
  await expect(main.locator("[data-model-origin]")).toContainText("Pay-as-you-meter applies the PAYGo model");
  // The band split is a placeholder, and says so.
  await expect(main.locator("[data-bands]")).toContainText("Placeholder");
  // Charts with plain titles, units and legends.
  await expect(main.locator('[data-chart="balance"] figcaption')).toHaveText("Fund balance over the 60-month rollout: base case and all three shocks");
  await expect(main.locator('[data-chart="meters"] [data-chart-legend] li')).toHaveCount(1);
  await expect(main.locator('[data-chart="sources"] svg[role=img]')).toHaveAttribute("aria-label", /₦ billion$/);
  // No banned word anywhere on the screen.
  const text = (await main.innerText()).toLowerCase();
  for (const word of ["ai-powered", "insights", "unlock", "seamless", "leverage", "empower", "revolutionise", "harness", "cutting-edge", "journey", "at a glance"]) expect(text, word).not.toContain(word);
});

test("the GridIntel structure stands beside the fund alone, with investors, protection and a receipt", async ({ page }) => {
  await page.goto(`${FUND}?case=nigeria`);
  const main = page.getByRole("main");
  await expect(main.locator("[data-positioning]")).toContainText("Plan → Fund → Monitor");
  await expect(main.locator("[data-fund-alone]")).toHaveText("Fund alone: ₦1,286 a month, 4.9x the cap.");
  await expect(main.locator("[data-structure-sentence]")).toContainText("GridIntel structure: within the cap for every band; public money");
  await expect(main.locator("[data-inflation-line]")).toHaveText(/^Survives inflation if tariffs follow at least \d+% of it; all three shocks at \d+%\./);
  // Initial investment against break-even, for both, each with its chart.
  await expect(main.locator("[data-investment-case]")).toHaveCount(2);
  await expect(main.locator('[data-investment] [data-chart="cash-flow"]')).toHaveCount(2);
  await expect(main.locator('[data-investment-case="Fund alone"]')).toContainText("Peak capital in");
  await expect(main.locator('[data-investment-case="GridIntel structure"]')).toContainText("Break-even");
  await expect(main.locator("[data-structure-sentence]")).toContainText("of the ₦700bn already raised for PMI; survives 2 of 4 shocks.");
  await expect(main.locator("[data-receipt]")).toContainText("Meter charge paid:");
  await expect(main.locator("[data-protection] li")).toHaveCount(5);
  await expect(main.locator("[data-protection]")).toContainText("Requirement, not yet in place");
  await expect(main.locator('[data-band="lifeline"]')).toContainText("Exempt");
  await expect(main.locator("[data-mini-grids]")).toContainText("The same model applies to mini-grids");
});

test("the Nigeria case is built from NERC's figures, by DisCo, each cited", async ({ page }) => {
  await page.goto(FUND);
  await page.locator("[data-case-switch]").getByRole("link", { name: "Nigeria reference" }).click();
  await expect(page).toHaveURL(/case=nigeria/);
  const main = page.getByRole("main");
  await expect(main.locator("[data-gap-sentence]")).toHaveText(/^Nigeria needs [\d,]+ meters a month to finish in five years\. It installed 129,543 a month in the first half of 2026\.$/);
  await expect(main.locator('[data-shown-figure="customers"]')).toContainText("12.59 million");
  await expect(main.locator("[data-citations]")).toContainText("NERC, Second Quarter 2026 Report");
  await main.locator("[data-disco-form] select").selectOption("yola");
  await main.locator("[data-disco-form]").getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/disco=yola/);
  await expect(main.locator('[data-band="E"]')).toContainText("Not available");
});

test("an assumption or a mitigation recalculates the screen through the address", async ({ page }) => {
  await page.goto(FUND);
  const main = page.getByRole("main");
  await expect(main.locator('[data-stress-row="duty"]')).toContainText("No: short");
  await main.locator("[data-assumptions]").getByLabel(/Duty-shock reserve/).check();
  await main.locator("[data-assumptions]").getByRole("button", { name: "Recalculate" }).click();
  await expect(page).toHaveURL(/dutyReserve=1/);
  await expect(main.locator('[data-stress-row="duty"] td').nth(1)).toHaveText("Yes");
});

test("presentation mode hides the navigation and keeps the finding", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${FUND}?present=1`);
  await expect(page.locator("[data-sidebar]")).toBeHidden();
  await expect(page.locator("[data-sector-bar]")).toBeHidden();
  await expect(page.locator('[data-figure="charge"]')).toBeVisible();
  await page.getByRole("link", { name: "Leave presentation mode" }).click();
  await expect(page.locator("[data-sidebar]")).toBeVisible();
});

test("DisCo allocation: the largest gap first, the two scores, the first million against pro-rata, and a pilot", async ({ page }) => {
  await page.goto(FUND);
  await page.locator("[data-metering-tabs]").getByRole("link", { name: /DisCo allocation/ }).click();
  await expect(page).toHaveURL(/\/metering\/allocation$/);
  const main = page.getByRole("main");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Ibadan holds 22.2% of Nigeria's unmetered customers; at the current pace it reaches 100% in 52 months.");
  await expect(main.locator("[data-discos] [data-disco]")).toHaveCount(11);
  await expect(main.locator('[data-disco="enugu"]')).toContainText("Never at this pace");
  await expect(main.locator("[data-first-million]")).toContainText("The first million meters");
  await expect(main.locator("[data-rule]")).toContainText("Poor residential customers are never last in the queue");
  await expect(main.locator("[data-pilot]")).toContainText("installed by NEMSA-certified local installers");
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("PUBLISHED FIGURES AND ASSUMPTIONS");
  await main.locator("[data-allocation-form] select").selectOption("kano");
  await main.locator("[data-allocation-form]").getByRole("button", { name: "Recalculate" }).click();
  await expect(page).toHaveURL(/pilotDisco=kano/);
  await expect(main.locator("[data-pilot]")).toContainText("Pilot: Kano DisCo");
});
