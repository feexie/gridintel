import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OptionResult, PowerOption } from "./powerSource.ts";
import { cheapestOption, rankSites } from "./siteScore.ts";

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
      { id: "no-fit", fitsOnGridAt24: false, headroomLeftAt24Kva: -20, options: [option("grid_diesel", 100)] },
      { id: "fit-dear", fitsOnGridAt24: true, headroomLeftAt24Kva: 90, options: [option("grid_diesel", 600)] },
      { id: "fit-cheap-b", fitsOnGridAt24: true, headroomLeftAt24Kva: 10, options: [option("grid_diesel", 125)] },
      { id: "fit-cheap-a", fitsOnGridAt24: true, headroomLeftAt24Kva: 40, options: [option("grid_diesel", 125)] },
      { id: "unknown", fitsOnGridAt24: null, headroomLeftAt24Kva: null, options: [option("solar_bess", null)] },
    ]);
    assert.deepEqual(ranked.map((one) => one.id), ["fit-cheap-a", "fit-cheap-b", "fit-dear", "unknown", "no-fit"]);
    assert.deepEqual(ranked[0].reasons, ["fits on the grid at 24 months", "cheapest costed option: grid_diesel", "headroom left at 24 months: 40 kVA"]);
    assert.deepEqual(ranked[3].reasons, ["fit on the grid at 24 months not known", "no option can be costed", "headroom at 24 months not known"]);
    assert.equal(ranked[4].rank, 5);
  });
});
