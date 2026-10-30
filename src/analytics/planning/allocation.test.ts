import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateTranche, scoreDiscos, type DiscoFacts } from "./allocation.ts";

/** Three DisCos: A has most of the gap and collects badly; B is small and collects well; C publishes no collection figure. */
const DISCOS: DiscoFacts[] = [
  { id: "a", activeCustomers: 1_000_000, meteredCustomers: 400_000, installsPerMonth: 20_000, growthPerMonth: 5_000, collectionEfficiency: 0.5, atccLoss: 0.6, lowBandShare: null },
  { id: "b", activeCustomers: 500_000, meteredCustomers: 400_000, installsPerMonth: 5_000, growthPerMonth: 5_000, collectionEfficiency: 0.9, atccLoss: 0.2, lowBandShare: null },
  { id: "c", activeCustomers: 400_000, meteredCustomers: 100_000, installsPerMonth: 10_000, growthPerMonth: 2_000, collectionEfficiency: null, atccLoss: 0.3, lowBandShare: null },
];

const close = (actual: number, expected: number, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

describe("DisCo allocation", () => {
  it("gives each DisCo its share of the gap, its rate, and the months to 100% at its pace, or none when growth keeps up", () => {
    const [a, b, c] = scoreDiscos(DISCOS);
    close(a.gapShare, 600_000 / 1_000_000);
    close(c.meteringRate, 0.25);
    close(a.monthsTo100!, 600_000 / 15_000);
    assert.equal(b.monthsTo100, null);
  });

  it("leaves a missing figure out of a score and names it, never counting it as 0", () => {
    const [a, , c] = scoreDiscos(DISCOS);
    assert.deepEqual(a.needMissing, ["low-band share"]);
    assert.deepEqual(c.riskMissing, ["collection efficiency"]);
    // C's risk is its ATC&C alone, scaled to A's 60%.
    close(c.risk!, 0.3 / 0.6);
    // A has the largest gap share and the lowest rate after C: need from the two published components.
    close(a.need, (0.5 * 1 + 0.3 * (0.6 / 0.75)) / 0.8);
  });

  it("sends public meters to need and private capital to low risk, never past a DisCo's unmetered customers", () => {
    const result = allocateTranche(scoreDiscos(DISCOS), 300_000, 200_000);
    const total = (key: "proRata" | "publicMeters" | "privateMeters") => result.allocation.reduce((sum, row) => sum + row[key], 0);
    close(total("publicMeters"), 300_000, 1e-3);
    close(total("privateMeters"), 200_000, 1e-3);
    close(total("proRata"), 500_000, 1e-3);
    const [a, b] = result.allocation;
    // A is the riskiest: at first it gets no private capital; B, the safest, gets the most per unmetered customer.
    close(a.privateMeters, 0, 1e-6);
    assert.ok(b.privateMeters / 100_000 > result.allocation[2].privateMeters / 300_000);
    for (const row of result.allocation) assert.ok(row.recommended <= result.scored.find((one) => one.id === row.id)!.unmetered + 1e-6);
  });

  it("widens private capital to plain pro-rata once risk no longer counts", () => {
    const result = allocateTranche(scoreDiscos(DISCOS), 0, 100_000, 0);
    for (const row of result.allocation) close(row.privateMeters, row.proRata, 1e-3);
  });
});
