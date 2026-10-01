import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BillingRecord, Payment } from "@/domain";
import { PERIOD, PROVENANCE, buildRegistry } from "../__fixtures__/network.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { billingTotals } from "./totals.ts";

const index = buildTopologyIndex(buildRegistry());
const IN = "2026-01-01T00:30:00Z";

const charge = (id: string, customerId: string, extra: Partial<BillingRecord> = {}): BillingRecord => ({
  id,
  customerId,
  basis: "meter_reading",
  billedAt: IN,
  energyKwh: 100,
  amount: { amountMinor: 500_000, currency: "NGN" },
  provenance: PROVENANCE,
  ...extra,
});

const payment = (id: string, customerId: string, amountMinor: number, receivedAt = IN): Payment => ({
  id,
  customerId,
  receivedAt,
  amount: { amountMinor, currency: "NGN" },
  provenance: PROVENANCE,
});

const totals = (billingRecords: BillingRecord[], payments: Payment[], recordsAvailable = true) =>
  billingTotals({
    index,
    scope: { kind: "distribution_transformer", id: "DT-1" },
    period: PERIOD,
    recordsAvailable,
    billingRecords,
    payments,
    currency: "NGN",
  });

describe("billing totals", () => {
  it("sums only the accounts under the scope and only records in the period", () => {
    const result = totals(
      [
        charge("B-1", "C-1"),
        charge("B-2", "C-2", { basis: "prepaid_vend", energyKwh: 40, amount: { amountMinor: 200_000, currency: "NGN" } }),
        charge("B-3", "C-3"),
        charge("B-4", "C-1", { billedAt: "2026-01-01T01:00:00Z" }),
      ],
      [payment("P-1", "C-1", 250_000), payment("P-2", "C-3", 999), payment("P-3", "C-2", 1, "2025-12-31T23:59:00Z")],
    );
    assert.equal(result.energyBilled.value, 140);
    assert.equal(result.energyBilled.quality, "measured");
    assert.equal(result.energyBilled.origin, "observed");
    assert.equal(result.revenueBilled.value, 7000);
    assert.equal(result.revenueCollected.value, 2500);
    assert.equal(result.byBasis.prepaid_vend.records, 1);
    assert.equal(result.accountsBilled, 2);
    // C-1, C-2 and the closed account C-5 are connected under DT-1.
    assert.equal(result.accountsInScope, 3);
  });

  it("marks energy billed as estimated when any charge was estimated", () => {
    const result = totals([charge("B-1", "C-1"), charge("B-2", "C-2", { basis: "estimated" })], []);
    assert.equal(result.energyBilled.value, 200);
    assert.equal(result.energyBilled.quality, "estimated");
  });

  it("gives a real zero for an empty period when records are available", () => {
    const result = totals([], []);
    assert.equal(result.energyBilled.value, 0);
    assert.equal(result.revenueBilled.value, 0);
    assert.equal(result.revenueCollected.value, 0);
  });

  it("is missing, not zero, when the source holds no billing records", () => {
    const result = totals([], [], false);
    assert.equal(result.energyBilled.value, null);
    assert.equal(result.energyBilled.quality, "missing");
    assert.equal(result.revenueBilled.value, null);
    assert.equal(result.revenueCollected.value, null);
    assert.equal(result.accountsInScope, null);
    assert.deepEqual(result.warnings.map((w) => w.code), ["BILLING_NOT_AVAILABLE"]);
  });

  it("keeps revenue but not energy when a charge states no energy", () => {
    const result = totals([charge("B-1", "C-1", { energyKwh: null }), charge("B-2", "C-2")], []);
    assert.equal(result.energyBilled.value, null);
    assert.equal(result.revenueBilled.value, 10_000);
    assert.ok(result.warnings.some((w) => w.code === "BILLED_ENERGY_NOT_STATED"));
  });

  it("does not convert another currency; revenue becomes unavailable", () => {
    const result = totals([charge("B-1", "C-1", { amount: { amountMinor: 100, currency: "USD" } })], []);
    assert.equal(result.revenueBilled.value, null);
    assert.equal(result.revenueCollected.value, null);
    assert.ok(result.warnings.some((w) => w.code === "CURRENCY_MISMATCH"));
  });

  it("is missing for a scope that is not in the registry", () => {
    const result = billingTotals({
      index,
      scope: { kind: "feeder", id: "nope" },
      period: PERIOD,
      recordsAvailable: true,
      billingRecords: [charge("B-1", "C-1")],
      payments: [],
      currency: "NGN",
    });
    assert.equal(result.energyBilled.value, null);
    assert.ok(result.warnings.some((w) => w.code === "SCOPE_NOT_FOUND"));
  });
});
