import { expect, test } from "@playwright/test";
import { OPERATIONS, ROUTES } from "./routes";

/* The menu, the one heading per page, and the one bar that says what data a screen shows. */

const PLACEHOLDERS = [
  "/dashboard/der",
  "/dashboard/planning",
  "/dashboard/reports",
  "/dashboard/settings",
  "/dashboard/intelligence/ai",
  "/dashboard/intelligence/analytics",
];

const UTILITY = "/dashboard/utility";
const MINIGRID = "/dashboard/minigrid";
const ASSISTANTS = [`${UTILITY}/ai`, `${MINIGRID}/ai`];

test("every sector has the same menu: Overview, GIS Map, AI Assistant marked planned, then its workspaces", async ({ page }) => {
  await page.goto(UTILITY);
  const menu = page.getByRole("navigation", { name: "Main" });
  const links = await menu.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") as string));
  expect(links).toEqual([
    "/dashboard",
    UTILITY,
    `${UTILITY}/map`,
    `${UTILITY}/ai`,
    `${UTILITY}/executive`,
    OPERATIONS,
    `${UTILITY}/reliability`,
    `${UTILITY}/revenue`,
    `${UTILITY}/assets`,
    `${UTILITY}/events`,
    MINIGRID,
    `${MINIGRID}/map`,
    `${MINIGRID}/ai`,
    `${MINIGRID}/sites`,
  ]);
  // There is no top-level Map: the platform has an Overview only.
  await expect(menu.getByRole("region", { name: "Platform" }).getByRole("link")).toHaveText(["Overview"]);
  for (const sector of ["Utility Intelligence", "Mini-grid Intelligence"]) {
    const items = menu.getByRole("region", { name: sector }).getByRole("link");
    // What is not built is marked so in a word, in the menu, before it is opened.
    expect((await items.allTextContents()).slice(0, 3), sector).toEqual(["Overview", "GIS Map", "AI AssistantPlanned"]);
    await expect(menu.getByRole("region", { name: sector }).locator("[data-planned]"), sector).toHaveCount(1);
  }
  await expect(menu.getByRole("region", { name: "Utility Intelligence" }).getByRole("link")).toHaveCount(9);
  await expect(menu.getByRole("region", { name: "Mini-grid Intelligence" }).getByRole("link")).toContainText(["Overview", "GIS Map", "AI Assistant", "Sites"]);
  // Every link in the menu leads to a screen that exists: none says "Coming Soon".
  for (const href of links) {
    await page.goto(href);
    await expect(page.getByText("Coming Soon"), href).toHaveCount(0);
  }
  for (const href of PLACEHOLDERS) expect(links, href).not.toContain(href);
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
  await expect(page).toHaveURL(/\/dashboard\/utility\/revenue$/);
});

test("the Platform Overview says what GridIntel does, shows every sector on one map and leads into each sector's findings", async ({ page }) => {
  await page.goto("/dashboard");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("See where energy and money are lost");
  // The hero is a brand area: it holds no figure.
  await expect(main.locator("[data-hero] [data-figure], [data-hero] [data-metric]")).toHaveCount(0);
  // Three lines of each sector, each a line of that sector's own Overview, with status and origin.
  const utility = main.locator('[data-sector="utility"]');
  await expect(utility.locator("[data-attention]")).toHaveCount(3);
  await expect(utility.locator("[data-attention]").first()).toContainText("Fault at Farm Road 11 kV feeder, 10 elements still without supply.");
  await expect(utility.locator("[data-attention]").first()).toContainText("1,015");
  await expect(utility.locator('[data-attention="revenue:FD-GOV"]')).toContainText("₦16,953,603");
  await expect(utility.locator('[data-attention="revenue:FD-GOV"]')).toContainText("Estimated inputs");
  await expect(utility.locator('[data-attention="revenue:FD-GOV"]')).toContainText("Derived");
  const minigrid = main.locator('[data-sector="minigrid"]');
  await expect(minigrid.locator("[data-attention]")).toHaveCount(3);
  await expect(minigrid.locator('[data-attention="report_differs:MG-DRY"]')).toContainText("Dry River's report differs from its records on 3 of the 8 figures it states.");
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
  await expect(main.locator("[data-to-join] li")).toHaveText([/DER Intelligence\s*Planned/, /Planning\s*Planned/]);
  await utility.locator("[data-open-sector]").click();
  await expect(page).toHaveURL(/\/dashboard\/utility$/);
});

