import type { ByYear, ReferenceBasis } from "@/domain";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: BENCHMARKS FROM REFERENCE SITES

   A benchmark is taken across the reference sites that have the
   figure: the plain mean of their figures, with the number of sites
   and their ids. With one site the benchmark is that site's figure.
   It is never called typical or national (MG-PLAN.md 3.1).
========================================================== */

export const PLANNING_YEARS = 5;
export const YEARS: readonly number[] = Array.from({ length: PLANNING_YEARS }, (_, index) => index + 1);

export interface Benchmark {
  /** null when no reference site has the figure. */
  value: number | null;
  referenceSites: number;
  referenceSiteIds: string[];
}

/** One figure across the reference sites that have it. */
export function benchmark(bases: readonly ReferenceBasis[], pick: (basis: ReferenceBasis) => number | null | undefined): Benchmark {
  const held = bases.map((basis) => ({ id: basis.siteId, value: pick(basis) })).filter((one): one is { id: string; value: number } => typeof one.value === "number" && Number.isFinite(one.value));
  return {
    value: held.length === 0 ? null : held.reduce((sum, one) => sum + one.value, 0) / held.length,
    referenceSites: held.length,
    referenceSiteIds: held.map((one) => one.id),
  };
}

/** A by-year figure across the reference sites, year n at index n − 1. */
export function benchmarkByYear(bases: readonly ReferenceBasis[], pick: (basis: ReferenceBasis) => ByYear): Benchmark[] {
  return YEARS.map((year) => benchmark(bases, (basis) => pick(basis)[year - 1]));
}

/** "1 reference site", "2 reference sites". */
export const sitesLabel = (count: number): string => `${count} reference site${count === 1 ? "" : "s"}`;
