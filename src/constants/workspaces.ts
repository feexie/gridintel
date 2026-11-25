/* ==========================================================
   WORKSPACES AND THEIR RAIL (ADR 0021)

   A workspace is an organization's branded environment; in code it
   is the Organization (the tenant of ADR 0020). Its type decides the
   rail it is given. The workspace types, the rail items and which
   views each type's rail lists are held with the views, in the one
   catalogue (views.ts), and re-exported here.

   Pure data and pure functions: no figure, no clock, no I/O.
========================================================== */

import { hrefOf, RAIL_ITEMS, RAILS, type RailEntry, type WorkspaceType } from "./views.ts";

export { RAIL_ITEMS, RAILS, VIEWS, viewOf, WORKSPACE_TYPE_LABELS, WORKSPACE_TYPES } from "./views.ts";
export type { RailEntry, RailItemId, View, ViewId, WorkspaceType } from "./views.ts";

/** The rail of a workspace type, with each item's label and question. */
export function railFor(type: WorkspaceType): (RailEntry & { label: string; question: string })[] {
  return RAILS[type].map((entry) => {
    const item = RAIL_ITEMS.find((one) => one.id === entry.item)!;
    return { ...entry, label: item.label, question: item.question };
  });
}

/** Where every workspace's reports are listed today (ADR 0019). Reports are login-only: never on a public page. */
export function reportsHrefFor(type: WorkspaceType): string {
  if (type === "utility") return hrefOf("utility.reports");
  if (type === "minigrid") return hrefOf("minigrid.reports");
  return hrefOf("platform.reports");
}
