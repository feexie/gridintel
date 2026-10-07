import { expect, test, type Page } from "@playwright/test";
import { OPERATIONS, ROUTES } from "./routes";

/** The tile of a headline figure, by the figure's label. */
const tile = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`).first();

test("every screen carries the SYNTHETIC DATA label", async ({ page }) => {
  // One navigation per route, in a real browser and beside the other tests: allow for each.
  test.setTimeout(ROUTES.length * 6_000);
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole("note").getByText("SYNTHETIC DATA", { exact: true }), route).toBeVisible();
    await expect(page.getByRole("note"), route).toContainText("describes no real network");
  }
});

test("drills from region to service point, one URL per level", async ({ page }) => {
  await page.goto(OPERATIONS);
  await page.getByRole("link", { name: "Northfield Region" }).click();
  await expect(page).toHaveURL(/\/regions\/demo-region-northfield$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Northfield Region");

  // Each level links to the one below from its revenue-gap rows and from its table; either will do.
  await page.getByRole("link", { name: "Riverside 33/11 kV injection substation" }).first().click();
  await expect(page).toHaveURL(/\/substations\/SS-RIV$/);

  await page.getByRole("link", { name: "Old Town 11 kV feeder" }).first().click();
  await expect(page).toHaveURL(/\/feeders\/FD-OLD$/);
  await expect(page.getByText("NERC service band")).toBeVisible();

  await page.getByRole("link", { name: "Riverbank transformer" }).first().click();
  await expect(page).toHaveURL(/\/transformers\/DT-OLD-2$/);
  await expect(tile(page, "Peak loading")).toContainText("Over rating");

  await page.getByRole("link", { name: "SP-OLD2-001", exact: true }).click();
  await expect(page).toHaveURL(/\/service-points\/SP-OLD2-001$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("SP-OLD2-001");

  // The path back is in the breadcrumb, and each level is a link.
  const crumbs = page.getByRole("navigation", { name: "Drill-down path" });
  await expect(crumbs).toContainText("Northfield Region");
  await crumbs.getByRole("link", { name: "Old Town 11 kV feeder" }).click();
  await expect(page).toHaveURL(/\/feeders\/FD-OLD$/);
});

test("a deep link opens its level directly, and an unknown asset says so", async ({ page }) => {
  await page.goto(`${OPERATIONS}/transformers/DT-MKT-3`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Hilltop Close transformer");
  await page.goto(`${OPERATIONS}/feeders/NOPE`);
  await expect(page.getByText("Not in the registry")).toBeVisible();
});

test("Source & method opens on a figure calculated with estimates", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const atcc = tile(page, "ATC&C");
  await expect(atcc).toContainText("Estimated inputs");
  await expect(atcc.getByText("GridIntel reference ATC&C")).toBeHidden();
  await atcc.locator("summary").click();
  await expect(atcc.getByText("GridIntel reference ATC&C")).toBeVisible();
  await expect(atcc).toContainText("energyBilled");
  await expect(atcc).toContainText("% estimated");
  await expect(atcc).toContainText("[synthetic]");
});

test("Source & method on commercial loss says it is a derived residual", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const commercial = tile(page, "Commercial loss");
  await expect(commercial).toContainText("Derived");
  await commercial.locator("summary").click();
  await expect(commercial).toContainText("A residual: what is left after subtracting other figures");
  await expect(commercial).toContainText("Energy input − technical loss − energy billed");
  await expect(commercial).toContainText("technicalLoss");
  await expect(commercial).toContainText("100.0% estimated");
});

test("table caveats are visible as a marker and a footnote, not only on hover", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const feeders = page.locator("section", { has: page.getByRole("heading", { name: /^Feeders/ }) });
  await expect(feeders.getByText("Cash basis: received in the period ÷ billed in the period.")).toBeVisible();
  // The marker printed on the collection cells is the one the footnote starts with.
  const footnote = feeders.locator("li", { hasText: "Cash basis: received in the period" });
  const marker = (await footnote.locator("span").first().innerText()).trim();
  await expect(feeders.getByRole("row", { name: /Market Road/ })).toContainText(marker);
  // Feeders now carry a realistic number of transformers, so feeder loading has no caveat.
  await expect(page.getByText("carries only three transformers")).toHaveCount(0);
});

test("feeder loading is that of a loaded 11 kV feeder, with no caveat", async ({ page }) => {
  for (const [feeder, peak] of [["FD-MKT", "78.5%"], ["FD-OLD", "80.9%"], ["FD-GOV", "72.3%"], ["FD-FRM", "53.8%"]]) {
    await page.goto(`${OPERATIONS}/feeders/${feeder}`);
    await expect(tile(page, "Peak loading"), feeder).toContainText(peak);
    await expect(page.getByText("artefact of the small model"), feeder).toHaveCount(0);
  }
});

test("government accounts are shown as their own customer class, with their own collection efficiency", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-GOV`);
  const classes = page.locator('[data-table="customer-class"]');
  const government = classes.getByRole("row", { name: /^Government \(MDA\)/ });
  await expect(government).toContainText("90");
  await expect(government).toContainText("19.8%");
  await expect(classes.getByRole("row", { name: /^Residential/ })).toContainText(/95\.\d%/);
});

