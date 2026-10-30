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
