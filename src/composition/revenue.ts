import { revenueWorkspaceView } from "../services/revenue/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — REVENUE

   The Revenue workspace read model bound to the running adapter,
   clock and result cache.
========================================================== */

export const revenue = {
  view: () => cachedView("revenue", (runtime) => revenueWorkspaceView(runtime)),
};

export { isPreparing } from "./runtime.ts";
