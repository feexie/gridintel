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

  it("gives the site's kWh per reporting meter-day by year of operation, the days left out listed", () => {
    assert.deepEqual(basis.siteKwhPerMeterDay.p50.map((value) => value?.toFixed(3)), ["0.231", "0.222", "0.163", "0.147", "0.122"]);
    assert.deepEqual(basis.siteKwhPerMeterDay.p90.map((value) => value?.toFixed(3)), ["0.296", "0.275", "0.235", "0.261", "0.163"]);
    assert.match(basis.exclusions.join(" "), /135 days left out: 38 with no meter data, 105 in the low-use window, 83 with a stale repeated total/);
    for (const year of [0, 1, 2, 3, 4]) {
      const residential = basis.classFactor.residential[year] ?? NaN;
      assert.ok(residential < 1 && (basis.classFactor.non_residential[year] ?? 0) > 1, `year ${year + 1}`);
    }
  });

  it("finds the two tariff changes disagree: +0.53 after ₦350, −2.10 after ₦500", () => {
    assert.deepEqual(basis.tariffs, [165, 350, 500]);
    assert.deepEqual(basis.tariffChanges.map((change) => [change.fromTariff, change.toTariff, change.changeMonth, change.before.days, change.after.days]), [
      [165, 350, "2023-07", 182, 182],
      [350, 500, "2024-02", 182, 182],
    ]);
  });

  it("holds the 2019 build cost by category with what it bought", () => {
    assert.deepEqual(basis.capex, { priceYear: 2019, storageNgn: 12_020_687.5, generationNgn: 10_042_335, distributionAndMeteringNgn: 8_415_000, otherNgn: 4_593_788, totalNgn: 35_071_810.5, pvKwp: 30, storageKwh: 136, connections: 220 });
    assert.deepEqual(basis.meterGap, { low: 0.086, high: 0.179 });
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

  it("labels demand as served demand and sizes on year 2's diversified P90", () => {
    assert.equal(view.demand.label, "Served demand at the reference site, a floor on true demand");
    assert.deepEqual(view.demand.rows.map((row) => row.p50), ["29.20 kWh", "33.95 kWh", "23.70 kWh", "19.68 kWh", "16.55 kWh"]);
    assert.equal(view.sizing?.designDay, "Year 2, diversified P90: 42.10 kWh a day");
    assert.deepEqual(view.sizing?.figures.slice(0, 2).map((figure) => figure.value), ["13.14 kWp", "50.52 kWh, Lead-acid"]);
    assert.equal(view.sizing?.oversized, null);
  });

  it("gives the tariff range where RMG01's two changes disagree, and no single figure", () => {
    assert.match(view.tariff.note ?? "", /^The reference events disagree: their elasticities run from -2\.10 to 0\.53, and no single figure is given$/);
    assert.deepEqual(view.tariff.scenarios.map((scenario) => scenario.elasticity), ["-1.00", "0.53", "-2.10"]);
  });

  it("gives no subsidy gap until opex and a factor to today are set, and then gives one", async () => {
    assert.equal(view.subsidyGap.figures.find((figure) => figure.key === "gap")?.status, "placeholder");
    assert.match(view.subsidyGap.figures.find((figure) => figure.key === "scaledCapex")?.value ?? "", /at 2019 prices; not brought to today/);
    const set = await minigridPlanView(createSyntheticPlannedCommunities(), references, { ...DEFAULT_PLAN_SETTINGS, opexPerDay: 3_000, capexToToday: 2 });
    const gap = set?.subsidyGap.figures.find((figure) => figure.key === "gap");
    assert.equal(gap?.status, "calculated");
    assert.match(gap?.value ?? "", /a connection$/);
  });

  it("lists what each method may not claim", () => {
    assert.ok(view.notClaimed.some((line) => line.method === "All" && /typical/.test(line.claims)));
  });
});
