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

  it("builds the Nigeria case from NERC's 30 June 2026 figures, with growth and pace from the two quarters", async () => {
    const view = await meteringFundView(published, { case: "nigeria" });
    assert.equal(view.scope, "Nigeria, all 11 DisCos");
    assert.equal(figure(view.startingPoint, "customers"), "12.59 million");
    assert.equal(figure(view.startingPoint, "metered"), "7.74 million");
    assert.equal(figure(view.startingPoint, "growth"), "67,546");
    assert.equal(figure(view.startingPoint, "pace"), "129,543");
    assert.match(view.gap.sentence, /^Nigeria needs [\d,]+ meters a month to finish in five years\. It installed 129,543 a month in the first half of 2026\.$/);
    assert.match(figure(view.startingPoint, "rate")!, /NERC states 61\.51% for all DisCos/);
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
