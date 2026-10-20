import { expect, test } from "@playwright/test";

/* Phase REPORTS-A (ADR 0019): the downloadable reports. While the data is synthetic every printed
   page carries the sample label; every figure keeps its status and origin on paper and in the CSV;
   a period the data does not cover says so and holds no figure; each report carries its ID,
   the time its figures were computed, its period, methodologies and data fingerprint. */

const RELIABILITY = "/dashboard/utility/reports/reliability";
const COMPLIANCE = "/dashboard/minigrid/reports/compliance";
const OPERATIONS = "/dashboard/utility/reports/operations";
const DAILY = "/dashboard/utility/reports/daily-brief";
const PERFORMANCE = "/dashboard/minigrid/reports/site-performance";
const LABEL = "SAMPLE: SYNTHETIC DATA";

/** The number of pages of a PDF, from its page tree. */
const pageCount = (pdf: Buffer) => Math.max(...[...pdf.toString("latin1").matchAll(/\/Count (\d+)/g)].map((match) => Number(match[1])));

test("a sector's Reports screen lists its reports, and a report opens on the month", async ({ page }) => {
  await page.goto("/dashboard/utility/reports");
  await expect(page.locator("[data-report]")).toHaveCount(3);
  await expect(page.locator('[data-report="daily-brief"]').getByRole("link", { name: "Open the report" })).toHaveAttribute("href", `${DAILY}/2026-09-30`);
  await expect(page.locator('[data-report="operations"]').getByRole("link", { name: "Open the report" })).toHaveAttribute("href", `${OPERATIONS}/2026-09`);
  await page.locator('[data-report="reliability"]').getByRole("link", { name: "Open the report" }).click();
  await expect(page).toHaveURL(new RegExp(`${RELIABILITY}/2026-09$`));
  // A report's address without a period leads to the month.
  await page.goto(RELIABILITY);
  await expect(page).toHaveURL(new RegExp(`${RELIABILITY}/2026-09$`));
});

for (const [route, title, id] of [
  [`${RELIABILITY}/2026-09`, "Reliability and service standards", /^GI-REL-2026-09-[0-9A-F]{8}$/],
  [`${COMPLIANCE}/2026-09`, "Mini-grid compliance and results", /^GI-MGC-2026-09-[0-9A-F]{8}$/],
  [`${OPERATIONS}/2026-09`, "DisCo operations", /^GI-OPS-2026-09-[0-9A-F]{8}$/],
  [`${PERFORMANCE}/2026-09`, "Mini-grid site performance", /^GI-MSP-2026-09-[0-9A-F]{8}$/],
] as const) {
  test(`${title}: the cover says it is a sample and identifies the report; the label is over every page`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("[data-sample-box]")).toContainText(LABEL);
    await expect(page.locator("[data-sample-box]")).toContainText("it is not a report of real results");
    await expect(page.locator("[data-sample-band]")).toContainText(LABEL);
    const identity = page.locator(".gr-identity");
    expect((await identity.locator("dt", { hasText: "Report ID" }).locator("+ dd").textContent())?.trim()).toMatch(id);
    await expect(identity.locator("dt", { hasText: "Data fingerprint (SHA-256)" }).locator("+ dd")).toHaveText(/^[0-9a-f]{64}$/);
    // The time the figures were computed (for a page built ahead of time, the build), never "generated" as if just now.
    await expect(identity).toContainText(/Figures computed\d{1,2} \w{3} \d{4}, \d{2}:\d{2} WAT, from data as of 1 Oct 2026, 00:00 WAT/);
    await expect(identity).not.toContainText("Generated");
    await expect(identity).toContainText("September 2026");
    // Every methodology is named with its version in the appendix.
    await expect(page.locator("#method")).toContainText(/gridintel\.[a-z_.]+/);
    // The words across the page are the label itself, drawn as text.
    await expect(page.locator(".gr-watermark text").first()).toHaveText(LABEL);
    // Every figure on paper carries a status mark and an origin.
    const values = page.locator(".gr-value");
    expect(await values.count()).toBeGreaterThan(20);
    expect(await page.locator(".gr-value:not(:has(.gr-status))").count()).toBe(0);

    // Printed: the screen's controls are gone, the words cover each page (fixed: repeated on every
    // page), and the sheet is on the page whose margins carry the label.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".gr-toolbar")).toBeHidden();
    await expect(page.locator("[data-sector-bar]")).toBeHidden();
    expect(await page.locator(".gr-watermark").evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
    expect(await page.locator(".gr-sheet").evaluate((node) => getComputedStyle(node).getPropertyValue("page"))).toBe("sample");
    const pageRule = await page.evaluate(() =>
      [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).some((rule) => rule instanceof CSSPageRule && rule.selectorText === "sample" && rule.cssText.includes("SAMPLE: SYNTHETIC DATA")),
    );
    expect(pageRule).toBe(true);
  });
}

