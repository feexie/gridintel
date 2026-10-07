import type { TransformerListing } from "../services/assets/view.ts";
import { assetsWorkspaceView } from "../services/assets/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — ASSETS

   The Assets workspace read model bound to the running adapter,
   clock and result cache.
========================================================== */

export const assets = {
  /** The distribution-transformer table is cut to its most loaded few by the read model unless every one is asked for. */
  view: (transformers: TransformerListing = "top") => cachedView(`assets:${transformers}`, (runtime) => assetsWorkspaceView(runtime, transformers)),
};

export { isPreparing } from "./runtime.ts";
