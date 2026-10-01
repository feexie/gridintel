import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { KpiBasis, KpiKey, ReportedKpi } from "@/domain";
import type { CalculatedKpi } from "../core/result.ts";
import type { Outage } from "@/domain";
import { CONTEXT, PERIOD, PROVENANCE, approx } from "../__fixtures__/network.ts";
import { calculateCollectionEfficiency } from "../losses/collection.ts";
import { calculateReliability, reliabilityOnBasis } from "../reliability/indices.ts";
import { basisDimensions, basisIssues, compareKpi, compareOnBasis } from "./compare.ts";

const SCOPE = { kind: "feeder", id: "FD-1" } as const;
const ALL = ["network", "upstream_supply", "load_management", "other"] as const;

const reported = (metric: KpiKey, value: number, unit: ReportedKpi["unit"], basis: KpiBasis | null): ReportedKpi => ({
  id: `r:${metric}`,
  metric,
  scope: SCOPE,
  period: PERIOD,
  asOf: null,
  value,
  unit,
  source: { name: "utility", kind: "utility" },
  document: null,
  basis,
  methodology: { name: "utility method" },
  reportedAt: null,
  provenance: PROVENANCE,
});

const calculated = (metric: KpiKey, value: number, unit: CalculatedKpi["unit"], basis: KpiBasis): CalculatedKpi => ({
  kind: "calculated",
  metric,
  scope: SCOPE,
  period: PERIOD,
  asOf: null,
  status: "ok",
  value,
  unit,
  methodology: { id: "m", version: "1" },
  basis,
  inputs: {},
  missingInputs: [],
  estimatedInputs: [],
  coverage: null,
  quality: "measured",
  warnings: [],
  computedAt: CONTEXT.computedAt,
});

describe("basis dimensions", () => {
  it("are defined per metric, and metrics that are plain counts have none", () => {
    assert.deepEqual(basisDimensions("saidi"), ["interruptionClasses", "plannedInterruptions"]);
    assert.deepEqual(basisDimensions("collection_efficiency"), ["collection"]);
    assert.deepEqual(basisDimensions("atcc"), ["lossBasis", "collection"]);
    assert.deepEqual(basisDimensions("customer_count"), []);
  });

  it("match only when every dimension is stated on both sides and equal", () => {
    const network: KpiBasis = { interruptionClasses: ["network"], plannedInterruptions: "included" };
    assert.deepEqual(basisIssues("saidi", network, network), []);
    // The order the classes are listed in does not matter.
    assert.deepEqual(
      basisIssues("saidi", { interruptionClasses: ["upstream_supply", "network"], plannedInterruptions: "included" }, { interruptionClasses: ["network", "upstream_supply"], plannedInterruptions: "included" }),
      [],
    );
    assert.deepEqual(basisIssues("saidi", network, { ...network, interruptionClasses: ALL }).map((i) => i.code), ["BASIS_MISMATCH"]);
    assert.deepEqual(basisIssues("saidi", network, { ...network, plannedInterruptions: "excluded" }).map((i) => i.code), ["BASIS_MISMATCH"]);
  });

  it("never assume an unstated basis matches, on either side", () => {
    const network: KpiBasis = { interruptionClasses: ["network"], plannedInterruptions: "included" };
    assert.deepEqual(basisIssues("saidi", null, network).map((i) => i.code), ["BASIS_UNSPECIFIED", "BASIS_UNSPECIFIED"]);
    assert.deepEqual(basisIssues("saidi", { interruptionClasses: ["network"] }, network).map((i) => i.code), ["BASIS_UNSPECIFIED"]);
    assert.deepEqual(basisIssues("collection_efficiency", { collection: "cash" }, {}).map((i) => i.code), ["BASIS_UNSPECIFIED"]);
    assert.ok(basisIssues("saidi", null, network).every((issue) => issue.blocking));
  });
});

