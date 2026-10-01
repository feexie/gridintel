import type { ReportedKpi } from "@/domain";
import type { Dimension, InputValue, MonetaryInput } from "../../analytics/index.ts";
import { dimensionOf } from "../../analytics/index.ts";

/* ==========================================================
   SERVICES — REPORTED FIGURES AS CALCULATION INPUTS

   Changes a ReportedKpi's format into an analytics input. No
   arithmetic and no unit conversion: the value and unit are passed
   on exactly as reported, and the input stays tagged
   origin "reported", so every result that uses it says so.

   Quality is "measured", following Phase 3: the figure is used as
   stated, with nothing estimated or substituted; that it is a
   reported rather than an observed value is carried by `origin`.
========================================================== */

export type Conversion<T> = { ok: true; input: T } | { ok: false; reason: string };

export function reportedInput(kpi: ReportedKpi, dimension: Dimension): Conversion<InputValue> {
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
    input: { value: kpi.value, unit: kpi.unit, origin: "reported", quality: "measured", ref: kpi.id },
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
