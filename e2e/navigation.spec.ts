import { expect, test } from "@playwright/test";
import { OPERATIONS, ROUTES } from "./routes";

/* The menu, the one heading per page, and the one bar that says what data a screen shows. */

// The Phase 1 "Coming Soon" pages, removed in NAV-B step 5 (Founder, 10 November 2026): not found.
const PLACEHOLDERS = [
  "/dashboard/settings",
  "/dashboard/intelligence/ai",
  "/dashboard/intelligence/analytics",
];

const UTILITY = "/dashboard/intelligence/utility";
const MINIGRID = "/dashboard/intelligence/minigrid";
const ASSISTANTS = [`${UTILITY}/ai`, `${MINIGRID}/ai`];
const PLANNED_SECTORS = ["/dashboard/intelligence/der"];
const PLANNING = "/dashboard/plan";
// The planned planners' addresses (NAV-B step 3: E-mobility's is charging-hubs).
const PLANNED_PLANNERS = ["dt", "feeders", "network-expansion", "unserved", "underserved", "pue", "charging-hubs"].map((id) => `${PLANNING}/${id}`);
const METERING_FUND = "/dashboard/finance/metering-fund";
const REFUSED = "/dashboard/refused";

test("the rail holds the workspace's items, and the item the reader is in lists its views", async ({ page }) => {
  await page.goto(UTILITY);
  const rail = page.locator("[data-rail]");
  const views = page.locator("[data-rail-views-wide]");
  const hrefs = () => views.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") as string));
  const visited: string[] = [];
  // The Demonstration DisCo: Home, Intelligence, Plan and Finance; no Oversight (a regulator's).
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "utility");
  await expect(page.locator("[data-demo-badge]")).toBeVisible();
  await expect(rail.locator("[data-rail-item]")).toHaveText(["Home", "Intelligence", "Plan", "Finance"]);
  await expect(rail.locator("[data-rail-item][data-active]")).toHaveText(["Intelligence"]);
  // Intelligence lists the utility's screens, the assistant marked planned; nothing of another domain.
  expect(await hrefs()).toEqual([`${UTILITY}/executive`, OPERATIONS, `${UTILITY}/reliability`, `${UTILITY}/revenue`, `${UTILITY}/assets`, `${UTILITY}/events`, `${UTILITY}/map`, `${UTILITY}/ai`]);
  await expect(views.locator("[data-planned]")).toHaveText(["AI AssistantPlanned"]);
  await expect(rail.locator("[data-rail-reports]")).toHaveAttribute("href", "/dashboard/reports/utility");
  visited.push(...(await hrefs()), ...(await rail.locator("[data-rail-item]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") as string))));

  // A mini-grid screen is shown in the demo mini-grid operator's workspace, with its own rail.
  await page.goto(MINIGRID);
  await expect(page.locator("[data-workspace-frame]")).toHaveAttribute("data-workspace-type", "minigrid");
  await expect(rail.locator("[data-rail-item]")).toHaveText(["Home", "Intelligence", "Plan"]);
  expect(await hrefs()).toEqual([`${MINIGRID}/sites`, `${MINIGRID}/map`, `${MINIGRID}/ai`]);
  await expect(rail.locator("[data-rail-reports]")).toHaveAttribute("href", "/dashboard/reports/minigrid");
  visited.push(...(await hrefs()));
  // A screen below a view is still in its item.
  await page.goto(`${MINIGRID}/sites/MG-DRY`);
  await expect(rail.locator("[data-rail-item][data-active]")).toHaveText(["Intelligence"]);

  // Home is marked Home.
  await rail.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(rail.locator('[data-rail-item="home"]')).toHaveAttribute("aria-current", "page");

  // Every link in the rail leads to a screen that exists: none says "Coming Soon".
  for (const href of [...new Set(visited), ...PLANNED_SECTORS, PLANNING, METERING_FUND, ...PLANNED_PLANNERS]) {
    await page.goto(href);
    await expect(page.getByText("Coming Soon"), href).toHaveCount(0);
  }
  for (const href of PLACEHOLDERS) expect(visited, href).not.toContain(href);
});

