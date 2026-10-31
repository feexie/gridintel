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
  // The tab bar is left out: the Founder named the tab "Journey" (31 October 2026); the screen's own words are checked.
  const text = (await main.evaluate((node) => { const copy = node.cloneNode(true) as HTMLElement; copy.querySelector("[data-metering-tabs]")?.remove(); return copy.textContent ?? ""; })).toLowerCase();
  for (const word of ["ai-powered", "insights", "unlock", "seamless", "leverage", "empower", "revolutionise", "harness", "cutting-edge", "journey", "at a glance"]) expect(text, word).not.toContain(word);
});

test("the GridIntel structure stands beside the fund alone, with investors, protection and a receipt", async ({ page }) => {
  await page.goto(`${FUND}?case=nigeria`);
  const main = page.getByRole("main");
  await expect(main.locator("[data-positioning]")).toContainText("Plan · Access → Fund · Affordability → Monitor · Availability");
  await expect(main.locator("[data-positioning]")).toContainText("Plan for access, fund for affordability, monitor for availability.");
  await expect(main.locator("[data-fund-alone]")).toHaveText("Fund alone: ₦1,286 a month, 4.9x the cap.");
  await expect(main.locator("[data-structure-sentence]")).toContainText("GridIntel structure: within the cap for every band; public money");
  await expect(main.locator("[data-inflation-line]")).toHaveText(/^Survives inflation if tariffs follow at least \d+% of it; all three shocks at \d+%\./);
  // Initial investment against break-even, for both, each with its chart.
  await expect(main.locator("[data-investment-case]")).toHaveCount(2);
  await expect(main.locator('[data-investment] [data-chart="cash-flow"]')).toHaveCount(2);
  await expect(main.locator('[data-investment-case="Fund alone"]')).toContainText("Peak capital in");
  await expect(main.locator('[data-investment-case="GridIntel structure"]')).toContainText("Break-even");
  await expect(main.locator("[data-structure-sentence]")).toContainText("of the ₦700bn already raised for PMI; survives 2 of 4 shocks.");
  // What it fails, split: the fund's shortfall, investors (never more than their capital) and what is uncovered.
  await expect(main.locator("[data-structure-failures]")).toContainText("Inflation: fund shortfall");
  await expect(main.locator("[data-structure-failures]")).toContainText("uncovered beyond investors, which falls to the public side unless tariffs follow inflation");
  await expect(main.locator("[data-public-per-meter]")).toHaveText(/^The same order of public money meters [\d.]+ million customers in this structure\.$/);
  await expect(main.locator('[data-shown-figure="pmiPerMeter"]')).toContainText(" to ");
  await expect(main.locator('[data-stress-row="combined"] [data-stress-split]')).toContainText("of their");
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

test("DT sequencing: every DT ranked by revenue per naira, the revolving effect, all marked synthetic", async ({ page }) => {
  await page.goto("/dashboard/planning/metering/allocation");
  await page.locator("[data-metering-tabs]").getByRole("link", { name: /DT sequencing/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/planning\/metering\/dt$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^Metering the 5 highest-ranked DTs first recovers \d+% of the revenue for \d+% of the CAPEX\.$/);
  await expect(main.locator("[data-headline]")).toContainText("Synthetic");
  await expect(main.locator('[data-chart="revolving"] [data-chart-legend] li')).toHaveCount(2);
  await expect(main.locator("[data-dts] tbody tr").first()).toContainText("1");
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
  await main.locator('[data-planning-input="budget"] input').fill("10000000");
  await main.getByRole("button", { name: "Recalculate" }).click();
  await expect(page).toHaveURL(/budget=10000000/);
});

test("Monitoring: plan against synthetic actuals, tranches against verified installs, a later quarter not reported", async ({ page }) => {
  await page.goto("/dashboard/planning/metering/monitoring");
  const main = page.getByRole("main");
  await expect(main.locator("[data-tranche-line]")).toHaveText(/^Fund money is released in tranches against verified installs/);
  await expect(main.locator("[data-monitoring-table] tbody tr")).toHaveCount(11);
  await expect(main.locator("[data-headline]")).toContainText("Synthetic");
  await main.locator("[data-quarters]").getByRole("link", { name: /2027 Q1/ }).click();
  await expect(main.locator("[data-not-reported]")).toContainText("not as zero");
});

test("Marketplace: pledges matched to approved meters, the daily charge by band, unmatched money queued, all marked synthetic", async ({ page }) => {
  await page.goto("/dashboard/planning/metering/allocation");
  await page.locator("[data-metering-tabs]").getByRole("link", { name: /Marketplace · Match/ }).click();
  await expect(page).toHaveURL(/\/metering\/marketplace$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^5 funders have pledged ₦[\d.,]+ (million|billion); [\d,]+ approved meters are matched; ₦[\d.,]+( million| billion)? is queued for the next allocation\.$/);
  await expect(main.locator("[data-headline]")).toContainText("Synthetic");
  await expect(main.locator("[data-headline] [data-how]")).toHaveText(/^How this is calculated:/);
  await expect(main.locator("[data-funders] tbody tr")).toHaveCount(5);
  await expect(main.locator('[data-queued="yes"]').first()).toContainText("Queued for the next allocation");
  await expect(main.locator("[data-band-charges] tbody tr")).toHaveCount(7);
  await expect(main.locator("[data-demand] tbody tr")).toHaveCount(11);
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
});

test("One meter's journey: six steps for one household in Ibadan, each naming who acts and linking to its screen, the balance falling, marked synthetic", async ({ page }) => {
  await page.goto("/dashboard/planning/metering/marketplace");
  await page.locator("[data-metering-tabs]").getByRole("link", { name: /Journey/ }).click();
  await expect(page).toHaveURL(/\/metering\/journey$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^On GridIntel one household in Ibadan applied/);
  await expect(main.locator("[data-headline]")).toContainText("Synthetic");
  await expect(main.locator("[data-step]")).toHaveCount(6);
  await expect(main.locator('[data-step="funded"] [data-step-link]')).toHaveAttribute("href", "/dashboard/planning/metering/marketplace");
  await expect(main.locator('[data-step="installed"] [data-step-link]')).toHaveAttribute("href", "/dashboard/planning/metering/monitoring");
  await expect(main.locator("[data-schedule] tbody tr").last()).toContainText("Repaid");
});

test("About this build: the baseline, the sprint's commits with times, and the comparison link", async ({ page }) => {
  await page.goto("/dashboard/planning/about-this-build");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^The Metering planner was built in the sprint: \d+ commits after the tag geh-baseline\.$/);
  await expect(main.locator("[data-compare-link]")).toHaveAttribute("href", "https://github.com/feexie/gridintel/compare/geh-baseline...geh-sprint");
  expect(await main.locator("[data-sprint-rows] tbody tr").count()).toBeGreaterThan(10);
  await expect(main.locator("[data-baseline] li").first()).toBeVisible();
});

test("presentation mode on DisCo allocation, DT sequencing, Marketplace, Monitoring and About this build: no navigation, no tabs, a larger headline, kept through a form or a quarter", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const path of ["/dashboard/planning/metering/allocation", "/dashboard/planning/metering/dt", "/dashboard/planning/metering/marketplace", "/dashboard/planning/metering/monitoring", "/dashboard/planning/metering/journey", "/dashboard/planning/about-this-build"]) {
    await page.goto(`${path}?present=1`);
    await expect(page.locator("[data-sidebar]"), path).toBeHidden();
    await expect(page.locator("[data-metering-tabs]"), path).toBeHidden();
    const size = await page.getByRole("main").getByRole("heading", { level: 1 }).evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size, path).toBeGreaterThanOrEqual(36);
    await expect(page.getByRole("link", { name: "Leave presentation mode" }), path).toBeVisible();
  }
  await page.goto("/dashboard/planning/metering/allocation?present=1");
  await page.locator("[data-allocation-form]").getByRole("button", { name: "Recalculate" }).click();
  await expect(page).toHaveURL(/present=1/);
  await page.goto("/dashboard/planning/metering/monitoring?present=1");
  await page.locator("[data-quarters]").getByRole("link", { name: /2027 Q1/ }).click();
  await expect(page).toHaveURL(/quarter=.*present=1/);
  await expect(page.locator("[data-sidebar]")).toBeHidden();
  await page.getByRole("link", { name: "Leave presentation mode" }).click();
  await expect(page.locator("[data-sidebar]")).toBeVisible();
});

