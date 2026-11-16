import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canFundHub, escrowPerDay, hubFundingBasis, hubFundingCost, hubMonthsToRepay, hubRepaymentSchedule, matchHubPledges, type HubFinanceInput, type HubPledgeInput } from "./swapFinance.ts";

const close = (actual: number, expected: number, digits = 2) => assert.equal(Number(actual.toFixed(digits)), expected);

// Test-only costs, not figures of any real hub.
const HUBS: HubFinanceInput[] = [
  { id: "H1", feederId: "F-A", cost: 91_200_000, swapsPerDay: 300 },
  { id: "H2", feederId: "F-B", cost: 60_000_000, swapsPerDay: 200 },
  { id: "H3", feederId: "F-A", cost: null, swapsPerDay: 150 },
];
const pledge = (over: Partial<HubPledgeInput>): HubPledgeInput => ({ id: "p", kind: "dfi", amountNaira: 100_000_000, returnPercent: 8, tenorMonths: 60, feeders: ["F-A", "F-B"], ...over });

describe("e-mobility swap finance", () => {
  it("puts the add-on of every swap into escrow and repays a hub from it", () => {
    assert.equal(escrowPerDay(300), 300_000);
    // ₦91.2m from ₦300,000 a day over 30.4-day months: 10 months at no return.
    close(hubMonthsToRepay(HUBS[0], 0)!, 10);
    const atReturn = hubMonthsToRepay(HUBS[0], 0.2)!;
    close(atReturn, 11.03);
    assert.equal(hubRepaymentSchedule(HUBS[0], 0).length, 10);
  });

  it("never repays or matches a hub with no cost", () => {
    assert.equal(hubMonthsToRepay(HUBS[2], 0.1), null);
    assert.equal(canFundHub(pledge({}), HUBS[2]), false);
  });

  it("funds only hubs on the feeders a pledge names, within its tenor", () => {
    assert.equal(canFundHub(pledge({ feeders: ["F-B"] }), HUBS[0]), false);
    assert.equal(canFundHub(pledge({ tenorMonths: 6 }), HUBS[0]), false);
    assert.equal(canFundHub(pledge({ tenorMonths: null, returnPercent: 0, kind: "public" }), HUBS[0]), true);
  });

  it("orders pledges as the Marketplace does and funds each hub once", () => {
    const result = matchHubPledges([pledge({ id: "dear", returnPercent: 20, amountNaira: 200_000_000 }), pledge({ id: "cheap", returnPercent: 5 })], HUBS);
    assert.deepEqual(result.matches, [
      { pledgeId: "cheap", hubId: "H1", naira: 91_200_000 },
      { pledgeId: "dear", hubId: "H2", naira: 60_000_000 },
    ]);
    assert.deepEqual(result.pledges.cheap, { placed: 91_200_000, queued: 8_800_000, hubs: 1, queuedReason: "the money left is less than the cost of any hub it could still fund" });
    assert.deepEqual(result.waiting, []);
    assert.deepEqual(result.notCosted, ["H3"]);
  });

  it("queues a pledge that cannot place its money, and leaves the hubs waiting", () => {
    // A 6-month tenor at 12%: no hub repays that fast.
    const result = matchHubPledges([pledge({ id: "short", tenorMonths: 6, returnPercent: 12 })], HUBS);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.pledges.short, { placed: 0, queued: 100_000_000, hubs: 0, queuedReason: "tenor shorter than any hub's payback" });
    assert.deepEqual(result.waiting, ["H1", "H2"]);
  });

  it("never places a 3-month pledge on a hub that takes longer to repay, and queues it with the reason", () => {
    // H1 repays in about 10 months at no return; at 24% it takes longer still.
    assert.ok(hubMonthsToRepay(HUBS[0], 0.24)! > 3);
    const short = pledge({ id: "three", tenorMonths: 3, returnPercent: 24, amountNaira: 50_000_000, feeders: ["F-A"] });
    assert.equal(canFundHub(short, HUBS[0]), false);
    const result = matchHubPledges([short], HUBS);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.pledges.three, { placed: 0, queued: 50_000_000, hubs: 0, queuedReason: "tenor shorter than any hub's payback" });
  });

  it("names why money is queued when no costed hub is on the pledge's feeders", () => {
    const result = matchHubPledges([pledge({ id: "elsewhere", feeders: ["F-C"] })], HUBS);
    assert.equal(result.pledges.elsewhere.queuedReason, "no costed hub on its feeders");
  });

  it("funds a hub on the grid only where it fits through 24 months; otherwise a DT upgrade or solar + BESS", () => {
    const row = (months: number, fits: boolean | null, limits: ("DT rating" | "supply hours")[] = []) => ({ months, fits, limits });
    assert.deepEqual(hubFundingBasis([row(0, true), row(12, true), row(24, true), row(48, false, ["DT rating"])]), { power: "grid", dtUpgradeBy: null, reason: "fits on the grid through 24 months" });
    assert.deepEqual(hubFundingBasis([row(0, true), row(12, true), row(24, false, ["DT rating"])]), { power: "grid_after_dt_upgrade", dtUpgradeBy: 24, reason: "the DT rating fails at 24 months" });
    assert.deepEqual(hubFundingBasis([row(0, false, ["DT rating"]), row(12, false, ["DT rating", "supply hours"])]), { power: "solar_bess", dtUpgradeBy: null, reason: "the feeder's hours of supply fail at 12 months" });
    assert.equal(hubFundingBasis([row(0, null)]).power, null);
  });

  it("adds the PV and BESS cost to a hub on solar + BESS, and gives no cost while it is a placeholder", () => {
    const solar = { power: "solar_bess" as const, dtUpgradeBy: null, reason: "" };
    assert.equal(hubFundingCost(30_000_000, solar, null), null);
    assert.equal(hubFundingCost(30_000_000, solar, 20_000_000), 50_000_000);
    assert.equal(hubFundingCost(30_000_000, { power: "grid_after_dt_upgrade", dtUpgradeBy: 0, reason: "" }, null), 30_000_000);
    assert.equal(hubFundingCost(30_000_000, { power: null, dtUpgradeBy: null, reason: "" }, 1), null);
  });
});
