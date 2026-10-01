import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Period, TelemetryPoint } from "@/domain";
import { CONTEXT, PROVENANCE, buildRegistry } from "../__fixtures__/network.ts";
import { peakLoading } from "./peak.ts";

const dt = buildRegistry().distributionTransformers[0]; // DT-1, 500 kVA
const WINDOW: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };

const reading = (observedAt: string, kva: number | null, id = dt.id): TelemetryPoint => ({
  source: { kind: "distribution_transformer", id },
  metric: "apparent_power_kva",
  observedAt,
  value: kva,
  phase: "total",
  quality: kva === null ? "missing" : "measured",
  provenance: PROVENANCE,
});

const peak = (telemetry: TelemetryPoint[]) =>
  peakLoading({
    target: { kind: "distribution_transformer", asset: dt },
    telemetry,
    window: WINDOW,
    overloadThreshold: 1,
    context: CONTEXT,
  });

describe("peak loading", () => {
  it("returns the highest loading observed in the window, and when", () => {
    const result = peak([
      reading("2026-01-01T08:00:00Z", 200),
      reading("2026-01-01T20:00:00Z", 550),
      reading("2026-01-01T21:00:00Z", 510),
      reading("2026-01-01T23:00:00Z", 100),
    ]);
    assert.equal(result.peak?.loadingFraction, 1.1);
    assert.equal(result.peak?.asOf, "2026-01-01T20:00:00Z");
    assert.equal(result.instantsEvaluated, 4);
    assert.equal(result.instantsComputed, 4);
    assert.equal(result.instantsOverloaded, 2);
  });

  it("ignores readings outside the window and readings of other assets", () => {
    const result = peak([
      reading("2025-12-31T23:00:00Z", 900),
      reading("2026-01-02T00:00:00Z", 900),
      reading("2026-01-01T12:00:00Z", 900, "DT-2"),
      reading("2026-01-01T12:00:00Z", 250),
    ]);
    assert.equal(result.peak?.loadingFraction, 0.5);
    assert.equal(result.instantsEvaluated, 1);
  });

  it("has no peak, rather than a zero, when nothing could be calculated", () => {
    assert.equal(peak([]).peak, null);
    // The missing reading at 13:00 is too far from the 10:00 reading for that one to stand in.
    const result = peak([reading("2026-01-01T13:00:00Z", null)]);
    assert.equal(result.peak, null);
    assert.equal(result.instantsEvaluated, 1);
    assert.equal(result.instantsComputed, 0);
  });

  it("counts a measured zero as a real loading of 0", () => {
    const result = peak([reading("2026-01-01T03:00:00Z", 0)]);
    assert.equal(result.peak?.loadingFraction, 0);
    assert.equal(result.instantsOverloaded, 0);
  });
});