test("the Planning overview says it shows no data", async ({ page }) => {
  await page.goto("/dashboard/planning");
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("NO DATA ON THIS SCREEN");
});

test("each step is paired with its A, in the tabs and the screens' eyebrows", async ({ page }) => {
  await page.goto("/dashboard/planning/metering/allocation");
  const tabs = page.locator("[data-metering-tabs]");
  await expect(tabs.getByRole("link", { name: /DisCo allocation/ })).toContainText("Plan · Access");
  await expect(tabs.getByRole("link", { name: /Metering Fund/ })).toContainText("Fund · Affordability");
  await expect(tabs.getByRole("link", { name: /Monitoring/ })).toContainText("Monitor · Availability");
  await expect(page.locator("[data-headline]").first()).toContainText("Plan · Access · DisCo allocation");
  await page.goto("/dashboard/planning/metering/monitoring");
  await expect(page.locator("[data-headline]").first()).toContainText("Monitor · Availability");
  await page.goto("/dashboard/planning/metering");
  await expect(page.locator("[data-headline]").first()).toContainText("Fund · Affordability · Metering Fund");
});

test("the Metering Plan report: a Download report link on every Metering screen, six sections in order, the sources, and a print button", async ({ page }) => {
  for (const path of ["/dashboard/planning/metering", "/dashboard/planning/metering/allocation", "/dashboard/planning/metering/dt", "/dashboard/planning/metering/marketplace", "/dashboard/planning/metering/monitoring", "/dashboard/planning/metering/journey", "/dashboard/planning/about-this-build"]) {
    await page.goto(path);
    await expect(page.locator("[data-report-link]"), path).toHaveAttribute("href", /\/dashboard\/planning\/metering\/report/);
  }
  await expect(page.locator("[data-about-report]")).toContainText("The Metering Plan report");
  await expect(page.locator("[data-steps] li")).toHaveCount(3);
  await page.goto("/dashboard/planning/metering?case=nigeria");
  await page.locator("[data-report-link]").click();
  await expect(page).toHaveURL(/\/metering\/report\?case=nigeria/);
  const report = page.locator("[data-metering-report]");
  await expect(report.locator("h1")).toHaveText("Metering Plan");
  await expect(report.locator("[data-report-section]")).toHaveCount(7);
  const ids = await report.locator("[data-report-section]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-report-section")));
  expect(ids).toEqual(["gap", "access", "affordability", "availability", "shocks", "assumptions", "sources"]);
  await expect(report.locator('[data-report-section="access"]')).toContainText("Plan · Access");
  await expect(report.locator('[data-report-section="availability"]')).toContainText("Synthetic:");
  await expect(report.locator('[data-report-section="affordability"]')).toContainText("The same order of public money meters");
  await expect(report.locator("[data-report-citations] li").first()).toBeVisible();
  await expect(page.locator("[data-print-report]")).toBeVisible();
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("MONITORING SYNTHETIC");
  const text = (await report.innerText()).toLowerCase();
  for (const word of ["ai-powered", "insights", "unlock", "seamless", "leverage", "empower", "revolutionise", "harness", "cutting-edge", "journey", "at a glance"]) expect(text, word).not.toContain(word);
});
