import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReferenceCustomer, ReferenceMeterDay, ReferenceOutage, ReferencePayment, ReferenceSiteDay } from "@/domain";
import { accountsCreatedTo, creditBuyers, repeatBuyers } from "./buyers.ts";
import { claimStanding } from "./claims.ts";
import { meterGap, meterGapByYear } from "./meterGap.ts";
import { indicesByMonth } from "./reliability.ts";
import { useByYear } from "./use.ts";

const day = (date: string, communityKwh: number | null, sumOfMetersKwh: number | null, metersReporting: number | null = 10): ReferenceSiteDay => ({
  siteId: "s",
  date,
  communityKwh,
  sumOfMetersKwh,
  metersReporting: sumOfMetersKwh === null ? null : metersReporting,
  creditBoughtNgn: null,
  flags: [],
  loggedOutage: null,
});

describe("meter gap", () => {
  const days = [
    day("2022-12-30", 20, 16),
    day("2022-12-31", 10, null),
    day("2023-01-01", null, 5),
    day("2023-01-02", 30, 27),
    day("2023-01-03", 50, 45),
  ];

  it("uses only the days with both values, never a blank as 0", () => {
    const gap = meterGap(days, "2022-01-01", "2023-12-31");
    assert.equal(gap.daysWithBoth, 3);
    assert.equal(gap.siteKwh, 100);
    assert.equal(gap.metersKwh, 88);
    assert.ok(Math.abs((gap.gap ?? 0) - 0.12) < 1e-12);
    assert.ok(Math.abs((gap.reached ?? 0) - 0.88) < 1e-12);
  });

  it("gives no figure for a window with no day with both", () => {
    const gap = meterGap(days, "2021-01-01", "2021-12-31");
    assert.equal(gap.daysWithBoth, 0);
    assert.equal(gap.gap, null);
  });

  it("splits by year", () => {
    const byYear = meterGapByYear(days);
    assert.deepEqual(byYear.map((year) => [year.from.slice(0, 4), year.daysWithBoth, year.reached]), [
      ["2022", 1, 0.8],
      ["2023", 2, 0.9],
    ]);
  });
});

describe("customers who bought credit", () => {
  const pay = (date: string, customerCode: string | null, type = "PAY"): ReferencePayment => ({ siteId: "s", date, amountNgn: 500, type, customerCode });
  const payments = [
    pay("2021-01-05", "A"),
    pay("2021-03-01", "A"),
    pay("2021-06-01", "B"),
    pay("2021-07-01", "C", "UCU"),
    pay("2021-08-01", null),
    pay("2024-02-01", "A"),
    pay("2024-02-02", "D"),
    pay("2024-02-03", "C"),
  ];

  it("counts distinct PAY customers in the calendar year only", () => {
    assert.equal(creditBuyers(payments, 2021), 2);
    assert.equal(creditBuyers(payments, 2024), 3);
    assert.equal(creditBuyers(payments, 2022), 0);
  });

  it("counts repeat buyers as x of y", () => {
    assert.deepEqual(repeatBuyers(payments, 2021, 2024), { firstYear: 2021, laterYear: 2024, of: 2, again: 1 });
  });

  it("counts accounts created to date, leaving out accounts with no year", () => {
    const customer = (yearCreated: number | null): ReferenceCustomer => ({ siteId: "s", customerCode: String(yearCreated), customerClass: null, yearCreated, metersLinked: 1 });
    const customers = [customer(2020), customer(2020), customer(2021), customer(null), customer(2023)];
    assert.deepEqual([2020, 2021, 2022, 2023].map((year) => accountsCreatedTo(customers, year)), [2, 3, 3, 4]);
  });
});

describe("metered use by year", () => {
  it("averages over the days with data and counts zero meter-days", () => {
    const days = [day("2021-01-01", null, 4, 8), day("2021-01-02", null, 6, 12), day("2021-01-03", null, null)];
    const meterDay = (kwh: number): ReferenceMeterDay => ({ siteId: "s", date: "2021-01-01", meterCode: "m", kwh, customerClass: "residential" });
    const [year] = useByYear(days, [meterDay(0), meterDay(0.5), meterDay(0), meterDay(1)]);
    assert.equal(year.daysInData, 3);
    assert.equal(year.daysWithMeterData, 2);
    assert.equal(year.kwhPerDay, 5);
    assert.equal(year.meanMetersReporting, 10);
    assert.equal(year.kwhPerReportingMeterDay, 0.5);
    assert.equal(year.zeroMeterDayShare, 0.5);
  });
});

describe("reliability from a fault log", () => {
  const outage = (date: string, customersInterrupted: number, customersServed: number, customerHours: number, recorded = 1, fromTimes = 1): ReferenceOutage => ({
    siteId: "s",
    eventId: date,
    date,
    startTime: null,
    endTime: null,
    crossesMidnight: false,
    durationHoursRecorded: recorded,
    durationHoursFromTimes: fromTimes,
    cause: "test",
    causeCategory: null,
    customersInterrupted,
    customersServed,
    customerHours,
    notes: null,
  });

  it("divides by the largest count of customers served in the month", () => {
    const [december] = indicesByMonth([outage("2020-12-06", 144, 144, 288), outage("2020-12-25", 200, 200, 500), outage("2020-12-28", 202, 202, 858.5, 4.25, 4.25)]);
    assert.equal(december.customersServed, 202);
    assert.equal(Number(december.saidiHours?.toFixed(3)), 8.151);
    assert.equal(Number(december.saifi?.toFixed(3)), 2.703);
    assert.equal(december.durationDisagreements, 0);
  });

  it("names events whose recorded duration and times disagree, and gives months with no event no figure", () => {
    const months = indicesByMonth([outage("2021-01-03", 100, 100, 250, 2.5, 1.5)]);
    assert.deepEqual(months.map((month) => month.month), ["2021-01"]);
    assert.equal(months[0].durationDisagreements, 1);
  });
});

describe("a publisher's figure against the calculation", () => {
  it("agrees only when it rounds to the stated figure", () => {
    assert.equal(claimStanding(0.179, 3, 0.17929), "agrees");
    assert.equal(claimStanding(0.179, 3, 0.1784), "differs");
    assert.equal(claimStanding(141, 0, 141), "agrees");
    assert.equal(claimStanding(0.179, 3, null), "not_calculable");
  });
});
