import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hubAgainstPlan } from "./verify.ts";

const day = (swaps: number, kwhCharged: number, minutesAvailable: number) => ({ hubId: "H", day: "2026-09-01", swaps, kwhCharged, minutesAvailable, sourceId: "s" });

describe("an installed hub against its plan", () => {
  it("sets swaps, energy and availability against the plan", () => {
    const result = hubAgainstPlan([day(180, 500, 1_440), day(100, 280, 720)], 200, 566.7)!;
    assert.equal(result.swaps, 280);
    assert.equal(result.plannedSwaps, 400);
    assert.equal(result.swapsShare, 0.7);
    assert.equal(result.kwhCharged, 780);
    assert.equal(Number(result.kwhShare!.toFixed(4)), 0.6882);
    assert.equal(result.availability, 0.75);
  });

  it("gives no figure for a hub with no days recorded", () => {
    assert.equal(hubAgainstPlan([], 200, 566.7), null);
  });
});
