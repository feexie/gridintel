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
const HILLCREST: ScopeRef = { kind: "substation", id: "SS-HIL" };
const REGION: ScopeRef = { kind: "region", id: DEMO_REGION_ID };
// The revenue-gap tests walk every transformer; they share one cache so each is computed once.
const cache = createMemoryCache();
const ORGANIZATION: ScopeRef = { kind: "organization", id: DEMO_ORGANIZATION_ID };
const feeder = (id: string): ScopeRef => ({ kind: "feeder", id });
const dt = (id: string): ScopeRef => ({ kind: "distribution_transformer", id });
const close = (a: number | null, b: number | null, epsilon = 1e-6) => a !== null && b !== null && Math.abs(a - b) <= epsilon;

describe("aggregation across sections", () => {
  it("gives a region the sum of its two substations, each counted once", async () => {
    const parts = await Promise.all([SUBSTATION, HILLCREST].map((scope) => sectionLosses({ repos, scope, period, context })));
    for (const scope of [REGION, ORGANIZATION]) {
      const total = (await sectionLosses({ repos, scope, period, context })).result;
      assert.deepEqual(total.sections, [HILLCREST, SUBSTATION], scope.kind);
      for (const figure of ["received", "energyInput", "technicalLoss", "delivered", "energyBilled", "unbilled", "totalLoss", "downstreamMeasured"] as const) {
        const sum = parts.reduce((value, part) => value + (part.result.account[figure].value as number), 0);
        assert.ok(close(total.account[figure].value, sum, 1e-6), `${scope.kind} ${figure}`);
      }
      assert.equal(total.account.status, "calculated_with_estimates");
      const billed = parts.reduce((value, part) => value + (part.result.billing.revenueBilled.value as number), 0);
      const collected = parts.reduce((value, part) => value + (part.result.billing.revenueCollected.value as number), 0);
      assert.ok(close(total.billing.revenueBilled.value, billed, 1e-3));
      assert.ok(close(total.billing.revenueCollected.value, collected, 1e-3));
      // ATC&C of the whole is from the summed energy and revenue, not an average of the two percentages.
      const input = total.account.energyInput.value as number;
      const expected = 1 - ((total.account.energyBilled.value as number) / input) * (collected / billed);
      assert.ok(close(total.atcc.atcc.value, expected, 1e-9));
      const [riverside, hillcrest] = parts.map((part) => part.result.atcc.atcc.value as number);
      assert.ok((total.atcc.atcc.value as number) > Math.min(riverside, hillcrest) && (total.atcc.atcc.value as number) < Math.max(riverside, hillcrest));
      assert.equal(total.account.scope.kind, scope.kind);
    }
  });

  it("gives a section the same account whether asked for directly or as the only section of a scope", async () => {
    // Guards against double counting: a one-section sum must be that section, figure for figure.
    const direct = (await sectionLosses({ repos, scope: SUBSTATION, period, context })).result.account;
    const { aggregateEnergyAccounts } = await import("../../analytics/index.ts");
    const summed = aggregateEnergyAccounts({ scope: REGION, period, accounts: [direct], computedAt: context.computedAt });
    for (const figure of ["received", "energyInput", "technicalLoss", "delivered", "energyBilled", "unbilled", "totalLoss"] as const) {
      assert.equal(summed[figure].value, direct[figure].value, figure);
    }
  });

  it("sums billed energy to what the region's own billing totals say", async () => {
    const region = (await sectionLosses({ repos, scope: REGION, period, context })).result;
    assert.ok(close(region.account.energyBilled.value, region.billing.energyBilled.value, 1e-6));
  });

  it("can now be compared with the figure reported for the region", async () => {
    const region = (await sectionLosses({ repos, scope: REGION, period, context })).result;
    assert.equal(region.atcc.atcc.status, "calculated_with_estimates");
    assert.deepEqual(region.atcc.atcc.basis, { lossBasis: "energy_input_net_of_transfers_out", collection: "cash" });
    assert.equal(region.technicalLossStudy, null);
    assert.match(region.technicalLossNote ?? "", /Sum of the technical-loss figures of 2 section\(s\): SS-HIL, SS-RIV/);
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
    const { result } = await scopeRevenueGap({ repos, scope: feeder("FD-OLD"), period, context, cache });
    const sections = result.commercial.parts.filter((part) => part.kind === "section");
    assert.equal(sections.length, 14);
    assert.deepEqual(sections.slice(0, 3).map((part) => part.scope.id), ["DT-OLD-1", "DT-OLD-10", "DT-OLD-11"]);
    // Old Town is billed at the Band C assumption of ₦50/kWh.
    for (const part of sections) assert.ok(close(part.ratePerKwh, 50, 0.01), part.scope.id);
    for (const part of sections.slice(0, 4)) {
      const losses = (await sectionLosses({ repos, scope: part.scope, period, context, cache })).result;
      assert.ok(close(part.energyKwh, losses.account.unbilled.value), part.scope.id);
      assert.ok(close(part.amount, (part.energyKwh as number) * (part.ratePerKwh as number)));
    }
  });

  it("keeps the 11 kV customer out of every rate", async () => {
    const { result } = await scopeRevenueGap({ repos, scope: feeder("FD-MKT"), period, context, cache });
    // Every rate on Market Road is the Band A assumption; none is moved by the 11 kV account.
    for (const part of result.commercial.parts) assert.ok(part.ratePerKwh === null || close(part.ratePerKwh, 209.5, 0.01), part.scope.id);
    const residual = result.commercial.parts.find((part) => part.kind === "residual");
    assert.ok(close(residual?.ratePerKwh ?? null, 209.5, 0.01));

    // The account exists, is recorded as maximum demand, and is a large part of the feeder's billing.
    const account = demoDataset().registry.customers.find((customer) => customer.id === "C-MKT-MV-001");
    assert.equal(account?.demandClass, "md");
    assert.equal(account?.category, "industrial");
    const losses = (await sectionLosses({ repos, scope: feeder("FD-MKT"), period, context, cache })).result;
    assert.ok((losses.billing.byCategory.industrial.revenueBilled as number) > 10_000_000);
  });

  it("leaves government maximum-demand accounts out of the rate, though they are under a transformer", async () => {
    const { fetchBillingTotals } = await import("./billing.ts");
    const { loadTopology } = await import("./topology.ts");
    const { SourceTrail } = await import("./sourcing.ts");
    const { index, snapshot } = await loadTopology(repos.registry, period.end);
    const scope = dt("DT-GOV-1");
    const all = await fetchBillingTotals({ repos, index, snapshot, scope, period, trail: new SourceTrail() });
    const ordinary = await fetchBillingTotals({ repos, index, snapshot, scope, period, trail: new SourceTrail(), accounts: "low_voltage_non_md" });
    assert.ok(all.byCategory.government.accounts > 0);
    assert.equal(ordinary.byCategory.government, undefined);
    assert.ok((ordinary.energyBilled.value as number) < (all.energyBilled.value as number));
    assert.equal(ordinary.unknownDemandClassExcluded, 0);
  });

  it("counts and flags the accounts whose demand class is not recorded", async () => {
    const farm = (await scopeRevenueGap({ repos, scope: feeder("FD-FRM"), period, context, cache })).result;
    const unknown = demoDataset().registry.customers.filter((customer) => customer.demandClass === undefined).length;
    assert.ok(unknown > 0);
    assert.equal(farm.unknownDemandClassExcluded, unknown);
    assert.ok(farm.warnings.some((w) => w.message === `${unknown} account(s) with unknown demand class excluded from the rate.`));
    assert.equal((await scopeRevenueGap({ repos, scope: feeder("FD-MKT"), period, context, cache })).result.unknownDemandClassExcluded, 0);
    // The organization's figure carries the same count up.
    assert.equal((await scopeRevenueGap({ repos, scope: ORGANIZATION, period, context, cache })).result.unknownDemandClassExcluded, unknown);
  });

  it("is the sum of the levels below plus the level's own residual, never a blended rate", async () => {
    const substation = (await scopeRevenueGap({ repos, scope: SUBSTATION, period, context, cache })).result;
    const feeders = await Promise.all(["FD-MKT", "FD-OLD"].map((id) => scopeRevenueGap({ repos, scope: feeder(id), period, context, cache })));
    const below = feeders.reduce((total, part) => total + (part.result.commercial.amount as number), 0);
    const own = substation.commercial.parts.find((part) => part.kind === "residual" && part.scope.kind === "substation");
    assert.ok(close(substation.commercial.amount, below + (own?.amount as number), 1e-3));

    const losses = (await sectionLosses({ repos, scope: SUBSTATION, period, context, cache })).result;
    const blended = (losses.account.unbilled.value as number) * ((losses.billing.revenueBilled.value as number) / (losses.billing.energyBilled.value as number));
    // Most unbilled energy is on the ₦50 feeder, so a blended rate would overstate it.
    assert.ok(blended > 1.5 * (substation.commercial.amount as number));
  });

  it("gives the collection gap on a cash basis, apart from the commercial gap", async () => {
    const { result, sourcing } = await scopeRevenueGap({ repos, scope: SUBSTATION, period, context, cache });
    const losses = (await sectionLosses({ repos, scope: SUBSTATION, period, context, cache })).result;
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

  it("is the same for the region as for the organization, and is the two substations plus nothing", async () => {
    const organization = (await scopeRevenueGap({ repos, scope: ORGANIZATION, period, context, cache })).result;
    const region = (await scopeRevenueGap({ repos, scope: REGION, period, context, cache })).result;
    assert.ok(close(region.commercial.amount, organization.commercial.amount, 1e-3));
    assert.ok(close(region.collection.amount, organization.collection.amount, 1e-3));
    const substations = await Promise.all([SUBSTATION, HILLCREST].map((scope) => scopeRevenueGap({ repos, scope, period, context, cache })));
    const commercial = substations.reduce((total, part) => total + (part.result.commercial.amount as number), 0);
    const collection = substations.reduce((total, part) => total + (part.result.collection.amount as number), 0);
    assert.ok(close(organization.commercial.amount, commercial, 1));
    assert.ok(close(organization.collection.amount, collection, 1e-3));
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
