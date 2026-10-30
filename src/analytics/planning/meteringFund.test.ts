import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meteringPace, runMeteringFund, shortfallAtCharge, sizeCharge, type MeteringFundInputs } from "./meteringFund.ts";

/** A fund with no cost of capital, no gain, no reserve and no growth: each meter costs N60,000, all in naira. */
const PLAIN: MeteringFundInputs = {
  customers: 1_000_000,
  meteredShare: 0.4,
  growthPerYear: 0,
  publicMeters: [],
  grantsPerYear: [],
  hardwareUsd: 0,
  importedShare: 1,
  dutyRate: 0.1,
  installNaira: 60_000,
  fxNairaPerUsd: 1_000,
  reserveRatePerYear: 0,
  failureRatePerYear: 0,
  capital: { currency: "ngn", ratePerYear: 0 },
  nonPayingShare: 0,
  exemptShare: 0,
  collectionGainShare: 0,
  gainToFundShare: 0,
  averageBillNaira: null,
  tariffPassThrough: 1,
  chargeIndexed: false,
};

/** Imported meters: $45 at N1,000 with 10% duty, plus N25,000 to install; dollar capital at 8%. */
const IMPORTED: MeteringFundInputs = { ...PLAIN, hardwareUsd: 45, installNaira: 25_000, capital: { currency: "usd", ratePerYear: 0.08 }, reserveRatePerYear: 0.02 };

