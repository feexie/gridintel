import { eventsWorkspaceView } from "../services/events/view.ts";
import { cachedView } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — EVENTS / ALARMS

   The Events / Alarms workspace read model bound to the running
   adapter, clock and result cache.
========================================================== */

export const events = {
  view: () => cachedView("events", (runtime) => eventsWorkspaceView(runtime)),
};

export { isPreparing } from "./runtime.ts";
