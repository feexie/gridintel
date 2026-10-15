import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { availability, coverageLabel, defaultPeriodKey, parsePeriod, periodChoices, samePeriod, type ReportCoverage } from "./period.ts";

/** September 2026 in West Africa Time: the demonstration dataset's coverage. */
const SEPTEMBER: ReportCoverage = { start: "2026-09-01T00:00:00+01:00", end: "2026-10-01T00:00:00+01:00", offset: "+01:00" };

describe("report periods", () => {
  it("reads a day, a month and a year from the address, in the data's offset", () => {
    assert.deepEqual(parsePeriod("2026-09-14", "+01:00"), { kind: "day", key: "2026-09-14", start: "2026-09-14T00:00:00+01:00", end: "2026-09-15T00:00:00+01:00", label: "14 September 2026" });
    assert.deepEqual(parsePeriod("2026-09-30", "+01:00")?.end, "2026-10-01T00:00:00+01:00");
    assert.deepEqual(parsePeriod("2026-09", "+01:00"), { kind: "month", key: "2026-09", start: "2026-09-01T00:00:00+01:00", end: "2026-10-01T00:00:00+01:00", label: "September 2026" });
    assert.deepEqual(parsePeriod("2026-12", "+01:00")?.end, "2027-01-01T00:00:00+01:00");
    assert.deepEqual(parsePeriod("2026", "+01:00"), { kind: "year", key: "2026", start: "2026-01-01T00:00:00+01:00", end: "2027-01-01T00:00:00+01:00", label: "2026" });
  });

  it("reads nothing from an address that names no period", () => {
    for (const key of ["", "2026-13", "2026-02-30", "2026-9", "26-09", "2026-09-14x", "latest"]) assert.equal(parsePeriod(key, "+01:00"), null, key);
  });

  it("offers a day or a month the data wholly covers", () => {
    for (const key of ["2026-09-01", "2026-09-14", "2026-09-30", "2026-09"]) assert.deepEqual(availability(parsePeriod(key, "+01:00")!, SEPTEMBER), { available: true }, key);
  });

  it("says a year is not available when the data covers one month of it, and never fills it", () => {
    const result = availability(parsePeriod("2026", "+01:00")!, SEPTEMBER);
    assert.equal(result.available, false);
    assert.match(result.available ? "" : result.reason, /^Not available for this period\. The data covers 1 September 2026 to 30 September 2026 only, which is part of 2026\. An annual report needs the whole year; it is not filled, shortened or scaled/);
  });

  it("says a period outside the data holds nothing", () => {
    for (const key of ["2026-08", "2026-10-01", "2025"]) {
      const result = availability(parsePeriod(key, "+01:00")!, SEPTEMBER);
      assert.equal(result.available, false, key);
      assert.match(result.available ? "" : result.reason, /nothing is held for/, key);
    }
  });

  it("lists every covered day, the month, and the year marked not available", () => {
    const choices = periodChoices(SEPTEMBER);
    assert.equal(choices.days.length, 30);
    assert.equal(choices.days[0].period.key, "2026-09-01");
    assert.equal(choices.days[29].period.key, "2026-09-30");
    assert.deepEqual(choices.months.map((choice) => [choice.period.key, choice.available]), [["2026-09", true]]);
    assert.deepEqual(choices.years.map((choice) => [choice.period.key, choice.available]), [["2026", false]]);
    assert.equal(choices.coverage, "1 September 2026 to 30 September 2026");
    assert.equal(coverageLabel(SEPTEMBER), choices.coverage);
  });

  it("opens on the month of the reporting period, and compares periods by instant", () => {
    assert.equal(defaultPeriodKey(SEPTEMBER.start), "2026-09");
    assert.equal(samePeriod({ start: "2026-09-01T00:00:00+01:00", end: "2026-10-01T00:00:00+01:00" }, { start: "2026-08-31T23:00:00Z", end: "2026-09-30T23:00:00Z" }), true);
    assert.equal(samePeriod({ start: "2026-09-14T00:00:00+01:00", end: "2026-09-15T00:00:00+01:00" }, SEPTEMBER), false);
  });
});
