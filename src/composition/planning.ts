import { nercPublishedFigures } from "../repositories/published/nerc.ts";
import { meteringFundView } from "../services/planning/metering.ts";

/* ==========================================================
   COMPOSITION — PLANNING

   The Metering planner bound to the published-figures adapter. Its
   figures are published documents, not the running dataset, so the
   view is not cached with the dataset's results; it is built for the
   assumptions in each request's address.
========================================================== */

const published = nercPublishedFigures();

export const planning = {
  meteringFund: (query: Record<string, string | string[] | undefined>) => meteringFundView(published, query),
};
