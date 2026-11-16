import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayEnergy, energyPerSwap, energyUsedPerSwap, growthFactor, projectDemand } from "./demand.ts";

const close = (actual: number, expected: number, digits = 2) => assert.equal(Number(actual.toFixed(digits)), expected);

describe("e-mobility swap demand", () => {
  it("draws 2.50 kWh a motorcycle swap and 4.17 a tricycle swap, 3.33 and 5.56 at full depletion", () => {
    const motorcycle = energyPerSwap("motorcycle");
    const tricycle = energyPerSwap("tricycle");
    close(motorcycle.base, 2.5);
    close(tricycle.base, 4.17);
    close(motorcycle.upper, 3.33);
    close(tricycle.upper, 5.56);
    close(energyUsedPerSwap("motorcycle"), 2.25);
  });

  it("gives 750 kWh a day for 300 motorcycle swaps, 1,000 kWh in the upper case", () => {
    const day = dayEnergy({ motorcycle: 300 });
    close(day.kwh, 750);
    close(day.kwhUpper, 1000);
    assert.deepEqual(day.notCounted, []);
  });

  it("never counts a segment it has no battery for as 0 kWh: it names it", () => {
    const day = dayEnergy({ motorcycle: 100, bus: 10 });
    assert.equal(day.swaps, 110);
    close(day.kwh, 250);
    assert.deepEqual(day.notCounted, ["bus"]);
  });

  it("compounds growth at each horizon", () => {
    close(growthFactor(0.35, 0), 1);
    close(growthFactor(0.35, 12), 1.35);
    close(growthFactor(0.35, 24), 1.8225, 4);
    close(growthFactor(0.35, 48), 3.3215, 4);
  });

  it("projects swaps, vehicles, energy and power for every case and horizon", () => {
    const rows = projectDemand({ motorcycle: 300 }, 20);
    assert.equal(rows.length, 12);
    const base24 = rows.find((row) => row.adoption === "base" && row.months === 24)!;
    close(base24.totalSwapsPerDay, 546.75);
    close(base24.vehiclesServed, 364.5);
    close(base24.kwhPerDay, 1366.88);
    close(base24.chargingKw!, 68.34);
    const slow0 = rows.find((row) => row.adoption === "slow" && row.months === 0)!;
    close(slow0.kwhPerDay, 750);
    assert.equal(projectDemand({ motorcycle: 300 }, null)[0].chargingKw, null);
  });
});
