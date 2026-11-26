/* ==========================================================
   THE FRONT DOOR'S ADDRESSES AND ROUTING (ADR 0021)

   NAV-B step 7: the public layer is at "/", on the public
   demonstration only: Home, an initiative's own page with Take part,
   "Who are you?" under it, and Track. The demo workspaces are the
   dashboard itself, the demo workspace named by ?workspace= on the
   link (views.ts, safeguard C). The prototype's /preview addresses
   redirect here (moves.ts).

   Where a role is sent is decided here and nowhere else:
   - a public role goes straight to its public view;
   - an organization role goes to the sign-in hand-off, which offers
     signing in (the tenant deployment's sign-in page, set in
     configuration) or the demo workspace of its type, landing on
     that initiative's place in it.

   Pure functions of the catalogues: no clock, no I/O.
========================================================== */

import { initiativeOf, type Initiative, type InitiativeRole, type Landing, type PublicViewId } from "./initiatives.ts";
import { DEMO_WORKSPACE_QUERY, demoWorkspaceType, hrefOf, landingOf, WORKSPACE_TYPES, type RailItemId, type WorkspaceType } from "./views.ts";

/** Home of the public layer. */
export const PUBLIC_HOME = "/";
export const TRACK_PATH = "/track";

/** An initiative's own public page (brief 3c.1). */
export const initiativeHref = (initiativeId: string) => `/initiatives/${initiativeId}`;
/** "Who are you?", one step from the initiative's page. */
export const takePartHref = (initiativeId: string) => `${initiativeHref(initiativeId)}/take-part`;
export const roleHref = (initiativeId: string, roleId: string) => `${takePartHref(initiativeId)}/${roleId}`;

/** The id of the demo workspace of a type: one per type (ADR 0021, decision 6). */
export const demoWorkspaceId = (type: WorkspaceType) => `demo-${type}`;
/** The type of a demo workspace's id; the default for any other id. */
const typeOfWorkspace = (workspaceId: string): WorkspaceType => demoWorkspaceType(WORKSPACE_TYPES.find((type) => demoWorkspaceId(type) === workspaceId) ?? null);
/** A dashboard address, shown in a demo workspace: ?workspace= names it (read only on the demonstration). */
const inDemo = (href: string, workspaceId: string) => `${href}?${DEMO_WORKSPACE_QUERY}=${typeOfWorkspace(workspaceId)}`;
export const workspaceHref = (workspaceId: string) => inDemo(hrefOf("platform.home"), workspaceId);
export const railHref = (workspaceId: string, item: RailItemId) => {
  const landing = landingOf(typeOfWorkspace(workspaceId), item);
  return landing === null ? workspaceHref(workspaceId) : inDemo(hrefOf(landing), workspaceId);
};
export const workspaceInitiativeHref = (workspaceId: string, initiativeId: string) => inDemo(hrefOf("initiative.home", initiativeId), workspaceId);

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
