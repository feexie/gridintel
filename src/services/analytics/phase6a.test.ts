import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ScopeRef } from "@/domain";
import { DEMO_CLOCK, DEMO_ORGANIZATION_ID, DEMO_PERIOD, DEMO_REGION_ID, createDemoRepositories, demoDataset } from "../../repositories/demo/index.ts";
import { sparseRepositories, SPARSE_PERIOD } from "./__fixtures__/sparse.ts";
import { NO_CACHE, createMemoryCache, resultKey } from "./cache.ts";
import { sectionLosses } from "./losses.ts";
import { scopeReliability } from "./reliability.ts";
import { scopeRevenueGap } from "./revenueGap.ts";

const repos = createDemoRepositories();
const period = DEMO_PERIOD;
const context = { computedAt: DEMO_CLOCK };
const SUBSTATION: ScopeRef = { kind: "substation", id: "SS-RIV" };
const REGION: ScopeRef = { kind: "region", id: DEMO_REGION_ID };
const ORGANIZATION: ScopeRef = { kind: "organization", id: DEMO_ORGANIZATION_ID };
const feeder = (id: string): ScopeRef => ({ kind: "feeder", id });
const dt = (id: string): ScopeRef => ({ kind: "distribution_transformer", id });
const close = (a: number | null, b: number | null, epsilon = 1e-6) => a !== null && b !== null && Math.abs(a - b) <= epsilon;

describe("aggregation across sections", () => {
  it("gives a region with one substation exactly that substation's account: nothing is counted twice", async () => {
    const substation = (await sectionLosses({ repos, scope: SUBSTATION, period, context })).result;
    for (const scope of [REGION, ORGANIZATION]) {
      const total = (await sectionLosses({ repos, scope, period, context })).result;
      assert.deepEqual(total.sections, [SUBSTATION], scope.kind);
      for (const figure of ["received", "energyInput", "technicalLoss", "delivered", "energyBilled", "unbilled", "totalLoss", "downstreamMeasured"] as const) {
        assert.equal(total.account[figure].value, substation.account[figure].value, `${scope.kind} ${figure}`);
      }
      assert.equal(total.account.status, substation.account.status);
      assert.deepEqual(total.account.estimatedInputs, substation.account.estimatedInputs);
      assert.equal(total.billing.revenueBilled.value, substation.billing.revenueBilled.value);
      assert.equal(total.billing.revenueCollected.value, substation.billing.revenueCollected.value);
      assert.equal(total.billing.energyBilled.value, substation.billing.energyBilled.value);
      assert.equal(total.atcc.atcc.value, substation.atcc.atcc.value);
      assert.equal(total.split.technicalLoss.value, substation.split.technicalLoss.value);
      assert.equal(total.split.commercialLoss.value, substation.split.commercialLoss.value);
      assert.equal(total.decomposition.collection, substation.decomposition.collection);
      assert.equal(total.account.scope.kind, scope.kind);
    }
  });

  it("sums billed energy to what the region's own billing totals say", async () => {
    const region = (await sectionLosses({ repos, scope: REGION, period, context })).result;
    assert.equal(region.account.energyBilled.value, region.billing.energyBilled.value);
  });

  it("can now be compared with the figure reported for the region", async () => {
    const region = (await sectionLosses({ repos, scope: REGION, period, context })).result;
    assert.equal(region.atcc.atcc.status, "calculated_with_estimates");
    assert.deepEqual(region.atcc.atcc.basis, { lossBasis: "energy_input_net_of_transfers_out", collection: "cash" });
    assert.equal(region.technicalLossStudy, null);
    assert.match(region.technicalLossNote ?? "", /Sum of the technical-loss figures of 1 section/);
  });

  it("has no account, rather than an empty one, for a region with no sections", async () => {
    const { result } = await sectionLosses({ repos, scope: { kind: "region", id: "nope" }, period, context });
    assert.equal(result.account.status, "not_computable");
    assert.equal(result.account.energyInput.value, null);
    assert.deepEqual(result.sections, []);
  });

  it("is insufficient_data on a source with no meters", async () => {
    const { result } = await sectionLosses({ repos: sparseRepositories(), scope: { kind: "region", id: "R-1" }, period: SPARSE_PERIOD, context });
    assert.equal(result.account.status, "insufficient_data");
    assert.equal(result.account.received.value, null);
  });
});