test("a sector that is not built says so, in the rail and on its one page", async ({ page }) => {
  for (const [route, name] of [["/dashboard/intelligence/der", "DER Intelligence"]]) {
    await page.goto(route);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 }), route).toHaveText("Overview");
    await expect(main, route).toContainText("Planned · not built");
    await expect(main, route).toContainText(`${name} is not built yet. There is no data and no figure on this page.`);
    await expect(main.locator("[data-planned-structure] li"), route).toHaveText([/^Overview/, /^GIS Map/, /^AI Assistant/, /^Workspaces/]);
    // No figure, and nothing to operate.
    await expect(main.locator("[data-metric], [data-figure], input, textarea, select, button, form"), route).toHaveCount(0);
    // The demo DER developer's workspace: its Intelligence lists the one planned view.
    await expect(page.locator("[data-workspace-frame]"), route).toHaveAttribute("data-workspace-type", "der");
    await expect(page.locator("[data-rail-views-wide] [data-planned]"), route).toHaveText(["DER fleetPlanned"]);
    await expect(page.getByRole("note", { name: "About the data on this screen" }), route).toContainText("SYNTHETIC DATA");
  }
});

test("Planning lists its planners in two groups: Metering is built, the other seven say they are planned and hold no figure", async ({ page }) => {
  await page.goto(PLANNING);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(main.locator('[data-planning-group="utility"] [data-planner]')).toHaveText([/^Metering\s*Built/, /^Distribution transformers \(DT\)\s*Planned/, /^Feeders\s*Planned/, /^Network expansion\s*Planned/]);
  await expect(main.locator('[data-planning-group="minigrid"] [data-planner]')).toHaveText([/^Unserved\s*Planned/, /^Underserved\s*Planned/, /^Productive use of energy \(PUE\)\s*Planned/, /^E-mobility\s*Planned/]);
  // The rail: Plan, as the Demonstration DisCo's rail lists it, the planned ones marked so.
  await expect(page.locator('[data-rail-item][data-active]')).toHaveText(["Plan"]);
  await expect(page.locator("[data-rail-views-wide] a")).toHaveText(["Metering allocation", "DT sequencing", "FeedersPlanned", "Network expansionPlanned", "Charging hubs: siting and loadPlanned"]);

  for (const route of PLANNED_PLANNERS) {
    await page.goto(route);
    await expect(main, route).toContainText("Planned · not built");
    await expect(main, route).toContainText("This planner is not built yet. There is no data and no figure on this page.");
    await expect(main.locator("[data-metric], [data-figure], input, textarea, select, button, form"), route).toHaveCount(0);
  }
  expect((await page.request.get(`${PLANNING}/no-such-planner`)).status()).toBe(404);
});

test("an AI Assistant page says it is not built, gives example questions, and is nothing like a working assistant", async ({ page }) => {
  for (const route of ASSISTANTS) {
    await page.goto(route);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 }), route).toHaveText("AI Assistant");
    await expect(main, route).toContainText("Planned · not built");
    await expect(main, route).toContainText("This assistant is not built yet. Nothing on this page can be asked a question, and nothing on it is an answer.");
    await expect(main.locator("[data-planned-questions] li"), route).toHaveCount(4);
    await expect(main, route).toContainText("Every answer cites the figures");
    await expect(main, route).toContainText("It sees what you may see");
    // Nothing to type in, nothing to send, and no figure: every link on it leads to a screen that exists.
    await expect(main.locator("input, textarea, select, button, form, [contenteditable], [role=textbox], [role=log]"), route).toHaveCount(0);
    await expect(main.locator("[data-metric], [data-figure]"), route).toHaveCount(0);
    await expect(page.getByRole("note", { name: "About the data on this screen" }), route).toContainText("SYNTHETIC DATA");
  }
  await page.goto(ASSISTANTS[0]);
  await page.getByRole("main").getByRole("link", { name: /Revenue/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence\/utility\/revenue$/);
});

test("Home holds the workspace's initiatives and a clear way to the Platform overview, now under Intelligence", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("[data-workspace-home] [data-initiative-card]").first()).toBeVisible();
  const link = page.locator("[data-platform-overview-link]").getByRole("link", { name: "Platform overview (now under Intelligence)" });
  await link.click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence$/);
  await expect(page.locator('[data-overview="platform"]')).toBeVisible();
});

