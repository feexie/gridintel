import { executiveView } from "../services/executive/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — EXECUTIVE

   The Executive read model bound to the running adapter, clock and
   result cache.
========================================================== */

export const executive = {
  view: () => cachedView("executive", (runtime) => executiveView(runtime)),
};

export { getDataNotice } from "./runtime.ts";
