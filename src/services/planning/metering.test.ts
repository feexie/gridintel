import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { readAssumptions } from "./assumptions.ts";
import { meteringFundView } from "./metering.ts";

const published = nercPublishedFigures();
const figure = (figures: { key: string; value: string }[], key: string) => figures.find((one) => one.key === key)?.value;

describe("the Metering Fund screen", () => {
  it("states the finding first: the charge, its share of a typical bill, and how far it is above the cap", async () => {
    const view = await meteringFundView(published, { case: "brief" });
    assert.match(view.headline.sentence, /^Metering every customer by year 5 with no upfront payment needs ₦[\d,]+ a month: [\d.]+% of a typical Band C bill, ₦[\d,]+ above the 5% cap\.$/);
    assert.equal(view.headline.tone, "warning");
    assert.match(view.headline.how, /^How this is calculated:/);
    assert.match(view.atCap!.sentence, /^Held at the cap, ₦261 a month, each meter is up to ₦[\d,]+ short\. Public money of ₦[\d.]+ billion \(PMI, DISREP, MAF\) would close the gap/);
    assert.match(view.repaymentLine, /^Each meter is repaid within 5 years of installation; the last meters finish repaying in month 120\.$/);
    assert.equal(view.sourcing.synthetic, false);
  });

  it("shows Brief 15's two impact measures: customers metered in five years and estimated bills removed, by year", async () => {
    const view = await meteringFundView(published, { case: "nigeria" });
    assert.equal(view.impact.metered.value, "100.0%");
    assert.match(view.impact.bills.value, /^[\d.]+ million$/);
    assert.equal(view.impact.byYear.length, 5);
    assert.deepEqual(view.impact.byYear.map((year) => year.year), ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"]);
    assert.match(view.impact.how, /each unmetered customer gets one estimated bill a month/);
    assert.match(view.impact.how, /missed readings\) are not included/);
  });

  it("builds the Nigeria case from NERC's 30 June 2026 figures, with growth and pace from the two quarters", async () => {
    const view = await meteringFundView(published, { case: "nigeria" });
    assert.equal(view.scope, "Nigeria, all 11 DisCos");
    assert.equal(figure(view.startingPoint, "customers"), "12.59 million");
    assert.equal(figure(view.startingPoint, "metered"), "7.74 million");
    assert.equal(figure(view.startingPoint, "growth"), "67,546");
    assert.equal(figure(view.startingPoint, "pace"), "129,543");
    assert.match(view.gap.sentence, /^Nigeria needs [\d,]+ meters a month to finish in five years\. It installed 129,543 a month in the first half of 2026\.$/);
    assert.equal(figure(view.startingPoint, "rate"), "61.51% (NERC: 61.51%)");
    // Each figure cites only the table it comes from.
    const customers = view.startingPoint.find((one) => one.key === "customers")!;
    assert.match(customers.basis, /Table 15, p\. 56$/);
    assert.ok(!customers.basis.includes("Table 7"));
    // NERC's total is shown beside the sum, not again among the other published figures.
    assert.ok(!view.references.some((one) => one.label === "Nigeria, 30 June 2026"));
    assert.ok(view.references.some((one) => one.label === "Nigeria, August 2026" && one.value.startsWith("63.1% metered")));
    assert.match(view.yearsNote, /^Year 1 is July 2026 to June 2027/);
    assert.ok(view.citations.some((one) => one.id === "nerc-q2-2026" && one.standing === "primary"));
  });

  it("uses a DisCo's own tariffs and shows a band its order does not list as not available", async () => {
    const kano = await meteringFundView(published, { case: "nigeria", disco: "kano" });
    assert.equal(kano.bands.find((band) => band.band === "C")?.tariff, "₦47.57");
    assert.equal(kano.bands.find((band) => band.band === "C")?.tariffOrigin, "reported");
    const yola = await meteringFundView(published, { case: "nigeria", disco: "yola" });
    const bandE = yola.bands.find((band) => band.band === "E")!;
    assert.equal(bandE.tariff, "Not available");
    assert.equal(bandE.bill, "Not available");
    assert.equal(bandE.underCap, null);
    assert.deepEqual(yola.citations.filter((one) => one.id.startsWith("nerc-myto-")).map((one) => one.id), ["nerc-myto-2026-09-yedc"]);
  });

  it("keeps the fund solvent under the duty shock when the duty-shock reserve is on, and not without it", async () => {
    const without = await meteringFundView(published, { case: "brief" });
    assert.equal(without.stress.find((row) => row.key === "duty")?.solvent, false);
    const reserved = await meteringFundView(published, { case: "brief", dutyReserve: "1" });
    assert.equal(reserved.stress.find((row) => row.key === "duty")?.solvent, true);
    assert.equal(reserved.mitigations.find((one) => one.key === "dutyReserve")?.on, true);
  });

  it("labels the band split as a placeholder and every input with its basis", async () => {
    const view = await meteringFundView(published, { case: "brief" });
    assert.ok(view.assumptions.filter((one) => one.key.startsWith("share")).every((one) => one.origin === "placeholder"));
    assert.ok(view.assumptions.every((one) => one.basis.length > 0));
    assert.ok(!view.assumptions.some((one) => one.key === "pmi2027"), "PMI belongs to the Nigeria case");
  });
});

