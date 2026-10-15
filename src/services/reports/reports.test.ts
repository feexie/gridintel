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

const section = (body: ReportBody, id: string) => body.sections.find((one) => one.id === id)!;

function document(body: ReportBody, id: "reliability" | "compliance", key: string) {
  const definition = REPORT_DEFINITIONS[id];
  const period = parsePeriod(key, OFFSET)!;
  const methods = methodsUsed(body);
  return reportDocument({
    item: REPORTS.find((item) => item.id === id)!,
    definition,
    period,
    periods: periodChoices(COVERAGE),
    sample: sampleNotice("A designed demonstration dataset."),
    built: { body, reportId: reportIdOf(definition, period, "0123456789abcdef"), generatedAt: "2026-10-15T12:00:00.000Z", dataAsOf: period.end, dataFingerprint: "f".repeat(64), methods },
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

  it("writes a cell a spreadsheet would read as a formula as text", () => {
    const view = document(month, "reliability", "2026-09");
    const csv = reportCsv({ ...view, header: { ...view.header, audience: "=HYPERLINK(1)" } });
    assert.ok(csv.includes(",'=HYPERLINK(1),"));
  });
});