test("the reliability report keeps each attribution-rule finding beside the comparison it explains", async ({ page }) => {
  await page.goto(`${RELIABILITY}/2026-09`);
  const reported = page.locator("#reported");
  const withFinding = reported.locator(".gr-comparison:has(.gr-finding)");
  await expect(withFinding).toHaveCount(8);
  await expect(withFinding.first().locator(".gr-finding")).toContainText("Rule treats sub-transmission lines as upstream");
  // Hillcrest's feeders are among them.
  await expect(reported).toContainText("Farm Road 11 kV feeder");
});

test("a day is a report of its own; a reported figure for the month is named and not compared with it", async ({ page }) => {
  await page.goto(`${RELIABILITY}/2026-09-14`);
  await expect(page.locator(".gr-identity")).toContainText("14 September 2026");
  await expect(page.locator(".gr-identity")).toContainText(/GI-REL-2026-09-14-/);
  await expect(page.locator("#reported")).toContainText("No reported figure in the records is for 14 September 2026.");
  await expect(page.locator("#reported")).toContainText("They are not compared here");
  await expect(page.locator("#reported .gr-comparison")).toHaveCount(0);
});

test("on a report's page the data bar names the report's own period, never the platform's month", async ({ page }) => {
  for (const [route, period, asOf] of [
    [`${RELIABILITY}/2026-09-14`, "14 September 2026", "15 Sep 2026, 00:00 WAT"],
    [`${COMPLIANCE}/2026-09-03`, "3 September 2026", "4 Sep 2026, 00:00 WAT"],
    [`${RELIABILITY}/2026-09`, "September 2026", "1 Oct 2026, 00:00 WAT"],
    [`${COMPLIANCE}/2026`, "2026", "Not available for this period"],
  ] as const) {
    await page.goto(route);
    const bar = page.getByRole("note", { name: "About the data on this screen" });
    await expect(bar, route).toContainText(LABEL.replace("SAMPLE: ", ""));
    await expect(bar, route).toContainText(`Report period${period}`);
    await expect(bar, route).toContainText(`Data as of${asOf}`);
    await expect(bar, route).not.toContainText("Reporting period");
  }
  // The Reports screen itself is not a report: it keeps the platform's period.
  await page.goto("/dashboard/utility/reports");
  await expect(page.getByRole("note", { name: "About the data on this screen" })).toContainText("Reporting period1 Sep 2026 – 30 Sep 2026");
});

