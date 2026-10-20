import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReportBody } from "./body.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMinigridDemoRepositories } from "../../repositories/demo/minigrid/index.ts";
import { REPORTS } from "../../constants/navigation.ts";
import { createMemoryCache } from "../analytics/cache.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { REPORT_DEFINITIONS } from "./catalogue.ts";
import { complianceReport } from "./compliance.ts";
import { reportCsv } from "./csv.ts";
import { identitySeed, methodsUsed, reportDocument, reportIdOf, sampleNotice } from "./document.ts";
import { parsePeriod, periodChoices } from "./period.ts";
import { reliabilityReport } from "./reliability.ts";
import { MONEY_NOT_FOR_A_DAY, operationsReport } from "./operations.ts";
import { crc32, reportXlsx } from "./xlsx.ts";
import { dailyBrief } from "./daily.ts";
import { executiveView } from "../executive/view.ts";
import { revenueWorkspaceView } from "../revenue/view.ts";

/* The reports are built from the read models of the screens, for the report's period, on the
   synthetic demonstration dataset at a fixed clock. */

const OFFSET = "+01:00";
const COVERAGE = { ...DEMO_PERIOD, offset: OFFSET };
const utility = createDemoRepositories();
const minigrid = createMinigridDemoRepositories();

function runtime(repos: OperationsRuntime["repos"], key: string): OperationsRuntime {
  const period = parsePeriod(key, OFFSET)!;
  return { repos, now: period.end, period: { start: period.start, end: period.end }, caveats: { tariffs: "Tariffs are assumptions, not current published rates." }, cache: createMemoryCache() };
}

const month = await reliabilityReport(runtime(utility, "2026-09"), OFFSET);
const day = await reliabilityReport(runtime(utility, "2026-09-14"), OFFSET);
const sites = await complianceReport(runtime(minigrid, "2026-09"), OFFSET);
const siteDay = await complianceReport(runtime(minigrid, "2026-09-14"), OFFSET);
const operations = await operationsReport(runtime(utility, "2026-09"), OFFSET, "month");
const operationsDay = await operationsReport(runtime(utility, "2026-09-14"), OFFSET, "day");
const brief = await dailyBrief(runtime(utility, "2026-09-14"), OFFSET);
const briefLastDay = await dailyBrief(runtime(utility, "2026-09-30"), OFFSET);

const section = (body: ReportBody, id: string) => body.sections.find((one) => one.id === id)!;

function document(body: ReportBody, id: "reliability" | "compliance" | "operations", key: string) {
  const definition = REPORT_DEFINITIONS[id];
  const period = parsePeriod(key, OFFSET)!;
  const methods = methodsUsed(body);
  return reportDocument({
    item: REPORTS.find((item) => item.id === id)!,
    definition,
    period,
    periods: periodChoices(COVERAGE),
    sample: sampleNotice("A designed demonstration dataset."),
    built: { body, reportId: reportIdOf(definition, period, "0123456789abcdef"), computedAt: "2026-10-15T12:00:00.000Z", dataAsOf: period.end, dataFingerprint: "f".repeat(64), methods },
    unavailable: null,
  });
}

describe("the reliability report", () => {
  it("gives the same portfolio figures as the Reliability screen, for the same period", async () => {
    const screen = await reliabilityWorkspaceView(runtime(utility, "2026-09"));
    assert.deepEqual(month.summary.slice(0, 3), [screen.portfolio.saidi, screen.portfolio.saifi, screen.portfolio.caidi]);
    assert.deepEqual(month.sourcing, screen.sourcing);
    assert.equal(month.sourcing.synthetic, true);
  });

  it("has the seven sections the regulator's report is defined with", () => {
    assert.deepEqual(
      month.sections.map((one) => one.id),
      ["portfolio", "substations", "feeders", "origins", "bands", "open", "reported"],
    );
    const feeders = section(month, "feeders").blocks[0];
    assert.equal(feeders.kind, "table");
    if (feeders.kind === "table") assert.match(feeders.rows[0].label, /^1\. /);
  });

  it("compares each reported figure for the month on its basis, each attribution-rule finding beside its comparison", () => {
    const block = section(month, "reported").blocks[0];
    assert.equal(block.kind, "comparisons");
    if (block.kind !== "comparisons") return;
    assert.equal(block.rows.length, 12);
    assert.equal(block.rows.filter((row) => row.ruleFinding !== null).length, 8);
    assert.ok(month.summaryNotes.some((note) => note.startsWith("8 reported figure(s) state an attribution rule")));
  });

  it("compares nothing on a day for which no report is held, and names the period the reports are for", () => {
    const blocks = section(day, "reported").blocks;
    assert.equal(blocks[0].kind === "comparisons" && blocks[0].rows.length, 0);
    assert.equal(blocks[0].kind === "comparisons" && blocks[0].empty, "No reported figure in the records is for 14 September 2026.");
    assert.ok(blocks[1].kind === "statement" && blocks[1].text.includes("for 1 September 2026 to 30 September 2026"));
  });

  it("marks the provisional figures while an interruption is still open at the end of the period", () => {
    assert.ok(month.summaryNotes.some((note) => note.startsWith("Provisional")));
    const open = section(month, "open").blocks[1];
    assert.ok(open.kind === "table" && open.rows.length === 1);
  });

  it("lists every feeder-day below its band minimum, and each one has a figure, not a zero for a missing one", () => {
    const days = section(month, "bands").blocks[1];
    assert.ok(days.kind === "table");
    if (days.kind !== "table") return;
    assert.ok(days.rows.length > 0);
    for (const row of days.rows) assert.ok(row.cells.hours.kind === "figure" && row.cells.hours.metric.value !== null && row.cells.hours.metric.status === "ok");
  });
});

