import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { headroomAt, headroomOverTime, type HubSiteFacts } from "./headroom.ts";

const site = (over: Partial<HubSiteFacts>): HubSiteFacts => ({ ratingKva: 300, observedPeakKva: 200, overloadThreshold: 1, hoursOfSupply: 20, chargerKw: 120, ...over });
const close = (actual: number, expected: number, digits = 2) => assert.equal(Number(actual.toFixed(digits)), expected);

describe("e-mobility hub headroom", () => {
  it("fits a DT now but not at 24 months", () => {
    // 230 kVA peak on a 300 kVA DT; the hub grows from 750 to 1,366.9 kWh a day (base adoption) over 20 h of supply.
    const rows = headroomOverTime(site({ observedPeakKva: 230 }), [
      { months: 0, kwhPerDay: 750 },
      { months: 24, kwhPerDay: 1366.875 },
    ]);
    assert.equal(rows[0].fits, true);
    close(rows[0].headroomKva!, 70);
    close(rows[0].hubDrawKva!, 39.47);
    assert.equal(rows[1].fits, false);
    assert.deepEqual(rows[1].limits, ["DT rating"]);
    close(rows[1].dtLoadKva!, 253.58);
    close(rows[1].hubDrawKva!, 71.94);
    assert.ok(rows[1].hubDrawKva! > rows[1].headroomKva!);
  });

  it("finds a feeder with too few supply hours for grid-only charging", () => {
    // 9.3 h of supply: 750 kWh needs 80.6 kW, more than the hub's 60 kW of chargers.
    const result = headroomAt(site({ ratingKva: 500, hoursOfSupply: 9.3, chargerKw: 60 }), 0, 750);
    assert.equal(result.fitsHours, false);
    assert.equal(result.fitsRating, true);
    assert.deepEqual(result.limits, ["supply hours"]);
    assert.equal(result.fits, false);
  });

  it("names both limits when both fail", () => {
    const result = headroomAt(site({ observedPeakKva: 290, hoursOfSupply: 9.3, chargerKw: 60 }), 0, 750);
    assert.deepEqual(result.limits, ["DT rating", "supply hours"]);
  });

  it("shows a DT already over its rating as negative headroom, and the hub not fitting", () => {
    const result = headroomAt(site({ ratingKva: 100, observedPeakKva: 112 }), 0, 300);
    close(result.headroomKva!, -12);
    assert.equal(result.fits, false);
  });

  it("gives no answer, never a fit, for a DT with no observed peak", () => {
    const result = headroomAt(site({ observedPeakKva: null }), 0, 750);
    assert.equal(result.headroomKva, null);
    assert.equal(result.fitsRating, null);
    assert.equal(result.fits, null);
    assert.deepEqual(result.unknown, ["no observed peak on the DT"]);
  });

  it("gives no answer for hours when the feeder has none calculated", () => {
    const result = headroomAt(site({ hoursOfSupply: null }), 0, 750);
    assert.equal(result.fitsHours, null);
    assert.equal(result.hubDrawKw, null);
    assert.equal(result.fits, null);
  });
});