test("the DisCo operations report gives the loss account and the money for the month, and says on a day that they are not available", async ({ page }) => {
  await page.goto(`${OPERATIONS}/2026-09`);
  await expect(page.locator("#losses .gr-figure").first()).toContainText("ATC&C");
  await expect(page.locator("#losses")).toContainText("The energy account");
  await expect(page.locator("#collection")).toContainText("By customer class");
  await page.goto(`${OPERATIONS}/2026-09-14`);
  for (const id of ["#losses", "#revenue-gap", "#collection"]) {
    await expect(page.locator(id), id).toContainText("Not available for a day.");
    await expect(page.locator(`${id} .gr-figure`), id).toHaveCount(0);
  }
  // Reliability, assets and events are given for the day.
  await expect(page.locator("#reliability .gr-figure").first()).toContainText("SAIDI");
  // No monitor is said to be quiet on a day whose check-ins are not held.
  await expect(page.locator("#events")).toContainText("Whether a monitor has gone quiet cannot be told");
  await expect(page.locator("#events td").filter({ hasText: /^Monitor quiet$/ })).toHaveCount(0);
});

test("the daily operations brief is one page for a day, and a month of it is not available", async ({ page }) => {
  await page.goto(DAILY);
  await expect(page).toHaveURL(new RegExp(`${DAILY}/2026-09-30$`));
  await page.goto(`${DAILY}/2026-09-14`);
  expect((await page.locator(".gr-identity dt", { hasText: "Report ID" }).locator("+ dd").textContent())?.trim()).toMatch(/^GI-DOB-2026-09-14-[0-9A-F]{8}$/);
  await expect(page.locator("[data-sample-band]")).toContainText(LABEL);
  await expect(page.locator(".gr-contents")).toHaveCount(0);
  await expect(page.locator(".gr-section").first()).toContainText("Supply on the day");
  // Only days are offered.
  await expect(page.locator(".gr-periods-label")).toHaveText(["Day"]);
  // No monitor is found quiet on a day whose check-ins are not held, and it says so.
  await expect(page.locator("#alarms")).toContainText("Whether a monitor has gone quiet cannot be told");
  // Printed, the brief is one page, on a quiet day and on the busiest (the 30th: the open fault, four
  // alarms, a gap in the record); the appendices follow on pages of their own.
  for (const day of ["2026-09-14", "2026-09-30"]) {
    await page.goto(`${DAILY}/${day}`);
    const pages = pageCount(await page.pdf({ preferCSSPageSize: true }));
    await page.evaluate(() => {
      for (const node of document.querySelectorAll(".gr-cover, .gr-section:not(#method):not(#regulatory):not(#glossary)")) node.remove();
    });
    const appendixPages = pageCount(await page.pdf({ preferCSSPageSize: true }));
    expect(pages - appendixPages, `pages taken by the brief for ${day}`).toBe(1);
  }

  for (const route of [`${DAILY}/2026-09`, `${DAILY}/2026`]) {
    await page.goto(route);
    await expect(page.getByRole("status"), route).toContainText("The daily operations brief is for one day.");
    await expect(page.locator(".gr-figure"), route).toHaveCount(0);
  }
});

test("the site performance report sets the sites side by side, then each site; on a day it gives no sales or collection", async ({ page }) => {
  await page.goto("/dashboard/minigrid/reports");
  await expect(page.locator("[data-report]")).toHaveCount(2);
  await expect(page.getByText("Not built yet.")).toHaveCount(0);
  await page.locator('[data-report="site-performance"]').getByRole("link", { name: "Open the report" }).click();
  await expect(page).toHaveURL(new RegExp(`${PERFORMANCE}/2026-09$`));
  await expect(page.locator(".gr-section h2")).toContainText(["The sites side by side", "Dry River", "Granite Hill", "Palm Landing", "Tamarind Cross"]);
  await expect(page.locator("#site-mg-grn")).toContainText("Granite Hill has no generator in the register.");
  await expect(page.locator("#site-mg-grn")).toContainText("Sales and collection");
  await page.goto(`${PERFORMANCE}/2026-09-14`);
  await expect(page.locator("#site-mg-grn")).toContainText("Not available for a day.");
  await expect(page.locator("#site-mg-grn h3", { hasText: "Sales and collection" })).toHaveCount(0);
});

