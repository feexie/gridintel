import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ScopeRef } from "@/domain";
import type { InputValue, MonetaryInput } from "../core/result.ts";
import type { RevenueGapNode } from "./revenueGap.ts";
import { CONTEXT, PERIOD, PROVENANCE, approx, buildRegistry } from "../__fixtures__/network.ts";
import { billingTotals } from "../billing/totals.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { calculateRevenueGap } from "./revenueGap.ts";

const energy = (value: number | null, quality: InputValue["quality"] = "estimated"): InputValue => ({
  value,
  unit: "kWh",
  origin: "calculated",
  quality: value === null ? "missing" : quality,
});
const money = (value: number | null): MonetaryInput => ({
  value,
  unit: "currency",
  currency: "NGN",
  scale: 1,
  origin: "observed",
  quality: value === null ? "missing" : "measured",
});
const dt = (id: string): ScopeRef => ({ kind: "distribution_transformer", id });
const FEEDER: ScopeRef = { kind: "feeder", id: "FD-1" };

/** A transformer with `unbilled` kWh, whose LV customers were billed `kwh` for `ngn`. */
const transformer = (id: string, unbilled: number | null, kwh: number, ngn: number): RevenueGapNode => ({
  scope: dt(id),
  unbilled: energy(unbilled),
  lowVoltage: { energyBilled: energy(kwh, "measured"), revenueBilled: money(ngn) },
  children: [],
});

const gap = (tree: RevenueGapNode, billed: number | null = 100_000, collected: number | null = 90_000) =>
  calculateRevenueGap({ period: PERIOD, tree, revenueBilled: money(billed), revenueCollected: money(collected), collectionBasis: "cash", context: CONTEXT });

// DT-A: ₦50/kWh. DT-B: ₦200/kWh. Feeder LV average: (50,000 + 40,000) ÷ (1,000 + 200) = ₦75/kWh.
const feeder = (unbilled: number | null): RevenueGapNode => ({
  scope: FEEDER,
  unbilled: energy(unbilled),
  children: [transformer("DT-A", 100, 1000, 50_000), transformer("DT-B", 10, 200, 40_000)],
});

describe("revenue gap: commercial part", () => {
  it("values a transformer's unbilled energy at its own low-voltage billed rate", () => {
    const result = gap(transformer("DT-A", 100, 1000, 50_000));
    assert.equal(result.commercial.amount, 5000);
    assert.deepEqual(result.commercial.parts, [{ scope: dt("DT-A"), kind: "section", energyKwh: 100, ratePerKwh: 50, amount: 5000 }]);
  });

  it("sums transformers each at its own rate, and values the feeder residual at the feeder's LV average", () => {
    const result = gap(feeder(130));
    const [a, b, residual] = result.commercial.parts;
    assert.equal(a.amount, 100 * 50);
    assert.equal(b.amount, 10 * 200);
    assert.deepEqual([residual.kind, residual.energyKwh, residual.ratePerKwh, residual.amount], ["residual", 20, 75, 1500]);
    assert.equal(result.commercial.amount, 5000 + 2000 + 1500);
    assert.equal(result.commercial.unbilledKwh, 130);
  });

  it("is not the unbilled energy times a blended rate", () => {
    const result = gap(feeder(110));
    // 110 kWh at the feeder's ₦75 average would be 8,250; valued where it occurs it is 7,000.
    assert.equal(result.commercial.amount, 7000);
    assert.notEqual(result.commercial.amount, 110 * 75);
  });

  it("takes its rate only from low-voltage billing, so a large medium-voltage bill changes nothing", () => {
    const without = gap(feeder(130), 90_000, 80_000);
    const withLargeAccount = gap(feeder(130), 90_000 + 20_000_000, 80_000 + 20_000_000);
    assert.equal(withLargeAccount.commercial.amount, without.commercial.amount);
    assert.deepEqual(withLargeAccount.commercial.parts, without.commercial.parts);
  });

  it("treats a residual within rounding as nothing, even with no rate to value it", () => {
    const tree: RevenueGapNode = { scope: FEEDER, unbilled: energy(100.2), children: [transformer("DT-A", 100, 0, 0)] };
    const result = gap({ ...tree, children: [transformer("DT-A", 100, 1000, 50_000)] });
    assert.equal(result.commercial.parts[1].amount, 0);
    assert.equal(result.commercial.amount, 5000);
  });

  it("is insufficient_data when unbilled energy is missing or there is no rate to value it, never zero", () => {
    const missing = gap(feeder(null));
    assert.equal(missing.commercial.amount, null);
    assert.equal(missing.commercial.status, "insufficient_data");
    assert.equal(missing.notRealised, null);
    assert.ok(missing.missingInputs.includes("unbilled energy of feeder FD-1"));

    const noRate = gap(transformer("DT-A", 100, 0, 0));
    assert.equal(noRate.commercial.amount, null);
    assert.ok(noRate.warnings.some((w) => w.code === "NO_LOW_VOLTAGE_RATE"));
  });

  it("is calculated_with_estimates when unbilled energy rests on an estimate, and ok when it does not", () => {
    assert.equal(gap(feeder(130)).status, "calculated_with_estimates");
    assert.deepEqual(gap(feeder(130)).estimatedInputs.map((input) => input.name), ["unbilled energy"]);
    const measured: RevenueGapNode = { ...transformer("DT-A", 100, 1000, 50_000), unbilled: energy(100, "measured") };
    assert.equal(gap(measured).status, "ok");
  });
});

