import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue, MonetaryInput } from "../core/result.ts";
import { CONTEXT, PERIOD, approx, buildIntervals, buildRegistry } from "../__fixtures__/network.ts";
import { computeEnergyAccount } from "../energy/account.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { atccInputsFromAccount, calculateAtcc, calculateLossSplit, decomposeAtcc } from "./atcc.ts";

const energy = (value: number): InputValue => ({ value, unit: "kWh", origin: "observed", quality: "measured" });
const money = (value: number): MonetaryInput => ({ value, unit: "currency", currency: "NGN", scale: 1, origin: "observed", quality: "measured" });

function decompose(inputs: { technicalLoss?: InputValue; energyBilled?: InputValue; revenueBilled?: MonetaryInput; revenueCollected?: MonetaryInput }) {
  const scope = { kind: "feeder", id: "FD-1" } as const;
  const account = computeEnergyAccount({
    index: buildTopologyIndex(buildRegistry()),
    scope,
    period: PERIOD,
    intervals: buildIntervals(),
    inputs,
    computedAt: CONTEXT.computedAt,
  });
  const atcc = calculateAtcc({ scope, period: PERIOD, inputs: atccInputsFromAccount(account), context: CONTEXT });
  return decomposeAtcc(atcc, calculateLossSplit({ account, context: CONTEXT }));
}

describe("ATC&C decomposition", () => {
  it("splits ATC&C into technical, commercial and collection parts that sum to it", () => {
    // Feeder FD-1 receives 400 kWh: 40 lost technically, 300 billed, 60 delivered but unbilled.
    const d = decompose({ technicalLoss: energy(40), energyBilled: energy(300), revenueBilled: money(1000), revenueCollected: money(800) });
    assert.equal(d.status, "ok");
    assert.ok(approx(d.technical, 0.1));
    assert.ok(approx(d.commercial, 0.15));
    assert.ok(approx(d.collection, 0.75 * 0.2));
    assert.ok(approx(d.atcc, 1 - 0.75 * 0.8));
    assert.ok(approx((d.technical as number) + (d.commercial as number) + (d.collection as number), d.atcc as number));
  });

  it("gives the collection part but no technical/commercial split without a technical loss", () => {
    const d = decompose({ energyBilled: energy(300), revenueBilled: money(1000), revenueCollected: money(800) });
    assert.equal(d.status, "insufficient_data");
    assert.equal(d.technical, null);
    assert.equal(d.commercial, null);
    assert.ok(approx(d.collection, 0.15));
    assert.ok(approx(d.atcc, 0.4));
    assert.ok(d.missingInputs.includes("technical loss"));
  });

  it("gives no part a value when revenue is missing", () => {
    const d = decompose({ technicalLoss: energy(40), energyBilled: energy(300) });
    assert.equal(d.status, "insufficient_data");
    assert.equal(d.collection, null);
    assert.equal(d.atcc, null);
  });
});