test("the figures download as XLSX beside the CSV, with the label in the file name", async ({ page, request }) => {
  await page.goto(`${OPERATIONS}/2026-09`);
  await expect(page.getByRole("link", { name: "Download figures (XLSX)" })).toHaveAttribute("href", `${OPERATIONS}/2026-09/data.xlsx`);
  const response = await request.get(`${OPERATIONS}/2026-09/data.xlsx`);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(response.headers()["content-disposition"]).toContain("gridintel-operations-2026-09-SAMPLE-SYNTHETIC.xlsx");
  const body = await response.body();
  expect([...body.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  expect(body.toString("latin1")).toContain("SAMPLE: SYNTHETIC DATA");
  // A period that is not available has no workbook.
  expect((await request.get(`${OPERATIONS}/2026/data.xlsx`)).status()).toBe(404);
});

test("a year the data does not cover is not available: no figure, no ID, no CSV, and the reason", async ({ page }) => {
  for (const route of [`${RELIABILITY}/2026`, `${COMPLIANCE}/2026`]) {
    await page.goto(route);
    const status = page.getByRole("status");
    await expect(status, route).toContainText("Not available for this period.");
    await expect(status, route).toContainText("The data covers 1 September 2026 to 30 September 2026 only, which is part of 2026.");
    await expect(page.locator(".gr-figure"), route).toHaveCount(0);
    await expect(page.locator(".gr-identity"), route).not.toContainText("Report ID");
    await expect(page.getByRole("link", { name: "Download figures (CSV)" }), route).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download figures (XLSX)" }), route).toHaveCount(0);
    // Still labelled.
    await expect(page.locator("[data-sample-box]"), route).toContainText(LABEL);
  }
  const missing = await page.goto(`${RELIABILITY}/2026-02-30`);
  expect(missing?.status()).toBe(404);
});

test("the CSV carries every figure with its status, origin and unit, and the sample label on every row", async ({ page, request }) => {
  await page.goto(`${RELIABILITY}/2026-09`);
  const reportId = (await page.locator(".gr-identity dt", { hasText: "Report ID" }).locator("+ dd").textContent())?.trim();
  const response = await request.get(`${RELIABILITY}/2026-09/data.csv`);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toContain("gridintel-reliability-2026-09-SAMPLE-SYNTHETIC.csv");
  const lines = (await response.text()).replace(/^﻿/, "").trim().split("\r\n");
  expect(lines[0]).toBe("sample_label,report_id,period,section,table,row,column,value,unit,currency,status,origin,method_id,method_version,note");
  const rows = lines.slice(1);
  expect(rows.length).toBeGreaterThan(200);
  for (const row of rows) expect(row.startsWith(`${LABEL},${reportId},2026-09,`), row).toBe(true);
  // A figure without a value is never written as zero: its value is empty and its status says why.
  const figures = rows.filter((row) => /,(ok|calculated_with_estimates|insufficient_data|not_computable|not_available),(measured|reported|calculated|estimated|derived),/.test(row));
  expect(figures.length).toBeGreaterThan(150);
  for (const row of figures.filter((one) => /,(insufficient_data|not_available|not_computable),/.test(one))) expect(row, row).toMatch(/,,[A-Za-z0-9_]+,[A-Z]*,(insufficient_data|not_available|not_computable),/);
  expect(rows.some((row) => row.includes("Data fingerprint (SHA-256)"))).toBe(true);
});

test("on a phone a report does not slide sideways, and its print button is in reach", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [`${RELIABILITY}/2026-09`, `${COMPLIANCE}/2026-09`, `${COMPLIANCE}/2026-09-14`, `${RELIABILITY}/2026`, `${OPERATIONS}/2026-09`, `${OPERATIONS}/2026-09-14`, `${DAILY}/2026-09-30`, `${PERFORMANCE}/2026-09`]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll(".gr-sheet *")].filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1 && !node.closest(".gr-table-frame, .gr-watermark")).length,
    );
    expect(wide, route).toBe(0);
    await expect(page.locator("[data-print-report]"), route).toBeVisible();
  }
});
