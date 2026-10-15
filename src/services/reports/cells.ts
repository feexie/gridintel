import type { MethodView, MetricUnit, MetricView } from "../operations/views.ts";
import type { ReportCell } from "./views.ts";

/* ==========================================================
   SERVICES — REPORT CELLS

   A report table holds figures, words and instants. A figure that a
   read model gives as a bare number (a breakdown's SAIDI, a tier's
   billed revenue) is given here the status and origin it already
   has, and the method it was calculated under. No value is changed.
========================================================== */

export function figure(metric: MetricView): ReportCell {
  return { kind: "figure", metric };
}

export function text(words: string): ReportCell {
  return { kind: "text", text: words };
}

export function time(iso: string | null, missing = "Not recorded"): ReportCell {
  return { kind: "time", iso, missing: iso === null ? missing : null };
}

/**
 * A value a read model calculated and gives as a bare number. Missing is "insufficient data",
 * never zero.
 */
export function calculated(
  label: string,
  value: number | null,
  unit: MetricUnit,
  method: MethodView | null,
  options: { derivation?: string; note?: string | null; currency?: string | null; missing?: string } = {},
): MetricView {
  return {
    label,
    value,
    unit,
    currency: options.currency ?? null,
    status: value === null ? "insufficient_data" : "ok",
    origin: "calculated",
    derivation: options.derivation ?? null,
    method,
    inputs: [],
    estimatedInputs: [],
    missingInputs: value === null && options.missing ? [options.missing] : [],
    warnings: [],
    note: options.note ?? null,
  };
}

/** A count of records: interruptions that began somewhere, days that met a band. Counted, not measured. */
export function counted(label: string, value: number | null, derivation: string, note: string | null = null): MetricView {
  return { ...calculated(label, value, "count", null, { derivation, note }), derivation };
}

/** The same figure under another label, for a table column. */
export function relabel(metric: MetricView, label: string): MetricView {
  return { ...metric, label };
}
