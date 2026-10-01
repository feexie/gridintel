import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ScopeRef } from "@/domain";
import { compareKpi } from "../../analytics/index.ts";
import { DEMO_CLOCK, DEMO_PERIOD, DEMO_REGION_ID, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createMockRepositories } from "../../repositories/mock/index.ts";
import { scopeCollection } from "./billing.ts";
import { assetLoading } from "./loading.ts";
import { sectionLosses } from "./losses.ts";
import { scopeReliability } from "./reliability.ts";

/* ==========================================================
   THE SERVICES ON THE SYNTHETIC DATASET

   These pin the properties the dataset was designed to show, not
   exact figures: the design can be tuned without rewriting them.
========================================================== */

const repos = createDemoRepositories();
const period = DEMO_PERIOD;
const context = { computedAt: DEMO_CLOCK };
const dt = (id: string): ScopeRef => ({ kind: "distribution_transformer", id });
const feeder = (id: string): ScopeRef => ({ kind: "feeder", id });
const SUBSTATION: ScopeRef = { kind: "substation", id: "SS-RIV" };
const close = (a: number | null, b: number | null, epsilon = 1e-9) => a !== null && b !== null && Math.abs(a - b) <= epsilon;

describe("synthetic marker", () => {
  it("is set on every result derived from the synthetic dataset", async () => {
    const results = await Promise.all([
      sectionLosses({ repos, scope: feeder("FD-MKT"), period, context }),
      scopeReliability({ repos, scope: feeder("FD-MKT"), period, context }),
      scopeCollection({ repos, scope: { kind: "region", id: DEMO_REGION_ID }, period, context }),
      assetLoading({ repos, asset: { kind: "distribution_transformer", id: "DT-MKT-1" }, asOf: DEMO_CLOCK, context }),
    ]);
    for (const { sourcing } of results) {
      assert.equal(sourcing.synthetic, true);
      assert.ok(sourcing.sources.length > 0);
      assert.deepEqual(sourcing.unknownSources, []);
    }
  });

  it("is not set on results from the legacy mock data, which is a different kind of source", async () => {
    const mock = createMockRepositories();
    const { sourcing } = await scopeReliability({
      repos: mock,
      scope: { kind: "organization", id: "mock-utility" },
      period: { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" },
      context,
    });
    assert.equal(sourcing.synthetic, false);
    assert.ok(sourcing.sources.every((source) => source.kind === "mock"));
  });
});

describe("energy account and losses", () => {
  it("is fully measured on the fully metered transformer", async () => {
    const { result } = await sectionLosses({ repos, scope: dt("DT-MKT-3"), period, context });
    assert.equal(result.account.status, "ok");
    assert.equal(result.account.quality, "measured");
    assert.equal(result.account.recordedConsumption.status, "ok");
    assert.ok(close(result.account.downstreamMeasured.value, result.account.recordedConsumption.value, 1e-6));
  });

  it("gives the loss chain but no downstream total where connections are unmetered", async () => {
    const { result } = await sectionLosses({ repos, scope: dt("DT-OLD-2"), period, context });
    assert.equal(result.account.status, "insufficient_data");
    assert.equal(result.account.downstreamMeasured.value, null);
    assert.ok(result.account.missingInputs.some((name) => name.startsWith("service_point meter for service_point")));
    assert.equal(result.account.energyInput.status, "ok");
    assert.equal(result.account.unbilled.status, "ok");
    assert.equal(result.account.energyBilled.quality, "estimated");
  });

  it("reports a meter gap as missing input, not as zero consumption", async () => {
    const { result } = await sectionLosses({ repos, scope: dt("DT-MKT-2"), period, context });
    assert.ok(result.account.warnings.some((w) => w.code === "INTERVAL_GAP"));
    assert.equal(result.account.recordedConsumption.value, null);
  });

  it("decomposes ATC&C into technical, commercial and collection parts that sum to it", async () => {
    for (const scope of [SUBSTATION, feeder("FD-MKT"), feeder("FD-OLD"), dt("DT-MKT-3"), dt("DT-OLD-2")]) {
      const { result } = await sectionLosses({ repos, scope, period, context });
      const d = result.decomposition;
      assert.equal(d.status, "ok", scope.id);
      assert.ok(close((d.technical as number) + (d.commercial as number) + (d.collection as number), d.atcc), scope.id);
      assert.ok((d.technical as number) > 0 && (d.commercial as number) >= 0 && (d.collection as number) >= 0, scope.id);
    }
  });

  it("flags the technical loss as a reported input and names the study", async () => {
    const { result } = await sectionLosses({ repos, scope: feeder("FD-OLD"), period, context });
    assert.equal(result.technicalLossStudy?.metric, "technical_loss");
    assert.equal(result.split.technicalLoss.inputs.technicalLoss.origin, "calculated");
    assert.ok(result.account.warnings.some((w) => w.code === "INPUTS_FROM_REPORTED"));
  });

  it("shows Old Town as the feeder with heavy commercial loss and poor collection", async () => {
    const market = (await sectionLosses({ repos, scope: feeder("FD-MKT"), period, context })).result;
    const oldTown = (await sectionLosses({ repos, scope: feeder("FD-OLD"), period, context })).result;
    assert.ok((oldTown.atcc.collectionEfficiency.value as number) < 0.75);
    assert.ok((market.atcc.collectionEfficiency.value as number) > 0.9);
    assert.ok((oldTown.decomposition.commercial as number) > 0.2);
    assert.ok((oldTown.decomposition.atcc as number) > 0.5);
    assert.ok((market.decomposition.atcc as number) < 0.2);
  });

  it("keeps the reported ATC&C beside the calculated one, and they differ", async () => {
    const { result } = await sectionLosses({ repos, scope: feeder("FD-OLD"), period, context });
    const reported = (await repos.reported.listReportedKpis({ metrics: ["atcc"], scopes: [feeder("FD-OLD")] })).records;
    assert.equal(reported.length, 1);
    const comparison = compareKpi(reported[0], result.atcc.atcc);
    assert.equal(comparison.reported.value, 48);
    assert.ok((comparison.variance.absolute as number) > 5);
  });

  it("without billing records, gives energy input but no ATC&C", async () => {
    const mock = createMockRepositories();
    const { result } = await sectionLosses({
      repos: mock,
      scope: feeder("ADM-FD-001"),
      period: { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" },
      context,
    });
    assert.equal(result.billing.energyBilled.value, null);
    assert.equal(result.atcc.atcc.status, "insufficient_data");
    assert.equal(result.atcc.atcc.value, null);
    assert.equal(result.technicalLossStudy, null);
  });
});

describe("collection for an administrative scope", () => {
  it("totals the region from billing records", async () => {
    const { result } = await scopeCollection({ repos, scope: { kind: "region", id: DEMO_REGION_ID }, period, context });
    const substation = (await sectionLosses({ repos, scope: SUBSTATION, period, context })).result;
    assert.equal(result.collectionEfficiency.status, "ok");
    assert.equal(result.billing.revenueBilled.currency, "NGN");
    assert.ok(close(result.billing.revenueBilled.value, substation.billing.revenueBilled.value, 1e-6));
    assert.ok(result.billing.byBasis.estimated.records > 0 && result.billing.byBasis.prepaid_vend.records > 0);
  });
});

describe("reliability", () => {
  it("is calculated at every level, from the customers each transformer serves", async () => {
    for (const scope of [SUBSTATION, feeder("FD-OLD"), dt("DT-OLD-2")]) {
      const { result } = await scopeReliability({ repos, scope, period, context });
      assert.equal(result.reliability.saidi.status, "ok", scope.id);
      assert.equal(result.reliability.saifi.status, "ok", scope.id);
      assert.deepEqual(result.unattributable, [], scope.id);
    }
  });

  it("keeps each feeder within the hours of supply its service band commits to", async () => {
    const hours = async (id: string) =>
      ((await scopeReliability({ repos, scope: feeder(id), period, context })).result.reliability.asai.value as number) * 24;
    assert.ok((await hours("FD-MKT")) >= 20);
    const oldTown = await hours("FD-OLD");
    assert.ok(oldTown >= 12 && oldTown < 16);
  });

  it("excludes the momentary trip and the complaint that was never closed", async () => {
    const { result } = await scopeReliability({ repos, scope: feeder("FD-MKT"), period, context });
    assert.equal(result.reliability.components.momentary.exposures, 4);
    assert.equal(result.reliability.components.excludedForData, 1);
    assert.ok(result.reliability.saidi.warnings.some((w) => w.code === "EXPOSURES_EXCLUDED"));
  });

  it("shows that load shedding, not faults, drives the indices", async () => {
    const { result } = await scopeReliability({ repos, scope: SUBSTATION, period, context });
    const byCause = result.reliability.components.breakdown.byCause;
    assert.ok((byCause.load_shedding?.customerMinutes as number) > 10 * (byCause.fault?.customerMinutes as number));
  });

  it("is insufficient_data, not a wrong number, when the customer registry is incomplete", async () => {
    const { result } = await scopeReliability({
      repos: createMockRepositories(),
      scope: feeder("ADM-FD-001"),
      period: { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" },
      context,
    });
    assert.equal(result.reliability.saidi.status, "insufficient_data");
    assert.equal(result.reliability.saidi.value, null);
    assert.ok(result.warnings.some((w) => w.code === "CUSTOMER_REGISTRY_INCOMPLETE"));
  });
});

describe("loading", () => {
  const loadingOf = (id: string, kind: "distribution_transformer" | "feeder" = "distribution_transformer") =>
    assetLoading({ repos, asset: { kind, id }, asOf: DEMO_CLOCK, window: period, context });

  it("finds the one overloaded transformer from its observed peak", async () => {
    const overloaded = (await loadingOf("DT-OLD-2")).result;
    assert.ok((overloaded.peak?.peak?.loadingFraction as number) > 1);
    assert.ok((overloaded.peak?.instantsOverloaded as number) > 0);
    for (const id of ["DT-MKT-1", "DT-MKT-2", "DT-MKT-3", "DT-OLD-1", "DT-OLD-3"]) {
      const { result } = await loadingOf(id);
      assert.equal(result.peak?.instantsOverloaded, 0, id);
      assert.ok((result.peak?.peak?.loadingFraction as number) > 0.4, id);
    }
  });

  it("calculates loading at the demo clock from the latest reading, measured rather than reported", async () => {
    const { result } = await loadingOf("DT-OLD-2");
    assert.equal(result.loading?.status, "ok");
    assert.equal(result.loading?.basis, "apparent_power_vs_rated_capacity");
    assert.equal(result.loading?.apparentPowerMethod, "measured_apparent_power");
    assert.equal(result.overload?.overloaded, false);
  });

  it("calculates feeder loading", async () => {
    const { result } = await loadingOf("FD-MKT", "feeder");
    assert.equal(result.loading?.status, "ok");
    assert.ok((result.peak?.peak?.loadingFraction as number) > 0);
  });

  it("returns nothing for an asset that is not in the registry", async () => {
    const { result } = await loadingOf("DT-NOPE");
    assert.equal(result.loading, null);
    assert.equal(result.peak, null);
  });
});