describe("revenue gap", () => {
  it("values each transformer's unbilled energy at that transformer's low-voltage rate", async () => {
    const { result } = await scopeRevenueGap({ repos, scope: feeder("FD-OLD"), period, context });
    const sections = result.commercial.parts.filter((part) => part.kind === "section");
    assert.deepEqual(sections.map((part) => part.scope.id), ["DT-OLD-1", "DT-OLD-2", "DT-OLD-3"]);
    // Old Town is billed at the Band C assumption of ₦50/kWh.
    for (const part of sections) assert.ok(close(part.ratePerKwh, 50, 0.01), part.scope.id);
    for (const part of sections) {
      const losses = (await sectionLosses({ repos, scope: part.scope, period, context })).result;
      assert.ok(close(part.energyKwh, losses.account.unbilled.value), part.scope.id);
      assert.ok(close(part.amount, (part.energyKwh as number) * (part.ratePerKwh as number)));
    }
  });

  it("keeps the 11 kV customer out of every rate", async () => {
    const { result } = await scopeRevenueGap({ repos, scope: feeder("FD-MKT"), period, context });
    // Every rate on Market Road is the Band A assumption; none is moved by the 11 kV account.
    for (const part of result.commercial.parts) assert.ok(part.ratePerKwh === null || close(part.ratePerKwh, 209.5, 0.01), part.scope.id);
    const residual = result.commercial.parts.find((part) => part.kind === "residual");
    assert.ok(close(residual?.ratePerKwh ?? null, 209.5, 0.01));

    // The account exists, is recorded as maximum demand, and is a large share of the feeder's billing.
    const md = demoDataset().registry.customers.filter((customer) => customer.demandClass === "md");
    assert.deepEqual(md.map((customer) => customer.id), ["C-MKT-MV-001"]);
    const losses = (await sectionLosses({ repos, scope: feeder("FD-MKT"), period, context })).result;
    const lvEnergy = (
      await Promise.all(["DT-MKT-1", "DT-MKT-2", "DT-MKT-3"].map((id) => sectionLosses({ repos, scope: dt(id), period, context })))
    ).reduce((total, part) => total + (part.result.billing.energyBilled.value as number), 0);
    assert.ok((losses.billing.energyBilled.value as number) - lvEnergy > 30_000);
  });

  it("is the sum of the levels below plus the level's own residual, never a blended rate", async () => {
    const substation = (await scopeRevenueGap({ repos, scope: SUBSTATION, period, context })).result;
    const feeders = await Promise.all(["FD-MKT", "FD-OLD"].map((id) => scopeRevenueGap({ repos, scope: feeder(id), period, context })));
    const below = feeders.reduce((total, part) => total + (part.result.commercial.amount as number), 0);
    const own = substation.commercial.parts.find((part) => part.kind === "residual" && part.scope.kind === "substation");
    assert.ok(close(substation.commercial.amount, below + (own?.amount as number), 1e-3));

    const losses = (await sectionLosses({ repos, scope: SUBSTATION, period, context })).result;
    const blended = (losses.account.unbilled.value as number) * ((losses.billing.revenueBilled.value as number) / (losses.billing.energyBilled.value as number));
    // Most unbilled energy is on the ₦50 feeder, so a blended rate would overstate it several times.
    assert.ok(blended > 1.5 * (substation.commercial.amount as number));
  });

  it("gives the collection gap on a cash basis, apart from the commercial gap", async () => {
    const { result, sourcing } = await scopeRevenueGap({ repos, scope: SUBSTATION, period, context });
    const losses = (await sectionLosses({ repos, scope: SUBSTATION, period, context })).result;
    assert.ok(close(result.collection.amount, (losses.billing.revenueBilled.value as number) - (losses.billing.revenueCollected.value as number)));
    assert.equal(result.collection.basis, "cash");
    assert.equal(result.collection.status, "ok");
    assert.equal(result.commercial.status, "calculated_with_estimates");
    assert.equal(result.status, "calculated_with_estimates");
    assert.equal(result.currency, "NGN");
    assert.deepEqual(result.negativeParts, []);
    assert.ok(close(result.notRealised, (result.commercial.amount as number) + (result.collection.amount as number)));
    assert.equal(sourcing.synthetic, true);
  });

  it("is the same for the region and the organization as for their one substation", async () => {
    const substation = (await scopeRevenueGap({ repos, scope: SUBSTATION, period, context })).result;
    for (const scope of [REGION, ORGANIZATION]) {
      const total = (await scopeRevenueGap({ repos, scope, period, context })).result;
      assert.ok(close(total.commercial.amount, substation.commercial.amount, 1e-3), scope.kind);
      assert.ok(close(total.collection.amount, substation.collection.amount), scope.kind);
    }
  });

  it("is insufficient_data where there are no billing records", async () => {
    const { result } = await scopeRevenueGap({ repos: sparseRepositories(), scope: feeder("FD-1"), period: SPARSE_PERIOD, context });
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.commercial.amount, null);
    assert.equal(result.collection.amount, null);
    assert.equal(result.notRealised, null);
  });
});

