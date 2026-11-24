import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createSyntheticPlannedCommunities } from "../../repositories/demo/minigridPlanning.ts";
import { rmg01Reference } from "../../repositories/reference/rmg01/index.ts";
import { minigridPlanView, referenceBases } from "./minigrid.ts";
import { DEFAULT_PLAN_SETTINGS } from "./minigridInputs.ts";
import type { MinigridPlanView } from "./minigridViews.ts";

/* The mini-grid planner on the synthetic planned community, with RMG01's published records as
   the one reference site. The figures are what the methods give on the vendored data, recorded
   as found. */
const STATUSES = new Set(["reported", "calculated", "assumption", "placeholder", "input", "synthetic", "not_available"]);
const references = rmg01Reference();

describe("RMG01 as a planning basis", async () => {
  const [basis] = await referenceBases(references);

  it("gives the ramp and the buying share the plan worked out, by calendar year from 2020", () => {
    assert.deepEqual(basis.ramp.map((value) => value?.toFixed(2)), ["0.85", "0.96", "0.97", "1.00", "1.00"]);
    assert.deepEqual(basis.buyingShare.map((value) => value?.toFixed(2)), ["0.56", "0.60", "0.57", "0.50", "0.51"]);
    assert.equal(basis.operationStart, "2020-08-26");
  });

  it("gives the per-meter use at its single tariff, years 1 and 2 at ₦165 pooled: the default basis", () => {
    assert.deepEqual(basis.singleTariff && { ...basis.singleTariff, p50: basis.singleTariff.p50?.toFixed(3), p90: basis.singleTariff.p90?.toFixed(3), classFactor: undefined }, { tariff: 165, years: [1, 2], days: 730, p50: "0.227", p90: "0.287", classFactor: undefined });
    assert.equal(basis.singleTariff?.classFactor.residential?.toFixed(2), "0.94");
    assert.equal(basis.singleTariff?.classFactor.non_residential?.toFixed(2), "1.34");
  });

  it("keeps the site's kWh per reporting meter-day by year of operation, the days left out listed", () => {
    assert.deepEqual(basis.siteKwhPerMeterDay.p50.map((value) => value?.toFixed(3)), ["0.231", "0.222", "0.163", "0.147", "0.122"]);
    assert.deepEqual(basis.siteKwhPerMeterDay.p90.map((value) => value?.toFixed(3)), ["0.296", "0.275", "0.235", "0.261", "0.163"]);
    assert.match(basis.exclusions.join(" "), /135 days left out: 38 with no meter data, 105 in the low-use window, 83 with a stale repeated total/);
    for (const year of [0, 1, 2, 3, 4]) {
      const residential = basis.classFactor.residential[year] ?? NaN;
      assert.ok(residential < 1 && (basis.classFactor.non_residential[year] ?? 0) > 1, `year ${year + 1}`);
    }
  });

  it("finds the two tariff changes: ₦165 to ₦350 and ₦350 to ₦500, 182 days either side", () => {
    assert.deepEqual(basis.tariffs, [165, 350, 500]);
    assert.deepEqual(basis.tariffChanges.map((change) => [change.fromTariff, change.toTariff, change.changeMonth, change.before.days, change.after.days]), [
      [165, 350, "2023-07", 182, 182],
      [350, 500, "2024-02", 182, 182],
    ]);
  });

  it("holds the 2019 build cost by category with what it bought", () => {
    assert.deepEqual(basis.capex, { priceYear: 2019, ngnPerUsd: 350, storageNgn: 12_020_687.5, generationNgn: 10_042_335, distributionAndMeteringNgn: 8_415_000, otherNgn: 4_593_788, totalNgn: 35_071_810.5, pvKwp: 30, storageKwh: 136, connections: 220, accounts: 245 });
    assert.deepEqual(basis.meterGap, { low: 0.086, high: 0.179 });
  });

  it("holds the recurring opex lines as a floor by year, and names the lines the source leaves blank", () => {
    assert.deepEqual(basis.opexFloor.map((floor) => [floor.year, floor.ngnPerYear]), [[2022, 1_368_274], [2023, 785_554], [2024, 1_486_500]]);
    assert.deepEqual(basis.opexBlank, ["Labor", "Metering platform fees"]);
  });
});