test("the Platform Overview says what GridIntel does, shows every sector on one map and leads into each sector's findings", async ({ page }) => {
  await page.goto("/dashboard/intelligence");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Know what your network is really doing, not just what the report says.");
  // The hero is a brand area: it holds no figure.
  await expect(main.locator("[data-hero] [data-figure], [data-hero] [data-metric]")).toHaveCount(0);
  // Three lines of each sector, each a line of that sector's own Overview, with status and origin.
  const utility = main.locator('[data-sector="utility"]');
  await expect(utility.locator("[data-attention]")).toHaveCount(3);
  await expect(utility.locator("[data-attention]").first()).toContainText("Fault at Farm Road 11 kV feeder, 10 transformers still without supply.");
  await expect(utility.locator("[data-attention]").first()).toContainText("1,015");
  // Each sector's largest difference between a report and the records is among its lines.
  const hillcrest = utility.locator('[data-attention^="report_differs:"]');
  await expect(hillcrest).toContainText("Hillcrest 33/11 kV injection substation: the SAIDI its report states is furthest from the outage log.");
  await expect(hillcrest).toContainText("SAIDI1.9 h reported · 23.1 h calculated (+21.2 h)");
  const minigrid = main.locator('[data-sector="minigrid"]');
  await expect(minigrid.locator("[data-attention]")).toHaveCount(3);
  await expect(minigrid.locator('[data-attention="report_differs:MG-DRY"]')).toContainText("Dry River's report differs from its records on 3 of the 8 figures it states.");
  // A report line leads with its largest difference, measured against the reported figure.
  await expect(minigrid.locator('[data-attention="report_differs:MG-DRY"]')).toContainText("Generator running hours");
  await expect(main).toContainText("Listed by fixed rules, not by AI.");
  // The rule and the source and method of a line are one tap away, not left out.
  const fault = utility.locator("[data-attention]").first();
  await fault.locator("summary").click();
  await expect(fault).toContainText("Why it is listed: Every interruption the outage log holds as in progress at the as-of time.");
  // Every sector on one map: the utility's substations and the mini-grid sites, among the states.
  await expect(page.locator("path.gi-kind-substation")).toHaveCount(2);
  await expect(page.locator("path.gi-kind-minigrid_site")).toHaveCount(4);
  await expect(page.locator("path.gi-outline-state")).toHaveCount(37);
  await expect(page.locator("[data-map-credits]")).toContainText("geoBoundaries");
  // The sectors that are not built are said not to be.
  await expect(main.locator("[data-to-join] li")).toHaveText([/DER Intelligence\s*Planned/, /Planning\s*Partly built\s*Metering is built. The other planners are planned./]);
  await utility.locator("[data-open-sector]").click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence\/utility$/);
});

test("a sector's Overview says what needs attention, in the fixed order of its rules, with links in", async ({ page }) => {
  await page.goto(UTILITY);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Overview");
  const lines = main.locator("[data-attention]");
  expect(await lines.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-attention")?.split(":")[0]))).toEqual(["in_progress", "asset_risk", "asset_risk", "revenue", "report_differs", "standing_alarms", "assets_listed"]);
  // A line is never told by colour alone: it carries a mark and a word.
  await expect(lines.first()).toContainText("▲Act·In progress now");
  await expect(main.locator('[data-attention="asset_risk:DT-OLD-2"]')).toContainText("121.2%");
  await expect(main.locator('[data-attention="asset_risk:DT-OLD-2"]').getByRole("link")).toHaveAttribute("href", `${OPERATIONS}/transformers/DT-OLD-2`);
  // The headline figures and the loss split are the Executive workspace's own.
  await expect(main.locator('[data-headline] [data-metric="ATC&C"]')).toContainText("31.4%");
  await expect(main.locator("[data-loss-split]")).toContainText("Technical");
  await expect(main.locator("[data-loss-split] [role=img]")).toHaveAttribute("aria-label", /Technical 9\.\d%, Commercial 8\.9%, Collection 13\.2%/);
  // The ways in: the map, the six workspaces, and the assistant marked planned.
  await expect(main.locator("[data-ways-in] a")).toHaveCount(8);
  await expect(main.locator("[data-ways-in]")).toContainText("Which feeders fail their customers, why, and is it ours to fix?");

  await page.goto(MINIGRID);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(main.locator("[data-attention]")).toHaveCount(6);
  await expect(main.locator('[data-attention="pv_held_back:MG-GRN"]')).toContainText("72.4%");
  await expect(main.locator('[data-site-mix] [data-site="MG-DRY"]')).toContainText("49.6%");
  await expect(main.locator('[data-site-mix] [data-site="MG-GRN"]')).toContainText("100.0%");
  await main.locator('[data-site-mix] [data-site="MG-DRY"]').getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence\/minigrid\/sites\/MG-DRY$/);
});

