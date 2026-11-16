import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthsToRepayAt, monthsToRepayWithReturnAt, pledgeOrder, repaymentScheduleAt } from "./loan.ts";
import { monthsToRepay, monthsToRepayWithReturn, repaymentSchedule } from "./marketplace.ts";

describe("the shared loan arithmetic", () => {
  it("repays a cost from a charge a day, and never without a charge", () => {
    assert.equal(monthsToRepayAt(91_200, 200, 30.4), 15);
    assert.equal(monthsToRepayAt(91_200, null, 30.4), null);
    assert.equal(monthsToRepayAt(91_200, 0, 30.4), null);
  });

  it("takes longer at a return, and never when the return outruns the charge", () => {
    const months = monthsToRepayWithReturnAt(91_200, 200, 0.12, 30.4)!;
    assert.ok(months > 15 && months < 17);
    assert.equal(monthsToRepayWithReturnAt(1_000_000, 10, 0.24, 30.4), null);
  });

  it("gives the Marketplace exactly the numbers it gave before the move", () => {
    for (const [cost, charge, rate] of [[90_000, 200, 0], [90_000, 150, 0.08], [180_000, 250, 0.22], [90_000, 50, 0.24]] as const) {
      assert.equal(monthsToRepay(cost, charge), monthsToRepayAt(cost, charge, 30.4));
      assert.equal(monthsToRepayWithReturn(cost, charge, rate), monthsToRepayWithReturnAt(cost, charge, rate, 30.4));
      assert.deepEqual(repaymentSchedule(cost, charge, rate), repaymentScheduleAt(cost, charge, rate, 30.4));
    }
  });

  it("orders pledges by return, then fewer areas, then id", () => {
    const pledges = [
      { id: "b", returnPercent: 8, areas: 2 },
      { id: "a", returnPercent: 8, areas: 2 },
      { id: "c", returnPercent: 8, areas: 1 },
      { id: "d", returnPercent: 0, areas: 5 },
    ];
    assert.deepEqual(pledges.sort(pledgeOrder((pledge) => pledge.areas)).map((pledge) => pledge.id), ["d", "c", "a", "b"]);
  });
});
