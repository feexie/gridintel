import type { CalculatedKpi } from "../../analytics/index.ts";
import type { MetricView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — MINI-GRID: THE NAME A SHARED METHOD GOES BY

   A site's collection efficiency is calculated by the one
   collection calculation the platform has (collected ÷ billed),
   which is recorded under the methodology that also defines ATC&C
   for a distribution network. A mini-grid has no ATC&C, so on a
   site the method is shown by a name that says what it does here.

   Only the displayed name changes. The methodology's id and version
   are shown beside it exactly as the calculation recorded them.
========================================================== */

export const SITE_COLLECTION_METHOD_NAME = "GridIntel reference collection";

/** A site figure's view, with the shared collection method named for what it does on a site. */
export function siteMethodName(view: MetricView, kpi: CalculatedKpi): MetricView {
  if (kpi.metric !== "collection_efficiency" || view.method === null) return view;
  return { ...view, method: { ...view.method, name: SITE_COLLECTION_METHOD_NAME } };
}
