import { executiveView } from "../services/executive/view.ts";
import { getClock, getDataNotice, getRepositories } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — EXECUTIVE

   The Executive read model bound to the running adapter and clock.
========================================================== */

export const executive = {
  view: () => {
    const clock = getClock();
    return executiveView({
      repos: getRepositories(),
      now: clock.now,
      period: clock.reportingPeriod,
      caveats: { feederLoading: getDataNotice()?.caveats.feederLoading },
    });
  },
};

export { getDataNotice } from "./runtime.ts";
