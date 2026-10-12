import { sitePerformance, sitePortfolio } from "../services/minigrid/performance.ts";
import { minigridPortfolioView, minigridSiteIds, minigridSiteView } from "../services/minigrid/view.ts";
import { getMinigridRuntime } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — MINI-GRID

   The mini-grid services bound to the mini-grid operator's
   repositories, the clock and their own result cache: the two read
   models the Mini-grid screens take, and the service results under
   them.
========================================================== */

export const minigrid = {
  /** The Mini-grid workspace: the sites side by side, and what stands out. */
  portfolioView: () => minigridPortfolioView(getMinigridRuntime()),
  /** One site in full; null for a site that is not in the register. */
  siteView: (siteId: string) => minigridSiteView(getMinigridRuntime(), siteId),
  /** Every site's id, for building the site screens ahead of time. */
  siteIds: () => minigridSiteIds(getMinigridRuntime()),
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
