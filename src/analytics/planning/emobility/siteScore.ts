import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import type { HeadroomLimit } from "./headroom.ts";
import type { OptionResult, PowerOption } from "./powerSource.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: WHICH CANDIDATE SITE FIRST

   No weighted score, so no invented weights. Candidates are put in
   order by, in turn:
   1. whether the hub fits on the grid at 24 months (DT rating and
      supply hours): yes, then not known, then no;
   2. the cost per swap of the cheapest feasible option that can be
      costed on an average day (an option with no cost is never the
      cheapest). An option that draws on the grid is not feasible where
      the hub does not fit on the grid at 24 months: "not feasible
      without a DT upgrade (X kVA short)" where the DT rating fails,
      "not feasible: too few hours of supply" where the hours fail.
      None known goes last;
   3. the DT's headroom left at 24 months after the hub, the most
      first; none known goes last;
   4. the id.
   Each place carries the reasons it sits there.
========================================================== */

export const EMOBILITY_SITE_SCORE_REFERENCE: Methodology<Record<string, never>> = {
  id: "gridintel.planning.emobility-site-score",
  version: "0.1.0",
  name: "GridIntel reference order of candidate hub sites",
  description: "Candidate hubs in order of fit on the grid at 24 months, then the cheapest cost per swap of a feasible option that can be costed, then DT headroom left at 24 months, then id; no weights.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export interface SiteCandidate {
  id: string;
  fitsOnGridAt24: boolean | null;
  /** The limits that fail at 24 months: "DT rating", "supply hours"; empty when it fits. */
  limitsAt24: readonly HeadroomLimit[];
  /** Headroom left on the DT at 24 months once the hub draws, kVA; null when not known. */
  headroomLeftAt24Kva: number | null;
  options: readonly OptionResult[];
}

/** The options that draw on the grid. */
export const GRID_OPTIONS: readonly PowerOption[] = ["grid_diesel", "solar_grid", "hybrid"];

/** Why the grid options are not feasible at 24 months; null when they are (or the fit is not known). */
export function gridNotFeasible(candidate: Pick<SiteCandidate, "fitsOnGridAt24" | "limitsAt24" | "headroomLeftAt24Kva">): string | null {
  if (candidate.fitsOnGridAt24 !== false) return null;
  const parts: string[] = [];
  if (candidate.limitsAt24.includes("DT rating")) {
    const short = candidate.headroomLeftAt24Kva === null ? null : Math.max(0, -candidate.headroomLeftAt24Kva);
    parts.push(`not feasible without a DT upgrade${short === null ? "" : ` (${short.toFixed(1)} kVA short)`}`);
  }
  if (candidate.limitsAt24.includes("supply hours")) parts.push(parts.length === 0 ? "not feasible: too few hours of supply" : "too few hours of supply");
  return parts.length === 0 ? "not feasible" : parts.join("; ");
}

export interface RankedSite {
  id: string;
  rank: number;
  fitsOnGridAt24: boolean | null;
  cheapest: { option: PowerOption; costPerSwap: number } | null;
  /** Why the grid options are not feasible at 24 months; null when they are. */
  gridNotFeasible: string | null;
  headroomLeftAt24Kva: number | null;
  reasons: string[];
}

/** The cheapest feasible option that can be costed on an average day; null when none can. */
export function cheapestOption(options: readonly OptionResult[], gridFeasible = true): { option: PowerOption; costPerSwap: number } | null {
  let best: { option: PowerOption; costPerSwap: number } | null = null;
  for (const one of options) {
    if (!gridFeasible && GRID_OPTIONS.includes(one.option)) continue;
    const cost = one.days?.average.costPerSwap ?? null;
    if (cost === null) continue;
    if (best === null || cost < best.costPerSwap) best = { option: one.option, costPerSwap: cost };
  }
  return best;
}

const fitOrder = (fits: boolean | null) => (fits === true ? 0 : fits === null ? 1 : 2);
const nullLast = (a: number | null, b: number | null, ascending: boolean) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : ascending ? a - b : b - a);

export function rankSites(candidates: readonly SiteCandidate[]): RankedSite[] {
  const scored = candidates.map((one) => {
    const notFeasible = gridNotFeasible(one);
    return { ...one, notFeasible, cheapest: cheapestOption(one.options, notFeasible === null) };
  });
  scored.sort(
    (a, b) =>
      fitOrder(a.fitsOnGridAt24) - fitOrder(b.fitsOnGridAt24) ||
      nullLast(a.cheapest?.costPerSwap ?? null, b.cheapest?.costPerSwap ?? null, true) ||
      nullLast(a.headroomLeftAt24Kva, b.headroomLeftAt24Kva, false) ||
      a.id.localeCompare(b.id),
  );
  return scored.map((one, index) => {
    const reasons = [
      one.fitsOnGridAt24 === true ? "fits on the grid at 24 months" : one.fitsOnGridAt24 === false ? "does not fit on the grid at 24 months" : "fit on the grid at 24 months not known",
      ...(one.notFeasible === null ? [] : [`grid options ${one.notFeasible}`]),
      one.cheapest === null ? "no feasible option can be costed" : `cheapest feasible option: ${one.cheapest.option}`,
      one.headroomLeftAt24Kva === null ? "headroom at 24 months not known" : `headroom left at 24 months: ${one.headroomLeftAt24Kva.toFixed(0)} kVA`,
    ];
    return { id: one.id, rank: index + 1, fitsOnGridAt24: one.fitsOnGridAt24, cheapest: one.cheapest, gridNotFeasible: one.notFeasible, headroomLeftAt24Kva: one.headroomLeftAt24Kva, reasons };
  });
}
