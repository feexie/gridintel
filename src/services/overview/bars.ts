/* ==========================================================
   SERVICES — BAR SCALES

   How long each bar of a small bar chart is drawn. A screen that
   sets several rows of figures side by side as bars needs one
   scale for all of them; the scale is worked out here, so that no
   component divides one figure by another.

   A fraction is a length on the screen, not a figure: the figures
   themselves are always written beside their bars, with their
   status and origin, by the screen.

   A row is drawn only when every part has a value and none is
   below zero. Otherwise its parts are null, and the screen says
   that the row cannot be drawn and why.
========================================================== */

export interface BarPartInput {
  key: string;
  value: number | null;
}

export interface BarView {
  /** The row's id, as the screen's own rows have it. */
  id: string;
  /** Each part's length as a fraction of the longest row, in the order given; null when the row cannot be drawn. */
  parts: { key: string; fraction: number }[] | null;
  /** Why the row cannot be drawn; null when it can. */
  reason: string | null;
}

function drawable(parts: readonly BarPartInput[]): parts is readonly { key: string; value: number }[] {
  return parts.every((part) => part.value !== null && part.value >= 0);
}

/** One scale for every row: the longest drawable row is the full length. */
export function scaleBars(rows: readonly { id: string; parts: readonly BarPartInput[] }[]): BarView[] {
  let longest = 0;
  for (const row of rows) {
    if (drawable(row.parts)) longest = Math.max(longest, row.parts.reduce((sum, part) => sum + part.value, 0));
  }
  return rows.map((row) => {
    if (!drawable(row.parts)) {
      return {
        id: row.id,
        parts: null,
        reason: row.parts.some((part) => part.value === null) ? "a part has no value" : "a part is below zero, and a bar cannot show it",
      };
    }
    return { id: row.id, parts: row.parts.map((part) => ({ key: part.key, fraction: longest === 0 ? 0 : part.value / longest })), reason: null };
  });
}
