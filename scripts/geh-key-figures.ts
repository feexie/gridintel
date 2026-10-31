/* Writes docs/geh/KEY-FIGURES.md from the Metering planner's services: every figure is read from a
   view model, exactly as the screen shows it, never typed. Run after any change to a method, an
   assumption or a published figure:

     node scripts/geh-key-figures.ts <short commit>
*/
import { writeFileSync } from "node:fs";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../src/repositories/demo/index.ts";
import { createSyntheticMonitoring } from "../src/repositories/demo/monitoring.ts";
import { nercPublishedFigures } from "../src/repositories/published/nerc.ts";
import { allocationView, startingCostPerMeter } from "../src/services/planning/allocation.ts";
import { dtSequencingView } from "../src/services/planning/dt.ts";
import { formatNaira, meteringFundView } from "../src/services/planning/metering.ts";
import { monitoringPlan, monitoringView } from "../src/services/planning/monitoring.ts";
import type { ShownFigure } from "../src/services/planning/views.ts";

const commit = process.argv[2] ?? "working tree";
const published = nercPublishedFigures();
const NERC_Q2 = "NERC, Quarterly Report Q2 2026";
const NERC_Q1 = "NERC, Quarterly Report Q1 2026";
const MYTO = "NERC, MYTO orders, September 2026, Table 3";

type Row = { screen: string; figure: string; wording: string; value: string; origin: string; source: string };
const rows: Row[] = [];
const add = (screen: string, figure: string, wording: string, value: string, origin: string, source: string) => rows.push({ screen, figure, wording, value, origin, source });
const shown = (figures: ShownFigure[], key: string) => {
  const found = figures.find((one) => one.key === key);
  if (!found) throw new Error(`No figure ${key}`);
  return found;
};
const words = (figure: ShownFigure) => `${figure.label}: ${figure.value}`;

const FUND = "Metering Fund (Nigeria)";
const nigeria = await meteringFundView(published, { case: "nigeria" });
const brief = await meteringFundView(published, { case: "brief" });

