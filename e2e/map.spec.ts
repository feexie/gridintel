import { expect, test, type Page } from "@playwright/test";
import { OPERATIONS } from "./routes";

/* The shared map: the Map workspace, and the same component inside other screens. */

const MAP = "/dashboard/map";
const CREDIT = "Boundaries: geoBoundaries (CC BY 4.0), Runfola et al. 2020";

async function open(page: Page, route = MAP) {
  await page.goto(route);
  // Leaflet draws in the browser only; the shapes arrive after the page does.
  await expect(page.locator(".leaflet-container path.gi-point").first()).toBeVisible();
}
const selected = (page: Page) => page.locator("[data-selected]");
const figure = (page: Page, label: string) => selected(page).locator(`[data-figure="${label}"]`);
const layer = (page: Page, id: string) => page.locator(`[data-layer="${id}"] input`);

test("the map shows the network on a plain ground, and says on the map itself what must be said", async ({ page }) => {
  const elsewhere: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) elsewhere.push(request.url());
  });
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Map");
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  // Two substations, four routes, 48 transformers coloured by loading.
  await expect(page.locator("path.gi-kind-substation")).toHaveCount(2);
  await expect(page.locator("path.gi-line")).toHaveCount(4);
  await expect(page.locator('path.gi-point[class*="gi-tone-"]')).toHaveCount(48);
  // Every route is dashed and carries the word, on the map.
  await expect(page.locator("path.gi-line.gi-schematic")).toHaveCount(4);
  await expect(page.locator(".leaflet-container .gi-label")).toHaveText(["schematic", "schematic", "schematic", "schematic"]);
  await expect(page.locator("[data-map-notes]")).toContainText("Schematic: straight lines between the points a route connects.");
  // The boundaries are credited on the map, and said not to be survey-grade.
  await expect(page.locator("[data-map-credits]")).toContainText(CREDIT);
  await expect(page.locator("[data-map-notes]")).toContainText("Administrative boundaries from geoBoundaries, not survey-grade.");
  await expect(page.locator("path.gi-outline-state")).toHaveCount(37);
  // No basemap, and so nothing fetched from anyone else.
  await expect(page.locator("[data-map-credits]")).toContainText("No basemap");
  await expect(page.locator(".leaflet-tile")).toHaveCount(0);
  expect(elsewhere).toEqual([]);
  // Where it all came from is written out.
  const sources = page.locator("section", { has: page.getByRole("heading", { name: "What is on this map, and where it came from" }) });
  await expect(sources).toContainText("synthetic demonstration data");
  await expect(sources).toContainText("Creative Commons Attribution 4.0 International (CC BY 4.0)");
  await expect(sources).toContainText("Represents 2022; retrieved 2026-10-09");
});

test("an overloaded transformer is traced to its feeder, substation, district and customers", async ({ page }) => {
  await open(page);
  await page.locator("[data-select-asset]").selectOption("distribution_transformer:DT-OLD-2");
  await expect(selected(page)).toContainText("Riverbank transformer");
  const trace = selected(page).locator("[data-trace]");
  await expect(trace).toContainText("Old Town 11 kV feeder ‹ Riverside T1 ‹ Riverside 33/11 kV injection substation");
  await expect(trace).toContainText("Demonstration district South (synthetic)");
  await expect(trace).toContainText("135 service points");
  // A synthetic transformer is in no real state.
  await expect(trace).not.toContainText("Adamawa");
  await expect(figure(page, "Active accounts behind it")).toContainText("132");
  await expect(figure(page, "Active accounts behind it")).toContainText("Calculated");
  // Its key figures, each with status and origin; it is above its rating.
  await expect(figure(page, "Peak loading")).toContainText("121.2%");
  await expect(figure(page, "Peak loading")).toContainText("OK");
  await expect(figure(page, "Peak loading")).toContainText("GridIntel reference equipment loading");
  await expect(figure(page, "ATC&C")).toContainText("Estimated inputs");
  await expect(figure(page, "Revenue not realised")).toContainText("Derived");
  // And the way into the drill-down, where every figure has its full trail.
  await expect(selected(page).getByRole("link", { name: /Open in Operations/ })).toHaveAttribute("href", `${OPERATIONS}/transformers/DT-OLD-2`);
  await expect(trace.getByRole("link", { name: "Old Town 11 kV feeder" })).toHaveAttribute("href", `${OPERATIONS}/feeders/FD-OLD`);
  // It is marked as selected on the map.
  await expect(page.locator("path.gi-selected")).toHaveCount(1);
});