describe("the mini-grid plan for the synthetic community", () => {
  let view: MinigridPlanView;
  before(async () => {
    const built = await minigridPlanView(createSyntheticPlannedCommunities(), references);
    assert.ok(built);
    view = built;
  });

  it("is marked synthetic, rests on 1 reference site and credits it", () => {
    assert.equal(view.sourcing.synthetic, true);
    assert.equal(view.community.status, "synthetic");
    assert.equal(view.references, "1 reference site: RMG01");
    assert.deepEqual(view.sourcing.sources.map((source) => source.kind), ["synthetic", "published_dataset"]);
    assert.equal(view.attribution[0].licence, "CC BY 4.0");
    assert.match(view.attribution[0].citation, /Kemabonta.*Geoffrey.*v1\.0\.2/);
    assert.ok(view.sourcing.citations.some((citation) => citation.id === "nasa-power-climatology-5.45N-6.30E"));
  });

  it("gives every input a status and a basis", () => {
    for (const input of view.inputs) {
      assert.ok(STATUSES.has(input.status), input.key);
      assert.ok(input.basis.length > 0, input.key);
    }
    assert.equal(view.inputs.find((input) => input.key === "opex")?.status, "placeholder");
    assert.match(view.inputs.find((input) => input.key === "losses")?.basis ?? "", /8\.6% to 17\.9%.*not used/);
  });

  it("holds the single-tariff use flat by default and sizes on year 2's diversified P90", () => {
    assert.equal(view.demand.label, "Served demand at the reference site, a floor on true demand");
    assert.deepEqual(view.demand.rows.map((row) => row.p50), ["28.58 kWh", "34.74 kWh", "33.51 kWh", "30.30 kWh", "30.80 kWh"]);
    assert.deepEqual(view.demand.rows.map((row) => row.p90), ["36.21 kWh", "44.01 kWh", "42.45 kWh", "38.39 kWh", "39.02 kWh"]);
    assert.equal(view.sizing?.designDay, "Year 2, diversified P90: 44.01 kWh a day");
    assert.deepEqual(view.sizing?.figures.slice(0, 2).map((figure) => figure.value), ["13.73 kWp", "52.82 kWh, Lead-acid"]);
    assert.deepEqual(view.sizing?.utilisation.map((row) => row.p50), ["64.9%", "78.9%", "76.1%", "68.8%", "70.0%"]);
    assert.equal(view.sizing?.oversized, null);
    assert.equal(view.productiveUse?.figure.value, "2.47 kWh a day");
  });

  it("keeps what happened at RMG01 as a labelled scenario, never the default", () => {
    assert.equal(view.demand.scenario.label, "As happened at RMG01 (tariff rises and an outage; confounded)");
    assert.deepEqual(view.demand.scenario.rows.map((row) => row.p50), ["29.20 kWh", "33.95 kWh", "23.70 kWh", "19.68 kWh", "16.55 kWh"]);
  });

  it("uses the fixed budget as the middle case and the ₦350 to ₦500 change; shows ₦165 to ₦350 (+0.53) as not usable", () => {
    assert.match(view.tariff.base, /34\.74 kWh a day, at ₦165\/kWh/);
    assert.deepEqual(view.tariff.scenarios.map((scenario) => [scenario.label, scenario.elasticity, scenario.middle]), [
      ["Fixed budget (e = −1), the middle case", "-1.00", true],
      ["RMG01: ₦350 to ₦500", "-2.10", false],
    ]);
    assert.equal(view.tariff.range, "e = -2.10 to -1.00");
    assert.deepEqual(view.tariff.notUsable.map((one) => [one.label, one.elasticity]), [["RMG01: ₦165 to ₦350", "+0.53"]]);
    assert.match(view.tariff.notUsable[0].reason, /not usable as a price response/);
    assert.ok(view.tariff.notUsable[0].confounders.some((line) => /105 days between the windows are left out/.test(line)));
  });

  it("gives no subsidy gap until opex and a factor to today are set, and then gives one", async () => {
    assert.equal(view.subsidyGap.figures.find((figure) => figure.key === "gap")?.status, "placeholder");
    const scaled = view.subsidyGap.figures.find((figure) => figure.key === "scaledCapex");
    assert.equal(scaled?.value, "₦21,666,037 at 2019 prices; not brought to today");
    assert.match(scaled?.basis ?? "", /₦38,250 a meter bought, 220 meters; ₦34,347 over the 245 accounts, shown beside it/);
    const opex = view.inputs.find((input) => input.key === "opex");
    assert.match(opex?.basis ?? "", /reported floor, excluding labour and metering platform fees \(blank in the source\), never as full opex: RMG01 2022: ₦3,749 a day/);
    const set = await minigridPlanView(createSyntheticPlannedCommunities(), references, {
      ...DEFAULT_PLAN_SETTINGS,
      opexPerDay: { ngn: 3_000, source: "the planner's estimate" },
      ngnPerUsdToday: { rate: 1_500, source: "a cited rate" },
    });
    assert.equal(set?.inputs.find((input) => input.key === "opex")?.status, "input");
    assert.match(set?.inputs.find((input) => input.key === "capexToToday")?.value ?? "", /^× 4\.29 \(₦350\/\$ in 2019 to ₦1,500\.00\/\$ today\)$/);
    const gap = set?.subsidyGap.figures.find((figure) => figure.key === "gap");
    assert.equal(gap?.status, "calculated");
    assert.match(gap?.value ?? "", /a connection$/);
    assert.match(gap?.basis ?? "", /fixed-budget response \(e = −1\) from ₦165/);
  });

  it("lists what each method may not claim", () => {
    assert.ok(view.notClaimed.some((line) => line.method === "All" && /typical/.test(line.claims)));
  });
});
