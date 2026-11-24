import { createSyntheticPlannedCommunities } from "../repositories/demo/minigridPlanning.ts";
import { minigridPlanView } from "../services/planning/minigrid.ts";
import type { MinigridPlanView } from "../services/planning/minigridViews.ts";
import { referenceRepository } from "./reference.ts";

/* ==========================================================
   COMPOSITION — THE MINI-GRID PLANNER (MG-PLAN-A)

   The planner bound to the synthetic planned community and the
   reference sites (real, published). Nothing in it changes while the
   process runs, so the view is built once per process. No screen
   uses it yet: the screens follow NAV-B.
========================================================== */

const communities = createSyntheticPlannedCommunities();
let view: Promise<MinigridPlanView | null> | null = null;

export const minigridPlanning = {
  /** The plan for the synthetic community, on the reference sites. */
  view: (): Promise<MinigridPlanView | null> =>
    (view ??= minigridPlanView(communities, referenceRepository).catch((error: unknown) => {
      view = null;
      throw error;
    })),
};
