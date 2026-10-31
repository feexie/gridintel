import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareQuarter, planEscrow, spreadOverQuarters } from "./monitoring.ts";

describe("monitoring the metering programme", () => {
  it("spreads a DisCo's meters evenly over the quarters, in whole meters, losing none", () => {
    assert.deepEqual(spreadOverQuarters(10, 4), [3, 3, 2, 2]);
    assert.equal(spreadOverQuarters(250_001, 4).reduce((sum, one) => sum + one, 0), 250_001);
  });

  it("releases tranches against verified installs only, and holds what the plan expected beyond them", () => {
    const behind = compareQuarter(10_000, { metersInstalled: 8_000, metersVerified: 7_000, escrowCollected: 0, investorRepaid: 0 }, 100_000, 250);
    assert.equal(behind.againstPlan, 0.7);
    assert.equal(behind.behind, true);
    assert.equal(behind.trancheReleased, 700_000_000);
    assert.equal(behind.trancheHeld, 300_000_000);
    assert.equal(behind.escrowPlan, 10_000 * 1.5 * 250);
    const ahead = compareQuarter(10_000, { metersInstalled: 10_500, metersVerified: 10_200, escrowCollected: 0, investorRepaid: 0 }, 100_000, 250);
    assert.equal(ahead.behind, false);
    assert.equal(ahead.trancheHeld, 0);
  });

  it("has no planned escrow without a charge, never 0", () => {
    assert.equal(planEscrow(10_000, null), null);
    assert.equal(compareQuarter(0, { metersInstalled: 0, metersVerified: 0, escrowCollected: 0, investorRepaid: 0 }, 100_000, null).againstPlan, null);
  });
});