test("clicking an asset on the map selects it", async ({ page }) => {
  await open(page);
  await page.locator("path.gi-kind-substation").first().click({ force: true });
  await expect(selected(page)).toHaveAttribute("data-selected", /^substation:SS-/);
  await expect(selected(page)).toContainText("injection substation");
  await expect(figure(page, "SAIDI")).toBeVisible();
});

test("the Farm Road open fault is traced to the 1,015 accounts behind it", async ({ page }) => {
  await open(page);
  const fault = page.locator('[data-incident="OUT-2026-09-30-FD-FRM-FAULT"]');
  await expect(fault).toContainText("Fault, since 30 Sep 2026, 23:20 WAT. Began at Feeder: Farm Road 11 kV feeder.");
  await expect(fault).toContainText("Behind it: 10 distribution transformers, 1064 service points.");
  // The outage record's count and the registry's count, each a figure of its own.
  await expect(fault.locator('[data-figure="Customers affected"]')).toContainText("1,015");
  await expect(fault.locator('[data-figure="Active accounts behind it"]')).toContainText("1,015");
  await expect(fault.locator('[data-figure="Active accounts behind it"]')).toContainText("not a count of customers without supply");
  // Its ten transformers are ringed as without supply, and marking the fault picks out the feeder and all ten.
  await expect(page.locator("path.gi-mark.gi-tone-alert")).toHaveCount(10);
  await fault.locator("input").check();
  await expect(page.locator("path.gi-highlighted")).toHaveCount(11);
  // The four assets a source alarm is standing on are ringed too.
  await expect(page.locator("path.gi-mark.gi-tone-watch")).toHaveCount(4);
});

test("transformers are coloured by one figure at a time, with its legend", async ({ page }) => {
  await open(page);
  const legend = page.locator("[data-legend]");
  await expect(legend).toContainText("Above rating (over 100%)");
  await expect(page.locator("path.gi-point.gi-tone-alert")).toHaveCount(2);
  await layer(page, "utility.transformers.atcc").check();
  await expect(legend).toContainText("Over 50%");
  await expect(legend).not.toContainText("Above rating");
  await expect(page.locator("path.gi-point.gi-tone-alert")).toHaveCount(24);
  await layer(page, "utility.transformers.revenue").check();
  await expect(legend).toContainText("Highest third of those shown");
  await expect(page.locator("path.gi-point.gi-tone-alert")).toHaveCount(16);
  await layer(page, "utility.transformers.band").check();
  await expect(legend).toContainText("Feeder below its band minimum on more than 5 days");
  // A legend class is never colour alone: the words say how it is drawn.
  await expect(legend).toContainText("largest mark");
});

test("revenue not realised is totalled by the synthetic districts only, with what belongs to none shown apart", async ({ page }) => {
  await open(page);
  await layer(page, "utility.districts").check();
  await expect(page.locator("path.gi-area")).toHaveCount(3);
  const table = page.locator('[data-table="areas-utility.districts"]');
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await expect(table).toContainText("Demonstration district North-west (synthetic)");
  await expect(table.locator('[data-row="Revenue not realised, carried by no distribution transformer"]')).toContainText("912,259");
  await expect(table.locator('[data-row="Revenue not realised, carried by no distribution transformer"]')).toContainText("customers supplied at 11 kV");
  const panel = page.locator("section", { has: table });
  await expect(panel).toContainText("Synthetic areas, drawn for the demonstration. They are no administrative boundary.");
  await expect(panel).toContainText("It follows where transformers are, not where customers live.");
});

