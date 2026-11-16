import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { co2Finding, comparePowerSources, dieselCostPerKwh, EMOBILITY_POWER_SOURCE_REFERENCE, petrolBaselineKgCo2, type HubPowerFacts, type PowerOption } from "./powerSource.ts";

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
  it("costs diesel, fuel only, at ₦1,092.49 a kWh (base price) and ₦583.33 (low price), and burns 250 litres a day for 750 kWh", () => {
    close(dieselCostPerKwh(), 1092.49);
    close(dieselCostPerKwh(undefined, "low"), 583.33);
    const diesel = option(comparePowerSources(hub()), "diesel");
    close(diesel.days!.average.dieselLitres, 250);
    close(diesel.days!.average.costPerKwh!, 1092.49);
    close(diesel.days!.average.costPerSwap!, 2731.22);
    close(diesel.days!.average.costPerKwhLowDiesel!, 583.33);
    close(diesel.days!.average.costPerSwapLowDiesel!, 1458.33);
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
    close(bandD.days!.average.costPerKwh!, 316.88);
    close(bandD.days!.average.costPerKwhLowDiesel!, 186.54);
  });

  it("measures avoided CO2 against petrol motorcycles, with the grid at 0.395 kg a kWh, and gives none without a grid factor", () => {
    close(petrolBaselineKgCo2({ motorcycle: 300 }), 974.53);
    const results = comparePowerSources(hub());
    close(option(results, "diesel").days!.average.kgCo2AvoidedPerDay!, 304.53);
    assert.equal(option(results, "diesel").days!.average.co2Finding, "saving");
    close(option(results, "solar_bess").days!.average.kgCo2AvoidedPerDay!, 974.53);
    // 750 kWh from the grid × 0.395 kg a kWh = 296.25 kg.
    close(option(results, "grid_diesel").days!.average.kgCo2AvoidedPerDay!, 678.28);
    const without = comparePowerSources(hub(), { ...EMOBILITY_POWER_SOURCE_REFERENCE.parameters, gridKgCo2PerKwh: null });
    assert.equal(option(without, "grid_diesel").days!.average.kgCo2AvoidedPerDay, null);
    assert.equal(option(without, "grid_diesel").days!.average.co2Finding, null);
    assert.ok(option(without, "grid_diesel").reasons.includes("grid emission factor not available"));
  });

  it("reports no material saving when the difference from petrol is within ±10%", () => {
    assert.equal(co2Finding(10, 100), "no_material_saving");
    assert.equal(co2Finding(-10, 100), "no_material_saving");
    assert.equal(co2Finding(10.1, 100), "saving");
    assert.equal(co2Finding(-10.1, 100), "more_than_petrol");
    assert.equal(co2Finding(5, 0), null);
    // 150 tricycle swaps on diesel only: 625 kWh, 208.3 litres, 558.3 kg against petrol's 519.75 kg (−7.4%).
    const keke = option(comparePowerSources(hub({ swapsPerDay: { tricycle: 150 }, kwhPerDay: 625 })), "diesel");
    close(keke.days!.average.petrolKgCo2PerDay, 519.75);
    close(keke.days!.average.kgCo2AvoidedPerDay!, -38.58);
    assert.equal(keke.days!.average.co2Finding, "no_material_saving");
  });

  it("sizes solar to the average day with the BESS's round-trip losses, and leaves a rainy-season shortfall for the backup", () => {
    const solar = option(comparePowerSources(hub()), "solar_bess");
    // PV makes 375 kWh in sun hours plus 375 ÷ 0.90 = 416.67 kWh through the BESS: 791.67 kWh ÷ (5.73 × 0.80).
    close(solar.pvKwp!, 172.7);
    close(solar.bessKwh!, 416.67);
    close(solar.days!.average.solarKwh, 750);
    close(solar.days!.average.dieselKwh, 0);
    // Rainy season: PV makes 653.50 kWh; 375 used directly, 278.50 into the BESS and 250.65 back out.
    close(solar.days!.rainy_season.solarKwh, 625.65);
    close(solar.days!.rainy_season.dieselLitres, 41.45);
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
    const expectedCost = ((375 + 375 / 0.9) / (5.73 * 0.8)) * 500_000 + (375 / 0.9) * 250_000;
    close(solar.installedCost!, Number(expectedCost.toFixed(2)));
    // Against diesel only: 750 kWh × ₦1,092.49 a day saved.
    close(solar.paybackMonths!, Number((expectedCost / (750 * (3_277.47 / 3)) / 30.4).toFixed(2)));
    close(solar.days!.average.costPerKwh!, 0);
    close(solar.days!.rainy_season.costPerKwh!, 181.1, 1);
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
