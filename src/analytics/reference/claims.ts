/* ==========================================================
   ANALYTICS — A PUBLISHER'S FIGURE AGAINST GRIDINTEL'S CALCULATION

   A publisher states a figure to a number of decimals. The
   calculation agrees when it rounds to the same figure at those
   decimals: 0.17929 agrees with a stated 0.179, 0.1784 does not.
   Nothing is tuned to agree; a difference is shown as found.
========================================================== */

export type ClaimStanding = "agrees" | "differs" | "not_calculable";

export function claimStanding(stated: number, decimals: number, calculated: number | null): ClaimStanding {
  if (calculated === null) return "not_calculable";
  const scale = 10 ** decimals;
  return Math.round(calculated * scale) === Math.round(stated * scale) ? "agrees" : "differs";
}
