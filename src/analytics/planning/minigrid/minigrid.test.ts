import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlannedCommunity, ReferenceBasis } from "@/domain";
import { demandFromReference, MINIGRID_DEMAND_REFERENCE } from "./demand.ts";
import { pueGap } from "./pueGap.ts";
import { sizeSystem } from "./sizing.ts";
import { capexFactorToToday, scaleReferenceCapex, subsidyGap } from "./subsidyGap.ts";
import { NOT_A_PRICE_RESPONSE, tariffResponse } from "./tariff.ts";

/* The synthetic test community of MG-PLAN.md 3.6: fixed round inputs held here, so the tests do
   not depend on the vendored file. The expected figures were worked out by hand before the
   methods were run; if a method disagrees, the method or the hand check is wrong, and the
   inputs are not retuned to match.

   Re-derived 24 November 2026 for the single-tariff basis: the fixture's use at its single
   tariff is the mean of its own years 1 and 2 (P50 0.195, P90 0.255), fixed before the
   figures were worked out, held flat across years 1 to 5. The by-year figures stay as the
   "as happened" scenario. */

const same = <T>(value: T): T[] => [value, value, value, value, value];

const TEST_BASIS: ReferenceBasis = {
  siteId: "test-site",
  siteCode: "TEST01",
  sourceId: "test",
  operationStart: "2020-01-01",
  singleTariff: { tariff: 165, years: [1, 2], days: 730, p50: 0.195, p90: 0.255, classFactor: { residential: 0.8 / 0.92, non_residential: 0.2 / 0.08 } },
  siteKwhPerMeterDay: { p50: [0.18, 0.21, 0.21, 0.19, 0.17], p90: [0.24, 0.27, 0.27, 0.25, 0.23] },
  classFactor: { residential: same(0.8 / 0.92), non_residential: same(0.2 / 0.08) },
  classP90MeterDay: { residential: 0.3, non_residential: 1.2 },
  ramp: [0.85, 0.95, 0.97, 0.99, 1.0],
  buyingShare: [0.55, 0.6, 0.57, 0.52, 0.51],
  exclusions: ["none in the fixture"],
  meterGap: { low: 0.086, high: 0.179 },
  tariffChanges: [],
  capex: null,
  opexFloor: [],
  opexBlank: [],
  tariffs: [165, 350, 500],
};

const COMMUNITY: PlannedCommunity = {
  id: "test-community",
  name: "Test community",
  latitude: 5.45,
  longitude: 6.3,
  customers: { residential: 232, non_residential: 18 },
  solar: { averagePeakSunHours: 5, rainySeasonPeakSunHours: 4, rainySeasonMonth: "fixture", citationId: "fixture" },
  sourceId: "test",
};
const SUN = { average: 5.0, rainySeason: 4.0 };
const two = (values: readonly (number | null)[]) => values.map((value) => (value === null ? null : Number(value.toFixed(2))));
const pct = (values: readonly (number | null)[]) => values.map((value) => (value === null ? null : Number((value * 100).toFixed(1))));
const window = (start: string, end: string, kwhPerMeterDay: number) => ({ start, end, days: 100, kwhPerMeterDay, metersReporting: 100, zeroShare: 0.2 });

