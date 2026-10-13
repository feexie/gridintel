import type { KpiComparison } from "../../analytics/index.ts";
import type { ReportedComparisonView } from "./views.ts";

/* ==========================================================
   SERVICES — WHAT IS SAID ONCE ABOUT A TABLE OF COMPARISONS

   That a report's methodology has not been verified as equivalent
   to the reference one is true of the report, not of one figure.
   Analytics records it on every comparison, as it must; a table of
   comparisons says it once, above the rows, and no row repeats it.

   A row keeps the name of the unverified methodology, so that rows
   gathered from several scopes can still be given one note.
========================================================== */

const NOT_VERIFIED = "METHODOLOGY_NOT_VERIFIED";

/** A comparison's caveats for its row, with the unverified methodology kept apart for the table's note. */
export function comparisonCaveats(comparison: Pick<KpiComparison, "issues" | "reported">): Pick<ReportedComparisonView, "caveats" | "unverifiedMethodology"> {
  const unverified = comparison.issues.some((issue) => issue.code === NOT_VERIFIED);
  return {
    caveats: comparison.issues.filter((issue) => !issue.blocking && issue.code !== NOT_VERIFIED).map((issue) => issue.message),
    unverifiedMethodology: unverified ? (comparison.reported.methodology?.name ?? null) : null,
  };
}

/** The note above a table of comparisons; null when no row states a methodology. */
export function comparisonNote(rows: readonly Pick<ReportedComparisonView, "unverifiedMethodology">[]): string | null {
  const stated = rows.flatMap((row) => row.unverifiedMethodology ?? []);
  if (stated.length === 0) return null;
  const names = [...new Set(stated)].map((name) => `"${name}"`).join(", ");
  const reach = stated.length === rows.length ? "This applies to every figure below." : `This applies to the ${stated.length} of ${rows.length} figures below that state a methodology.`;
  return `The report's methodology (${names}) has not been verified as equivalent to the GridIntel reference methods the calculations use. ${reach}`;
}