describe("comparison on a basis", () => {
  const total = calculated("saidi", 216, "hours", { interruptionClasses: ALL, plannedInterruptions: "included" });
  const network = calculated("saidi", 5.7, "hours", { interruptionClasses: ["network"], plannedInterruptions: "included" });
  const report = reported("saidi", 5.1, "hours", { interruptionClasses: ["network"], plannedInterruptions: "included" });

  it("is not comparable across different bases, gives the reason and no difference", () => {
    const comparison = compareKpi(report, total);
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.sameBasis, false);
    assert.equal(comparison.variance.absolute, null);
    assert.equal(comparison.variance.relative, null);
    assert.match(comparison.issues.find((i) => i.code === "BASIS_MISMATCH")?.message ?? "", /which interruptions are counted/);
    // Both records are returned untouched.
    assert.equal(comparison.reported, report);
    assert.equal(comparison.calculated, total);
  });

  it("picks the calculated figure on the reported basis", () => {
    const comparison = compareOnBasis(report, [total, network]);
    assert.equal(comparison.calculated, network);
    assert.equal(comparison.sameBasis, true);
    assert.equal(comparison.comparable, true);
    assert.ok(approx(comparison.variance.absolute, 0.6));
  });

  it("falls back to the first candidate as not comparable when none is on the reported basis", () => {
    const upstreamOnly = reported("saidi", 3, "hours", { interruptionClasses: ["upstream_supply"], plannedInterruptions: "included" });
    const comparison = compareOnBasis(upstreamOnly, [total, network]);
    assert.equal(comparison.calculated, total);
    assert.equal(comparison.comparable, false);
    assert.equal(comparison.variance.absolute, null);

    const noBasis = compareOnBasis(reported("saidi", 5.1, "hours", null), [total, network]);
    assert.equal(noBasis.comparable, false);
    assert.ok(noBasis.issues.some((i) => i.code === "BASIS_UNSPECIFIED"));
  });

  it("applies to collection figures too: cash is not accrual", () => {
    const money = (value: number) => ({ value, unit: "currency" as const, currency: "NGN", scale: 1, origin: "observed" as const, quality: "measured" as const });
    const cash = calculateCollectionEfficiency({ scope: SCOPE, period: PERIOD, revenueBilled: money(100), revenueCollected: money(80), collectionBasis: "cash", context: CONTEXT });
    assert.deepEqual(cash.basis, { collection: "cash" });
    assert.equal(compareKpi(reported("collection_efficiency", 75, "percent", { collection: "cash" }), cash).sameBasis, true);
    assert.equal(compareKpi(reported("collection_efficiency", 75, "percent", { collection: "accrual" }), cash).comparable, false);

    // A calculation whose caller did not say which basis its revenue is on states none, and matches nothing.
    const unstated = calculateCollectionEfficiency({ scope: SCOPE, period: PERIOD, revenueBilled: money(100), revenueCollected: money(80), context: CONTEXT });
    assert.deepEqual(unstated.basis, {});
    assert.equal(compareKpi(reported("collection_efficiency", 75, "percent", { collection: "cash" }), unstated).comparable, false);
  });
});

describe("reliability on a stated basis", () => {
  const outage = (id: string, cause: Outage["cause"], party: Outage["responsibleParty"], customers: number, hours: number, basis: "recorded" | "topology_derived" | "estimated" = "recorded"): Outage => ({
    id,
    origin: SCOPE,
    planned: false,
    cause,
    responsibleParty: party,
    exposures: [
      {
        affected: SCOPE,
        customersAffected: customers,
        customerCountBasis: basis,
        interruptedAt: "2026-01-01T00:00:00Z",
        restoredAt: `2026-01-01T0${hours}:00:00Z`.replace("T01:00:00Z", "T00:30:00Z"),
        quality: "measured",
      },
    ],
    provenance: PROVENANCE,
  });
  const DAY = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };
  const served = { value: 10, unit: "count" as const, origin: "calculated" as const, quality: "measured" as const };
  const result = (outages: Outage[]) => calculateReliability({ scope: SCOPE, period: DAY, outages, customersServed: served, context: CONTEXT });

  it("sums the chosen classes, states them as its basis, and never exceeds the total", () => {
    const all = result([outage("A", "fault", "distribution", 10, 2), outage("B", "load_shedding", "transmission", 10, 6), outage("C", "upstream_supply", "transmission", 5, 4)]);
    assert.deepEqual(all.saidi.basis, { interruptionClasses: ALL, plannedInterruptions: "included" });

    const network = reliabilityOnBasis(all, ["network"]);
    assert.ok(approx(network.saidi.value, 120));
    assert.ok(approx(network.saifi.value, 1));
    assert.deepEqual(network.saidi.basis.interruptionClasses, ["network"]);
    assert.equal(network.saidi.inputs.customerMinutes.value, 1200);

    const two = reliabilityOnBasis(all, ["upstream_supply", "network"]);
    assert.deepEqual(two.saidi.basis.interruptionClasses, ["network", "upstream_supply"]);
    assert.ok(approx(two.saidi.value, 120 + 120));
    assert.ok(approx(reliabilityOnBasis(all, ALL).saidi.value, all.saidi.value as number));
  });

  it("treats a topology-derived customer count as derived, not estimated", () => {
    const derived = result([outage("A", "fault", "distribution", 10, 2, "topology_derived")]);
    assert.equal(derived.saidi.status, "ok");
    assert.equal(derived.saidi.quality, "measured");
    assert.deepEqual(derived.saidi.estimatedInputs, []);
    assert.ok(derived.saidi.warnings.some((w) => w.code === "CUSTOMER_COUNTS_TOPOLOGY_DERIVED"));

    const recorded = result([outage("A", "fault", "distribution", 10, 2, "recorded")]);
    assert.ok(!recorded.saidi.warnings.some((w) => w.code === "CUSTOMER_COUNTS_TOPOLOGY_DERIVED"));
  });

  it("still calls a count that is itself an estimate estimated", () => {
    const estimated = result([outage("A", "fault", "distribution", 10, 2, "estimated")]);
    assert.equal(estimated.saidi.status, "calculated_with_estimates");
    assert.equal(estimated.saidi.quality, "estimated");
  });
});
