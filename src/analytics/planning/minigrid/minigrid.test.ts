import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlannedCommunity, ReferenceBasis } from "@/domain";
import { demandFromReference, MINIGRID_DEMAND_REFERENCE } from "./demand.ts";
import { pueGap } from "./pueGap.ts";
import { sizeSystem } from "./sizing.ts";
import { scaleReferenceCapex, subsidyGap } from "./subsidyGap.ts";
import { EVENTS_DISAGREE, tariffResponse } from "./tariff.ts";

/* The synthetic test community of MG-PLAN.md 3.6: fixed round inputs held here, so the tests do
   not depend on the vendored file. The expected figures were worked out by hand before the
   methods were written; if a method disagrees, the method or the hand check is wrong, and the
   inputs are not retuned to match. */

const same = <T>(value: T): T[] => [value, value, value, value, value];

const TEST_BASIS: ReferenceBasis = {
  siteId: "test-site",
  siteCode: "TEST01",
  sourceId: "test",
  operationStart: "2020-01-01",
  siteKwhPerMeterDay: { p50: [0.18, 0.21, 0.21, 0.19, 0.17], p90: [0.24, 0.27, 0.27, 0.25, 0.23] },
  classFactor: { residential: same(0.8 / 0.92), non_residential: same(0.2 / 0.08) },
  classP90MeterDay: { residential: 0.3, non_residential: 1.2 },
  ramp: [0.85, 0.95, 0.97, 0.99, 1.0],
  buyingShare: [0.55, 0.6, 0.57, 0.52, 0.51],
  exclusions: ["none in the fixture"],
  meterGap: { low: 0.086, high: 0.179 },
  tariffChanges: [],
  capex: null,
  tariffs: [165, 350, 500],
};

const COMMUNITY: PlannedCommunity = { id: "test-community", name: "Test community", latitude: 5.45, longitude: 6.3, customers: { residential: 232, non_residential: 18 }, solar: { averagePeakSunHours: 5, rainySeasonPeakSunHours: 4, rainySeasonMonth: "fixture", citationId: "fixture" }, sourceId: "test" };
const SUN = { average: 5.0, rainySeason: 4.0 };
const two = (values: readonly (number | null)[]) => values.map((value) => (value === null ? null : Number(value.toFixed(2))));
const pct = (values: readonly (number | null)[]) => values.map((value) => (value === null ? null : Number((value * 100).toFixed(1))));

