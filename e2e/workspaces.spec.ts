import { expect, test, type Page } from "@playwright/test";

const panel = (page: Page, title: string | RegExp) => page.locator("section", { has: page.getByRole("heading", { name: title, level: 2 }) });
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();

test("Reliability: feeders are ranked by what the network itself did, with the rest beside it", async ({ page }) => {
  await page.goto("/dashboard/utility/reliability");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Reliability");
  const ranking = page.locator('[data-table="feeder-ranking"] tbody tr');
  await expect(ranking).toHaveCount(4);
  await expect(ranking.nth(0)).toHaveAttribute("data-row", "FD-FRM");
  await expect(ranking.nth(1)).toHaveAttribute("data-row", "FD-OLD");
  await expect(ranking.nth(3)).toHaveAttribute("data-row", "FD-GOV");
  // Farm Road: 57.1 h is the network's, 10.7 h upstream, 374.0 h load shedding, 441.8 h in all.
  for (const figure of ["57.1 h", "10.7 h", "374.0 h", "441.8 h", "Band D · min 8 h · 9 of 30 days below"]) await expect(ranking.nth(0)).toContainText(figure);
  await expect(panel(page, /^Feeders, ranked/)).toContainText("do not set the rank");
  await ranking.nth(0).getByRole("link", { name: "Farm Road 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/operations\/feeders\/FD-FRM$/);
});

test("Reliability: why supply was interrupted, where it began, and whether it is ours to fix", async ({ page }) => {
  await page.goto("/dashboard/utility/reliability");
  // By cause and by origin point, each with its indices and its share.
  const cause = page.locator('[data-table="by-cause"]');
  await expect(cause.locator('[data-row="load_shedding"]')).toContainText("225.3 h");
  await expect(cause.locator('[data-row="load_shedding"]')).toContainText("93.5%");
  await expect(cause.locator('[data-row="fault"]')).toContainText("13.8 h");
  const origin = page.locator('[data-table="by-origin-point"]');
  await expect(origin.locator('[data-row="subtransmission_line"]')).toContainText("Sub-transmission line (33 kV)");
  await expect(origin.locator('[data-row="subtransmission_line"]')).toContainText("The distribution network");
  await expect(origin.locator('[data-row="transmission_station"]')).toContainText("Upstream");
  // The elements interruptions most often began at: a 33 kV line is named, not linked.
  const origins = page.locator('[data-table="origins"] tbody tr');
  await expect(origins.nth(0)).toContainText("Hillcrest rural 33 kV line");
  await expect(origins.nth(0)).toContainText("16");
  await expect(origins.nth(0)).toContainText("not a registry asset");
  await expect(origins.nth(0).getByRole("link")).toHaveCount(0);
  await expect(panel(page, "Where interruptions most often begin")).toContainText("Load shedding left out");

  // The attribution-rule findings of every feeder report, and each reported figure at the scope it is stated for.
  const ours = panel(page, /^Is it ours to fix/);
  await expect(ours.locator('[data-rule-finding="FD-FRM:SAIDI"]')).toContainText("Farm Road 11 kV feeder. Rule treats sub-transmission lines as upstream: +56.7 h SAIDI under the reference rule");
  await expect(ours.locator('[data-rule-finding="FD-MKT:SAIDI"]')).toContainText("+3.6 h");
  await expect(ours.getByRole("row", { name: /^SAIDI/ })).toHaveCount(6);
  await expect(ours.getByRole("row", { name: /^SAIDI/ }).filter({ hasText: "Hillcrest" })).toContainText("+20.9 h");

  // The portfolio's own indices and split, and day-by-day compliance for each feeder.
  await expect(tile(page, "SAIDI")).toContainText("240.9 h");
  await expect(page.locator("[data-band-feeder]")).toHaveCount(4);
  await expect(page.locator('[data-band-feeder="FD-MKT"]')).toContainText("23 days met the minimum, 7 did not");
});

test("Revenue: the gap, collection by customer class with MDA visible, and commercial against collection loss by feeder", async ({ page }) => {
  await page.goto("/dashboard/utility/revenue");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Revenue");
  // The revenue gap, as on the Executive page: an estimate, monthly, in two parts.
  await expect(panel(page, "Revenue gap")).toContainText("It is not an amount owed by anyone");
  await expect(tile(page, "Revenue not realised")).toContainText("₦46,310,113");
  await expect(tile(page, "Collection gap")).toContainText("Cash basis");

  // The valuation lists the ten largest transformers, says so, and has the rest one click away.
  const valuation = page.locator("[data-valuation]");
  const sections = valuation.locator('[data-table="gap-valuation"] [data-row^="section:"]');
  await expect(valuation).toHaveAttribute("data-valuation", "top");
  await expect(sections).toHaveCount(10);
  await expect(sections.nth(0)).toHaveAttribute("data-row", "section:DT-MKT-5");
  await expect(valuation).toContainText("The 10 largest of 48 sections by amount, then the residuals above them. The rows shown do not add up to the commercial gap.");
  await expect(valuation.locator('[data-row^="residual:"]')).toHaveCount(4);
  await valuation.getByRole("link", { name: "Show all 48" }).click();
  await expect(page).toHaveURL(/\/revenue\?valuation=all$/);
  await expect(sections).toHaveCount(48);
  await expect(valuation).toContainText("All 48 sections, largest amount first");
  await expect(tile(page, "Revenue not realised")).toContainText("₦46,310,113");
  await valuation.getByRole("link", { name: "Show the 10 largest" }).click();
  await expect(sections).toHaveCount(10);

  // Government (MDA) accounts are their own class and lead the list: 90 accounts, 19.8% collected, 45% of the shortfall.
  const classes = page.locator('[data-table="class-portfolio"] tbody tr');
  await expect(classes.nth(0)).toHaveAttribute("data-row", "government");
  for (const text of ["Government (MDA)", "90", "19.8%", "₦13,829,391", "45.0%"]) await expect(classes.nth(0)).toContainText(text);
  await expect(classes.nth(1)).toHaveAttribute("data-row", "residential");
  await expect(panel(page, "Collection by customer class")).toContainText("It is not the amount owed");
  await expect(tile(page, "Collection efficiency")).toContainText("83.8%");
  // By feeder, MDA is on Government Avenue and nowhere else.
  await expect(page.locator('[data-table="class-FD-GOV"] [data-row="government"]')).toContainText("88.4%");
  await expect(page.locator('[data-table="class-FD-MKT"] [data-row="government"]')).toHaveCount(0);

  // Commercial beside collection loss: Old Town loses to unbilled energy, Government Avenue to unpaid bills.
  const loss = page.locator('[data-table="loss-by-feeder"]');
  await expect(loss.locator('[data-row="FD-OLD"]')).toContainText("27.9%");
  await expect(loss.locator('[data-row="FD-OLD"]')).toContainText("23.1%");
  await expect(loss.locator('[data-row="FD-GOV"]')).toContainText("2.3%");
  await expect(loss.locator('[data-row="FD-GOV"]')).toContainText("26.9%");
  await expect(loss.locator('[data-row="FD-GOV"]')).toContainText("₦15,639,570");
  // Commercial loss is marked as derived, collection loss as calculated.
  await expect(loss.locator('[data-row="FD-OLD"]')).toContainText("27.9%≈Deri");
  await expect(loss.locator('[data-row="FD-OLD"]')).toContainText("23.1%≈Calc");
  await expect(page.locator("[data-loss-feeder]")).toHaveCount(4);
  await expect(panel(page, /^Commercial against collection loss/)).toContainText("never set against each other");
  await loss.getByRole("link", { name: "Old Town 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/operations\/feeders\/FD-OLD$/);
});
