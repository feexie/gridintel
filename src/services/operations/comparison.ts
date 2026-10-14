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

/** A reported figure agrees with the records when it is within this fraction of the reported value. Every sector uses the same. */
export const AGREEMENT_TOLERANCE = 0.01;

/** True when a reported figure is on the same basis as the calculation and further from it than the tolerance. */
export function rowDiffers(row: Pick<ReportedComparisonView, "comparable" | "variance" | "relativeVariance">): boolean {
  // A claim of zero has no relative difference: any difference from it counts.
  return row.comparable && (row.relativeVariance === null ? row.variance !== null && row.variance !== 0 : Math.abs(row.relativeVariance) > AGREEMENT_TOLERANCE);
}

/** Largest difference relative to the reported figure first; a claim of zero that differs before any other. */
export function byLargestDifference(a: Pick<ReportedComparisonView, "relativeVariance">, b: Pick<ReportedComparisonView, "relativeVariance">): number {
  const size = (row: Pick<ReportedComparisonView, "relativeVariance">) => (row.relativeVariance === null ? Number.POSITIVE_INFINITY : Math.abs(row.relativeVariance));
  return size(b) - size(a);
}

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
