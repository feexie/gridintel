import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankDts, revolve, shuffledOrder, type DtFacts } from "./dtSequencing.ts";

/* Three DTs: A is small with high estimated billing; B is large with a high loss; C has no boundary
   meter; D has every customer metered. */
const DTS: DtFacts[] = [
  { id: "a", connections: 20, unmetered: 10, estimatedBillingPerMonth: 100_000, commercialLossPerMonth: 20_000 },
  { id: "b", connections: 200, unmetered: 100, estimatedBillingPerMonth: 200_000, commercialLossPerMonth: 400_000 },
  { id: "c", connections: 50, unmetered: 20, estimatedBillingPerMonth: 60_000, commercialLossPerMonth: null },
  { id: "d", connections: 30, unmetered: 0, estimatedBillingPerMonth: 0, commercialLossPerMonth: 5_000 },
];
const RECOVERY = { estimatedBilling: 0.3, commercialLoss: 0.5 };
const close = (actual: number, expected: number, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

describe("DT sequencing", () => {
  it("ranks DTs by revenue recovered a year per naira of CAPEX, and leaves a DT with nothing to meter unranked", () => {
    const ranked = rankDts(DTS, 100_000, RECOVERY);
    const a = ranked.find((dt) => dt.id === "a")!;
    close(a.capex, 1_000_000);
    close(a.fromEstimatedBilling!, 12 * 100_000 * 0.3);
    close(a.fromCommercialLoss!, 12 * 20_000 * (10 / 20) * 0.5);
    close(a.perNaira!, (360_000 + 60_000) / 1_000_000);
    assert.deepEqual(ranked.map((dt) => [dt.id, dt.rank]), [["a", 1], ["b", 2], ["c", 3], ["d", null]]);
  });

  it("names a missing part and never counts it as 0", () => {
    const c = rankDts(DTS, 100_000, RECOVERY).find((dt) => dt.id === "c")!;
    assert.equal(c.fromCommercialLoss, null);
    assert.deepEqual(c.missing, ["commercial loss"]);
    close(c.recoveredPerYear, 12 * 60_000 * 0.3);
  });

  it("shuffles the same way every run, and keeps every item", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    assert.deepEqual(shuffledOrder(ids), shuffledOrder(ids));
    assert.deepEqual([...shuffledOrder(ids)].sort(), ids);
    assert.notDeepEqual(shuffledOrder(ids, 1), shuffledOrder(ids, 2));
  });

  it("revolves: recoveries buy more meters, so the ranked order meters everyone sooner than a worse one", () => {
    const ranked = rankDts(DTS, 100_000, RECOVERY);
    const run = revolve(ranked, 2_000_000, 120);
    const worst = revolve([...ranked].reverse(), 2_000_000, 120);
    assert.equal(run.months[1].metersInstalled, 20);
    assert.ok(run.monthAllMetered !== null && worst.monthAllMetered !== null);
    assert.ok(run.monthAllMetered <= worst.monthAllMetered);
    assert.ok(run.months[12].recovered > worst.months[12].recovered);
    // With no budget nothing is ever installed.
    assert.equal(revolve(ranked, 0, 12).monthAllMetered, null);
  });
});
