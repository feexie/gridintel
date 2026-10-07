import { expect, test } from "@playwright/test";
import { OPERATIONS, ROUTES } from "./routes";

/* The menu, the one heading per page, and the one bar that says what data a screen shows. */

const PLACEHOLDERS = [
  "/dashboard/der",
  "/dashboard/minigrid",
  "/dashboard/planning",
  "/dashboard/reports",
  "/dashboard/settings",
  "/dashboard/intelligence/ai",
  "/dashboard/intelligence/analytics",
  "/dashboard/intelligence/gis",
  "/dashboard/utility/ai",
];

test("the menu lists the Utility Intelligence workspaces that exist, and no placeholder", async ({ page }) => {
  await page.goto("/dashboard/utility");
  const menu = page.getByRole("navigation", { name: "Main" });
  const utility = menu.getByRole("region", { name: "Utility Intelligence" });
  await expect(utility.getByRole("link")).toHaveText(["Executive", "Operations", "Reliability", "Revenue", "Assets", "Events / Alarms"]);
  // Every link in the menu leads to a screen that works: none says "Coming Soon".
  const links = await menu.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") as string));
  expect(links).toEqual([
    "/dashboard",
    "/dashboard/utility/executive",
    OPERATIONS,
    "/dashboard/utility/reliability",
    "/dashboard/utility/revenue",
    "/dashboard/utility/assets",
    "/dashboard/utility/events",
  ]);
  for (const href of links) {
    await page.goto(href);
    await expect(page.getByText("Coming Soon"), href).toHaveCount(0);
  }
  for (const href of PLACEHOLDERS) expect(links, href).not.toContain(href);

  // The hub offers the same workspaces, each with the question it answers.
  await page.goto("/dashboard/utility");
  const hub = page.getByRole("main");
  await expect(hub.getByRole("link")).toHaveText(["Executive", "Operations", "Reliability", "Revenue", "Assets", "Events / Alarms"]);
  await expect(hub).toContainText("Which feeders fail their customers, why, and is it ours to fix?");
});

test("the menu marks the workspace the reader is in, at any depth", async ({ page }) => {
  const menu = page.getByRole("navigation", { name: "Main" });
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Operations"]);
  await page.goto("/dashboard/utility/revenue");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Revenue"]);
  await page.goto("/dashboard/utility/events");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Events / Alarms"]);
  // The overview is not marked on the pages below it.
  await page.goto("/dashboard");
  await expect(menu.locator('[aria-current="page"]')).toHaveText(["Overview"]);
});

test("every page has exactly one h1", async ({ page }) => {
  const pages = ["/dashboard", "/dashboard/utility", ...ROUTES, `${OPERATIONS}/feeders/NOPE`, ...PLACEHOLDERS];
  test.setTimeout(pages.length * 6_000);
  for (const route of pages) {
    await page.goto(route);
    await expect(page.locator("h1"), route).toHaveCount(1);
  }
});

test("the reporting period and the SYNTHETIC DATA label are in one bar, once, on every dashboard page", async ({ page }) => {
  // "/" is where a visitor lands; it leads to the overview, which carries the bar like every other screen.
  for (const route of ["/", "/dashboard", "/dashboard/utility", "/dashboard/utility/executive", `${OPERATIONS}/feeders/FD-MKT`, "/dashboard/utility/reliability", "/dashboard/utility/revenue", "/dashboard/utility/assets", "/dashboard/utility/events", "/dashboard/reports"]) {
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
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const lines = (await robots.text()).split("\n").map((line) => line.trim()).filter(Boolean);
  expect(lines).toEqual(["User-Agent: *", "Disallow: /"]);
});