test("a reported figure on another basis is not comparable, with the reason and no difference", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const row = page.getByRole("row", { name: /^Collection efficiency/ });
  await expect(row).toContainText("Not comparable");
  await expect(row).toContainText("none on this basis");
  await expect(row).toContainText('reported "accrual", calculated "cash"');
  await expect(row).not.toContainText("pp");
  await expect(row).not.toContainText("with caveats");
});

test("reported SAIDI is set beside the network-only calculation, on the same basis", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("network interruptions only");
  await expect(row).toContainText("3.0 h");
  await expect(row).toContainText("6.9 h");
  // The total, with load shedding, is the headline figure and is far larger.
  await expect(tile(page, "SAIDI")).toContainText("208.7 h");
});

test("a report that books 33 kV line faults as upstream shows as a variance on the same basis", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-HIL`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  // Comparable, because both count network interruptions; different, because the report leaves the line faults out.
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("1.9 h");
  await expect(row).toContainText("22.8 h");
  await expect(row).toContainText("+20.9 h");
  await expect(row).not.toContainText("Not comparable");
  await expect(page.getByText("including the lines that feed its substations")).toBeVisible();
  // The substation summary does not say how it classifies, so the row says what the variance may be.
  await expect(row).toContainText("The variance may reflect a difference in classification rather than in what happened.");
  await expect(row.locator("[data-on-reported-rule]")).toHaveCount(0);
  // Its feeders' reports do state their rule, and what that rule changes is a finding on the substation's screen too.
  const findings = page.locator("[data-rule-findings]");
  await expect(findings).toContainText("Finding: the report's attribution rule");
  await expect(findings.locator('[data-rule-finding="FD-FRM:SAIDI"]')).toContainText(
    "Farm Road 11 kV feeder. Rule treats sub-transmission lines as upstream: +56.7 h SAIDI under the reference rule",
  );
  await expect(findings.locator('[data-rule-finding="FD-GOV:SAIDI"]')).toContainText("no difference to SAIDI in this period");
});

test("a report that states its attribution rule is compared on that rule, and what the rule changes is a named finding with its size", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-FRM`);
  const row = page.getByRole("row", { name: /^SAIDI/ });
  await expect(row).toContainText("Same basis");
  await expect(row).toContainText("treating as upstream: the grid, transmission stations, sub-transmission lines");
  // 0.4 h reported, 0.4 h calculated on the report's own rule: no difference, and never "-0.0 h".
  await expect(row).toContainText("0.4 h");
  await expect(row.getByRole("cell").nth(3)).toHaveText("0.0 h");
  await expect(page.getByText("-0.0")).toHaveCount(0);
  await expect(row.locator("[data-on-reported-rule]")).toContainText("What the rule changes is the finding above.");
  await expect(row).not.toContainText("may reflect a difference in classification");
  // The finding: 57.1 h on the reference rule less 0.4 h on the report's. A figure with its origin and status, not a side note.
  const finding = page.locator('[data-rule-finding="FD-FRM:SAIDI"]');
  await expect(finding).toContainText("Rule treats sub-transmission lines as upstream: +56.7 h SAIDI under the reference rule");
  await expect(finding).toContainText("Calculated");
  await expect(finding).toContainText("57.1 h");
  await expect(page.locator('[data-rule-finding="FD-FRM:SAIFI"]')).toContainText("+16.0 SAIFI under the reference rule");
  // On its own screen the finding does not repeat the feeder's name.
  await expect(finding.getByRole("link")).toHaveCount(0);
  // The headline and the attribution table are still on the reference rule.
  await expect(tile(page, "SAIDI")).toContainText("441.8 h");
});

