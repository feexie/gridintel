import { reliabilityWorkspaceView } from "../services/reliability/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — RELIABILITY

   The Reliability workspace read model bound to the running adapter,
   clock and result cache.
========================================================== */

export const reliability = {
  view: () => cachedView("reliability", (runtime) => reliabilityWorkspaceView(runtime)),
};

export { isPreparing } from "./runtime.ts";
