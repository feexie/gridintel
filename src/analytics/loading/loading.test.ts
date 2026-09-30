import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MetricKey, TelemetryPoint } from "@/domain";
import type { LoadingTarget } from "./loading.ts";
import { LOADING_REFERENCE } from "../core/methodology.ts";
import { calculateLoading, detectOverload, transformerLoadingKpi } from "./loading.ts";
import { CONTEXT, PROVENANCE, approx, buildRegistry } from "../__fixtures__/network.ts";

const AS_OF = "2026-01-01T12:00:00Z";
const registry = buildRegistry();
const DT1: LoadingTarget = { kind: "distribution_transformer", asset: registry.distributionTransformers[0] }; // 500 kVA, 3-phase
const FD1: LoadingTarget = { kind: "feeder", asset: registry.feeders[0] }; // rated 400 A

function point(
  metric: MetricKey,
  value: number,
  phase?: TelemetryPoint["phase"],
  observedAt = "2026-01-01T11:55:00Z",
  sourceId = "DT-1",
): TelemetryPoint {
  return {
    source: { kind: sourceId.startsWith("FD") ? "feeder" : "distribution_transformer", id: sourceId },
    metric,
    observedAt,
    value,
    phase,
    quality: "measured",
    provenance: PROVENANCE,
  };
}

const load = (telemetry: TelemetryPoint[], extra: Partial<Parameters<typeof calculateLoading>[0]> = {}) =>
  calculateLoading({ target: DT1, telemetry, asOf: AS_OF, context: CONTEXT, ...extra });

describe("transformer loading", () => {
  it("measured apparent power ÷ rating", () => {
    const result = load([point("apparent_power_kva", 400, "total")]);
    assert.equal(result.status, "ok");
    assert.equal(result.loadingFraction, 0.8);
    assert.equal(result.basis, "apparent_power_vs_rated_capacity");
    assert.equal(result.apparentPowerMethod, "measured_apparent_power");
    assert.equal(result.ratedCapacityKva, 500);
  });

  it("S = √(P² + Q²) from total active and reactive power", () => {
    const result = load([point("active_power_kw", 300, "total"), point("reactive_power_kvar", 400, "total")]);
    assert.equal(result.apparentPowerKva, 500);
    assert.equal(result.loadingFraction, 1);
    assert.equal(result.apparentPowerMethod, "active_reactive");
  });

  it("S = P ÷ PF", () => {
    const result = load([point("active_power_kw", 300, "total"), point("power_factor", 0.75, "total")]);
    assert.equal(result.apparentPowerKva, 400);
    assert.equal(result.apparentPowerMethod, "active_power_factor");
  });

  it("S = Σ V × I per phase, only with declared line-to-neutral semantics", () => {
    const telemetry = [
      point("voltage_v", 240, "A"), point("voltage_v", 240, "B"), point("voltage_v", 240, "C"),
      point("current_a", 700, "A"), point("current_a", 690, "B"), point("current_a", 695, "C"),
    ];
    const result = load(telemetry, { semantics: { phases: 3, voltageBasis: "line_to_neutral" } });
    assert.ok(approx(result.apparentPowerKva, 500.4)); // 240 × (700 + 690 + 695) / 1000
    assert.ok(approx(result.loadingFraction, 500.4 / 500));
    assert.equal(result.apparentPowerMethod, "voltage_current");
  });

  it("is insufficient_data when electrical semantics are not declared", () => {
    const telemetry = [
      point("voltage_v", 240, "A"), point("voltage_v", 240, "B"), point("voltage_v", 240, "C"),
      point("current_a", 700, "A"), point("current_a", 690, "B"), point("current_a", 695, "C"),
    ];
    const result = load(telemetry);
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.loadingFraction, null);
    assert.ok(result.missingInputs.some((m) => m.includes("semantics")));
  });

  it("does not convert line-to-line voltages by assuming a symmetrical system", () => {
    const telemetry = [
      point("voltage_v", 415, "A"), point("voltage_v", 415, "B"), point("voltage_v", 415, "C"),
      point("current_a", 695, "A"), point("current_a", 695, "B"), point("current_a", 695, "C"),
    ];
    const result = load(telemetry, { semantics: { phases: 3, voltageBasis: "line_to_line" } });
    assert.equal(result.status, "insufficient_data");
  });

  it("does not treat an unlabelled current as a balanced phase current", () => {
    const result = load([point("voltage_v", 415), point("current_a", 695)]);
    assert.equal(result.status, "insufficient_data");
  });

  it("does not use nominal voltage in place of measured voltage", () => {
    // DT-1's registry record has secondaryVoltageKv 0.415, but there is no voltage telemetry.
    const currents = [point("current_a", 700, "A"), point("current_a", 690, "B"), point("current_a", 695, "C")];
    const result = load(currents, { semantics: { phases: 3, voltageBasis: "line_to_neutral" } });
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.apparentPowerKva, null);
  });

  it("does not combine readings taken too far apart", () => {
    const result = load([
      point("active_power_kw", 300, "total", "2026-01-01T11:55:00Z"),
      point("reactive_power_kvar", 400, "total", "2026-01-01T11:20:00Z"),
    ]);
    assert.equal(result.status, "insufficient_data");
  });

  it("ignores stale and unlabelled power readings", () => {
    const stale = load([point("apparent_power_kva", 400, "total", "2026-01-01T09:00:00Z")]);
    assert.equal(stale.status, "insufficient_data");
    const unlabelled = load([point("apparent_power_kva", 400)]);
    assert.equal(unlabelled.status, "insufficient_data");
    assert.ok(unlabelled.warnings.some((w) => w.code === "PHASE_UNSPECIFIED"));
  });

  it("does not use declared semantics that conflict with the registry", () => {
    const result = load([point("voltage_v", 230), point("current_a", 100)], {
      semantics: { phases: 1, voltageBasis: "line_to_neutral" },
    });
    assert.equal(result.status, "insufficient_data");
    assert.ok(result.warnings.some((w) => w.code === "SEMANTICS_CONFLICT"));
  });

  it("produces a calculated KPI in explicit units", () => {
    const kpi = transformerLoadingKpi(load([point("apparent_power_kva", 400, "total")]));
    assert.equal(kpi.kind, "calculated");
    assert.equal(kpi.metric, "transformer_loading");
    assert.equal(kpi.unit, "fraction");
    assert.equal(kpi.asOf, AS_OF);
    assert.equal(kpi.inputs.apparentPower.unit, "kVA");
    assert.equal(kpi.inputs.ratedCapacity.value, 500);
  });
});

