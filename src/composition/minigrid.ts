import { sitePerformance, sitePortfolio } from "../services/minigrid/performance.ts";
import { getMinigridRuntime } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — MINI-GRID

   The mini-grid services bound to the mini-grid operator's
   repositories, the clock and their own result cache. These return
   service results; the view models a screen takes are built on top
   of them with the screens (Phase 10b).
========================================================== */

export const minigrid = {
  /** Every site with its performance for the reporting period. */
  portfolio: () => {
    const runtime = getMinigridRuntime();
    return sitePortfolio({ repos: runtime.repos, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
  },
  /** One site's performance for the reporting period; null for a site that is not in the register. */
  site: (siteId: string) => {
    const runtime = getMinigridRuntime();
    return sitePerformance({ repos: runtime.repos, siteId, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
  },
};
