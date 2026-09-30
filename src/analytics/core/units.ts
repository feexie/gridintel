import type { KpiUnit } from "@/domain";

/* ==========================================================
   ANALYTICS — UNITS

   Conversions are explicit and only allowed within one physical
   dimension. Converting across dimensions returns null; it never
   guesses.
========================================================== */

export type Dimension =
  | "energy"
  | "active_power"
  | "apparent_power"
  | "ratio"
  | "duration"
  | "count"
  | "interruption_frequency"
  | "currency";

const UNITS: Record<KpiUnit, { dimension: Dimension; toBase: number }> = {
  kWh: { dimension: "energy", toBase: 1 },
  MWh: { dimension: "energy", toBase: 1000 },
  kW: { dimension: "active_power", toBase: 1 },
  MW: { dimension: "active_power", toBase: 1000 },
  kVA: { dimension: "apparent_power", toBase: 1 },
  MVA: { dimension: "apparent_power", toBase: 1000 },
  fraction: { dimension: "ratio", toBase: 1 },
  percent: { dimension: "ratio", toBase: 0.01 },
  minutes: { dimension: "duration", toBase: 1 },
  hours: { dimension: "duration", toBase: 60 },
  count: { dimension: "count", toBase: 1 },
  interruptions_per_customer: { dimension: "interruption_frequency", toBase: 1 },
  // Currency amounts carry their own currency code and scale (see MonetaryInput);
  // the unit alone never converts one currency into another.
  currency: { dimension: "currency", toBase: 1 },
};

export function dimensionOf(unit: KpiUnit): Dimension {
  return UNITS[unit].dimension;
}

/** Converts `value` from one unit to another, or returns null if the dimensions differ. */
export function convertUnit(value: number, from: KpiUnit, to: KpiUnit): number | null {
  const source = UNITS[from];
  const target = UNITS[to];
  if (source.dimension !== target.dimension) return null;
  return (value * source.toBase) / target.toBase;
}
