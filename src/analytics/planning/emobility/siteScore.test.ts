import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OptionResult, PowerOption } from "./powerSource.ts";
import { cheapestOption, gridNotFeasible, rankSites } from "./siteScore.ts";

const option = (which: PowerOption, costPerSwap: number | null): OptionResult => ({
  option: which,
  pvKwp: null,
  bessKwh: null,
  installedCost: null,
  paybackMonths: null,
  reasons: [],
  days: {
    average: { sun: "average", solarKwh: 0, gridKwh: 0, dieselKwh: 0, dieselLitres: 0, fuelAndTariffPerDay: 0, costPerKwh: null, costPerSwap, costPerKwhLowDiesel: null, costPerSwapLowDiesel: null, hubKgCo2PerDay: null, kgCo2AvoidedPerDay: null, kgCo2AvoidedPerSwap: null, petrolKgCo2PerDay: 0, co2Finding: null, dieselLitresAvoidedPerDay: 0 },
    rainy_season: { sun: "rainy_season", solarKwh: 0, gridKwh: 0, dieselKwh: 0, dieselLitres: 0, fuelAndTariffPerDay: 0, costPerKwh: null, costPerSwap, costPerKwhLowDiesel: null, costPerSwapLowDiesel: null, hubKgCo2PerDay: null, kgCo2AvoidedPerDay: null, kgCo2AvoidedPerSwap: null, petrolKgCo2PerDay: 0, co2Finding: null, dieselLitresAvoidedPerDay: 0 },
  },
});

describe("e-mobility site order", () => {
  it("never takes an option with no cost as the cheapest", () => {
    assert.deepEqual(cheapestOption([option("solar_bess", null), option("diesel", 1458), option("grid_diesel", 524)]), { option: "grid_diesel", costPerSwap: 524 });
    assert.equal(cheapestOption([option("solar_bess", null)]), null);
  });

  it("orders by fit at 24 months, then cost per swap, then headroom, then id, with reasons", () => {
    const ranked = rankSites([
      { id: "no-fit", fitsOnGridAt24: false, limitsAt24: ["DT rating"], headroomLeftAt24Kva: -20, options: [option("grid_diesel", 100)] },
      { id: "fit-dear", fitsOnGridAt24: true, limitsAt24: [], headroomLeftAt24Kva: 90, options: [option("grid_diesel", 600)] },
      { id: "fit-cheap-b", fitsOnGridAt24: true, limitsAt24: [], headroomLeftAt24Kva: 10, options: [option("grid_diesel", 125)] },
      { id: "fit-cheap-a", fitsOnGridAt24: true, limitsAt24: [], headroomLeftAt24Kva: 40, options: [option("grid_diesel", 125)] },
      { id: "unknown", fitsOnGridAt24: null, limitsAt24: [], headroomLeftAt24Kva: null, options: [option("solar_bess", null)] },
    ]);
    assert.deepEqual(ranked.map((one) => one.id), ["fit-cheap-a", "fit-cheap-b", "fit-dear", "unknown", "no-fit"]);
    assert.deepEqual(ranked[0].reasons, ["fits on the grid at 24 months", "cheapest feasible option: grid_diesel", "headroom left at 24 months: 40 kVA"]);
    assert.deepEqual(ranked[3].reasons, ["fit on the grid at 24 months not known", "no feasible option can be costed", "headroom at 24 months not known"]);
    assert.equal(ranked[4].rank, 5);
  });

  it("never names a grid option cheapest where the grid fails at 24 months, and says why", () => {
    const options = [option("grid_diesel", 158), option("diesel", 2731), option("solar_bess", null)];
    const dt = { id: "dt", fitsOnGridAt24: false, limitsAt24: ["DT rating" as const], headroomLeftAt24Kva: -4.9, options };
    assert.equal(gridNotFeasible(dt), "not feasible without a DT upgrade (4.9 kVA short)");
    assert.equal(gridNotFeasible({ fitsOnGridAt24: false, limitsAt24: ["supply hours"], headroomLeftAt24Kva: 10 }), "not feasible: too few hours of supply");
    assert.equal(gridNotFeasible({ fitsOnGridAt24: true, limitsAt24: [], headroomLeftAt24Kva: 10 }), null);
    const [ranked] = rankSites([dt]);
    assert.deepEqual(ranked.cheapest, { option: "diesel", costPerSwap: 2731 });
    assert.deepEqual(ranked.reasons, ["does not fit on the grid at 24 months", "grid options not feasible without a DT upgrade (4.9 kVA short)", "cheapest feasible option: diesel", "headroom left at 24 months: -5 kVA"]);
  });

  it("ranks hubs that do not fit by checks failed, then kVA short, before cost", () => {
    const ranked = rankSites([
      { id: "two-failures-near", fitsOnGridAt24: false, limitsAt24: ["DT rating", "supply hours"], headroomLeftAt24Kva: -1.9, options: [option("diesel", 2000)] },
      { id: "one-failure-far", fitsOnGridAt24: false, limitsAt24: ["DT rating"], headroomLeftAt24Kva: -68.3, options: [option("diesel", 2731)] },
      { id: "one-failure-near", fitsOnGridAt24: false, limitsAt24: ["DT rating"], headroomLeftAt24Kva: -4.9, options: [option("diesel", 2731)] },
    ]);
    assert.deepEqual(ranked.map((one) => one.id), ["one-failure-near", "one-failure-far", "two-failures-near"]);
  });
});
