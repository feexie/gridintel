import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rmg01Reference } from "../../repositories/reference/rmg01/index.ts";
import { referenceBarNotices, referenceSiteIds, referenceSitesView, referenceSiteView } from "./reference.ts";

/* The reference site's views on the vendored dataset: every figure the publisher states is set
   beside GridIntel's calculation, and the differences found are kept as found. */
describe("the RMG01 reference site's views", async () => {
  const repo = rmg01Reference();
  const view = await referenceSiteView(repo, "rmg01");
  assert.ok(view);

  it("agrees with the dataset's 17.9% and 8.6% meter gaps and its shares by year", () => {
    assert.deepEqual(
      view.meterGap.map((claim) => [claim.stated, claim.calculated, claim.standing]),
      [
        ["17.9%", "17.9%", "agrees"],
        ["8.6%", "8.6%", "agrees"],
        ["69%", "69%", "agrees"],
        ["85%", "85%", "agrees"],
        ["90%", "90%", "agrees"],
      ],
    );
    assert.match(view.meterGap[0].basis, /927 days with both.*13,537\.4 kWh metered against 16,494\.6 kWh/);
  });

  it("agrees with the dataset's count of customers who bought credit each year", () => {
    assert.deepEqual(
      view.creditBuyers.map((claim) => [claim.label.slice(-4), claim.calculated, claim.standing]),
      [
        ["2020", "116", "agrees"],
        ["2021", "141", "agrees"],
        ["2022", "136", "agrees"],
        ["2023", "123", "agrees"],
        ["2024", "125", "agrees"],
        ["2025", "68", "agrees"],
      ],
    );
  });

  it("gives repeat buyers as a count of a count, never as retention", () => {
    assert.equal(view.repeatBuyers.value, "114 of 141");
    assert.match(view.repeatBuyers.basis, /Not retention/);
    assert.doesNotMatch(view.repeatBuyers.label, /retention/i);
  });

  it("recalculates the reported reliability, and keeps March 2021's difference as found", () => {
    const march = view.reliability.find((month) => month.month === "March 2021");
    assert.equal(march?.reported.saidi, "7.03 h");
    assert.equal(march?.calculated.saidi, "6.88 h");
    assert.equal(march?.standing, "differs");
    const differing = view.reliability.filter((month) => month.standing === "differs").map((month) => month.month);
    assert.deepEqual(differing, ["March 2021"]);
    const may = view.reliability.find((month) => month.month === "May 2021");
    assert.equal(may?.reported.saidi, null);
    assert.equal(may?.calculated.saidi, null);
    assert.equal(may?.standing, null);
    assert.equal(may?.note, "No outage logged in the fault log.");
  });

  it("keeps the gap days out of the days with meter data", () => {
    assert.equal(view.years.find((year) => year.year === "2023")?.daysWithMeterData, "327 of 365");
  });

  it("states the tariffs as reported, with their approximate dates", () => {
    assert.deepEqual(view.tariffs.map((tariff) => tariff.value), ["₦165 per kWh", "₦350 per kWh", "About ₦500 per kWh"]);
    assert.match(view.tariffNote, /not recorded/);
  });

  it("is real, credited and outside any portfolio, and claims no revenue", () => {
    assert.equal(view.sourcing.synthetic, false);
    assert.equal(view.attribution.licence, "CC BY 4.0");
    assert.match(view.attribution.citation, /Kemabonta.*Geoffrey.*v1\.0\.2/);
    assert.match(view.standingNote, /Not part of any organization's portfolio/);
    assert.ok(view.notClaimed.some((line) => /No revenue, collection rate or price per kWh/.test(line)));
    assert.equal(view.caveats.length, 29);
    const text = JSON.stringify(view);
    assert.doesNotMatch(text, /RMG01-[MCA]\d/, "no meter, customer or agent code is shown");
  });

  it("gives the Sites screen a card per reference site, with its credit", async () => {
    const sites = await referenceSitesView(repo);
    assert.deepEqual(sites.sites.map((card) => [card.code, card.href]), [["RMG01", "/dashboard/intelligence/minigrid/sites/reference/rmg01"]]);
    assert.equal(sites.sites[0].meterGap.stated, "17.9%");
    assert.equal(sites.sites[0].attribution.licence, "CC BY 4.0");
    assert.equal(sites.sourcing.synthetic, false);
    assert.deepEqual(await referenceSiteIds(repo), ["rmg01"]);
    assert.equal(await referenceSiteView(repo, "another"), null);
  });

  it("gives the data bar above each reference page its notice and the dataset's citation, without reading the files", async () => {
    const reads: string[] = [];
    const notices = await referenceBarNotices({ ...repo, records: async (id) => (reads.push(id), null), sites: async () => (reads.push("sites"), []) });
    assert.deepEqual(reads, []);
    assert.deepEqual(Object.keys(notices), ["/dashboard/intelligence/minigrid/sites/reference/rmg01"]);
    const notice = notices["/dashboard/intelligence/minigrid/sites/reference/rmg01"];
    assert.equal(notice.label, "PUBLISHED DATA");
    assert.match(notice.summary, /portfolio shown on the other screens is synthetic/);
    assert.match(notice.citation, /Kemabonta.*Geoffrey.*v1\.0\.2/);
    assert.equal(notice.url, "https://doi.org/10.5281/zenodo.24098636");
    assert.deepEqual(notice.context, [
      { term: "Records cover", value: "26 August 2020 to 25 January 2025" },
      { term: "Published", value: "24 October 2026" },
    ]);
  });
});
