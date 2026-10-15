import type { RevenueGapRow } from "../operations/views.ts";
import type { BarView } from "../overview/bars.ts";
import { scaleBars } from "../overview/bars.ts";

/** The revenue gap of each section as a bar of its two parts, commercial then collection, on one scale. Never netted. */
export function gapBars(rows: readonly RevenueGapRow[]): BarView[] {
  return scaleBars(
    rows.map((row) => ({
      id: row.id,
      parts: [
        { key: "commercial", value: row.commercial.value },
        { key: "collection", value: row.collection.value },
      ],
    })),
  );
}
