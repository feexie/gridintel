import type { MethodologyRef } from "@/domain";
import type { CalculatedKpi, EnergyFigure, InputValue, MonetaryInput } from "../../analytics/index.ts";
import type { Sourcing } from "../analytics/sourcing.ts";
import type { DisplayOrigin, DisplayStatus, InputView, MethodView, MetricUnit, MetricView, SourcingView } from "./views.ts";
import {
  ATCC_REFERENCE,
  ENERGY_REFERENCE,
  LOADING_REFERENCE,
  RELIABILITY_REFERENCE,
  REVENUE_GAP_REFERENCE,
  SUPPLY_HOURS_REFERENCE,
  convertUnit,
  resultStatus,
} from "../../analytics/index.ts";

/* ==========================================================
   SERVICES — METRIC VIEWS

   Turns analytics results into MetricViews. No value is changed
   here except by an explicit unit conversion through analytics.

   The origin shown on screen is derived from the value's origin
   and quality:
     estimated  quality is estimated or substituted, whatever the origin
     measured   observed, and measured
     reported   published by someone else
     calculated produced by GridIntel analytics
     derived    a residual: what is left after subtracting other figures
========================================================== */

const METHODS = [ENERGY_REFERENCE, ATCC_REFERENCE, RELIABILITY_REFERENCE, LOADING_REFERENCE, SUPPLY_HOURS_REFERENCE, REVENUE_GAP_REFERENCE];

export function methodView(ref: MethodologyRef): MethodView {
  const known = METHODS.find((method) => method.id === ref.id && method.version === ref.version);
  return {
    id: ref.id,
    version: ref.version,
    name: known?.name ?? ref.id,
    disclaimer: known?.disclaimer ?? "",
  };
}

function isEstimate(quality: string | null): boolean {
  return quality === "estimated" || quality === "substituted";
}

export function inputOrigin(input: InputValue): DisplayOrigin {
  if (isEstimate(input.quality)) return "estimated";
  if (input.origin === "observed") return "measured";
  return input.origin;
}

export function inputView(name: string, input: InputValue): InputView {
  return {
    name,
    value: input.value,
    unit: "currency" in input ? String((input as MonetaryInput).currency) : input.unit,
    origin: inputOrigin(input),
    quality: input.quality,
    estimatedShare: isEstimate(input.quality) ? (input.estimatedShare ?? null) : null,
    ref: input.ref ?? null,
  };
}

export function sourcingView(sourcing: Sourcing): SourcingView {
  return {
    synthetic: sourcing.synthetic,
    sources: sourcing.sources.map((source) => ({ id: source.id, name: source.name, kind: source.kind })),
  };
}

const EMPTY = { derivation: null, method: null, inputs: [], estimatedInputs: [], missingInputs: [], warnings: [], note: null };

/** A figure the platform has no source for. */
export function unavailable(label: string, unit: MetricUnit, reason: string): MetricView {
  return { ...EMPTY, label, value: null, unit, currency: null, status: "not_available", origin: "measured", note: reason };
}

/** A plain count or fact taken from the registry. */
export function registryCount(label: string, value: number | null, note: string | null = null): MetricView {
  return {
    ...EMPTY,
    label,
    value,
    unit: "count",
    currency: null,
    status: value === null ? "insufficient_data" : "ok",
    origin: "calculated",
    derivation: "Counted from the registry.",
    note,
  };
}

export function kpiMetric(
  label: string,
  kpi: CalculatedKpi,
  options: { unit?: MetricUnit; note?: string | null; derivation?: string } = {},
): MetricView {
  let value = kpi.value;
  let unit: MetricUnit = options.unit ?? (kpi.unit === "interruptions_per_customer" ? kpi.unit : "fraction");
  if (kpi.unit === "minutes" || kpi.unit === "hours") {
    value = kpi.value === null ? null : convertUnit(kpi.value, kpi.unit, "hours");
    unit = "hours";
  } else if (kpi.unit === "percent") {
    value = kpi.value === null ? null : convertUnit(kpi.value, "percent", "fraction");
  }
  // A KPI is "estimated" when everything estimated behind it is wholly an estimate, e.g. a
  // technical-loss fraction taken from a study. One with a partly estimated input is still calculated.
  const whollyEstimated = kpi.estimatedInputs.length > 0 && kpi.estimatedInputs.every((input) => input.share === 1);
  const origin: DisplayOrigin = kpi.derivation ? "derived" : whollyEstimated ? "estimated" : "calculated";
  return {
    label,
    value,
    unit,
    currency: null,
    status: kpi.status,
    origin,
    derivation: kpi.derivation?.note ?? options.derivation ?? null,
    method: methodView(kpi.methodology),
    inputs: Object.keys(kpi.inputs).map((name) => inputView(name, kpi.inputs[name])),
    estimatedInputs: kpi.estimatedInputs.map((input) => ({ name: input.name, share: input.share })),
    missingInputs: kpi.missingInputs,
    warnings: kpi.warnings.map((warning) => warning.message),
    note: options.note ?? null,
  };
}

export function figureMetric(label: string, figure: EnergyFigure, origin: DisplayOrigin, method: MethodologyRef): MetricView {
  const estimated = isEstimate(figure.quality);
  return {
    label,
    value: figure.value,
    unit: "kWh",
    currency: null,
    status: resultStatus(figure.status, figure.quality),
    origin: estimated && (origin === "measured" || origin === "reported") ? "estimated" : origin,
    derivation: figure.derivation === "" ? null : figure.derivation,
    method: methodView(method),
    inputs: [],
    estimatedInputs: estimated ? [{ name: label, share: figure.estimatedShare ?? null }] : [],
    missingInputs: figure.missingInputs,
    warnings: [],
    note: null,
  };
}

export function inputMetric(
  label: string,
  input: InputValue,
  unit: MetricUnit,
  derivation: string,
  note: string | null = null,
): MetricView {
  const status: DisplayStatus = input.value === null ? "insufficient_data" : resultStatus("ok", input.quality);
  return {
    label,
    value: input.value,
    unit,
    currency: "currency" in input ? String((input as MonetaryInput).currency) : null,
    status,
    origin: inputOrigin(input),
    derivation,
    method: null,
    inputs: [],
    estimatedInputs: isEstimate(input.quality) && input.value !== null ? [{ name: label, share: input.estimatedShare ?? null }] : [],
    missingInputs: input.value === null ? [label] : [],
    warnings: [],
    note,
  };
}