describe("revenue gap: collection part and the total", () => {
  it("is revenue billed less revenue collected, on the stated basis", () => {
    const result = gap(feeder(130), 100_000, 90_000);
    assert.equal(result.collection.amount, 10_000);
    assert.equal(result.collection.basis, "cash");
    assert.equal(result.collection.status, "ok");
    assert.equal(result.notRealised, 8500 + 10_000);
    assert.deepEqual(result.negativeParts, []);
  });

  it("can be negative in a period of arrears recovery, and is then not set against the commercial gap", () => {
    const result = gap(feeder(130), 100_000, 120_000);
    assert.equal(result.collection.amount, -20_000);
    assert.equal(result.commercial.amount, 8500);
    // Not 8,500 − 20,000: the negative part counts as nothing.
    assert.equal(result.notRealised, 8500);
    assert.deepEqual(result.negativeParts, ["collection"]);
    assert.ok(result.warnings.some((w) => w.code === "COLLECTION_EXCEEDS_BILLED"));
  });

  it("shows a negative commercial gap as it is, and does not set it against the collection gap", () => {
    const result = gap(transformer("DT-A", -40, 1000, 50_000), 100_000, 90_000);
    assert.equal(result.commercial.amount, -2000);
    assert.equal(result.notRealised, 10_000);
    assert.deepEqual(result.negativeParts, ["commercial"]);
    assert.ok(result.warnings.some((w) => w.code === "BILLED_EXCEEDS_DELIVERED"));
  });

  it("has no collection part without both revenue figures", () => {
    const result = gap(feeder(130), 100_000, null);
    assert.equal(result.collection.amount, null);
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.notRealised, null);
    assert.equal(result.commercial.amount, 8500);
  });

  it("states that it is for the period and is not annualised or an amount owed", () => {
    assert.match(gap(feeder(130)).methodology.id, /revenue_gap/);
    assert.equal(approx(gap(feeder(130)).commercial.amount, 8500), true);
  });
});

