import type { DataQuality, ReportedKpi } from "@/domain";
import type { Dimension, InputValue, MonetaryInput } from "../../analytics/index.ts";
import { dimensionOf } from "../../analytics/index.ts";

/* ==========================================================
   SERVICES — REPORTED FIGURES AS CALCULATION INPUTS

   Changes a ReportedKpi's format into an analytics input. No
   arithmetic and no unit conversion: the value and unit are passed
   on exactly as reported, and the input stays tagged
   origin "reported", so every result that uses it says so.

   Quality is "measured" by default, following Phase 3: the figure
   is used as stated, with nothing estimated or substituted; that it
   is a reported rather than an observed value is carried by
   `origin`. A figure that is an estimate by nature (a technical-loss
   study) is passed on as "estimated" instead, so every result built
   on it says so.
========================================================== */

export type Conversion<T> = { ok: true; input: T } | { ok: false; reason: string };

export function reportedInput(
  kpi: ReportedKpi,
  dimension: Dimension,
  /** Set when the reported figure is itself an estimate rather than a count or a measurement. */
  quality: Extract<DataQuality, "measured" | "estimated"> = "measured",
): Conversion<InputValue> {
  if (kpi.unit === "currency") {
    return { ok: false, reason: `${kpi.id} is a monetary figure; use reportedMoney.` };
  }
  if (dimensionOf(kpi.unit) !== dimension) {
    return {
      ok: false,
      reason: `${kpi.id} is in ${kpi.unit} (${dimensionOf(kpi.unit)}), not a ${dimension} unit.`,
    };
  }
  return {
    ok: true,
    input: {
      value: kpi.value,
      unit: kpi.unit,
      origin: "reported",
      quality,
      ...(quality === "estimated" ? { estimatedShare: 1 } : {}),
      ref: kpi.id,
    },
  };
}

export function reportedMoney(kpi: ReportedKpi): Conversion<MonetaryInput> {
  if (kpi.unit !== "currency") {
    return { ok: false, reason: `${kpi.id} is in ${kpi.unit}, not a currency.` };
  }
  if (kpi.currency === undefined || kpi.currency === "") {
    return { ok: false, reason: `${kpi.id} is a monetary figure with no currency code.` };
  }
  return {
    ok: true,
    input: {
      value: kpi.value,
      unit: "currency",
      currency: kpi.currency,
      scale: 1,
      origin: "reported",
      quality: "measured",
      ref: kpi.id,
    },
  };
}
