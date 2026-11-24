import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv } from "../csv.ts";
import { RMG01_SOURCE, rmg01Reference } from "./index.ts";

describe("the CSV reader", () => {
  it("keeps quoted commas, line breaks and doubled quotes, and blank fields", () => {
    const rows = parseCsv('a,b,c\n1,"x, ""y""\nz",\n2,,3\n');
    assert.deepEqual(rows, [
      { a: "1", b: 'x, "y"\nz', c: "" },
      { a: "2", b: "", c: "3" },
    ]);
  });
});

describe("the RMG01 reference adapter (the vendored dataset)", async () => {
  const repo = rmg01Reference();
  const records = await repo.records("rmg01");
  assert.ok(records);

  it("holds one site, real and published, with its licence and credit", async () => {
    assert.deepEqual((await repo.sites()).map((site) => site.code), ["RMG01"]);
    assert.deepEqual((await repo.catalogue()).map((entry) => [entry.siteId, entry.source.id]), [["rmg01", RMG01_SOURCE.id]]);
    assert.equal(RMG01_SOURCE.kind, "published_dataset");
    assert.equal(RMG01_SOURCE.licence, "CC BY 4.0");
    assert.match(RMG01_SOURCE.attribution ?? "", /Kemabonta.*Geoffrey.*2026.*v1\.0\.2.*10\.5281\/zenodo\.24098636/);
    assert.equal(records.site.locationWithheld, true);
    assert.equal(await repo.records("another"), null);
  });

  it("reads every table at the size the publisher states", () => {
    assert.equal(records.days.length, 1_614);
    assert.equal(records.meterDays.length, 142_450);
    assert.equal(records.customers.length, 248);
    assert.equal(records.payments.length, 21_300);
    assert.equal(records.outages.length, 17);
    assert.equal(records.reportedIndices.length, 12);
    assert.equal(records.caveats.length, 29);
    assert.equal(records.site.facts.length, 38);
  });

  it("keeps the 38 gap days blank, never 0", () => {
    const gap = records.days.filter((day) => day.flags.includes("gap_no_meter_data"));
    assert.equal(gap.length, 38);
    for (const day of gap) {
      assert.equal(day.sumOfMetersKwh, null);
      assert.equal(day.metersReporting, null);
    }
    assert.equal(gap[0].date, "2023-04-26");
    assert.equal(gap.at(-1)?.date, "2023-06-02");
  });

  it("keeps the outage flag null outside the fault log's period", () => {
    assert.equal(records.days.find((day) => day.date === "2020-11-30")?.loggedOutage, null);
    assert.equal(records.days.find((day) => day.date === "2020-12-06")?.loggedOutage, 1);
    assert.equal(records.days.find((day) => day.date === "2020-12-07")?.loggedOutage, 0);
  });

  it("reads the months with no logged outage as having no indices, not zero", () => {
    const may = records.reportedIndices.find((month) => month.month === "2021-05");
    assert.equal(may?.eventsLogged, 0);
    assert.equal(may?.saidiHours, null);
    assert.equal(records.reportedIndices.find((month) => month.month === "2020-12")?.saidiHours, 8.151);
  });

  it("reads the classes and the tariffs as published", () => {
    assert.equal(records.meterDays.filter((day) => day.customerClass === "non_residential").length, 18_242);
    const tariffs = records.tariffEvents.filter((event) => event.recordType === "tariff").map((event) => event.value);
    assert.deepEqual(tariffs, [165, 350, 500]);
  });

  it("transcribes the publisher's own figures as claims", () => {
    const gaps = records.claims.filter((claim) => claim.key === "meter_gap_share").map((claim) => claim.value);
    assert.deepEqual(gaps, [0.179, 0.086]);
    const reached = records.claims.filter((claim) => claim.key === "meters_reached_share").map((claim) => claim.value);
    assert.deepEqual(reached, [0.69, 0.85, 0.9]);
    const buying = records.claims.filter((claim) => claim.key === "customers_buying_credit").map((claim) => [claim.from.slice(0, 4), claim.value]);
    assert.deepEqual(buying, [
      ["2020", 116],
      ["2021", 141],
      ["2022", 136],
      ["2023", 123],
      ["2024", 125],
      ["2025", 68],
    ]);
  });
});
