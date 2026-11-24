/* ==========================================================
   THE FRONT DOOR'S ADDRESSES AND ROUTING (ADR 0021, draft)

   Phase NAV-A: the public layer and the demo workspaces live under
   /preview, on the public demonstration only. Nothing here replaces
   "/" or "/dashboard".

   Where a role is sent is decided here and nowhere else:
   - a public role goes straight to its public view;
   - an organization role goes to the sign-in hand-off, which offers
     signing in (the tenant deployment's sign-in page, set in
     configuration) or the demo workspace of its type, landing on
     that initiative's place in it.

   Pure functions of the catalogues: no clock, no I/O.
========================================================== */

import { initiativeOf, type Initiative, type InitiativeRole, type Landing, type PublicViewId } from "./initiatives.ts";
import type { RailItemId, WorkspaceType } from "./workspaces.ts";

export const PREVIEW_HOME = "/preview";
export const TRACK_PATH = `${PREVIEW_HOME}/track`;

export const initiativeHref = (initiativeId: string) => `${PREVIEW_HOME}/initiatives/${initiativeId}`;
export const roleHref = (initiativeId: string, roleId: string) => `${initiativeHref(initiativeId)}/${roleId}`;

/** The id of the demo workspace of a type: one per type (ADR 0021, decision 6). */
export const demoWorkspaceId = (type: WorkspaceType) => `demo-${type}`;
export const workspaceHref = (workspaceId: string) => `${PREVIEW_HOME}/workspace/${workspaceId}`;
export const railHref = (workspaceId: string, item: RailItemId) => (item === "home" ? workspaceHref(workspaceId) : `${workspaceHref(workspaceId)}/${item}`);
export const workspaceInitiativeHref = (workspaceId: string, initiativeId: string) => `${workspaceHref(workspaceId)}/initiatives/${initiativeId}`;

export function landingHref(workspaceId: string, initiativeId: string, landing: Landing): string {
  return landing.kind === "rail" ? railHref(workspaceId, landing.item) : workspaceInitiativeHref(workspaceId, initiativeId);
}

export type RoleRoute =
  | { kind: "public"; view: PublicViewId; href: string }
  | {
      kind: "sign-in";
      href: string;
      workspaceType: WorkspaceType;
      /** Where a signed-in member lands, inside their own workspace (NAV-B). */
      landing: Landing;
      /** The demo workspace of this type, at the same place. */
      demoHref: string;
    };

export function routeOf(initiative: Initiative, role: InitiativeRole): RoleRoute {
  const href = roleHref(initiative.id, role.id);
  if (role.audience === "public") return { kind: "public", view: role.view, href };
  return { kind: "sign-in", href, workspaceType: role.workspaceType, landing: role.landing, demoHref: landingHref(demoWorkspaceId(role.workspaceType), initiative.id, role.landing) };
}

/** Where a role of an initiative is sent; null when either is unknown. */
export function routeFor(initiativeId: string, roleId: string): RoleRoute | null {
  const initiative = initiativeOf(initiativeId);
  const role = initiative?.roles.find((one) => one.id === roleId);
  return initiative === undefined || role === undefined ? null : routeOf(initiative, role);
}

/** Nigeria's 36 states and the FCT, for the public pages' state pickers: reference geography, not a record. */
export const NIGERIAN_STATES: readonly string[] = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun",
  "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