const close = (actual: number, expected: number, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

describe("the metering fund", () => {
  it("with nothing but the meter to repay, charges its cost over 60 months and is repaid in month 120", () => {
    close(sizeCharge(PLAIN)!, 1_000);
    const run = runMeteringFund(PLAIN);
    close(run.totalFundMeters, 600_000);
    close(run.years[0].fundMeters, 120_000);
    close(run.years[4].meteredShare, 1);
    close(run.owedAtEnd, 0, 1e-3);
    assert.equal(run.lastRepaymentMonth, 120);
    assert.equal(run.repaidMonth, 120);
    // The fund borrows to install and is paid back from month 61 on: its first year with net cash in is year 6.
    assert.equal(run.cashPositiveYear, 6);
    close(run.peakOwed, Math.max(...run.owedByMonth));
  });

  it("meters the customers who join during the rollout as well", () => {
    const run = runMeteringFund({ ...PLAIN, growthPerYear: 0.02 });
    close(run.years[4].meteredShare, 1);
    close(run.totalFundMeters, 1_000_000 * Math.pow(1.02, 5) - 400_000, 1e-3);
  });

  it("removes 12 estimated bills a year for each meter in place, against the customers left unmetered without it", () => {
    const run = runMeteringFund(PLAIN);
    // Without the plan, 600,000 customers get an estimated bill every month.
    close(run.years[0].estimatedBillsWithoutPlan, 7_200_000);
    // With it, 10,000 meters a month: the unmetered fall from 590,000 to 480,000 over the first year.
    close(run.years[0].estimatedBills, 12 * 600_000 - 10_000 * 78);
    close(run.years[5].estimatedBills, 0);
  });

  it("builds the cost of a meter from its dollar price, the exchange rate, duty and installation", () => {
    const run = runMeteringFund(IMPORTED);
    close(run.years[0].costPerMeter, 45 * 1_000 * 1.1 + 25_000);
  });

  it("repays every meter within 60 months of its installation with the cost of dollar capital and the reserve", () => {
    const run = runMeteringFund(IMPORTED);
    assert.ok(run.owedAtEnd <= 1e-3, `owes ${run.owedAtEnd}`);
    assert.ok(run.charge! > (45 * 1_100 + 25_000) / 60, "the charge covers more than the meter alone");
  });

  it("runs dry when import duty rises to 45% after launch, and the duty-shock reserve keeps it solvent", () => {
    const shock = { fromMonth: 13, dutyRate: 0.45 };
    const base = runMeteringFund(IMPORTED);
    const shocked = runMeteringFund(IMPORTED, shock, base.charge);
    assert.ok(shocked.owedAtEnd > 0, "the base charge does not repay meters bought at 45% duty");
    assert.ok(sizeCharge(IMPORTED, shock)! > base.charge!);
    const reserved = { ...IMPORTED, sizingDutyRate: 0.45 };
    assert.ok(runMeteringFund(reserved, shock).owedAtEnd <= 1e-3);
    assert.equal(runMeteringFund(reserved).chargeSizedForDutyRate, 0.45);
  });

  it("owes more in naira when the naira falls and its capital is in dollars, and not when its capital is in naira", () => {
    const shock = { fromMonth: 13, devaluation: 0.3 };
    const dollar = runMeteringFund(IMPORTED, shock, runMeteringFund(IMPORTED).charge);
    assert.ok(dollar.owedAtEnd > 0);
    const naira = { ...IMPORTED, importedShare: 0, capital: { currency: "ngn" as const, ratePerYear: 0.08 } };
    close(runMeteringFund(naira, shock, runMeteringFund(naira).charge).owedAtEnd, runMeteringFund(naira).owedAtEnd, 1e-3);
  });

  it("keeps a charge indexed to the tariff solvent under inflation when tariffs follow it", () => {
    const shock = { fromMonth: 13, inflationPerYear: 0.3 };
    const fixed = runMeteringFund(IMPORTED, shock, runMeteringFund(IMPORTED).charge);
    assert.ok(fixed.owedAtEnd > 0, "inflation raises installation costs the fixed charge does not cover");
    const indexed = { ...IMPORTED, chargeIndexed: true };
    assert.ok(sizeCharge(indexed, shock)! < sizeCharge(IMPORTED, shock)!);
  });

  it("installs fewer meters itself when public money pays for some, and sends their charges to the public pool", () => {
    const publicMeters = Array.from({ length: 12 }, () => 5_000);
    const run = runMeteringFund({ ...PLAIN, publicMeters });
    close(run.totalPublicMeters, 60_000);
    close(run.totalFundMeters, 540_000);
    close(run.years[4].meteredShare, 1);
    // 60,000 public meters each pay N1,000 for 60 months into the pool, not to the fund.
    close(run.pool.inflow, 60_000 * 60 * 1_000, 1e-3);
    close(run.owedAtEnd, 0, 1e-3);
  });

  it("collects less when customers stop buying, and the pool pays the charge of exempt customers", () => {
    const sized = sizeCharge({ ...PLAIN, nonPayingShare: 0.1 })!;
    close(sized, 1_000 / 0.9);
    const exempt = runMeteringFund({ ...PLAIN, exemptShare: 0.2 });
    close(exempt.charge!, 1_000);
    close(exempt.pool.outflow, 600_000 * 60 * 1_000 * 0.2, 1e-2);
    close(exempt.owedAtEnd, 0, 1e-3);
  });

  it("lowers the charge by the DisCo's share of the collection gain", () => {
    const withGain = { ...PLAIN, averageBillNaira: 10_000, collectionGainShare: 0.15, gainToFundShare: 0.5 };
    close(sizeCharge(withGain)!, 1_000 - 750);
  });

  it("says how much each meter is left short when the charge is held below what repays it", () => {
    // At N600 instead of N1,000, each N60,000 meter recovers N36,000 in 60 months and is N24,000 short.
    const short = shortfallAtCharge(PLAIN, 600)!;
    close(short.perMeter, 24_000);
    close(short.total, 24_000 * 600_000, 1e-2);
    close(shortfallAtCharge(PLAIN, 1_000)!.total, 0, 1e-3);
    assert.equal(shortfallAtCharge({ ...PLAIN, meteredShare: 1 }, 600), null);
  });

  it("charges nothing and installs nothing when every customer is already metered", () => {
    assert.equal(sizeCharge({ ...PLAIN, meteredShare: 1 }), null);
    assert.equal(runMeteringFund({ ...PLAIN, meteredShare: 1 }).lastRepaymentMonth, null);
  });
});

describe("the metering gap at a pace", () => {
  it("closes in unmetered / (installs - growth) months", () => {
    const pace = meteringPace(4_800_000, 120_000, 40_000);
    close(pace.monthsToClose!, 60);
    close(pace.requiredPerMonth, 120_000);
    close(pace.netBacklogChangePerMonth, -80_000);
  });

  it("never closes when installs do not exceed growth", () => {
    assert.equal(meteringPace(4_800_000, 40_000, 40_000).monthsToClose, null);
    assert.equal(meteringPace(4_800_000, 30_000, 40_000).monthsToClose, null);
  });
});