describe("result cache", () => {
  it("computes a result once, shares concurrent requests, and keeps keys apart", async () => {
    const cache = createMemoryCache();
    let runs = 0;
    const compute = async () => ++runs;
    const [a, b] = await Promise.all([cache.get("k", compute), cache.get("k", compute)]);
    assert.deepEqual([a, b, runs], [1, 1, 1]);
    assert.equal(await cache.get("k", compute), 1);
    assert.equal(await cache.get("other", compute), 2);
    assert.equal(cache.size(), 2);
    cache.clear();
    assert.equal(await cache.get("k", compute), 3);
  });

  it("does not keep a failure", async () => {
    const cache = createMemoryCache();
    await assert.rejects(cache.get("k", async () => Promise.reject(new Error("boom"))));
    assert.equal(await cache.get("k", async () => "ok"), "ok");
  });

  it("keys a result by service, scope, period and as-of time", () => {
    const base = resultKey("losses", SUBSTATION, period, DEMO_CLOCK);
    assert.notEqual(base, resultKey("reliability", SUBSTATION, period, DEMO_CLOCK));
    assert.notEqual(base, resultKey("losses", REGION, period, DEMO_CLOCK));
    assert.notEqual(base, resultKey("losses", SUBSTATION, { start: period.start, end: "2026-09-02T00:00:00+01:00" }, DEMO_CLOCK));
    assert.notEqual(base, resultKey("losses", SUBSTATION, period, "2026-10-02T00:00:00+01:00"));
  });

  it("returns the same results as computing without it", async () => {
    const cache = createMemoryCache();
    for (const scope of [REGION, feeder("FD-OLD"), dt("DT-MKT-3")]) {
      const cached = await sectionLosses({ repos, scope, period, context, cache });
      const again = await sectionLosses({ repos, scope, period, context, cache });
      assert.equal(again, cached, "second request is served from the cache");
      const fresh = await sectionLosses({ repos, scope, period, context, cache: NO_CACHE });
      assert.deepEqual(cached.result.atcc, fresh.result.atcc);
      assert.deepEqual(cached.result.account, fresh.result.account);
    }
    const reliability = await scopeReliability({ repos, scope: REGION, period, context, cache });
    assert.equal(await scopeReliability({ repos, scope: REGION, period, context, cache }), reliability);
    assert.deepEqual(reliability.result.reliability.saidi, (await scopeReliability({ repos, scope: REGION, period, context })).result.reliability.saidi);
  });
});
