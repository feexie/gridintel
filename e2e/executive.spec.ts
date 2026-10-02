import { expect, test, type Page } from "@playwright/test";

const EXECUTIVE = "/dashboard/utility/executive";
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();
const panel = (page: Page, title: string | RegExp) => page.locator("section", { has: page.getByRole("heading", { name: title, level: 2 }) });

test("the revenue gap is labelled as a monthly estimate of revenue not realised, in two separate parts", async ({ page }) => {
  await page.goto(EXECUTIVE);
  const gap = panel(page, "Revenue gap");
  await expect(gap).toContainText("An estimate of revenue not realised in the period");
  await expect(gap).toContainText("It is not an amount owed by anyone");
  await expect(gap).toContainText("Not annualised");
  await expect(gap).toContainText("shown separately and are never set against each other");
  await expect(gap).not.toContainText(/theft/i);
  await expect(gap).not.toContainText(/per year|annual revenue/i);

  await expect(tile(page, "Revenue not realised")).toContainText("Derived");
  await expect(tile(page, "Revenue not realised")).toContainText("Estimated inputs");
  await expect(tile(page, "Commercial gap")).toContainText("Derived");
  await expect(tile(page, "Collection gap")).toContainText("Calculated");
  await expect(tile(page, "Collection gap")).toContainText("Cash basis");
  await expect(tile(page, "Collection gap")).toContainText("OK");
  // Tariffs in the synthetic data are assumptions, and the screen says so beside the rates.
  await expect(gap).toContainText("Tariffs are assumptions, not current published rates.");
});

test("each loss is valued at the rate of the place it occurs, never a blended one", async ({ page }) => {
  await page.goto(EXECUTIVE);
  const gap = panel(page, "Revenue gap");
  await expect(gap.getByRole("row", { name: /Riverbank transformer/ })).toContainText("₦50.00/kWh");
  await expect(gap.getByRole("row", { name: /Garden Estate transformer/ })).toContainText("₦209.50/kWh");
  await expect(gap).toContainText("Customers supplied at 11 kV are in no rate");
});

test("asset risk is its own group above the money ranking, and is not ranked by money", async ({ page }) => {
  await page.goto(EXECUTIVE);
  const list = panel(page, "Where to look first");
  const assetRisk = list.locator('[data-group="asset-risk"]');
  const money = list.locator('[data-group="money"]');

  await expect(assetRisk).toContainText("Asset risk");
  await expect(assetRisk).toContainText("Not ranked by money");
  await expect(assetRisk.locator("[data-subject]")).toHaveCount(1);
  await expect(assetRisk.locator('[data-subject="DT-OLD-2"]')).toContainText("Loaded above its rating");
  await expect(assetRisk.locator('[data-subject="DT-OLD-2"]')).toContainText("69 hours over rating");
  // Its commercial gap is shown as context, and says whose total it is part of.
  await expect(assetRisk.locator('[data-subject="DT-OLD-2"]')).toContainText("part of Old Town 11 kV feeder's revenue not realised; not ranked separately");

  // Asset risk comes first on the page.
  const riskTop = (await assetRisk.boundingBox())?.y ?? 0;
  const moneyTop = (await money.boundingBox())?.y ?? 0;
  expect(riskTop).toBeLessThan(moneyTop);
});

test("feeders are ranked by revenue not realised, each once with every rule it triggered", async ({ page }) => {
  await page.goto(EXECUTIVE);
  const list = panel(page, "Where to look first");
  const money = list.locator('[data-group="money"] > ol > [data-subject]');
  await expect(money).toHaveCount(2);
  await expect(money.nth(0)).toHaveAttribute("data-subject", "FD-MKT");
  await expect(money.nth(1)).toHaveAttribute("data-subject", "FD-OLD");
  await expect(money.nth(0)).toContainText("revenue not realised, monthly estimate");
  await expect(money.nth(0)).toContainText("Largest revenue not realised among feeders");
  await expect(money.nth(1)).toContainText("Highest ATC&C among feeders");
  await expect(money.nth(1)).toContainText("Lowest collection efficiency among feeders (cash basis)");
  await expect(money.nth(1)).toContainText("Below its Band C minimum of 12 h");

  // No transformer competes in the money ranking, and no subject is listed twice.
  await expect(list.locator('[data-group="money"] [data-subject^="DT-"]')).toHaveCount(0);
  const subjects = await list.locator("[data-subject]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-subject")));
  expect(new Set(subjects).size).toBe(subjects.length);

  await expect(list).toContainText("Asset risk is its own group, shown first and never ranked by money");
  await expect(list).toContainText("Only feeders are ranked by money, because a transformer's commercial gap is already part of its feeder's total");
  await expect(list).toContainText("No weighting, no AI.");

  await money.nth(0).getByRole("link", { name: "Market Road 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/operations\/feeders\/FD-MKT$/);
});

test("reported figures are compared at the scope they are stated for, and say so", async ({ page }) => {
  await page.goto(EXECUTIVE);
  const saidi = page.getByRole("row", { name: /^SAIDI/ });
  await expect(saidi).toContainText("Stated for Riverside 33/11 kV injection substation; compared at that scope.");
  await expect(saidi).toContainText("Same basis");
  await expect(saidi).toContainText("5.1 h");
  await expect(saidi).toContainText("5.7 h");
  await expect(page.getByRole("row", { name: /^ATC&C/ })).toContainText("Stated for Riverside 33/11 kV injection substation");
});

test("the portfolio figures are those of the drill-down, with no literal KPI", async ({ page }) => {
  await page.goto(EXECUTIVE);
  await expect(tile(page, "ATC&C")).toContainText("22.4%");
  await expect(page.getByText("Summed over 1 electrical section(s): SS-RIV. An organization is not an electrical boundary")).toBeVisible();
  await expect(page.getByText("86.6%")).toHaveCount(0);
  await expect(page.getByText("17.1%")).toHaveCount(0);
  await expect(panel(page, "Service-band compliance by feeder").getByRole("row", { name: /Market Road/ })).toContainText("7 of 30");
  await expect(panel(page, "Transformer peak loading").getByRole("row", { name: /Riverbank/ })).toContainText("Over rating");
});