describe("the mini-grid compliance report", () => {
  it("states the tariff as an assumption, and finds the two sites whose reports differ from their records", () => {
    const tariff = section(sites, "tariffs").blocks[0];
    assert.ok(tariff.kind === "statement" && tariff.tone === "caveat" && tariff.text.includes("not a published or approved rate"));
    assert.deepEqual(
      sites.summaryNotes.filter((note) => note.includes("differs from its records")),
      ["Dry River: the site's report differs from its records on 3 of 8 figure(s); see section 6.", "Palm Landing: the site's report differs from its records on 2 of 8 figure(s); see section 6."],
    );
  });

  it("holds no comparison on a day that no site report covers, and says so for each site", () => {
    const blocks = section(siteDay, "reports").blocks.filter((block) => block.kind === "comparisons");
    assert.equal(blocks.length, 4);
    for (const block of blocks) assert.ok(block.kind === "comparisons" && block.rows.length === 0 && block.empty!.endsWith("states figures for 14 September 2026."));
  });

  it("reads none of the utility's records", () => {
    assert.ok(sites.sourcing.sources.every((source) => !/distribution company|Savanna/i.test(source.name)));
  });
});

describe("the DisCo operations report", () => {
  it("gives the same loss, money and reliability figures as the Executive and Revenue screens, for the same month", async () => {
    const executive = await executiveView(runtime(utility, "2026-09"), "all");
    const revenue = await revenueWorkspaceView(runtime(utility, "2026-09"), "all");
    assert.deepEqual(operations.summary.slice(0, 3), [executive.losses!.atcc, revenue.gap.notRealised, revenue.collectionEfficiency]);
    assert.deepEqual(
      operations.sections.map((one) => one.id),
      ["losses", "revenue-gap", "collection", "reliability", "assets", "events"],
    );
    assert.equal(operations.sourcing.synthetic, true);
  });

  it("compares the DisCo's reported loss figures for the month only on their basis", () => {
    const block = section(operations, "losses").blocks.find((one) => one.kind === "comparisons");
    assert.ok(block?.kind === "comparisons" && block.rows.length === 4);
  });

  it("gives no loss account and no money for a day, and says why in their place", () => {
    for (const id of ["losses", "revenue-gap", "collection"]) {
      const blocks = section(operationsDay, id).blocks;
      assert.equal(blocks.length, 1);
      assert.ok(blocks[0].kind === "statement" && blocks[0].tone === "unavailable" && blocks[0].text === MONEY_NOT_FOR_A_DAY);
    }
    assert.ok(operationsDay.summary.every((metric) => !/ATC&C|Collection efficiency|not realised/i.test(metric.label)));
  });

  it("says no monitor was quiet on a day whose check-ins are not held, rather than finding every monitor quiet", () => {
    const conditions = section(operationsDay, "events").blocks.find((one) => one.kind === "table" && one.title === "Derived conditions");
    assert.ok(conditions?.kind === "table");
    if (conditions?.kind !== "table") return;
    assert.ok(conditions.rows.every((row) => row.cells.rule.kind === "text" && row.cells.rule.text !== "Monitor quiet"));
    assert.ok(conditions.notes.some((note) => note.startsWith("Whether a monitor has gone quiet cannot be told")));
  });
});