describe("feeder loading", () => {
  it("highest phase current ÷ rated current", () => {
    const telemetry = [
      point("current_a", 300, "A", undefined, "FD-1"),
      point("current_a", 320, "B", undefined, "FD-1"),
      point("current_a", 310, "C", undefined, "FD-1"),
    ];
    const result = calculateLoading({ target: FD1, telemetry, asOf: AS_OF, context: CONTEXT });
    assert.equal(result.loadingFraction, 0.8); // 320 / 400
    assert.equal(result.basis, "current_vs_rated_current");
    assert.equal(result.maxPhaseCurrentA, 320);
  });

  it("uses only the target asset's telemetry", () => {
    const result = calculateLoading({
      target: FD1,
      telemetry: [point("apparent_power_kva", 400, "total")], // DT-1's reading
      asOf: AS_OF,
      context: CONTEXT,
    });
    assert.equal(result.status, "insufficient_data");
  });
});

describe("overload detection", () => {
  it("flags loading strictly above the threshold", () => {
    const telemetry = (kva: number) => [point("apparent_power_kva", kva, "total")];
    assert.equal(detectOverload(load(telemetry(500))).overloaded, false); // exactly 100%
    const over = detectOverload(load(telemetry(560)));
    assert.equal(over.overloaded, true);
    assert.ok(approx(over.marginFraction, 0.12));
    assert.equal(over.threshold, 1);
  });

  it("uses the methodology's threshold", () => {
    const strict = { ...LOADING_REFERENCE, parameters: { ...LOADING_REFERENCE.parameters, overloadThreshold: 0.75 } };
    assert.equal(detectOverload(load([point("apparent_power_kva", 400, "total")]), strict).overloaded, true);
  });

  it("returns null, not false, when loading is unknown", () => {
    const result = detectOverload(load([]));
    assert.equal(result.overloaded, null);
    assert.equal(result.status, "insufficient_data");
  });
});
