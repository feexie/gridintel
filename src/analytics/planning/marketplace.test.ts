import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedBands, canFund, matchPledges, monthsToRepay, takeAtRecharge, type BandTerms, type PledgeInput } from "./marketplace.ts";

const TERMS: BandTerms[] = [
  { band: "A1", meterCost: 90_000, chargePerDay: 200 },
  { band: "A3", meterCost: 180_000, chargePerDay: 250 },
  { band: "B", meterCost: 90_000, chargePerDay: 150 },
  { band: "C", meterCost: 90_000, chargePerDay: 100 },
  { band: "D", meterCost: 90_000, chargePerDay: 75 },
  { band: "E", meterCost: 90_000, chargePerDay: 50 },
  { band: "lifeline", meterCost: 90_000, chargePerDay: null },
];
const terms = (band: string) => TERMS.find((one) => one.band === band)!;

const pledge = (over: Partial<PledgeInput>): PledgeInput => ({ id: "p", kind: "private", amountNaira: 1_000_000, bands: ["A1", "A3", "B", "C", "D", "E", "lifeline"], discos: ["kano", "eko"], returnPercent: 20, tenorMonths: 36, ...over });

describe("the metering marketplace", () => {
  it("repays a meter from its daily charge, and an exempt band never", () => {
    assert.equal(monthsToRepay(91_200, 200), 15);
    assert.equal(monthsToRepay(90_000, null), null);
  });

  it("takes what is owed at a recharge, never more than half of it, and carries the rest", () => {
    assert.deepEqual(takeAtRecharge(1_400, 5_000), { toEscrow: 1_400, carried: 0 });
    assert.deepEqual(takeAtRecharge(3_000, 2_000), { toEscrow: 1_000, carried: 2_000 });
  });

  it("sends private money to Bands A and B, DFI and public money to C to E, and only grants to Lifeline", () => {
    assert.deepEqual(allowedBands("private"), ["A1", "A3", "B"]);
    assert.ok(!canFund(pledge({ kind: "private" }), terms("C")));
    assert.ok(!canFund(pledge({ kind: "dfi", tenorMonths: 120 }), terms("B")));
    assert.ok(canFund(pledge({ kind: "dfi", tenorMonths: 120 }), terms("E")));
    assert.ok(!canFund(pledge({ kind: "dfi", tenorMonths: 120 }), terms("lifeline")));
    assert.ok(canFund(pledge({ kind: "public", tenorMonths: null }), terms("lifeline")));
    assert.ok(!canFund(pledge({ kind: "public", tenorMonths: 120 }), terms("lifeline")));
  });

  it("matches a band only when its months to repay fit within the pledge's tenor", () => {
    // A3: 180,000 ÷ (250 × 30.4) = 23.7 months; E: 59.2 months.
    assert.ok(canFund(pledge({ tenorMonths: 24 }), terms("A3")));
    assert.ok(!canFund(pledge({ tenorMonths: 23 }), terms("A3")));
    assert.ok(!canFund(pledge({ kind: "dfi", tenorMonths: 48 }), terms("E")));
  });

  it("takes the cheapest money first, poorest band first, and queues what cannot be placed", () => {
    const pledges = [pledge({ id: "dear", kind: "dfi", returnPercent: 12, tenorMonths: 84, amountNaira: 500_000 }), pledge({ id: "cheap", kind: "dfi", returnPercent: 8, tenorMonths: 84, amountNaira: 200_000 })];
    const result = matchPledges(pledges, [{ disco: "kano", band: "C", approved: 3 }, { disco: "kano", band: "E", approved: 1 }], TERMS, ["kano", "eko"]);
    assert.deepEqual(result.matches, [
      { pledgeId: "cheap", disco: "kano", band: "E", meters: 1, naira: 90_000 },
      { pledgeId: "cheap", disco: "kano", band: "C", meters: 1, naira: 90_000 },
      { pledgeId: "dear", disco: "kano", band: "C", meters: 2, naira: 180_000 },
    ]);
    assert.deepEqual(result.pledges.cheap, { placed: 180_000, queued: 20_000, meters: 2 });
    assert.deepEqual(result.pledges.dear, { placed: 180_000, queued: 320_000, meters: 2 });
    assert.deepEqual(result.waiting, []);
  });

  it("matches only in the pledge's own DisCos, and leaves the rest waiting", () => {
    const result = matchPledges([pledge({ discos: ["eko"] })], [{ disco: "kano", band: "A1", approved: 2 }, { disco: "eko", band: "A1", approved: 1 }], TERMS, ["kano", "eko"]);
    assert.deepEqual(result.waiting, [{ disco: "kano", band: "A1", approved: 2 }]);
    assert.equal(result.pledges.p.meters, 1);
  });

  it("places a pledge of whole meters exactly", () => {
    const result = matchPledges([pledge({ kind: "public", tenorMonths: null, amountNaira: 1_000 * 91_033.3 })], [{ disco: "kano", band: "C", approved: 5_000 }], [{ band: "C", meterCost: 91_033.3, chargePerDay: 100 }], ["kano"]);
    assert.equal(result.pledges.p.meters, 1_000);
  });

  it("gives the same matches for the same inputs", () => {
    const run = () => matchPledges([pledge({}), pledge({ id: "q", returnPercent: 20 })], [{ disco: "eko", band: "B", approved: 20 }], TERMS, ["kano", "eko"]);
    assert.deepEqual(run(), run());
  });
});
