import type { OperationsRuntime } from "../services/operations/levels.ts";
import {
  feederView,
  overviewView,
  regionView,
  servicePointView,
  substationView,
  transformerView,
} from "../services/operations/levels.ts";
import { getClock, getDataNotice, getRepositories } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — OPERATIONS

   The Operations read models bound to the running adapter and
   clock. This is what the Operations screens call; they never see
   a repository, a service function or an analytics result.
========================================================== */

function runtime(): OperationsRuntime {
  const clock = getClock();
  return {
    repos: getRepositories(),
    now: clock.now,
    period: clock.reportingPeriod,
    caveats: { feederLoading: getDataNotice()?.caveats.feederLoading },
  };
}

export const operations = {
  overview: () => overviewView(runtime()),
  region: (id: string) => regionView(runtime(), id),
  substation: (id: string) => substationView(runtime(), id),
  feeder: (id: string) => feederView(runtime(), id),
  transformer: (id: string) => transformerView(runtime(), id),
  servicePoint: (id: string) => servicePointView(runtime(), id),
};

export { getDataNotice } from "./runtime.ts";
