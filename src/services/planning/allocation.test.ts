import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { allocationView } from "./allocation.ts";

const published = nercPublishedFigures();

describe("the DisCo allocation screen", () => {
  it("states the largest gap first, from NERC's 30 June 2026 figures and the 2026 pace", async () => {
    const view = await allocationView(published, {});
    assert.equal(view.headline, "Ibadan holds 22.2% of Nigeria's unmetered customers; at the current pace it reaches 100% in 52 months.");
    assert.match(view.headlineHow, /^How this is calculated:/);
    assert.equal(view.rows.length, 11);
    assert.equal(view.rows[0].name, "Ibadan");
  });

  it("says when a DisCo's pace never closes its gap, and shows NERC's figures beside each", async () => {
    const view = await allocationView(published, {});
    const enugu = view.rows.find((row) => row.id === "enugu")!;
    assert.equal(enugu.monthsTo100, "Never at this pace");
    assert.equal(enugu.collection, "79.52%");
    assert.equal(enugu.atcc, "36.8% (target 18.08%)");
    // NERC publishes no low-band share per DisCo: the need score is computed without it, and says so.
    assert.ok(view.rows.every((row) => row.needMissing.includes("low-band share")));
  });

  it("splits the first million: public meters to need, private capital away from repayment risk, against pro-rata", async () => {
    const view = await allocationView(published, {});
    assert.match(view.firstMillion, /^The first million meters: 750,000 public meters go where the need is greatest, most to Ibadan, Enugu, Jos\. 250,000 on private capital are weighted away from repayment risk: Kaduna, Kano, Jos get the fewest/);
    const kaduna = view.rows.find((row) => row.id === "kaduna")!;
    assert.equal(kaduna.change.startsWith("−"), true);
  });

  it("sets out a pilot from the model, as a proposal, for the DisCo chosen", async () => {
    const view = await allocationView(published, { pilotDisco: "kano" });
    assert.equal(view.pilot.sentence, "Pilot: Kano DisCo, two feeders, 20,000 meters over 12 months, installed by NEMSA-certified local installers.");
    assert.equal(view.pilot.figures.find((one) => one.key === "perMonth")?.value, "1,667");
    assert.match(view.pilot.note, /^A proposal\./);
    assert.equal(view.rows.find((row) => row.id === "kano")?.pilot, true);
  });

  it("takes weights from the address: with risk not counted, private capital follows pro-rata", async () => {
    const view = await allocationView(published, { riskEmphasis: "0", publicTranche: "0", privateTranche: "1000000" });
    for (const row of view.rows) assert.equal(row.privateMeters, row.proRata, row.name);
  });
});
