import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, DEMO_REGION_ID, createDemoRepositories } from "../../repositories/demo/index.ts";
import { SPARSE_AS_OF, SPARSE_PERIOD, sparseRepositories } from "../analytics/__fixtures__/sparse.ts";
import { regionView } from "../operations/levels.ts";
import { executiveView } from "./view.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
const view = await executiveView(runtime);

describe("executive read model", () => {
  it("shows the same figures as the Operations drill-down, and says whose they are", async () => {
    // The organization holds one region, so the two are the same sum of the same two substations.
    const region = await regionView(runtime, DEMO_REGION_ID);
    assert.equal(view.losses?.atcc.value, region?.losses?.atcc.value);
    assert.equal(view.losses?.collectionEfficiency.value, region?.losses?.collectionEfficiency.value);
    assert.match(view.losses?.scopeNote ?? "", /Summed over 2 electrical section\(s\): SS-HIL, SS-RIV\. An organization is not an electrical boundary/);
    assert.equal(view.losses?.collectionBasis, "cash");
    assert.equal(view.losses?.sourcing.synthetic, true);
    assert.equal(view.reliability.sourcing.synthetic, true);
  });

  it("splits ATC&C and reliability, and compares reported figures on their own basis", () => {
    const losses = view.losses;
    assert.ok(losses);
    const sum = (losses.parts.technical.value as number) + (losses.parts.commercial.value as number) + (losses.parts.collection.value as number);
    assert.ok(Math.abs(sum - (losses.atcc.value as number)) < 1e-9);
    assert.equal(view.reliability.attribution.length, 4);
    assert.ok(losses.reported.every((row) => row.sameBasis));
    // Reported SAIDI counts network interruptions only, and is set beside the network-only figure.
    const saidi = view.reliability.reported.find((row) => row.label === "SAIDI");
    assert.equal(saidi?.sameBasis, true);
    assert.ok((saidi?.calculated.value as number) < 10);
    assert.ok((view.reliability.saidi.value as number) > 200);
    assert.equal(view.reliability.scopeNote ?? null, null);
  });

  it("summarises band compliance per feeder and transformer loading, highest peak first", () => {
    assert.deepEqual(view.bandCompliance.map((row) => [row.feederId, row.band, row.minimumHours, row.daysObserved]), [
      ["FD-MKT", "A", 20, 30],
      ["FD-OLD", "C", 12, 30],
      ["FD-FRM", "D", 8, 30],
      ["FD-GOV", "B", 16, 30],
    ]);
    assert.ok(view.bandCompliance.every((row) => (row.daysFailed as number) > 0 && row.compliantOnAverage === true));
    assert.equal(view.transformerLoading.length, 48);
    assert.equal(view.transformerLoading[0].transformerId, "DT-OLD-2");
    assert.equal(view.transformerLoading[0].overloaded, true);
    const peaks = view.transformerLoading.map((row) => row.peak.value as number);
    assert.deepEqual(peaks, [...peaks].sort((a, b) => b - a));
  });

  it("puts every overloaded transformer in asset risk, highest peak first, apart from the money ranking", () => {
    assert.deepEqual(view.assetRisk.map((entry) => [entry.rank, entry.group, entry.subject.id, entry.money]), [
      [1, "asset_risk", "DT-OLD-2", null],
      [2, "asset_risk", "DT-GOV-3", null],
      [3, "asset_risk", "DT-GOV-10", null],
      [4, "asset_risk", "DT-GOV-4", null],
    ]);
    for (const entry of view.assetRisk) {
      assert.deepEqual(entry.findings.map((finding) => finding.rule), ["Transformer loaded above its rating"], entry.subject.id);
      assert.equal(entry.findings[0].detail?.label, "hours over rating");
    }
    const peaks = view.assetRisk.map((entry) => entry.findings[0].metric.value as number);
    assert.deepEqual(peaks, [...peaks].sort((a, b) => b - a));
    assert.ok(peaks.every((peak) => peak > 1));
  });

  it("ranks every feeder by revenue not realised, each once, with every rule it triggered", () => {
    assert.deepEqual(view.whereToLook.map((entry) => [entry.rank, entry.group, entry.subject.kind, entry.subject.id]), [
      [1, "money", "feeder", "FD-MKT"],
      [2, "money", "feeder", "FD-GOV"],
      [3, "money", "feeder", "FD-OLD"],
      [4, "money", "feeder", "FD-FRM"],
      [5, "other", "distribution_transformer", "DT-OLD-14"],
    ]);
    const [market, government, oldTown, farm, transformer] = view.whereToLook;
    const money = [market, government, oldTown, farm].map((entry) => entry.money?.value as number);
    assert.deepEqual(money, [...money].sort((a, b) => b - a));
    assert.deepEqual(market.findings.map((finding) => finding.rule), [
      "Feeder with the largest revenue not realised",
      "Feeder below its service-band minimum on at least one day",
    ]);
    // Ranked second on money alone: its gap is collection lost to government accounts, which no ratio rule picks out.
    assert.deepEqual(government.findings.map((finding) => finding.rule), ["Feeder below its service-band minimum on at least one day"]);
    assert.deepEqual(oldTown.findings.map((finding) => finding.rule), [
      "Feeder below its service-band minimum on at least one day",
      "Feeder with the highest network-attributable SAIDI",
    ]);
    // The worst ratios are on the smallest feeder, which is why ratios do not set the order.
    assert.deepEqual(farm.findings.map((finding) => finding.rule), [
      "Feeder with the highest ATC&C",
      "Feeder below its service-band minimum on at least one day",
      "Feeder with the lowest collection efficiency",
    ]);
    // A transformer's commercial loss has no money rank of its own: it is part of its feeder's.
    assert.equal(transformer.money, null);
    assert.deepEqual(transformer.findings.map((finding) => finding.rule), ["Transformer with the highest commercial loss"]);
    assert.match(transformer.findings[0].context?.note ?? "", /part of Old Town 11 kV feeder's revenue not realised; not ranked separately/);
    // No subject is listed twice across the two lists.
    const all = [...view.assetRisk, ...view.whereToLook].map((entry) => entry.subject.id);
    assert.equal(new Set(all).size, all.length);
    assert.match(view.whereToLookMethod, /Asset risk is its own group, shown first and never ranked by money/);
    for (const entry of [...view.assetRisk, ...view.whereToLook]) {
      for (const finding of entry.findings) assert.ok(finding.metric.value !== null, finding.title);
    }
  });

  it("shows reported figures at the scope they are stated for, labelled with it", () => {
    // Nothing is reported for the organization; the report states its figures for each substation.
    const rows = [...(view.losses?.reported ?? []), ...view.reliability.reported];
    const hillcrest = "Hillcrest 33/11 kV injection substation";
    const riverside = "Riverside 33/11 kV injection substation";
    assert.deepEqual(rows.map((row) => [row.label, row.statedFor]), [
      ["ATC&C", hillcrest],
      ["Collection efficiency", hillcrest],
      ["ATC&C", riverside],
      ["Collection efficiency", riverside],
      ["SAIDI", hillcrest],
      ["SAIFI", hillcrest],
      ["SAIDI", riverside],
      ["SAIFI", riverside],
    ]);
    for (const row of rows) {
      assert.equal(row.sameBasis, true, row.label);
      assert.equal(row.comparable, true, row.label);
      assert.ok(row.variance !== null, row.label);
    }
  });

  it("shows the revenue gap as two separate parts, labelled as a monthly estimate", () => {
    const gap = view.revenueGap;
    assert.equal(gap.currency, "NGN");
    assert.equal(gap.commercial.origin, "derived");
    assert.equal(gap.commercial.status, "calculated_with_estimates");
    assert.equal(gap.collection.origin, "calculated");
    assert.equal(gap.collection.status, "ok");
    assert.equal(gap.notRealised.origin, "derived");
    assert.equal(gap.notRealised.status, "calculated_with_estimates");
    assert.ok(Math.abs((gap.notRealised.value as number) - ((gap.commercial.value as number) + (gap.collection.value as number))) < 1e-6);
    assert.match(gap.definition, /estimate of revenue not realised/);
    assert.match(gap.definition, /not an amount owed/);
    assert.doesNotMatch(`${gap.definition} ${gap.periodNote} ${gap.notRealised.note}`, /theft/i);
    assert.match(gap.periodNote, /Not annualised/);
    assert.equal(gap.negativeNote, null);
    assert.match(gap.unknownDemandClassNote ?? "", /account\(s\) with unknown demand class excluded from the rate/);
    // The feeders' parts add up to the portfolio's.
    assert.equal(view.gapByFeeder.length, 4);
    const feeders = view.gapByFeeder.reduce((total, row) => total + (row.collection.value as number), 0);
    assert.ok(Math.abs(feeders - (gap.collection.value as number)) < 1e-6);
    // Each transformer is valued at its own feeder's rate; none at a blended one.
    const tariffs = [43, 50, 63, 209.5];
    const sections = gap.parts.filter((part) => part.kind === "section");
    assert.equal(sections.length, 48);
    const used = new Set(sections.map((part) => tariffs.find((tariff) => Math.abs((part.ratePerKwh as number) - tariff) < 0.01)));
    assert.deepEqual([...used].sort((a, b) => (a as number) - (b as number)), tariffs);
  });

  it("is the same list every time", async () => {
    const again = await executiveView(runtime);
    assert.deepEqual(again.whereToLook, view.whereToLook);
    assert.deepEqual(again.assetRisk, view.assetRisk);
  });

  it("ranks nothing it has no value for", async () => {
    const sparse = await executiveView({ repos: sparseRepositories(), now: SPARSE_AS_OF, period: SPARSE_PERIOD, caveats: {} });
    assert.deepEqual(sparse.whereToLook, []);
    assert.deepEqual(sparse.assetRisk, []);
    assert.equal(sparse.reliability.saidi.value, null);
    assert.equal(sparse.reliability.saidi.status, "insufficient_data");
  });
});