test("a region is accounted as the sum of its sections", async ({ page }) => {
  await page.goto(`${OPERATIONS}/regions/demo-region-northfield`);
  await expect(page.getByText("Summed over 2 electrical section(s): SS-HIL, SS-RIV.")).toBeVisible();
  await expect(tile(page, "ATC&C")).toContainText("31.5%");
  // The gap below the region is by substation, and the two rows are the region's two sections.
  const gap = page.locator("section", { has: page.getByRole("heading", { name: "Revenue gap", level: 2 }) });
  await expect(gap.getByRole("link", { name: "Riverside 33/11 kV injection substation" })).toBeVisible();
  await expect(gap.getByRole("link", { name: "Hillcrest 33/11 kV injection substation" })).toBeVisible();
});

test("alarms recorded by source systems and conditions derived by GridIntel are two lists, never mixed", async ({ page }) => {
  // Riverbank has one of each: its monitor's alarm for the blown fuses, and a loading condition GridIntel derived.
  await page.goto(`${OPERATIONS}/transformers/DT-OLD-2`);
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alarms and derived conditions", level: 2 }) });
  await expect(panel).toContainText("two separate lists, never merged");
  const recorded = panel.locator('[data-alarms="recorded"]');
  const derived = panel.locator('[data-alarms="derived"]');

  await expect(recorded.getByRole("heading", { level: 3 })).toContainText("Alarms recorded by source systems");
  await expect(recorded.getByRole("heading", { level: 3 })).toContainText("Measured");
  await expect(recorded).toContainText("GridIntel reports them; it does not decide whether they are true.");
  await expect(recorded.locator("[data-alarm]")).toHaveCount(1);
  const fuse = recorded.locator('[data-alarm="ALM-2026-09-23-DT-OLD-2-FAULT"]');
  await expect(fuse).toHaveAttribute("data-alarm-state", "cleared");
  await expect(fuse).toContainText("Transformer monitor: loss of low-voltage supply on all phases.");
  await expect(fuse).toContainText("Raised 23 Sep 2026, 16:30 WAT · cleared 23 Sep 2026, 23:10 WAT");
  await expect(recorded).toContainText("No alarm is active at the as-of time.");

  await expect(derived.getByRole("heading", { level: 3 })).toContainText("Conditions derived by GridIntel");
  await expect(derived.getByRole("heading", { level: 3 })).toContainText("Calculated");
  await expect(derived).toContainText("They are not alarms. Each says whether a source system raised an alarm of the matching kind.");
  const loading = derived.locator('[data-condition="loading_above_rating:DT-OLD-2"]');
  await expect(loading).toContainText("Rule: Loaded above rating");
  await expect(loading).toContainText("121.2%");
  await expect(loading).toContainText("above rating at 69 hourly reading(s)");
  await expect(loading).toContainText("does not hold at the as-of time");
  // No source system raised an overload alarm for it, and that can be said because the alarm record is complete.
  await expect(loading.locator("[data-source-alarm]")).toHaveAttribute("data-source-alarm", "none_raised");
  await expect(loading).toContainText("No source alarm: none of the kind “overload” stood on this subject while the condition held, and the source's alarm record is complete.");
  await expect(derived).toContainText("Found (1): a source alarm agrees with 0, none was raised for 1");
  // The fuse alarm is of another kind; no condition is said to agree with it.
  await expect(fuse).toContainText("Kind: loss of supply");
  await expect(fuse.locator("[data-agrees-with]")).toHaveCount(0);
  // Each rule is stated in words under the list, with the methodology and what it is not.
  await expect(derived).toContainText("Rule: Loaded above rating. Loading (apparent power ÷ rated capacity");
  await expect(derived).toContainText("gridintel.conditions.reference");
  await expect(derived).toContainText("It is not an alarm recorded by a source system.");
  // Nothing derived appears among the alarms, and no alarm among the conditions.
  await expect(recorded.locator("[data-condition]")).toHaveCount(0);
  await expect(derived.locator("[data-alarm]")).toHaveCount(0);
  await expect(recorded).not.toContainText("121.2%");
});