describe("mini-grid planning on the test community (MG-PLAN.md 3.6)", () => {
  const demand = demandFromReference(COMMUNITY, [TEST_BASIS]);
  const sizing = sizeSystem(demand, SUN);
  assert.ok(sizing);

  it("counts the community as 246.74 meter-equivalents", () => {
    assert.equal(demand.years[0].meterEquivalents?.toFixed(2), "246.74");
  });

  it("by default holds the single-tariff use flat; the ramp and the buying share carry the years", () => {
    assert.equal(demand.basis, "single_tariff");
    assert.equal(demand.scenarioLabel, null);
    assert.equal(demand.servedAtTariff, 165);
    assert.deepEqual(two(demand.years.map((one) => one.p50)), [24.74, 30.17, 29.26, 27.25, 26.99]);
    assert.deepEqual(two(demand.years.map((one) => one.p90)), [32.36, 39.45, 38.27, 35.63, 35.3]);
    assert.deepEqual(two(demand.years.map((one) => one.noDiversityUpperBound)), [46.9, 57.18, 55.47, 51.64, 51.16]);
    assert.deepEqual(demand.years.map((one) => one.p50WithUplift), [null, null, null, null, null]);
    assert.equal(demand.sitesLabel, "1 reference site");
    assert.equal(demand.label, "Served demand at the reference site, a floor on true demand");
  });

  it("keeps the site's own curve as a labelled scenario, never the default", () => {
    const happened = demandFromReference(COMMUNITY, [TEST_BASIS], { ...MINIGRID_DEMAND_REFERENCE.parameters, basis: "as_happened" });
    assert.equal(happened.scenarioLabel, "As happened at TEST01 (tariff rises and an outage; confounded)");
    assert.equal(happened.servedAtTariff, null);
    assert.deepEqual(two(happened.years.map((one) => one.p50)), [22.84, 32.49, 31.51, 26.55, 23.53]);
    assert.deepEqual(two(happened.years.map((one) => one.p90)), [30.45, 41.77, 40.52, 34.93, 31.84]);
  });

  it("shows a suppressed-demand uplift as a separate line, never in the P50", () => {
    const uplifted = demandFromReference(COMMUNITY, [TEST_BASIS], { ...MINIGRID_DEMAND_REFERENCE.parameters, suppressedDemandUplift: 1.5 });
    assert.deepEqual(two(uplifted.years.map((one) => one.p50WithUplift)), [37.11, 45.25, 43.89, 40.87, 40.49]);
    assert.deepEqual(two(uplifted.years.map((one) => one.p50)), [24.74, 30.17, 29.26, 27.25, 26.99]);
  });

  it("sizes the design day, year 2's diversified P90, at 10.91 kWp and 47.34 kWh of lead-acid", () => {
    assert.deepEqual({ ...sizing.designDay, kwh: Number(sizing.designDay.kwh.toFixed(2)) }, { year: 2, case: "p90", kwh: 39.45 });
    assert.equal(sizing.pvEnergyNeededKwh.toFixed(2), "43.63");
    assert.equal(sizing.pvKwp.toFixed(2), "10.91");
    assert.equal(sizing.batteryKwh.toFixed(2), "47.34");
  });

  it("gives utilisation by year and case", () => {
    assert.deepEqual(pct(sizing.utilisation.map((one) => one.p50)), [62.7, 76.5, 74.2, 69.1, 68.4]);
    assert.deepEqual(pct(sizing.utilisation.map((one) => one.p90)), [82, 100, 97, 90.3, 89.5]);
  });

  it("no longer flags year 1 oversized: its P50 uses 62.7%, above the 60% threshold", () => {
    assert.equal(sizing.oversized, null);
  });

  it("on a rainy-season day PV makes 80.0% of what the design day needs, and serves 81.2% of it", () => {
    assert.equal((sizing.rainySeason.pvEnergyShare * 100).toFixed(1), "80.0");
    assert.equal((sizing.rainySeason.servedShare * 100).toFixed(1), "81.2");
    assert.equal(sizing.rainySeason.shortfallKwh.toFixed(2), "7.42");
  });

  it("the no-diversity bound is never the design day", () => {
    assert.notEqual(sizing.designDay.kwh, demand.years[1].noDiversityUpperBound);
  });

  it("finds a productive-use gap of 3.18 kWh a day to bring year 1 at P50 to 70%", () => {
    const gap = pueGap(demand, sizing);
    assert.equal(gap.productiveKwhPerDay?.toFixed(2), "3.18");
    assert.equal(gap.utilisation?.toFixed(3), "0.627");
    assert.equal(gap.examples.find((one) => one.name === "Grain mill")?.kwhPerDay, 22.5);
  });

  it("gives tariff scenarios from 25 kWh a day at ₦165, the fixed budget as the middle case", () => {
    const result = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350, 500], userElasticity: -0.5, bases: [TEST_BASIS] });
    const row = (kind: string, tariff: number) => result.scenarios.find((one) => one.kind === kind)?.rows.find((one) => one.tariff === tariff);
    assert.equal(result.scenarios.find((one) => one.middle)?.kind, "fixed_budget");
    assert.equal(row("fixed_budget", 350)?.kwhPerDay.toFixed(2), "11.79");
    assert.equal(row("fixed_budget", 500)?.kwhPerDay.toFixed(2), "8.25");
    assert.equal(row("fixed_budget", 350)?.revenuePerDay.toFixed(0), "4125");
    assert.equal(row("fixed_budget", 500)?.revenuePerDay.toFixed(0), "4125");
    assert.equal(row("user", 350)?.kwhPerDay.toFixed(2), "17.17");
    assert.equal(row("user", 350)?.revenuePerDay.toFixed(1), "6007.8");
    assert.equal(row("user", 500)?.kwhPerDay.toFixed(2), "14.36");
    assert.equal(row("user", 500)?.revenuePerDay.toFixed(1), "7180.7");
    assert.deepEqual(result.range, { low: -1, high: -0.5 });
    const flat = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350, 500], userElasticity: 0, bases: [] });
    assert.deepEqual(flat.scenarios.find((one) => one.kind === "user")?.rows.map((one) => one.revenuePerDay), [8750, 12500]);
  });

  it("shows a change with a positive elasticity with its confounders, labelled, and leaves it out of every scenario", () => {
    const basis: ReferenceBasis = {
      ...TEST_BASIS,
      tariffChanges: [
        { id: "a", fromTariff: 165, toTariff: 350, changeMonth: "2023-07", before: window("2023-01-01", "2023-04-10", 1), after: window("2023-08-01", "2023-11-08", (350 / 165) ** 0.4), confounders: ["after an outage"] },
        { id: "b", fromTariff: 350, toTariff: 500, changeMonth: "2024-02", before: window("2023-10-01", "2024-01-08", 1), after: window("2024-03-01", "2024-06-08", (500 / 350) ** -2), confounders: [] },
      ],
    };
    const result = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350], userElasticity: 0.3, bases: [basis] });
    assert.deepEqual(result.scenarios.map((one) => [one.kind, one.elasticity.toFixed(1)]), [["fixed_budget", "-1.0"], ["reference_change", "-2.0"]]);
    assert.ok(result.scenarios.every((one) => one.elasticity <= 0), "no positive elasticity in any scenario");
    assert.deepEqual(result.unusable.map((one) => [one.kind, one.elasticity.toFixed(1)]), [["reference_change", "0.4"], ["user", "0.3"]]);
    assert.deepEqual(result.unusable[0].change?.confounders, ["after an outage"]);
    assert.match(result.unusable[0].reason, new RegExp(NOT_A_PRICE_RESPONSE));
    assert.equal(result.range.low.toFixed(1), "-2.0");
    assert.equal(result.range.high.toFixed(1), "-1.0");
    assert.match(result.note ?? "", /TEST01: ₦165 to ₦350 \(e = \+0\.40\).*not usable as a price response/);
  });

  it("finds the subsidy gap at ₦350 with no tariff response: ₦9,201,684 (₦36,807 a connection); ₦3,726,684 at ₦1,500 a day", () => {
    const input = { capexNgn: 30_000_000, demand, demandCase: "p50" as const, losses: 0.1, tariff: 350, tariffResponse: null, opexPerDay: 3_000, periodYears: 10, returnPerYear: 0.1, connections: 250 };
    const result = subsidyGap(input);
    assert.deepEqual(two(result.years.map((one) => one.kwhSoldPerDay)), [22.49, 27.43, 26.6, 24.77, 24.54]);
    assert.equal(result.netRevenueNgn?.toFixed(0), "20798316");
    assert.equal(result.gapNgn?.toFixed(0), "9201684");
    assert.equal(result.gapPerConnectionNgn?.toFixed(0), "36807");
    const lower = subsidyGap({ ...input, opexPerDay: 1_500 });
    assert.equal(lower.gapNgn?.toFixed(0), "3726684");
    assert.equal(lower.gapPerConnectionNgn?.toFixed(0), "14907");
    assert.equal(result.years[4].netPerDay?.toFixed(2), "5588.37");
    assert.equal(result.monthsToRepay.atZero?.toFixed(1), "176.6");
    assert.equal(result.monthsToRepay.atReturn, null, "never at 10% a year");
  });

  it("applies the planned tariff through the tariff response from the tariff demand was served at", () => {
    const base = { capexNgn: 30_000_000, demand, demandCase: "p50" as const, losses: 0.1, tariff: 350, opexPerDay: 3_000, periodYears: 10, returnPerYear: 0, connections: 250 };
    const fixedBudget = subsidyGap({ ...base, tariffResponse: { baseTariff: 165, elasticity: -1 } });
    // At e = −1 the spend is unchanged: kWh sold at ₦350 = kWh at ₦165 × 165 ÷ 350.
    assert.equal(fixedBudget.years[0].kwhSoldPerDay?.toFixed(2), ((24.74 / 1.1) * (165 / 350)).toFixed(2));
  });

  it("scales a reference build cost by kWh, kWp and connections, the rest in proportion, with the accounts beside the per-connection rate", () => {
    const reference = { priceYear: 2019, ngnPerUsd: 350, storageNgn: 1_000_000, generationNgn: 600_000, distributionAndMeteringNgn: 400_000, otherNgn: 200_000, totalNgn: 2_200_000, pvKwp: 10, storageKwh: 100, connections: 100, accounts: 125 };
    const scaled = scaleReferenceCapex(reference, { pvKwp: 20, batteryKwh: 50, connections: 200 }, 2);
    assert.deepEqual([scaled.storageNgn, scaled.generationNgn, scaled.distributionAndMeteringNgn, scaled.otherNgn, scaled.totalNgn], [1_000_000, 2_400_000, 1_600_000, 500_000, 5_500_000]);
    assert.equal(scaled.label, "2019 reference cost, scaled");
    assert.equal(scaled.perConnectionNgn, 4_000);
    assert.equal(scaled.perAccountNgn, 3_200);
  });

  it("brings 2019 ₦ to today through US dollars at the source's ₦350, then at today's cited rate", () => {
    assert.equal(capexFactorToToday(350, 1_400), 4);
  });

  it("takes a second reference site as a list entry: the benchmarks move and rest on 2 sites, with no code change", () => {
    const second: ReferenceBasis = { ...TEST_BASIS, siteId: "test-site-2", siteCode: "TEST02", singleTariff: { ...TEST_BASIS.singleTariff!, p50: 0.215, p90: 0.3 } };
    const both = demandFromReference(COMMUNITY, [TEST_BASIS, second]);
    assert.equal(both.referenceSites, 2);
    assert.equal(both.sitesLabel, "2 reference sites");
    assert.notEqual(both.years[0].p50, demand.years[0].p50);
    assert.equal(both.years[0].siteKwhPerMeterDay.p50?.toFixed(3), "0.205");
  });

  it("gives no figure, never 0, where the reference has none", () => {
    const none: ReferenceBasis = { ...TEST_BASIS, singleTariff: null };
    const result = demandFromReference(COMMUNITY, [none]);
    assert.equal(result.years[0].p50, null);
    assert.deepEqual(result.years[0].missing.slice(-2), ["site P50 meter-day", "site P90 meter-day"]);
  });
});
