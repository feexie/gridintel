import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparePowerSources, dieselCostPerKwh, EMOBILITY_POWER_SOURCE_REFERENCE, petrolBaselineKgCo2, type HubPowerFacts, type PowerOption } from "./powerSource.ts";

const close = (actual: number, expected: number, digits = 2) => assert.equal(Number(actual.toFixed(digits)), expected);

const hub = (over: Partial<HubPowerFacts> = {}): HubPowerFacts => ({
  swapsPerDay: { motorcycle: 300 },
  kwhPerDay: 750,
  grid: { tariffPerKwh: 209.5, hoursOfSupply: 21.5, availableKw: 120 },
  solar: { averagePeakSunHours: 5.73, rainySeasonPeakSunHours: 4.73 },
  installed: { pvNairaPerKwp: null, bessNairaPerKwh: null },
  ...over,
});
const option = (results: ReturnType<typeof comparePowerSources>, which: PowerOption) => results.find((one) => one.option === which)!;

describe("e-mobility power source", () => {
  it("costs diesel at ₦583.33 a kWh, fuel only, and burns 250 litres a day for 750 kWh", () => {
    close(dieselCostPerKwh(), 583.33);
    const diesel = option(comparePowerSources(hub()), "diesel");
    close(diesel.days!.average.dieselLitres, 250);
    close(diesel.days!.average.costPerKwh!, 583.33);
    close(diesel.days!.average.costPerSwap!, 1458.33);
    close(diesel.days!.average.hubKgCo2PerDay!, 670);
  });

  it("prices each hub at its own feeder's band tariff", () => {
    const bandA = option(comparePowerSources(hub()), "grid_diesel");
    close(bandA.days!.average.gridKwh, 750);
    close(bandA.days!.average.costPerKwh!, 209.5);
    // Band D on Yola DisCo's order, 9.3 h of supply and 60 kW: 558 kWh from the grid, 192 kWh from diesel.
    const bandD = option(comparePowerSources(hub({ grid: { tariffPerKwh: 50.01, hoursOfSupply: 9.3, availableKw: 60 } })), "grid_diesel");
    close(bandD.days!.average.gridKwh, 558);
    close(bandD.days!.average.dieselKwh, 192);
    close(bandD.days!.average.costPerKwh!, 186.54);
  });

  it("measures avoided CO2 against petrol motorcycles, and gives none for a grid option without a grid factor", () => {
    close(petrolBaselineKgCo2({ motorcycle: 300 }), 974.53);
    const results = comparePowerSources(hub());
    close(option(results, "diesel").days!.average.kgCo2AvoidedPerDay!, 304.53);
    close(option(results, "solar_bess").days!.average.kgCo2AvoidedPerDay!, 974.53);
    assert.equal(option(results, "grid_diesel").days!.average.kgCo2AvoidedPerDay, null);
    assert.ok(option(results, "grid_diesel").reasons.includes("grid emission factor not available"));
    const withFactor = comparePowerSources(hub(), { ...EMOBILITY_POWER_SOURCE_REFERENCE.parameters, gridKgCo2PerKwh: 0.4 });
    close(option(withFactor, "grid_diesel").days!.average.kgCo2AvoidedPerDay!, 674.53);
  });

  it("sizes solar to the average day and leaves a rainy-season shortfall for the backup", () => {
    const solar = option(comparePowerSources(hub()), "solar_bess");
    close(solar.pvKwp!, 163.61);
    close(solar.bessKwh!, 416.67);
    close(solar.days!.average.dieselKwh, 0);
    close(solar.days!.rainy_season.solarKwh, 619.11);
    close(solar.days!.rainy_season.dieselLitres, 43.63);
    const solarGrid = option(comparePowerSources(hub()), "solar_grid");
    close(solarGrid.pvKwp!, 81.81);
    close(solarGrid.days!.average.solarKwh, 375);
    close(solarGrid.days!.average.gridKwh, 375);
  });

  it("gives a solar option no cost and no payback until an installed cost is supplied", () => {
    const solar = option(comparePowerSources(hub()), "solar_bess");
    assert.equal(solar.installedCost, null);
    assert.equal(solar.days!.average.costPerKwh, null);
    assert.equal(solar.paybackMonths, null);
    assert.ok(solar.reasons.includes("placeholder: no EPC quote"));
  });

  it("compares diesel with solar + BESS once costs are supplied (test-only costs)", () => {
    const results = comparePowerSources(hub({ installed: { pvNairaPerKwp: 500_000, bessNairaPerKwh: 250_000 } }));
    const solar = option(results, "solar_bess");
    const expectedCost = (750 / (5.73 * 0.8)) * 500_000 + (375 / 0.9) * 250_000;
    close(solar.installedCost!, Number(expectedCost.toFixed(2)));
    close(solar.paybackMonths!, Number((expectedCost / 437_500 / 30.4).toFixed(2)));
    close(solar.days!.average.costPerKwh!, 0);
    close(solar.days!.rainy_season.costPerKwh!, 101.8, 1);
    assert.equal(option(results, "diesel").paybackMonths, null);
  });

  it("cannot study a grid option without the feeder's figures, and says why", () => {
    const results = comparePowerSources(hub({ grid: { tariffPerKwh: null, hoursOfSupply: 9.3, availableKw: 60 } }));
    const grid = option(results, "grid_diesel");
    assert.equal(grid.days, null);
    assert.deepEqual(grid.reasons, ["no published tariff for the feeder's band"]);
    assert.notEqual(option(results, "solar_bess").days, null);
  });
});