test("an alarm that is standing, one with no time, and a monitor that went quiet each say exactly what is known", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alarms and derived conditions", level: 2 }) });
  const oil = panel.locator('[data-alarm="ALM-2026-09-26-PT-RIV-1-OIL"]');
  await expect(oil).toHaveAttribute("data-alarm-state", "active");
  await expect(oil).toContainText("Riverside T1");
  await expect(oil).toContainText("not cleared");
  await expect(oil).toContainText("acknowledged 26 Sep 2026, 20:12 WAT");
  // The source did not say when this one was raised: it is listed apart and never called active.
  const door = panel.locator('[data-alarm="ALM-SS-RIV-DOOR"]');
  await expect(door).toHaveAttribute("data-alarm-state", "time_not_recorded");
  await expect(door).toContainText("Raise time not recorded by the source; whether it is active cannot be told");
  // The SCADA front end alarmed the silent monitor, and GridIntel derived the same thing from its check-ins.
  // They agree, each says so, and each stays in its own list.
  const quiet = panel.locator('[data-condition="monitor_quiet:ED-DT-OLD-3"]');
  await expect(quiet).toContainText("Rule: Monitor quiet");
  await expect(quiet).toContainText("Monitor on South Gate transformer");
  await expect(quiet).toContainText("9.1 h");
  await expect(quiet).toContainText("Last heard from 30 Sep 2026, 14:55 WAT");
  await expect(quiet).toContainText("holds at the as-of time");
  await expect(quiet.locator("[data-source-alarm]")).toHaveAttribute("data-source-alarm", "agrees");
  await expect(quiet).toContainText("A source alarm agrees (communications failure): RTU-COMMS-FAIL, raised 30 Sep 2026, 16:55 WAT, in the other list.");
  const comms = panel.locator('[data-alarms="recorded"] [data-alarm="ALM-2026-09-30-ED-DT-OLD-3-COMMS"]');
  await expect(comms).toHaveAttribute("data-alarm-state", "active");
  await expect(comms).toContainText("has not answered 2 consecutive polls");
  await expect(comms.locator('[data-agrees-with="monitor_quiet:ED-DT-OLD-3"]')).toContainText("A GridIntel derived condition agrees: Monitor quiet");
  await expect(panel.locator('[data-alarms="derived"] [data-alarm]')).toHaveCount(0);
  await expect(panel.locator('[data-alarms="recorded"] [data-condition]')).toHaveCount(0);
  // The RTU whose link dropped and came back: a cleared source alarm with no condition beside it.
  const rtu = panel.locator('[data-alarm="ALM-2026-09-12-ED-SS-RIV-COMMS"]');
  await expect(rtu).toHaveAttribute("data-alarm-state", "cleared");
  await expect(rtu.locator("[data-agrees-with]")).toHaveCount(0);
  // The alarm entered by hand: its code is not mapped to a kind, and the row says so.
  await expect(door).toContainText("Kind not mapped from the source's code");

  // Government Avenue: the designed daytime overload is derived, and no source alarm raised it. A feeder
  // overcurrent trip is in the alarm list, and no condition is set beside it.
  await page.goto(`${OPERATIONS}/feeders/FD-GOV`);
  const overload = panel.locator('[data-condition="loading_above_rating:DT-GOV-3"]');
  await expect(overload.locator("[data-source-alarm]")).toHaveAttribute("data-source-alarm", "none_raised");
  const trip = panel.locator('[data-alarm="ALM-2026-09-15-FD-GOV-FAULT"]');
  await expect(trip).toContainText("tripped on overcurrent (phase fault) and locked out");
  await expect(trip).toContainText("FDR-OC-TRIP");
  await expect(trip).toContainText("Kind: overcurrent trip");
  await expect(trip.locator("[data-agrees-with]")).toHaveCount(0);

  // Hillcrest: one alarm standing and not acknowledged; of 21 cleared, the six most recent are listed.
  await page.goto(`${OPERATIONS}/substations/SS-HIL`);
  const dc = panel.locator('[data-alarm="ALM-2026-09-30-SS-HIL-DC"]');
  await expect(dc).toContainText("high");
  await expect(dc).toContainText("not cleared · not acknowledged");
  await expect(panel).toContainText("Raised in the period and cleared (21), the 6 most recent");
  await expect(panel.locator('[data-alarm-state="cleared"]')).toHaveCount(6);

  // A transformer with neither says so, for both lists.
  await page.goto(`${OPERATIONS}/transformers/DT-MKT-1`);
  await expect(panel).toContainText("No alarm was recorded for this scope in the period.");
  await expect(panel).toContainText("No rule was met: 1 asset(s) checked for loading and 1 monitoring device(s) for check-ins.");
});

