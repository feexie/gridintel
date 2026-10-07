import type { ValuationListing } from "../services/revenue/view.ts";
import { revenueWorkspaceView } from "../services/revenue/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — REVENUE

   The Revenue workspace read model bound to the running adapter,
   clock and result cache.
========================================================== */

export const revenue = {
  /** The valuation is cut to its largest few sections by the read model unless every one is asked for. */
  view: (valuation: ValuationListing = "top") => cachedView(`revenue:${valuation}`, (runtime) => revenueWorkspaceView(runtime, valuation)),
};

export { isPreparing } from "./runtime.ts";