test("on a phone the rail is across the top, the item's views a row below it, the data bar stays in view and nothing is wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/dashboard", UTILITY, MINIGRID, `${UTILITY}/map`, `${MINIGRID}/map`, `${UTILITY}/ai`]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    expect(await page.evaluate(() => (document.querySelector("main") as HTMLElement).scrollWidth <= (document.querySelector("main") as HTMLElement).clientWidth + 1), route).toBe(true);
    const bar = page.getByRole("note", { name: "About the data on this screen" });
    await expect(bar.getByText("SYNTHETIC DATA", { exact: true }), route).toBeVisible();
    await expect(bar.getByText("Reporting period", { exact: true }), route).toBeVisible();
    // The signed-in frame starts the page within 200 px of the top on a phone. ADR 0021 requires the workspace
    // header (the organization's mark and name), which the old menu did not carry; the Founder allowed 200 px
    // for it (26 November 2026). The public pages keep their own, tighter budget.
    expect(await page.evaluate(() => (document.querySelector("main") as HTMLElement).getBoundingClientRect().top), route).toBeLessThan(200);
  }
  // What the dataset is opens with one tap.
  const bar = page.getByRole("note", { name: "About the data on this screen" });
  await expect(bar.getByText("It describes no real network")).toBeHidden();
  await bar.locator("[data-about-data]").click();
  await expect(bar.getByText("It describes no real network")).toBeVisible();
  // The rail is one row no wider than the screen (it scrolls), and every screen is one tap away.
  const rail = page.locator("[data-rail]");
  expect(await rail.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(page.locator("[data-rail-narrow]")).toBeVisible();
  await page.goto(UTILITY);
  await expect(page.locator("[data-rail-views-narrow]")).toBeVisible();
  await page.locator("[data-rail-views-narrow]").getByRole("link", { name: "Revenue" }).click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence\/utility\/revenue$/);
  await page.goto(MINIGRID);
  await page.locator("[data-rail-views-narrow]").getByRole("link", { name: "Sites" }).click();
  await expect(page).toHaveURL(/\/dashboard\/intelligence\/minigrid\/sites$/);
});

test("the theme can be changed and is kept", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(UTILITY);
  const html = page.locator("html");
  // Without a choice, the device's own setting.
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.locator("[data-workspace-header] [data-theme-toggle]").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  // The SYNTHETIC DATA bar is there in both.
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
});

test("the rail marks the view the reader is in, at any depth", async ({ page }) => {
  const views = page.locator("[data-rail-views-wide]");
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  await expect(views.locator('[aria-current="page"]')).toHaveText(["Operations"]);
  await page.goto("/dashboard/intelligence/utility/revenue");
  await expect(views.locator('[aria-current="page"]')).toHaveText(["Revenue"]);
  await page.goto("/dashboard/intelligence/utility/events");
  await expect(views.locator('[aria-current="page"]')).toHaveText(["Events / Alarms"]);
  // A site's screen is inside the Sites view.
  await page.goto("/dashboard/intelligence/minigrid/sites/MG-PLM");
  await expect(views.locator('[aria-current="page"]')).toHaveText(["Sites"]);
  // Each domain's own views are told apart; an item's landing marks the item.
  await page.goto(`${MINIGRID}/map`);
  await expect(views.locator('[aria-current="page"]')).toHaveText(["GIS Map"]);
  expect(await views.locator('[aria-current="page"]').getAttribute("href")).toBe(`${MINIGRID}/map`);
  await page.goto(UTILITY);
  await expect(page.locator('[data-rail-item="intelligence"]')).toHaveAttribute("aria-current", "page");
  await expect(views.locator('[aria-current="page"]')).toHaveCount(0);
});

test("the old Map addresses lead to the Platform Overview", async ({ page }) => {
  for (const old of ["/dashboard/map", "/dashboard/intelligence/gis"]) {
    await page.goto(old);
    await expect(page, old).toHaveURL(/\/dashboard\/intelligence$/);
    await expect(page.locator('[data-overview="platform"]'), old).toBeVisible();
    await expect(page.getByText("Coming Soon"), old).toHaveCount(0);
  }
});

test("the three Phase 1 placeholder pages are gone: each answers not found", async ({ request }) => {
  for (const route of PLACEHOLDERS) expect((await request.get(route)).status(), route).toBe(404);
});

