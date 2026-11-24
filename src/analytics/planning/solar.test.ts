import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sizeSolar, solarMakesKwh, solarServesKwh } from "./solar.ts";

const close = (actual: number, expected: number, digits = 2) => assert.equal(actual.toFixed(digits), expected.toFixed(digits));

describe("solar and storage sizing (shared)", () => {
  it("sizes PV and a lead-acid battery for the test community's design day (MG-PLAN.md 3.6)", () => {
    const sizing = sizeSolar({ energyKwhPerDay: 41.77, daytimeShare: 0.4, withStorage: true, peakSunHours: 5, performanceRatio: 0.8, depthOfDischarge: 0.5, roundTripEfficiency: 0.85 });
    close(sizing.daytimeKwh, 16.71);
    close(sizing.throughStorageKwh, 25.06);
    close(sizing.pvMakesKwh, 46.19);
    close(sizing.pvKwp, 11.55);
    close(sizing.storageKwh ?? NaN, 50.12);
  });

  it("without storage sizes PV for the daytime part only", () => {
    const sizing = sizeSolar({ energyKwhPerDay: 100, daytimeShare: 0.5, withStorage: false, peakSunHours: 5, performanceRatio: 0.8, depthOfDischarge: 0.9, roundTripEfficiency: 0.9 });
    assert.deepEqual(sizing, { daytimeKwh: 50, throughStorageKwh: 0, pvMakesKwh: 50, pvKwp: 12.5, storageKwh: null });
  });

  it("on a day serves the daytime part first, then through the battery, never more than was to pass through it", () => {
    const made = solarMakesKwh(11.548, 4, 0.8);
    close(made, 36.95);
    close(solarServesKwh(made, 16.708, 25.062, 0.85), 33.92);
    assert.equal(solarServesKwh(10, 16, 20, 0.85), 10);
    assert.equal(solarServesKwh(100, 16, 20, 0.85), 36);
  });
});
