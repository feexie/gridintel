import { rmg01Reference } from "../repositories/reference/rmg01/index.ts";
import { referenceSiteIds, referenceSitesView, referenceSiteView } from "../services/minigrid/reference.ts";
import type { ReferenceSitesView, ReferenceSiteView } from "../services/minigrid/referenceViews.ts";

/* ==========================================================
   COMPOSITION — REFERENCE SITES (Phase MG-REAL)

   Real mini-grids whose records someone else published: site RMG01
   today (Kemabonta & Geoffrey 2026, CC BY 4.0, vendored unchanged).
   Public reference data, so it is served in the public
   demonstration and in a tenant deployment alike, read-only, and
   behind no organization's gate; it is never added to an
   organization's own records or totals (Founder, 24 November 2026).

   The published files do not change while the process runs, so each
   view is built once per process.
========================================================== */

const repo = rmg01Reference();
let sites: Promise<ReferenceSitesView> | null = null;
const site = new Map<string, Promise<ReferenceSiteView | null>>();

/* A failed build is not kept: the next call builds again. */
const keep = <T>(promise: Promise<T>, forget: () => void): Promise<T> =>
  promise.catch((error: unknown) => {
    forget();
    throw error;
  });

export const reference = {
  /** Every reference site, as cards for the Sites screen. */
  sitesView: (): Promise<ReferenceSitesView> => (sites ??= keep(referenceSitesView(repo), () => (sites = null))),
  /** One reference site in full; null for a site that is not held. */
  siteView: (siteId: string): Promise<ReferenceSiteView | null> => {
    let found = site.get(siteId);
    if (!found) site.set(siteId, (found = keep(referenceSiteView(repo, siteId), () => site.delete(siteId))));
    return found;
  },
  /** Every reference site's id, for building its page ahead of time. */
  siteIds: () => referenceSiteIds(repo),
};