describe("the daily operations brief", () => {
  it("has four sections for the day, and the day's indices on the cover", async () => {
    assert.deepEqual(brief.sections.map((one) => one.id), ["supply", "interruptions", "alarms", "loading"]);
    const screen = await reliabilityWorkspaceView(runtime(utility, "2026-09-14"));
    assert.deepEqual(brief.summary.slice(0, 2), [screen.portfolio.saidi, screen.portfolio.saifi]);
    assert.ok(brief.sections.every((one) => !one.newPage));
  });

  it("lists what was still wrong when the last day closed: the open fault and the standing alarms", () => {
    const interruptions = section(briefLastDay, "interruptions").blocks.find((one) => one.kind === "table");
    assert.ok(interruptions?.kind === "table" && interruptions.rows.length === 2);
    const alarms = section(briefLastDay, "alarms").blocks[0];
    assert.ok(alarms.kind === "table" && alarms.rows.length === 4);
    const standing = briefLastDay.summary.find((metric) => metric.label === "Source alarms standing at the end of the day")!;
    assert.equal(standing.value, 4);
  });

  it("says the methodology's note once, not once for every feeder", () => {
    const table = section(brief, "supply").blocks.find((one) => one.kind === "table");
    assert.ok(table?.kind === "table");
    if (table?.kind !== "table") return;
    assert.equal(new Set(table.notes).size, table.notes.length);
    assert.ok(table.notes.length <= 1);
  });

  it("is offered for days only, and on one page", () => {
    const definition = REPORT_DEFINITIONS["daily-brief"];
    assert.deepEqual(definition.periodKinds, ["day"]);
    const view = reportDocument({
      item: REPORTS.find((item) => item.id === "daily-brief")!,
      definition,
      period: parsePeriod("2026-09-14", OFFSET)!,
      periods: periodChoices(COVERAGE),
      sample: sampleNotice("A designed demonstration dataset."),
      built: null,
      unavailable: "x",
    });
    assert.equal(view.onePage, true);
    assert.deepEqual([view.periods.months, view.periods.years], [[], []]);
    assert.equal(view.periods.days.length, 30);
  });
});

describe("the report document and its CSV", () => {
  it("names every methodology once, with its version", () => {
    const methods = methodsUsed(month);
    const keys = methods.map((method) => `${method.id}@${method.version}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(methods.some((method) => method.id === "gridintel.reliability.reference"));
  });

  it("gives the same ID to the same definition, period, methods and data, and another when the data differs", () => {
    const definition = REPORT_DEFINITIONS.reliability;
    const period = parsePeriod("2026-09", OFFSET)!;
    const seed = identitySeed(definition, period, methodsUsed(month), "a".repeat(64));
    assert.equal(seed, identitySeed(definition, period, methodsUsed(month), "a".repeat(64)));
    assert.notEqual(seed, identitySeed(definition, period, methodsUsed(month), "b".repeat(64)));
    assert.equal(reportIdOf(definition, period, "0123456789abcdef"), "GI-REL-2026-09-01234567");
  });

  it("writes every row of the CSV with the sample label, the report ID and the period, and a missing value as empty, never 0", () => {
    const csv = reportCsv(document(month, "reliability", "2026-09"));
    const [header, ...rows] = csv.trim().split("\r\n");
    assert.equal(header, "sample_label,report_id,period,section,table,row,column,value,unit,currency,status,origin,method_id,method_version,note");
    for (const row of rows) assert.ok(row.startsWith("SAMPLE: SYNTHETIC DATA,GI-REL-2026-09-01234567,2026-09,"), row);
    const missing = reportCsv(document(sites, "compliance", "2026-09"))
      .split("\r\n")
      .filter((row) => /,insufficient_data,/.test(row));
    assert.ok(missing.length > 0);
    for (const row of missing) assert.match(row, /,,[A-Za-z0-9_]+,[A-Z]*,insufficient_data,/);
  });

  it("holds no figure and no ID for a period the data does not cover", () => {
    const definition = REPORT_DEFINITIONS.compliance;
    const view = reportDocument({
      item: REPORTS.find((item) => item.id === "compliance")!,
      definition,
      period: parsePeriod("2026", OFFSET)!,
      periods: periodChoices(COVERAGE),
      sample: sampleNotice("A designed demonstration dataset."),
      built: null,
      unavailable: "Not available for this period.",
    });
    assert.equal(view.identity, null);
    assert.deepEqual([view.summary, view.sections], [[], []]);
    const csv = reportCsv(view).trim().split("\r\n");
    assert.ok(csv.at(-1)!.includes(",not_available,"));
    assert.ok(csv.slice(1).every((row) => row.startsWith("SAMPLE: SYNTHETIC DATA,,2026,")));
  });

  it("writes the same rows as an XLSX workbook, a value as a number, with the label in every row", () => {
    const view = document(operations, "operations", "2026-09");
    const bytes = reportXlsx(view);
    assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    // The same document gives the same bytes: no clock in the archive.
    assert.deepEqual(reportXlsx(view), bytes);
    const text = new TextDecoder().decode(bytes);
    const rows = text.match(/<row r="\d+">/g)!.length;
    assert.equal(rows, reportCsv(view).trim().split("\r\n").length);
    assert.ok(text.includes("&amp;L&amp;BSAMPLE: SYNTHETIC DATA"));
    assert.ok(/<c r="H\d+"><v>0\.3\d+<\/v><\/c>/.test(text), "a value is written as a number");
    assert.equal(view.xlsxFileName, "gridintel-operations-2026-09-SAMPLE-SYNTHETIC.xlsx");
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });

  it("writes a cell a spreadsheet would read as a formula as text", () => {
    const view = document(month, "reliability", "2026-09");
    const csv = reportCsv({ ...view, header: { ...view.header, audience: "=HYPERLINK(1)" } });
    assert.ok(csv.includes(",'=HYPERLINK(1),"));
  });
});