describe("low-voltage non-MD billing", () => {
  // C-2 is a maximum-demand account on DT-1; C-4 is supplied directly by the feeder at medium voltage.
  const withClasses = (classes: Record<string, "md" | "non_md" | undefined>) => {
    const registry = buildRegistry();
    registry.customers = registry.customers.map((customer) => ({ ...customer, demandClass: classes[customer.id] }));
    return buildTopologyIndex(registry);
  };
  const RECORDED = { "C-1": "non_md", "C-2": "md", "C-3": "non_md", "C-4": "md", "C-5": "non_md" } as const;
  const charge = (id: string, customerId: string, kwh: number, ngn: number) => ({
    id,
    customerId,
    basis: "meter_reading" as const,
    billedAt: "2026-01-01T00:30:00Z",
    energyKwh: kwh,
    amount: { amountMinor: ngn * 100, currency: "NGN" },
    provenance: PROVENANCE,
  });
  const charges = [charge("B-1", "C-1", 100, 5000), charge("B-2", "C-2", 900, 180_000), charge("B-3", "C-3", 100, 5000), charge("B-4", "C-4", 5000, 1_000_000)];
  const totals = (scope: ScopeRef, accounts?: "all" | "low_voltage_non_md", classes: Record<string, "md" | "non_md" | undefined> = RECORDED) =>
    billingTotals({ index: withClasses(classes), scope, period: PERIOD, recordsAvailable: true, billingRecords: charges, payments: [], currency: "NGN", accounts });

  it("leaves out the medium-voltage customer and the maximum-demand account", () => {
    const all = totals(FEEDER);
    assert.equal(all.energyBilled.value, 6100);
    const ordinary = totals(FEEDER, "low_voltage_non_md");
    assert.equal(ordinary.energyBilled.value, 200);
    assert.equal(ordinary.revenueBilled.value, 10_000);
    assert.equal(ordinary.accountsBilled, 2);
    assert.equal(ordinary.unknownDemandClassExcluded, 0);
  });

  it("counts every account by default", () => {
    assert.equal(totals(dt("DT-1")).energyBilled.value, 1000);
    assert.equal(totals(dt("DT-1"), "low_voltage_non_md").energyBilled.value, 100);
    assert.equal(totals(dt("DT-1")).unknownDemandClassExcluded, 0);
  });

  it("leaves out an account with no demand class recorded, and counts it: missing is not assumed non-MD", () => {
    const ordinary = totals(FEEDER, "low_voltage_non_md", { ...RECORDED, "C-3": undefined });
    // C-3's 100 kWh are not in the rate; only C-1's are.
    assert.equal(ordinary.energyBilled.value, 100);
    assert.equal(ordinary.revenueBilled.value, 5000);
    assert.equal(ordinary.unknownDemandClassExcluded, 1);
    assert.ok(ordinary.warnings.some((w) => w.code === "DEMAND_CLASS_UNKNOWN"));
    // An unrecorded class at medium voltage is not a low-voltage account and is not counted here.
    assert.equal(totals(FEEDER, "low_voltage_non_md", { ...RECORDED, "C-4": undefined }).unknownDemandClassExcluded, 0);
    // With every class unknown there is no rate at all, rather than one from assumed non-MD accounts.
    const none = totals(dt("DT-1"), "low_voltage_non_md", {});
    assert.equal(none.energyBilled.value, 0);
    assert.equal(none.unknownDemandClassExcluded, 3);
  });

  it("flags the excluded accounts on the revenue-gap result", () => {
    const node: RevenueGapNode = {
      scope: FEEDER,
      unbilled: energy(110),
      children: [
        { ...transformer("DT-A", 100, 1000, 50_000), lowVoltage: { energyBilled: energy(1000, "measured"), revenueBilled: money(50_000), unknownDemandClassExcluded: 2 } },
        { ...transformer("DT-B", 10, 200, 40_000), lowVoltage: { energyBilled: energy(200, "measured"), revenueBilled: money(40_000), unknownDemandClassExcluded: 1 } },
      ],
    };
    const result = gap(node);
    assert.equal(result.unknownDemandClassExcluded, 3);
    assert.ok(result.warnings.some((w) => w.code === "DEMAND_CLASS_UNKNOWN" && w.message === "3 account(s) with unknown demand class excluded from the rate."));
    assert.equal(gap(feeder(130)).unknownDemandClassExcluded, 0);
  });
});
