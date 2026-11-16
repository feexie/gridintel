import { createSyntheticEmobility } from "../repositories/demo/emobility.ts";
import { nercPublishedFigures } from "../repositories/published/nerc.ts";
import { emobilityView } from "../services/planning/emobility.ts";
import type { EmobilityView } from "../services/planning/emobilityViews.ts";
import { getRuntime } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — THE E-MOBILITY PLANNER (EMOB-A)

   The planner bound to the synthetic e-mobility hubs, the running
   network (synthetic today) and the published NERC tariffs. Nothing
   in it changes while the process runs, so the view is built once
   per process. No screen uses it yet: the screens are EMOB-B.
========================================================== */

const records = createSyntheticEmobility();
const published = nercPublishedFigures();
let view: Promise<EmobilityView> | null = null;

export const emobility = {
  /** The five questions for the synthetic hubs: demand, sites and headroom, power source, finance, verify. */
  view: async (): Promise<EmobilityView> => (view ??= getRuntime().then((runtime) => emobilityView(runtime, published, records))),
};