test("LGAs are fetched only when their layer is switched on, and mini-grid sites have a place with nothing in it", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/areas/")) asked.push(new URL(request.url()).pathname);
  });
  await open(page);
  await expect(page.locator("path.gi-outline-state")).toHaveCount(37);
  expect(asked).toEqual(["/api/areas/state"]);
  await layer(page, "reference.lgas").check();
  await expect(page.locator("path.gi-outline-lga")).toHaveCount(774);
  expect(asked).toEqual(["/api/areas/state", "/api/areas/lga"]);
  const sites = page.locator('[data-layer="minigrid.sites"]');
  await expect(sites.locator("input")).toBeDisabled();
  await expect(sites).toContainText("No source of mini-grid sites is connected");
});

test("the boundary outlines come with their credit and where they came from", async ({ request }) => {
  const states = await (await request.get("/api/areas/state")).json();
  expect(states.areas).toHaveLength(37);
  expect(states.credits).toEqual([CREDIT]);
  expect(states.notes).toEqual(["Administrative boundaries from geoBoundaries, not survey-grade."]);
  expect(states.sourcing.synthetic).toBe(false);
  const lgas = await (await request.get("/api/areas/lga")).json();
  expect(lgas.areas).toHaveLength(774);
  expect(lgas.areas.find((area: { name: string }) => area.name === "Yola North").parent).toMatchObject({ name: "Adamawa", basis: "derived" });
  expect((await request.get("/api/areas/ward")).status()).toBe(404);
});

test("the map works on a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  // Nothing is wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await page.locator(".leaflet-container").boundingBox();
  expect(box !== null && box.width > 300 && box.width <= 390 && box.height >= 320).toBe(true);
  await expect(page.locator("[data-map-credits]")).toContainText(CREDIT);
  await expect(page.locator(".leaflet-container .gi-label").first()).toHaveText("schematic");
  // Everything that can be done by pointing can be done from the list.
  await page.locator("[data-select-asset]").selectOption("feeder:FD-FRM");
  await expect(figure(page, "Active accounts behind it")).toContainText("1,015");
  await expect(figure(page, "Loading now")).toContainText("0.0%");
});

test("the same map is inside the Operations levels and Events / Alarms, on the part of the network each is about", async ({ page }) => {
  // A feeder: itself, its substation and its transformers, with the feeder selected.
  await open(page, `${OPERATIONS}/feeders/FD-FRM`);
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  await expect(page.locator("path.gi-line")).toHaveCount(1);
  await expect(page.locator("path.gi-kind-substation")).toHaveCount(1);
  await expect(page.locator("path.gi-mark.gi-tone-alert")).toHaveCount(10);
  await expect(selected(page)).toHaveAttribute("data-selected", "feeder:FD-FRM");
  await expect(page.locator(".leaflet-container .gi-label")).toHaveText(["schematic"]);
  await expect(page.getByRole("link", { name: /Open the Map workspace/ })).toHaveAttribute("href", MAP);
  // A transformer: with the connections it supplies.
  await open(page, `${OPERATIONS}/transformers/DT-OLD-2`);
  await expect(page.locator("path.gi-kind-service_point")).toHaveCount(135);
  await expect(page.locator("path.gi-point.gi-tone-alert")).toHaveCount(1);
  // A service point: where it is and what supplies it, and no figure, so that its first visit stays cheap.
  await open(page, `${OPERATIONS}/service-points/SP-OLD2-001`);
  await expect(page.locator("path.gi-kind-service_point")).toHaveCount(1);
  await expect(page.locator("path.gi-line")).toHaveCount(1);
  await expect(page.locator("path.gi-mark")).toHaveCount(0);
  // A substation, and a region, which is the whole network.
  await open(page, `${OPERATIONS}/substations/SS-HIL`);
  await expect(page.locator("path.gi-line")).toHaveCount(2);
  await open(page, `${OPERATIONS}/regions/demo-region-northfield`);
  await expect(page.locator("path.gi-line")).toHaveCount(4);
  // Events / Alarms: what is wrong now, where it is.
  await open(page, "/dashboard/utility/events");
  await expect(page.getByRole("heading", { name: "Where it is" })).toBeVisible();
  await expect(page.locator("path.gi-mark.gi-tone-alert")).toHaveCount(10);
  await expect(page.locator("path.gi-mark.gi-tone-watch")).toHaveCount(4);
  // An embedded map draws no boundaries, so it owes no credit; one page still has one h1.
  await expect(page.locator("[data-map-credits]")).not.toContainText("geoBoundaries");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});
