import {
  feederView,
  overviewView,
  regionView,
  servicePointView,
  substationView,
  transformerView,
} from "../services/operations/levels.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — OPERATIONS

   The Operations read models bound to the running adapter, clock
   and result cache. This is what the Operations screens call; they
   never see a repository, a service function or an analytics result.
========================================================== */

export const operations = {
  overview: () => cachedView("operations", (runtime) => overviewView(runtime)),
  region: (id: string) => cachedView(`region:${id}`, (runtime) => regionView(runtime, id)),
  substation: (id: string) => cachedView(`substation:${id}`, (runtime) => substationView(runtime, id)),
  feeder: (id: string) => cachedView(`feeder:${id}`, (runtime) => feederView(runtime, id)),
  transformer: (id: string) => cachedView(`transformer:${id}`, (runtime) => transformerView(runtime, id)),
  servicePoint: (id: string) => cachedView(`service-point:${id}`, (runtime) => servicePointView(runtime, id)),
};

export { getDataNotice } from "./runtime.ts";