describe("mini-grid planning on the test community (MG-PLAN.md 3.6)", () => {
  const demand = demandFromReference(COMMUNITY, [TEST_BASIS]);
  const sizing = sizeSystem(demand, SUN);
  assert.ok(sizing);

  it("counts the community as 246.74 meter-equivalents", () => {
    assert.equal(demand.years[0].meterEquivalents?.toFixed(2), "246.74");
  });

  it("gives P50, the diversified P90 and the no-diversity upper bound by year, on 1 reference site", () => {
    assert.deepEqual(two(demand.years.map((one) => one.p50)), [22.84, 32.49, 31.51, 26.55, 23.53]);
    assert.deepEqual(two(demand.years.map((one) => one.p90)), [30.45, 41.77, 40.52, 34.93, 31.84]);
    assert.deepEqual(two(demand.years.map((one) => one.noDiversityUpperBound)), [46.9, 57.18, 55.47, 51.64, 51.16]);
    assert.deepEqual(demand.years.map((one) => one.p50WithUplift), [null, null, null, null, null]);
    assert.equal(demand.sitesLabel, "1 reference site");
    assert.equal(demand.label, "Served demand at the reference site, a floor on true demand");
  });

  it("shows a suppressed-demand uplift as a separate line, never in the P50", () => {
    const uplifted = demandFromReference(COMMUNITY, [TEST_BASIS], { ...MINIGRID_DEMAND_REFERENCE.parameters, suppressedDemandUplift: 1.5 });
    assert.deepEqual(two(uplifted.years.map((one) => one.p50WithUplift)), [34.26, 48.73, 47.27, 39.82, 35.3]);
    assert.deepEqual(two(uplifted.years.map((one) => one.p50)), [22.84, 32.49, 31.51, 26.55, 23.53]);
  });

  it("sizes the design day, year 2's diversified P90, at 11.55 kWp and 50.12 kWh of lead-acid", () => {
    assert.deepEqual({ ...sizing.designDay, kwh: Number(sizing.designDay.kwh.toFixed(2)) }, { year: 2, case: "p90", kwh: 41.77 });
    assert.equal(sizing.pvEnergyNeededKwh.toFixed(2), "46.19");
    assert.equal(sizing.pvKwp.toFixed(2), "11.55");
    assert.equal(sizing.batteryKwh.toFixed(2), "50.12");
  });

  it("gives utilisation by year and case", () => {
    assert.deepEqual(pct(sizing.utilisation.map((one) => one.p50)), [54.7, 77.8, 75.4, 63.6, 56.3]);
    assert.deepEqual(pct(sizing.utilisation.map((one) => one.p90)), [72.9, 100, 97, 83.6, 76.2]);
  });

  it("flags year 1 oversized, and says it is year 1's ramp and buying share", () => {
    assert.ok(sizing.oversized);
    assert.equal(sizing.oversized.year, 1);
    assert.equal(sizing.oversized.utilisation.toFixed(3), "0.547");
    assert.match(sizing.oversized.reason, /connection ramp \(85\.0% of accounts\) and the buying share \(55\.0%\)/);
  });

  it("on a rainy-season day PV makes 80.0% of what the design day needs, and serves 81.2% of it", () => {
    assert.equal((sizing.rainySeason.pvEnergyShare * 100).toFixed(1), "80.0");
    assert.equal((sizing.rainySeason.servedShare * 100).toFixed(1), "81.2");
    assert.equal(sizing.rainySeason.shortfallKwh.toFixed(2), "7.85");
  });

  it("the no-diversity bound would need 15.81 kWp and 68.62 kWh; it is never the design day", () => {
    assert.notEqual(sizing.designDay.kwh, demand.years[1].noDiversityUpperBound);
    const upper = demand.years[1].noDiversityUpperBound ?? 0;
    const night = upper * 0.6;
    assert.equal(((upper * 0.4 + night / 0.85) / 4).toFixed(2), "15.81");
    assert.equal((night / 0.5).toFixed(2), "68.62");
  });

  it("finds a productive-use gap of 7.08 kWh a day to bring year 1 at P50 to 70%", () => {
    const gap = pueGap(demand, sizing);
    assert.equal(gap.productiveKwhPerDay?.toFixed(2), "7.08");
    assert.equal(gap.utilisation?.toFixed(3), "0.547");
    assert.equal(gap.examples.find((one) => one.name === "Grain mill")?.kwhPerDay, 22.5);
  });

  it("gives tariff scenarios from 25 kWh a day at ₦165", () => {
    const result = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350, 500], userElasticity: -0.5, bases: [TEST_BASIS] });
    const row = (kind: string, tariff: number) => result.scenarios.find((one) => one.kind === kind)?.rows.find((one) => one.tariff === tariff);
    assert.equal(row("fixed_budget", 350)?.kwhPerDay.toFixed(2), "11.79");
    assert.equal(row("fixed_budget", 500)?.kwhPerDay.toFixed(2), "8.25");
    assert.equal(row("fixed_budget", 350)?.revenuePerDay.toFixed(0), "4125");
    assert.equal(row("fixed_budget", 500)?.revenuePerDay.toFixed(0), "4125");
    assert.equal(row("user", 350)?.kwhPerDay.toFixed(2), "17.17");
    assert.equal(row("user", 350)?.revenuePerDay.toFixed(1), "6007.8");
    assert.equal(row("user", 500)?.kwhPerDay.toFixed(2), "14.36");
    assert.equal(row("user", 500)?.revenuePerDay.toFixed(1), "7180.7");
    const flat = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350, 500], userElasticity: 0, bases: [] });
    assert.deepEqual(flat.scenarios.find((one) => one.kind === "user")?.rows.map((one) => one.revenuePerDay), [8750, 12500]);
    assert.equal(result.agreement, "none");
  });

  it("returns the range, never a single figure, when two reference changes disagree in sign", () => {
    const window = (start: string, end: string, kwhPerMeterDay: number) => ({ start, end, days: 100, kwhPerMeterDay, metersReporting: 100, zeroShare: 0.2 });
    const basis: ReferenceBasis = {
      ...TEST_BASIS,
      tariffChanges: [
        { id: "a", fromTariff: 165, toTariff: 350, changeMonth: "2023-07", before: window("2023-01-01", "2023-04-10", 1), after: window("2023-08-01", "2023-11-08", (350 / 165) ** 0.4), confounders: [] },
        { id: "b", fromTariff: 350, toTariff: 500, changeMonth: "2024-02", before: window("2023-10-01", "2024-01-08", 1), after: window("2024-03-01", "2024-06-08", (500 / 350) ** -2), confounders: [] },
      ],
    };
    const result = tariffResponse({ baseKwh: 25, baseTariff: 165, tariffs: [350], userElasticity: null, bases: [basis] });
    assert.equal(result.agreement, "disagree");
    assert.equal(result.range?.low.toFixed(1), "-2.0");
    assert.equal(result.range?.high.toFixed(1), "0.4");
    assert.match(result.note ?? "", new RegExp(EVENTS_DISAGREE, "i"));
    assert.equal(Object.hasOwn(result, "elasticity"), false, "no single combined e");
    assert.deepEqual(
      result.scenarios.filter((one) => one.kind === "reference_change").map((one) => one.elasticity.toFixed(1)),
      ["0.4", "-2.0"],
    );
  });

  it("finds the subsidy gap: ₦11,384,287 (₦45,537 a connection); ₦5,909,287 at ₦1,500 a day of opex", () => {
    const input = { capexNgn: 30_000_000, demand, demandCase: "p50" as const, losses: 0.1, tariff: 350, tariffResponse: null, opexPerDay: 3_000, periodYears: 10, returnPerYear: 0.1, connections: 250 };
    const result = subsidyGap(input);
    assert.deepEqual(two(result.years.map((one) => one.kwhSoldPerDay)), [20.76, 29.53, 28.65, 24.13, 21.39]);
    assert.equal(result.netRevenueNgn?.toFixed(0), "18615713");
    assert.equal(result.gapNgn?.toFixed(0), "11384287");
    assert.equal(result.gapPerConnectionNgn?.toFixed(0), "45537");
    const lower = subsidyGap({ ...input, opexPerDay: 1_500 });
    assert.equal(lower.gapNgn?.toFixed(0), "5909287");
    assert.equal(lower.gapPerConnectionNgn?.toFixed(0), "23637");
    assert.equal(result.years[4].netPerDay?.toFixed(2), "4487.30");
    assert.equal(result.monthsToRepay.atZero?.toFixed(1), "219.9");
    assert.equal(result.monthsToRepay.atReturn, null, "never at 10% a year");
  });

  it("scales a reference build cost by kWh, kWp and connections, the rest in proportion, labelled", () => {
    const reference = { priceYear: 2019, storageNgn: 1_000_000, generationNgn: 600_000, distributionAndMeteringNgn: 400_000, otherNgn: 200_000, totalNgn: 2_200_000, pvKwp: 10, storageKwh: 100, connections: 100 };
    const scaled = scaleReferenceCapex(reference, { pvKwp: 20, batteryKwh: 50, connections: 200 }, 2);
    assert.deepEqual([scaled.storageNgn, scaled.generationNgn, scaled.distributionAndMeteringNgn, scaled.otherNgn, scaled.totalNgn], [1_000_000, 2_400_000, 1_600_000, 500_000, 5_500_000]);
    assert.equal(scaled.label, "2019 reference cost, scaled");
  });

  it("takes a second reference site as a list entry: the benchmarks move and rest on 2 sites, with no code change", () => {
    const second: ReferenceBasis = { ...TEST_BASIS, siteId: "test-site-2", siteCode: "TEST02", siteKwhPerMeterDay: { p50: same(0.22), p90: same(0.3) } };
    const both = demandFromReference(COMMUNITY, [TEST_BASIS, second]);
    assert.equal(both.referenceSites, 2);
    assert.equal(both.sitesLabel, "2 reference sites");
    assert.notEqual(both.years[0].p50, demand.years[0].p50);
    assert.equal(both.years[0].siteKwhPerMeterDay.p50?.toFixed(2), "0.20");
  });

  it("gives no figure, never 0, for a year the reference does not cover", () => {
    const short: ReferenceBasis = { ...TEST_BASIS, siteKwhPerMeterDay: { p50: [0.18, 0.21, 0.21, 0.19, null], p90: [0.24, 0.27, 0.27, 0.25, null] } };
    const result = demandFromReference(COMMUNITY, [short]);
    assert.equal(result.years[4].p50, null);
    assert.deepEqual(result.years[4].missing, ["site P50 meter-day", "site P90 meter-day"]);
  });
});
