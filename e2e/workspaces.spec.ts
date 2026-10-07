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

test("Assets: the assets with something on them, each fact in its own column, and loading by class", async ({ page }) => {
  await page.goto("/dashboard/utility/assets");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Assets");

  // Nine of the 55 assets are listed, in the order the rule states, and the rule is printed.
  const attention = page.locator('[data-table="attention"] tbody tr');
  await expect(attention).toHaveCount(9);
  await expect(attention.nth(0)).toHaveAttribute("data-row", "DT-OLD-3");
  await expect(attention.nth(1)).toHaveAttribute("data-row", "PT-RIV-1");
  await expect(attention.nth(2)).toHaveAttribute("data-row", "DT-OLD-2");
  await expect(panel(page, "Assets with something on them")).toContainText("9 of 55 in-service assets");
  await expect(panel(page, "Assets with something on them")).toContainText("It is an ordering of facts, not a score.");

  // South Gate: the source's alarm and GridIntel's condition are both on its monitor, in separate columns, and agree.
  await expect(attention.nth(0).locator("[data-asset-alarm]")).toContainText("RTU-COMMS-FAIL");
  await expect(attention.nth(0).locator("[data-asset-alarm]")).toContainText("on its monitor");
  await expect(attention.nth(0).locator("[data-asset-condition]")).toContainText("Rule: Monitor quiet, on its monitor");
  await expect(attention.nth(0).locator("[data-asset-condition]")).toContainText("holds at the as-of time · a source alarm agrees");
  // Riverbank: above rating at 69 of 720 readings, a derived condition no source alarm was raised for, and one interruption began there.
  const riverbank = page.locator('[data-table="attention"] [data-row="DT-OLD-2"]');
  for (const text of ["121.2%", "69 of 720", "Rule: Loaded above rating", "no source alarm was raised", "1 · 0.14 h SAIDI"]) await expect(riverbank).toContainText(text);
  await expect(riverbank.locator("[data-asset-alarm]")).toHaveCount(0);
  // The standing alarm on Hillcrest substation is not on any listed asset; the screen says where it is.
  await expect(panel(page, "Assets with something on them")).toContainText("1 standing alarm(s) name a substation as a whole");

  // Loading by class: every power transformer and feeder; the ten most loaded transformers, with all 48 one click away.
  await expect(page.locator('[data-table="assets-power_transformer"] tbody tr')).toHaveCount(3);
  await expect(page.locator('[data-table="assets-power_transformer"] [data-row="PT-RIV-1"]')).toContainText("72.2%");
  await expect(page.locator('[data-table="assets-feeder"] tbody tr')).toHaveCount(4);
  const transformers = page.locator('[data-asset-class="distribution_transformer"]');
  await expect(transformers).toHaveAttribute("data-listing", "top");
  await expect(transformers.locator("tbody tr")).toHaveCount(10);
  await expect(transformers.locator("tbody tr").nth(0)).toHaveAttribute("data-row", "DT-OLD-2");
  await expect(transformers).toContainText("The 10 with the highest peak loading, of 48.");
  await transformers.getByRole("link", { name: "Show all 48" }).click();
  await expect(page).toHaveURL(/\/assets\?transformers=all$/);
  await expect(transformers.locator("tbody tr")).toHaveCount(48);
  await expect(attention).toHaveCount(9);

  // What is not held is said, not filled in.
  await expect(page.locator('[data-not-held="Maintenance records"]')).toContainText("Not available. No source supplies work orders");
  await expect(tile(page, "Monitoring devices in the registry")).toContainText("50");

  await page.locator('[data-table="attention"]').getByRole("link", { name: "Riverbank transformer" }).click();
  await expect(page).toHaveURL(/\/operations\/transformers\/DT-OLD-2$/);
});

test("Events / Alarms: what is wrong now in three separate lists, where, and who is behind it", async ({ page }) => {
  await page.goto("/dashboard/utility/events");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Events / Alarms");
  const now = panel(page, "What is wrong now");
  await expect(now).toContainText("As of 1 Oct 2026, 00:00 WAT · three separate lists, never merged");

  // Source alarms standing: three, most severe first, each with where it is and the accounts behind it.
  const alarms = now.locator('[data-table="standing-alarms"] tbody tr');
  await expect(now.locator('[data-now="alarms"]')).toContainText("Source alarms standing (3)");
  await expect(alarms).toHaveCount(3);
  for (const text of ["high", "DC-SUPPLY-LOW", "Hillcrest 33/11 kV injection substation", "Not acknowledged", "2,781"]) await expect(alarms.nth(0)).toContainText(text);
  for (const text of ["RTU-COMMS-FAIL", "Monitor on South Gate transformer", "Old Town 11 kV feeder", "a derived condition agrees (Monitor quiet)", "42"]) await expect(alarms.nth(1)).toContainText(text);
  // The alarm with no raise time is not called standing.
  await expect(now.locator('[data-now="alarms"]')).toContainText("1 more alarm(s) have no raise time in the source");

  // Derived conditions that hold: one, in its own list, and it names the source alarm that agrees.
  const conditions = now.locator('[data-table="holding-conditions"] tbody tr');
  await expect(conditions).toHaveCount(1);
  for (const text of ["Monitor quiet", "Monitor on South Gate transformer", "9.1 h", "Agrees: RTU-COMMS-FAIL"]) await expect(conditions.nth(0)).toContainText(text);
  await expect(now.locator('[data-now="conditions"]')).toContainText("2 more condition(s) were found in the period and do not hold at the as-of time");

  // Interruptions: none in progress, and one with no restoration time kept apart from them.
  await expect(now.locator('[data-now="interruptions"]')).toContainText("Interruptions in progress (0)");
  await expect(now.locator('[data-now="interruptions"]')).toContainText("The outage log records no interruption in progress at the as-of time.");
  const open = now.locator('[data-table="restoration-not-recorded"] tbody tr');
  await expect(open).toHaveCount(1);
  for (const text of ["SP-MKT2-001", "Market Road 11 kV feeder", "No restoration time recorded"]) await expect(open.nth(0)).toContainText(text);
  await expect(now.locator('[data-now="restoration-not-recorded"]')).toContainText("these are not counted as in progress");
  await expect(now).toContainText("It is not a count of customers without supply");

  // Where: both substations and their feeders.
  const places = page.locator('[data-table="places"] tbody tr');
  await expect(places).toHaveCount(6);
  await expect(page.locator('[data-table="places"] [data-row="SS-HIL"]')).toContainText("2,781");
  await expect(page.locator('[data-table="places"] [data-row="FD-OLD"]')).toContainText("2,066");

  // The full two lists: every cleared alarm, not the most recent six.
  const full = panel(page, "Alarms and derived conditions");
  await expect(full.locator('[data-alarms="recorded"]')).toContainText("Raised in the period and cleared (27)");
  await expect(full.locator('[data-alarms="recorded"] [data-alarm-state="cleared"]')).toHaveCount(27);
  await expect(full.locator('[data-alarms="derived"] [data-condition]')).toHaveCount(3);
  await expect(full.locator('[data-alarms="recorded"] [data-condition]')).toHaveCount(0);

  await alarms.nth(1).getByRole("link", { name: "Old Town 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/operations\/feeders\/FD-OLD$/);
});