describe("the GridIntel structure beside the fund alone", () => {
  it("states both results: the customer alone at 4.9x the cap, and the split that stays within it, with what it fails", async () => {
    const view = await meteringFundView(published, { case: "nigeria" });
    const structure = view.structure!;
    assert.equal(structure.fundAlone, "Fund alone: ₦1,286 a month, 4.9x the cap.");
    assert.equal(structure.structure, "GridIntel structure: within the cap for every band; public money ₦650.2 billion, 93% of the ₦700bn already raised for PMI; survives 2 of 4 shocks.");
    // What it fails, split: the fund's shortfall, the buffers, investors (never more than their capital), and what is uncovered.
    assert.match(structure.failures!, /^Inflation: fund shortfall ₦469\.8 billion\. ₦69\.6 billion taken by the first-loss layer and the reserve; investors get back all their ₦63\.0 billion capital \([\d.]+% a year\), but ₦[\d.]+ billion of return due is unpaid; ₦[\d.]+ billion uncovered beyond investors, which falls to the public side unless tariffs follow inflation\. All three together: fund shortfall ₦1\.56 trillion\./);
    assert.ok(!/investors lose ₦381/.test(structure.failures!));
    assert.equal(structure.investor.stressed.capital, "₦63.0 billion");
    assert.equal(structure.investor.stressed.investorLoss, "None");
    assert.equal(structure.investor.stressed.uncovered, "₦1.26 trillion");
    // Public money per meter, beside PMI's reported range, and what the same money meters here.
    const perMeter = structure.publicPerMeter!;
    assert.equal(perMeter.line, "The same order of public money meters 10.4 million customers in this structure.");
    assert.equal(perMeter.figures.find((one) => one.key === "publicPerMeter")?.value, "₦67,226");
    const pmiRange = perMeter.figures.find((one) => one.key === "pmiPerMeter")!;
    assert.equal(pmiRange.value, "₦184,211 to ₦636,364");
    assert.equal(pmiRange.origin, "reported");
    assert.match(pmiRange.basis, /Nairametrics/);
    // The fund alone's shocks say who carries each shortfall, and no share of capital lost is over 100%.
    const combined = view.stress.find((row) => row.key === "combined")!;
    assert.match(combined.split!, /^Investors lose ₦[\d.]+ billion of their ₦342\.8 billion capital \((\d+)%\)/);
    assert.ok(Number(/\((\d+)%\)/.exec(combined.split!)![1]) <= 100);
    assert.equal(view.stress.find((row) => row.key === "base")?.split, null);
    assert.equal(structure.inflationLine, "Survives inflation if tariffs follow at least 20% of it; all three shocks at 55%. Today's assumption: 0%.");
    assert.equal(structure.survived, "2 of 4");
    assert.equal(structure.tone, "warning");
    assert.equal(structure.investor.base.repaid, true);
    assert.equal(structure.investor.base.irr, "22.0% a year");
    assert.equal(structure.investor.stressed.repaid, false);
    assert.equal(structure.figures.find((one) => one.key === "pmiFunding")?.origin, "reported");
    assert.deepEqual(structure.bandCharges.at(-1), { band: "Lifeline (R1)", charge: "₦0, exempt" });
    assert.ok(structure.protection.some((one) => one.requirement && one.title === "Regulatory recognition of the charge"));
  });

  it("sets initial investment against break-even for the fund alone and the structure", async () => {
    const view = await meteringFundView(published, { case: "nigeria" });
    const figure = (investment: typeof view.investment.fundAlone, key: string) => investment.figures.find((one) => one.key === key)?.value;
    assert.equal(figure(view.investment.fundAlone, "peak"), "₦342.8 billion in month 50 (Aug 2030)");
    assert.equal(figure(view.investment.fundAlone, "breakEven"), "Month 51 (Sep 2030)");
    assert.equal(figure(view.investment.fundAlone, "repaid"), "Month 120 (Jun 2036)");
    assert.equal(figure(view.investment.structure!, "repaid"), "Month 64 (Oct 2031)");
    assert.equal(view.investment.structure!.cumulative.length, 121);
  });

  it("shows NERC's exchange rate beside the assumption", async () => {
    const view = await meteringFundView(published, { case: "brief" });
    const nerc = view.costPerMeter.parts.find((one) => one.key === "nercRate")!;
    assert.equal(nerc.value, "₦1,369 per $ (ours: ₦1,334)");
    assert.equal(nerc.origin, "reported");
  });
});

describe("the assumptions in the address", () => {
  it("takes a valid value, and the default for anything missing, malformed or out of range", () => {
    const read = readAssumptions({ case: "nigeria", fx: "1500", duty: "abc", cap: "500", local: "1" });
    assert.equal(read.caseId, "nigeria");
    assert.equal(read.values.fx, 1_500);
    assert.equal(read.values.duty, 10);
    assert.equal(read.values.cap, 5);
    assert.deepEqual(read.changed, ["fx"]);
    assert.equal(read.mitigations.local, true);
    assert.equal(read.mitigations.naira, false);
    assert.equal(readAssumptions({}).caseId, "brief");
  });
});
