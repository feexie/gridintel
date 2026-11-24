import { expect, test, type Locator } from "@playwright/test";

/* Reference sites (Phase MG-REAL): a real mini-grid whose records its owners published (site
   RMG01, Kemabonta & Geoffrey 2026, CC BY 4.0). Shown beside the operator's sites and never among
   them, and credited wherever its data is shown. */

const SITES = "/dashboard/minigrid/sites";
const PAGE = "/dashboard/minigrid/sites/reference/rmg01";

async function credited(where: Locator) {
  const credit = where.locator("[data-reference-attribution]").first();
  await expect(credit).toContainText("Kemabonta, T. & Geoffrey, A. (2026)");
  await expect(credit).toContainText("v1.0.2");
  await expect(credit.locator('a[href="https://doi.org/10.5281/zenodo.24098636"]')).toHaveCount(1);
  await expect(credit.locator("[data-licence-link]")).toHaveText("CC BY 4.0");
  await expect(credit.locator("[data-licence-link]")).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
}

test("the Sites screen shows the reference site apart from the operator's sites, credited", async ({ page }) => {
  await page.goto(SITES);
  const reference = page.locator("[data-reference-sites]");
  await expect(reference).toContainText("Not part of this portfolio");
  const card = reference.locator('[data-reference-site="rmg01"]');
  await expect(card).toContainText("Site A (RMG01)");
  await expect(card).toContainText("17.9%");
  await expect(card.locator('[data-standing="agrees"]')).toHaveCount(1);
  await credited(card);
  // The operator's own site cards do not include it.
  await expect(page.locator('[data-sites] [data-site="rmg01"]')).toHaveCount(0);
  await card.getByRole("link", { name: "Site A (RMG01)" }).click();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
});

test("the reference page sets each published figure beside GridIntel's calculation, and claims no revenue", async ({ page }) => {
  await page.goto(PAGE);
  const view = page.locator('[data-reference-page="rmg01"]');
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site A (RMG01)");
  await expect(view.locator("[data-published-mark]").first()).toBeVisible();
  await credited(view);

  const gap = view.locator('[data-table="reference-meter-gap"]');
  await expect(gap.locator("tbody tr").first()).toContainText("17.9%");
  await expect(gap.locator('[data-standing="differs"]')).toHaveCount(0);

  await expect(view.locator("[data-repeat-buyers]")).toContainText("114 of 141");
  await expect(view.locator("[data-repeat-buyers]")).toContainText("Not retention");

  const reliability = view.locator('[data-table="reference-reliability"]');
  await expect(reliability.locator('[data-row="March 2021"]')).toContainText("7.03 h");
  await expect(reliability.locator('[data-row="March 2021"]')).toContainText("6.88 h");
  await expect(reliability.locator('[data-row="March 2021"] [data-standing="differs"]')).toHaveCount(1);
  await expect(reliability.locator('[data-row="May 2021"]')).toContainText("No outage logged");

  await expect(view.locator("[data-not-claimed]")).toContainText("No revenue, collection rate or price per kWh");
  await expect(view).not.toContainText(/RMG01-[MCA]\d/);
  await expect(view.locator("[data-caveat]")).toHaveCount(29);
});

test("the verification card and the public summary carry the reference site as a line of its own, credited", async ({ page }) => {
  await page.goto("/preview");
  const card = page.locator('[data-initiative-card="minigrid-verification"]');
  const line = card.locator("[data-card-reference]");
  await expect(line).toContainText("Reference site RMG01 (published data)");
  await expect(line).toContainText("17.9%");
  await expect(line).toContainText("Published data");
  await expect(line).not.toContainText("Synthetic");
  await credited(line);

  await page.goto("/preview/initiatives/minigrid-verification/public");
  const reference = page.locator("[data-summary-reference]");
  await expect(reference).toContainText("Not one of the sites above");
  await credited(reference);
});

test("the mini-grid demo workspace's Sites view carries the reference site too", async ({ page }) => {
  await page.goto("/preview/workspace/demo-minigrid/intelligence");
  await credited(page.locator('[data-reference-site="rmg01"]'));
});