/* The national gap and pace. */
add(FUND, "National gap and pace", nigeria.gap.sentence, shown(nigeria.gap.figures, "required").value + " meters a month needed", "calculated", `${NERC_Q2}, Table 15 p. 56; ${NERC_Q1}, Table 18 p. 58`);
for (const key of ["customers", "metered", "rate", "growth", "pace"]) {
  const figure = shown(nigeria.startingPoint, key);
  add(FUND, `Starting point: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);
}
const atPace = shown(nigeria.gap.figures, "atPace");
add(FUND, "At the 2026 pace", words(atPace), atPace.value, atPace.origin, atPace.basis);
for (const figure of nigeria.references) add(FUND, `Reference: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);

/* Estimated bills removed. */
add(FUND, "Customers metered within five years", `${nigeria.impact.metered.label}: ${nigeria.impact.metered.value}`, nigeria.impact.metered.value, "calculated (modelled)", `The rollout meters every customer, growth included, in 60 months (${nigeria.methodology.id} ${nigeria.methodology.version}); PMI meters as reported (S1, S2)`);
add(FUND, "Estimated bills removed, full rollout", `${nigeria.impact.bills.label}: ${nigeria.impact.bills.value}`, nigeria.impact.bills.value, "calculated (modelled)", "Assumption: one estimated bill a month per unmetered customer; missed-read estimates to metered customers not included");
for (const year of nigeria.impact.byYear) add(FUND, `Estimated bills removed, ${year.year}`, `${year.year}: ${year.billsRemoved} removed; ${year.meteredShare} metered at year end`, year.billsRemoved, "calculated (modelled)", "As above");

/* Fund alone, and the structure. */
add(FUND, "Fund alone: charge and cap multiple", nigeria.headline.sentence, nigeria.headline.figure, "calculated", nigeria.headline.how);
add("Metering Fund (Brief scenario)", "Fund alone: charge and cap multiple", brief.headline.sentence, brief.headline.figure, "calculated (test scenario)", "GEH Brief 15 test scenario: 15 million customers, 45% metered");
if (brief.atCap) add("Metering Fund (Brief scenario)", "Public money to hold the charge at the cap", brief.atCap.sentence, "", "calculated (test scenario)", brief.atCap.how);
if (nigeria.atCap) add(FUND, "Public money to hold the charge at the cap", nigeria.atCap.sentence, "", "calculated", nigeria.atCap.how);
const structure = nigeria.structure;
if (structure === null) throw new Error("No GridIntel structure in the Nigeria case");
add(FUND, "Fund alone, one line", structure.fundAlone, "", "calculated", structure.how);
add(FUND, "GridIntel structure sentence", structure.structure, structure.survived + " shocks survived", "calculated", structure.how);
for (const figure of structure.figures) add(FUND, `Structure: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);
for (const band of structure.bandCharges) add(FUND, `Structure charge, ${band.band}`, `${band.band}: ${band.charge}`, band.charge, band.band.startsWith("Lifeline") ? "rule" : "calculated", band.band.startsWith("Lifeline") ? "Exempt: Lifeline (R1) is up to 50 kWh a month (NERC, September 2026 orders); the share of customers on it, 10%, is a placeholder" : `5% of the band's bill; tariffs from ${MYTO}`);
add(FUND, "Fairness rule", nigeria.fairnessRule, "", "rule", "Design, section 3");
add(FUND, "PMI rule", nigeria.pmiRule, "", "rule", "Design, section 3");
for (const shock of structure.shocks) add(FUND, `Shock: ${shock.label}`, `${shock.label}: ${shock.outcome}`, shock.survives ? "Survives" : "Fails", "calculated", "Shocks from month 13: duty 45%, devaluation 30%, inflation 30% a year (assumptions)");
add(FUND, "Inflation pass-through line", structure.inflationLine, "", "calculated", "Lowest pass-through, in 5% steps, at which investors are repaid in full");

/* Initial investment against break-even, and investors. */
for (const investment of [nigeria.investment.fundAlone, nigeria.investment.structure]) {
  if (investment === null) continue;
  for (const figure of investment.figures) add(FUND, `${investment.label}: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);
}
for (const [label, investor] of [["base", structure.investor.base], ["stressed (all three shocks)", structure.investor.stressed]] as const) {
  add(FUND, `Investor IRR, ${label}`, `${investor.label}: IRR ${investor.irr}, payback ${investor.payback}`, investor.irr, "calculated", `Investor loss ${investor.investorLoss}; absorbed by first loss ${investor.absorbedByFirstLoss}, by the reserve ${investor.absorbedByReserve}`);
}

/* The cost of a meter. */
add(FUND, "Cost per meter, installed", `Cost of one meter, installed: ${nigeria.costPerMeter.figure}`, nigeria.costPerMeter.figure, "calculated", nigeria.costPerMeter.how);
for (const figure of nigeria.costPerMeter.parts) add(FUND, `Cost build-up: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);

/* DisCo allocation. */
const ALLOC = "DisCo allocation";
const allocation = await allocationView(published, {});
add(ALLOC, "Headline", allocation.headline, "", "calculated", `${NERC_Q2}, Table 15 p. 56; ${NERC_Q1}, Table 18 p. 58`);
const enugu = allocation.rows.find((row) => row.id === "enugu");
if (enugu) add(ALLOC, "Enugu: never at this pace", `Enugu: ${enugu.unmetered} unmetered, installed ${enugu.installsQ1} (Q1) and ${enugu.installsQ2} (Q2); to 100%: ${enugu.monthsTo100}`, enugu.monthsTo100, "calculated", `Installs and active customers, ${NERC_Q1} and ${NERC_Q2}`);
add(ALLOC, "Lifeline rule (on screen under the first million)", allocation.rule, "", "rule", "Lifeline (R1) up to 50 kWh a month, NERC September 2026 orders");
add(ALLOC, "First million", allocation.firstMillion, "", "calculated", "PMI 750,000 meters in 2027 as reported (S1, S2); 250,000 on private capital (assumption)");
for (const row of allocation.rows) add(ALLOC, `Split: ${row.name}`, `${row.name}: pro-rata ${row.proRata}; public ${row.publicMeters}; private ${row.privateMeters}; recommended ${row.recommended} (${row.change})`, row.recommended, "calculated", `Need ${row.need}, repayment risk ${row.risk}; ${NERC_Q2}, Tables 7, 8, 15`);
add(ALLOC, "Pilot card", allocation.pilot.sentence, "", "proposal", allocation.pilot.note);
for (const figure of allocation.pilot.figures) add(ALLOC, `Pilot: ${figure.label}`, words(figure), figure.value, figure.origin, figure.basis);

/* DT sequencing. */
const DT = "DT sequencing (synthetic network)";
const dt = await dtSequencingView({ repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} }, {});
add(DT, "Headline", dt.headline, "", "calculated on synthetic records", dt.headlineHow);
add(DT, "Revolving result", dt.revolvingLine, "", "calculated on synthetic records", dt.chart.how);
for (const figure of dt.figures) add(DT, figure.label, words(figure), figure.value, figure.origin, figure.basis);
add(DT, "Cost per meter used", `At ${formatNaira(startingCostPerMeter())} a meter`, formatNaira(startingCostPerMeter()), "calculated", "The Metering Fund's starting cost: hardware, duty, installation (assumptions)");

/* Monitoring. */
const MON = "Monitoring (synthetic actuals)";
const monitoring = await monitoringView(published, createSyntheticMonitoring(await monitoringPlan(published)), {});
add(MON, "Headline", monitoring.headline, "", "calculated; actuals synthetic", monitoring.headlineHow);
add(MON, "Tranche line", monitoring.trancheLine, "", "rule", "Design, section 6");
for (const figure of monitoring.totals) add(MON, figure.label, words(figure), figure.value, figure.origin, figure.basis);

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [
  "# Global Energy Hackathon: key figures",
  "",
  `Generated by \`scripts/geh-key-figures.ts\` from the services at \`${commit}\`. Do not edit by hand: run the script again.`,
  "Wording is what the screen shows. Origin: reported (a published source), calculated (GridIntel's method), assumption, placeholder, synthetic (demonstration records), rule or proposal.",
  "",
  "| Screen | Figure | On-screen wording | Value | Origin | Source or basis |",
  "| --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${cell(row.screen)} | ${cell(row.figure)} | ${cell(row.wording)} | ${cell(row.value)} | ${cell(row.origin)} | ${cell(row.source)} |`),
  "",
];
writeFileSync(new URL("../docs/geh/KEY-FIGURES.md", import.meta.url), lines.join("\n"), "utf8");
console.log(`${rows.length} figures written to docs/geh/KEY-FIGURES.md`);
