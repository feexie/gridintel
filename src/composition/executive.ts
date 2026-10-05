import type { FeederListing } from "../services/executive/view.ts";
import { executiveView } from "../services/executive/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — EXECUTIVE

   The Executive read model bound to the running adapter, clock and
   result cache.
========================================================== */

export const executive = {
  /** The money ranking is cut to its top few by the read model unless every feeder is asked for. */
  view: (feeders: FeederListing = "top") => cachedView(`executive:${feeders}`, (runtime) => executiveView(runtime, feeders)),
};

export { getDataNotice, isPreparing } from "./runtime.ts";
