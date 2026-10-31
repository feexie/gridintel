import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSyntheticMonitoring } from "../../repositories/demo/monitoring.ts";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { allocationView } from "./allocation.ts";
import { meteringFundView } from "./metering.ts";
import { monitoringPlan, monitoringView } from "./monitoring.ts";
import { ORIGIN_LABELS, meteringPlanReportView } from "./report.ts";

const published = nercPublishedFigures();

async function build() {
  const fund = await meteringFundView(published, { case: "nigeria" });
  const allocation = await allocationView(published, {});
  const monitoring = await monitoringView(published, createSyntheticMonitoring(await monitoringPlan(published)), {});
  return { fund, allocation, monitoring, report: meteringPlanReportView(fund, allocation, monitoring) };
}

describe("the Metering Plan report", () => {
  it("runs the gap, then Plan · Access, Fund · Affordability and Monitor · Availability, the shocks, and the assumptions and sources", async () => {
    const { report } = await build();
    assert.deepEqual(
      report.sections.map((section) => [section.id, section.step]),
      [
        ["gap", null],
        ["access", "Plan · Access"],
        ["affordability", "Fund · Affordability"],
        ["availability", "Monitor · Availability"],
        ["shocks", null],
        ["assumptions", null],
      ],
    );
    assert.deepEqual(report.sections.map((section) => section.number), [1, 2, 3, 4, 5, 6]);
    assert.equal(report.positioning, "Plan for access, fund for affordability, monitor for availability.");
  });

  it("carries the screens' own figures and sentences, never figures of its own", async () => {
    const { fund, allocation, monitoring, report } = await build();
    const statements = report.sections.flatMap((section) => section.blocks.flatMap((block) => (block.kind === "statement" ? [block.text] : [])));
    for (const sentence of [fund.gap.sentence, allocation.headline, allocation.firstMillion, allocation.pilot.sentence, fund.headline.sentence, fund.structure!.fundAlone, fund.structure!.structure, fund.structure!.failures!, fund.structure!.publicPerMeter!.line, monitoring.headline, fund.structure!.inflationLine]) {
      assert.ok(statements.includes(sentence), sentence);
    }
    // Every figure in the report is one a screen shows, with the same value and origin.
    const shown = new Map(
      [...fund.startingPoint, ...fund.gap.figures, ...fund.references, ...allocation.pilot.figures, ...fund.structure!.figures, ...fund.structure!.publicPerMeter!.figures, ...fund.investment.fundAlone.figures, ...fund.investment.structure!.figures, ...monitoring.totals].map((figure) => [`${figure.label}|${figure.value}`, figure.origin]),
    );
    const figures = report.sections.flatMap((section) => section.blocks.flatMap((block) => (block.kind === "figures" ? block.figures : [])));
    const ownImpact = new Set([`${fund.impact.metered.label}|${fund.impact.metered.value}`, `${fund.impact.bills.label}|${fund.impact.bills.value}`]);
    for (const figure of figures) {
      const key = `${figure.label}|${figure.value}`;
      assert.ok(shown.has(key) || ownImpact.has(key), key);
      if (shown.has(key)) assert.equal(figure.origin, shown.get(key), key);
    }
    // The tables hold the screens' rows.
    const tables = report.sections.flatMap((section) => section.blocks.flatMap((block) => (block.kind === "table" ? [block] : [])));
    assert.equal(tables.find((table) => table.title === "The 11 DisCos")!.rows.length, 11);
    assert.equal(tables.find((table) => table.title === "Metering Fund assumptions")!.rows.length, fund.assumptions.length);
    assert.ok(tables.find((table) => table.title === "Metering Fund assumptions")!.rows.every((row) => Object.values(ORIGIN_LABELS).includes(row.cells.origin)));
    assert.equal(tables.find((table) => table.title === "The fund alone under each shock")!.rows.length, fund.stress.length);
  });

  it("labels the monitoring figures synthetic, cites every source of the screens, and names its methods", async () => {
    const { fund, allocation, report } = await build();
    const availability = report.sections.find((section) => section.id === "availability")!;
    assert.ok(availability.blocks.some((block) => block.kind === "statement" && block.tone === "caveat" && block.text.startsWith("Synthetic:")));
    assert.ok(report.dataLabel.includes("MONITORING SYNTHETIC"));
    for (const citation of [...fund.citations, ...allocation.citations]) assert.ok(report.citations.some((one) => one.id === citation.id), citation.id);
    assert.deepEqual(report.methods.map((method) => method.id), ["gridintel.planning.metering-fund", "gridintel.planning.disco-allocation", "gridintel.planning.monitoring"]);
  });
});