test("every page has exactly one h1", async ({ page }) => {
  const pages = [...ROUTES, ...ASSISTANTS, ...PLANNED_SECTORS, PLANNING, METERING_FUND, ...PLANNED_PLANNERS, REFUSED, `${OPERATIONS}/feeders/NOPE`];
  test.setTimeout(pages.length * 6_000);
  for (const route of pages) {
    await page.goto(route);
    await expect(page.locator("h1"), route).toHaveCount(1);
  }
});

test("the reporting period and the SYNTHETIC DATA label are in one bar, once, on every dashboard page", async ({ page }) => {
  // "/" is the public Home since NAV-B step 7: a public page carries no data bar (front-door.spec.ts).
  for (const route of ["/dashboard", "/dashboard/intelligence/utility", "/dashboard/intelligence/utility/executive", `${OPERATIONS}/feeders/FD-MKT`, "/dashboard/intelligence/utility/reliability", "/dashboard/intelligence/utility/revenue", "/dashboard/intelligence/utility/assets", "/dashboard/intelligence/utility/events", "/dashboard/intelligence/utility/map", "/dashboard/intelligence/utility/ai", "/dashboard/intelligence/minigrid", "/dashboard/intelligence/minigrid/map", "/dashboard/intelligence/minigrid/sites", "/dashboard/intelligence/minigrid/sites/MG-GRN", "/dashboard/reports"]) {
    await page.goto(route);
    const bar = page.getByRole("note", { name: "About the data on this screen" });
    await expect(bar, route).toHaveCount(1);
    await expect(bar, route).toContainText("SYNTHETIC DATA");
    await expect(bar, route).toContainText("Reporting period1 Sep 2026 – 30 Sep 2026");
    await expect(bar, route).toContainText("Data as of1 Oct 2026, 00:00 WAT");
    // No screen repeats the period in its own header.
    await expect(page.getByText("Reporting period", { exact: true }), route).toHaveCount(1);
    await expect(page.getByText("SYNTHETIC DATA", { exact: true }), route).toHaveCount(1);
  }
});

test("the site asks not to be indexed: a robots meta on every page and a robots.txt that disallows everything", async ({ page, request }) => {
  for (const route of ["/", "/dashboard", "/dashboard/intelligence/utility/executive", `${OPERATIONS}/feeders/FD-MKT`, "/dashboard/reports", `${OPERATIONS}/feeders/NOPE`]) {
    await page.goto(route);
    // A not-found page carries Next's own "noindex" tags as well; the first is the layout's.
    await expect(page.locator('meta[name="robots"]').first(), route).toHaveAttribute("content", "noindex, nofollow");
  }
  // An address that leads nowhere is not indexed either, and carries the bar like every other screen.
  await page.goto("/no-such-page");
  await expect(page.locator("[data-not-found]")).toContainText("Page not found");
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
  await expect(page.locator("h1")).toHaveCount(1);
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const lines = (await robots.text()).split("\n").map((line) => line.trim()).filter(Boolean);
  expect(lines).toEqual(["User-Agent: *", "Disallow: /"]);
});

test("the public demonstration may open every screen, and the page a refused route is answered with says only that it is not open", async ({ page, request }) => {
  // The viewer of the demonstration holds everything: nothing in its menu or its routes is refused.
  for (const route of ["/dashboard", UTILITY, `${UTILITY}/revenue`, `${OPERATIONS}/feeders/FD-OLD`, MINIGRID, `${MINIGRID}/sites/MG-DRY`, ...PLANNED_SECTORS, PLANNING, METERING_FUND, ...PLANNED_PLANNERS]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }
  // Which routes a narrower grant refuses is tested where the grant is decided (src/constants/access.test.ts).
  await page.goto(REFUSED);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Not open to you");
  await expect(page.locator("[data-refused]")).toContainText("Your access does not include this screen.");
  await expect(page.locator("[data-refused] [data-metric], [data-refused] [data-figure]")).toHaveCount(0);
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
});

test("the public demonstration has no accounts: no sign-in, no people screen, no one signed in (ADR 0020)", async ({ page, request }) => {
  for (const route of ["/login", "/login/verify", "/login/enrol", "/dashboard/account/people"]) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
  expect((await request.get("/auth/confirm?token_hash=x&type=invite")).status()).toBe(404);
  expect((await request.post("/auth/signout")).status()).toBe(404);
  await page.goto("/dashboard/intelligence");
  await expect(page.locator("[data-account]")).toHaveCount(0);
  await expect(page.locator("[data-sector]")).toHaveCount(2);
});