test("a substation shows each power transformer with what it carries and how heavily it was loaded", async ({ page }) => {
  await page.goto(`${OPERATIONS}/substations/SS-HIL`);
  const table = page.locator('[data-table="power-transformers"]');
  const t1 = table.locator('[data-row="PT-HIL-1"]');
  const t2 = table.locator('[data-row="PT-HIL-2"]');
  await expect(t1).toContainText("Hillcrest T1");
  await expect(t1).toContainText("bus section A");
  await expect(t1).toContainText("5.0 MVA");
  await expect(t1.getByRole("link", { name: "Government Avenue 11 kV feeder" })).toBeVisible();
  await expect(t1).toContainText("55.7%");
  await expect(t1).toContainText("0 of 720");
  await expect(t2).toContainText("2.5 MVA");
  await expect(t2.getByRole("link", { name: "Farm Road 11 kV feeder" })).toBeVisible();
  await expect(t2).toContainText("24.8%");
  await page.goto(`${OPERATIONS}/substations/SS-RIV`);
  await expect(table.locator('[data-row="PT-RIV-1"]')).toContainText("72.2%");
  // A feeder's screen has no such table.
  await page.goto(`${OPERATIONS}/feeders/FD-GOV`);
  await expect(table).toHaveCount(0);
});

test("an unmetered connection shows no measured energy and an estimated bill", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-002`);
  await expect(page.getByText("None. Consumption at this connection is not measured.")).toBeVisible();
  await expect(tile(page, "Energy recorded")).toContainText("Not available");
  await expect(page.getByRole("row", { name: /Estimated bills \(no meter\)/ })).toContainText("Estimated");
});

test("an ordinary prepaid meter shows no consumption, and its vends as energy purchased", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-004`);
  await expect(page.getByText("conventional meter M-OLD2-004")).toBeVisible();
  const recorded = tile(page, "Energy recorded");
  await expect(recorded).toContainText("Not available");
  await expect(recorded).toContainText("This meter is not read");
  const purchased = tile(page, "Energy purchased");
  await expect(purchased).toContainText("kWh");
  await expect(purchased).toContainText("Measured");
  await expect(purchased).toContainText("It is not consumption and is never added to recorded consumption.");
  // No interval line: there are no intervals to count.
  await expect(page.getByText("Intervals usable")).toHaveCount(0);
});