test("a sector's Overview says what needs attention, in the fixed order of its rules, with links in", async ({ page }) => {
  await page.goto(UTILITY);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Overview");
  const lines = main.locator("[data-attention]");
  expect(await lines.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-attention")?.split(":")[0]))).toEqual(["in_progress", "asset_risk", "asset_risk", "revenue", "standing_alarms", "assets_listed"]);
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
  await expect(page).toHaveURL(/\/dashboard\/minigrid\/sites\/MG-DRY$/);
});

test("on a phone the menu opens on request, the data bar stays in view and nothing is wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/dashboard", UTILITY, MINIGRID, `${UTILITY}/map`, `${MINIGRID}/map`, `${UTILITY}/ai`]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    expect(await page.evaluate(() => (document.querySelector("main") as HTMLElement).scrollWidth <= (document.querySelector("main") as HTMLElement).clientWidth + 1), route).toBe(true);
    const bar = page.getByRole("note", { name: "About the data on this screen" });
    await expect(bar.getByText("SYNTHETIC DATA", { exact: true }), route).toBeVisible();
    await expect(bar.getByText("Reporting period", { exact: true }), route).toBeVisible();
    // The frame takes less than a fifth of the screen: the page starts within 170 px of the top.
    expect(await page.evaluate(() => (document.querySelector("main") as HTMLElement).getBoundingClientRect().top), route).toBeLessThan(170);
  }
  // What the dataset is opens with one tap.
  const bar = page.getByRole("note", { name: "About the data on this screen" });
  await expect(bar.getByText("It describes no real network")).toBeHidden();
  await bar.locator("[data-about-data]").click();
  await expect(bar.getByText("It describes no real network")).toBeVisible();
  // The menu is closed until asked for, and closes when a screen is chosen.
  await expect(page.locator("[data-menu]")).toHaveCount(0);
  await page.locator("[data-menu-button]").click();
  await expect(page.locator("[data-menu]").getByRole("link")).toHaveCount(14);
  await page.locator("[data-menu]").getByRole("link", { name: "Sites" }).click();
  await expect(page).toHaveURL(/\/dashboard\/minigrid\/sites$/);
  await expect(page.locator("[data-menu]")).toHaveCount(0);
});

test("the theme can be changed and is kept", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(UTILITY);
  const html = page.locator("html");
  // Without a choice, the device's own setting.
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.locator("aside [data-theme-toggle]").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  // The SYNTHETIC DATA bar is there in both.
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("SYNTHETIC DATA");
});

test("the menu marks the workspace the reader is in, at any depth", async ({ page }) => {
  const menu = page.getByRole("navigation", { name: "Main" });
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Operations"]);
  await page.goto("/dashboard/utility/revenue");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Revenue"]);
  await page.goto("/dashboard/utility/events");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Events / Alarms"]);
  // A site's screen is inside the Sites workspace.
  await page.goto("/dashboard/minigrid/sites/MG-PLM");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Sites"]);
  // A sector's Overview is not marked on the screens below it, and each sector's own items are told apart.
  await page.goto(`${MINIGRID}/map`);
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["GIS Map"]);
  expect(await menu.locator('[aria-current="page"]').getAttribute("href")).toBe(`${MINIGRID}/map`);
  await page.goto(UTILITY);
  expect(await menu.locator('[aria-current="page"]').getAttribute("href")).toBe(UTILITY);
  // The overview is not marked on the pages below it.
  await page.goto("/dashboard");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Overview"]);
});

test("the old Map addresses lead to the Platform Overview", async ({ page }) => {
  for (const old of ["/dashboard/map", "/dashboard/intelligence/gis"]) {
    await page.goto(old);
    await expect(page, old).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-overview="platform"]'), old).toBeVisible();
    await expect(page.getByText("Coming Soon"), old).toHaveCount(0);
  }
});

test("every page has exactly one h1", async ({ page }) => {
  const pages = [...ROUTES, ...ASSISTANTS, `${OPERATIONS}/feeders/NOPE`, ...PLACEHOLDERS];
  test.setTimeout(pages.length * 6_000);
  for (const route of pages) {
    await page.goto(route);
    await expect(page.locator("h1"), route).toHaveCount(1);
  }
});

test("the reporting period and the SYNTHETIC DATA label are in one bar, once, on every dashboard page", async ({ page }) => {
  // "/" is where a visitor lands; it leads to the overview, which carries the bar like every other screen.
  for (const route of ["/", "/dashboard", "/dashboard/utility", "/dashboard/utility/executive", `${OPERATIONS}/feeders/FD-MKT`, "/dashboard/utility/reliability", "/dashboard/utility/revenue", "/dashboard/utility/assets", "/dashboard/utility/events", "/dashboard/utility/map", "/dashboard/utility/ai", "/dashboard/minigrid", "/dashboard/minigrid/map", "/dashboard/minigrid/sites", "/dashboard/minigrid/sites/MG-GRN", "/dashboard/reports"]) {
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
  for (const route of ["/", "/dashboard", "/dashboard/utility/executive", `${OPERATIONS}/feeders/FD-MKT`, "/dashboard/reports", `${OPERATIONS}/feeders/NOPE`]) {
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