test("a postpaid meter read by hand shows one register reading, and says when it was estimated", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-001`);
  const recorded = tile(page, "Energy recorded");
  await expect(recorded).toContainText("kWh");
  await expect(recorded).toContainText("One register reading for the month, not interval data.");
  await expect(recorded).toContainText("Measured");
  await expect(page.locator("[data-register-readings]")).toContainText("The figure is the difference, for the time between the two readings.");
  await expect(page.locator('[data-register-counts="yes"]')).toContainText("Counts toward recorded consumption at the levels above");
  await expect(tile(page, "Energy purchased")).toHaveCount(0);

  // The reading round missed this meter: the reading, and the bill raised on it, are estimates.
  await page.goto(`${OPERATIONS}/service-points/SP-OLD2-005`);
  await expect(tile(page, "Energy recorded")).toContainText("Estimated");
  await expect(tile(page, "Energy recorded")).toContainText("The meter was not read this month");
  await expect(page.locator("[data-register-readings]")).toContainText("estimated: the meter was not read");
  await expect(page.locator('[data-register-counts="no"]')).toContainText("Not counted toward recorded consumption at the levels above: a reading was estimated");
  await expect(page.getByRole("row", { name: /Estimated bills \(meter not read\)/ })).toBeVisible();
});

test("a reading taken outside the reading window is shown with its date, and its advance is not counted", async ({ page }) => {
  // The first day of Old Town's longest route: read on 29 August and on 27 September, which is too early to close September.
  await page.goto(`${OPERATIONS}/service-points/SP-OLD6-022`);
  await expect(tile(page, "Energy recorded")).toContainText("Measured");
  await expect(tile(page, "Energy recorded")).toContainText("It covers the time between the two readings, which is not the calendar month.");
  await expect(page.locator("[data-register-readings]")).toContainText("29 Aug 2026");
  await expect(page.locator("[data-register-readings]")).toContainText("27 Sep 2026");
  await expect(page.locator('[data-register-counts="no"]')).toContainText("Not counted toward recorded consumption at the levels above: no reading within 3 days of the end of the period.");

  // A long rural route on Farm Road: the reading that opens the month was taken on 28 August.
  await page.goto(`${OPERATIONS}/service-points/SP-FRM4-013`);
  await expect(page.locator("[data-register-readings]")).toContainText("28 Aug 2026");
  await expect(page.locator('[data-register-counts="no"]')).toContainText("no reading within 3 days of the start of the period.");
  await page.goto(`${OPERATIONS}/feeders/FD-FRM`);
  await expect(page.locator("[data-register-exclusions]")).toContainText("8 register advance(s) not counted: no reading within 3 days of the start of the period.");
});

test("an AMI meter shows the sum of its intervals", async ({ page }) => {
  await page.goto(`${OPERATIONS}/service-points/SP-MKT2-005`);
  await expect(page.getByText("AMI meter M-MKT2-005")).toBeVisible();
  await expect(tile(page, "Energy recorded")).toContainText("kWh");
  await expect(page.getByText("Intervals usable")).toContainText("720 of 720");
});

test("a level shows energy purchased apart from recorded consumption, which it says is not available and why", async ({ page }) => {
  await page.goto(`${OPERATIONS}/feeders/FD-OLD`);
  const purchased = page.locator('[data-table="energy-purchased"]');
  await expect(purchased).toContainText("Energy purchased (prepaid vends)");
  await expect(purchased).toContainText("kWh");
  await expect(page.getByText("Purchased, not consumed")).toBeVisible();
  await expect(page.getByText("265 with a register advance that counts; 81 with a register advance that does not count; 588 with a meter that is not read")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Recorded consumption/ })).toContainText("insufficient data");
  // The two measured sources are shown apart, each with the connections it covers; neither is called the total.
  const sources = page.locator('[data-table="recorded-by-source"]');
  await expect(sources.locator('[data-row="intervals"]')).toContainText("5 of 2,141");
  await expect(sources.locator('[data-row="register"]')).toContainText("265 of 2,141");
  await expect(sources.locator('[data-row="register"]')).toContainText("kWh");
  await expect(page.getByText("It is taken as read and never pro-rated to the period.")).toBeVisible();
  // Each ground for leaving an advance out has its own line and count.
  await expect(page.locator("[data-register-exclusions]")).toContainText("65 register advance(s) not counted: a reading was estimated, not read from the meter.");
  await expect(page.locator("[data-register-exclusions]")).toContainText("16 register advance(s) not counted: no reading within 3 days of the end of the period.");
  // The accounting chain does not depend on customer meters and is unchanged in status.
  await expect(tile(page, "ATC&C")).toContainText("Estimated inputs");
});

test("a long list of connections shows its first rows, with the full list one click away", async ({ page }) => {
  await page.goto(`${OPERATIONS}/transformers/DT-OLD-2`);
  const table = page.locator("section", { has: page.getByRole("heading", { name: /^Service points \(135\)/ }) });
  await expect(table.locator("tbody tr")).toHaveCount(40);
  await expect(table).toContainText("Showing the first 40 of 135.");
  await table.getByRole("link", { name: "Show all 135" }).click();
  await expect(page).toHaveURL(/\/transformers\/DT-OLD-2\?rows=all$/);
  await expect(table.locator("tbody tr")).toHaveCount(135);
});
