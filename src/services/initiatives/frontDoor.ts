import { demoWorkspaceId, initiativeHref, railHref, roleHref, routeOf, workspaceHref, workspaceInitiativeHref } from "../../constants/frontDoor.ts";
import { INITIATIVES, initiativeOf, initiativesFor, roleFor, type Initiative, type InitiativeFigureId } from "../../constants/initiatives.ts";
import { railFor, reportsHrefFor, viewOf, WORKSPACE_TYPE_LABELS, type RailItemId, type ViewId, type WorkspaceType } from "../../constants/workspaces.ts";
import type {
  InitiativeCardView,
  InitiativeFigureView,
  PublicRoleView,
  RailItemPageView,
  RolePickerView,
  SignInHandoffView,
  ViewLinkView,
  WorkspaceFrameView,
  WorkspaceHomeView,
  WorkspaceInitiativeView,
  WorkspaceSummaryView,
} from "./views.ts";

/* ==========================================================
   SERVICES — THE FRONT DOOR AND THE WORKSPACE SHELL (ADR 0021)

   Builds the view models of the public layer (Home, the role
   picker, a public role's page, the sign-in hand-off) and of a
   workspace's frame (header, switcher, rail) from the catalogues
   and the resolved figures. Pure: the figures and the workspaces
   are given; no clock, no I/O.

   A workspace here is an organization as the front door shows it
   (in code, the Organization of ADR 0020). In NAV-A only demo
   workspaces exist: read-only, synthetic, badged DEMO.
========================================================== */

export type Figures = Record<InitiativeFigureId, InitiativeFigureView>;

/** An organization as a workspace: what its header needs. Branding decides nothing about access. */
export interface WorkspaceRecord {
  id: string;
  name: string;
  type: WorkspaceType;
  /** An image address; null for the GridIntel fallback. */
  logo: string | null;
  demo: boolean;
  synthetic: boolean;
  /** The DisCo whose queue of meter applications the workspace holds (a Utility workspace); null for any other. */
  disco: string | null;
}

function card(initiative: Initiative, figures: Figures, href: string): InitiativeCardView {
  return {
    id: initiative.id,
    title: initiative.title,
    summary: initiative.summary,
    href,
    headline: figures[initiative.headline],
    progress: initiative.progress === undefined ? null : figures[initiative.progress],
    secondary: initiative.secondary === undefined ? null : figures[initiative.secondary],
  };
}

/** The cards of the public Home, in the catalogue's order. */
export function publicCards(figures: Figures): InitiativeCardView[] {
  return INITIATIVES.map((initiative) => card(initiative, figures, initiativeHref(initiative.id)));
}

/** "Who are you?": the roles an initiative defines; null for an unknown initiative. */
export function rolePicker(initiativeId: string): RolePickerView | null {
  const initiative = initiativeOf(initiativeId);
  if (initiative === undefined) return null;
  return {
    id: initiative.id,
    title: initiative.title,
    summary: initiative.summary,
    roles: initiative.roles.map((role) => ({ id: role.id, label: role.label, description: role.description, audience: role.audience, href: roleHref(initiative.id, role.id) })),
  };
}

/** Where a role's page sends the visitor: a public view, or the sign-in hand-off. Null when the initiative or role is unknown. */
export function rolePage(
  initiativeId: string,
  roleId: string,
  workspaces: readonly WorkspaceRecord[],
  signInHref: string | null,
): { kind: "public"; view: PublicRoleView } | { kind: "sign-in"; view: SignInHandoffView } | null {
  const initiative = initiativeOf(initiativeId);
  const role = initiative?.roles.find((one) => one.id === roleId);
  if (initiative === undefined || role === undefined) return null;
  const route = routeOf(initiative, role);
  if (route.kind === "public") return { kind: "public", view: { initiativeId: initiative.id, initiativeTitle: initiative.title, roleLabel: role.label, view: route.view } };
  const demo = workspaces.find((one) => one.id === demoWorkspaceId(route.workspaceType));
  return {
    kind: "sign-in",
    view: {
      initiativeId: initiative.id,
      initiativeTitle: initiative.title,
      roleLabel: role.label,
      workspaceType: route.workspaceType,
      workspaceTypeLabel: WORKSPACE_TYPE_LABELS[route.workspaceType],
      signInHref,
      demoHref: route.demoHref,
      demoName: demo?.name ?? `Demonstration ${WORKSPACE_TYPE_LABELS[route.workspaceType]} (synthetic)`,
    },
  };
}

/** Up to two capital letters from the name, leaving out what is in brackets: "Savanna Electricity Distribution (synthetic)" → "SE". */
export function initialsOf(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").split(/\s+/).filter((word) => /^[A-Za-z]/.test(word));
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "GI";
}

function summary(workspace: WorkspaceRecord): WorkspaceSummaryView {
  return {
    id: workspace.id,
    name: workspace.name,
    initials: initialsOf(workspace.name),
    logo: workspace.logo,
    type: workspace.type,
    typeLabel: WORKSPACE_TYPE_LABELS[workspace.type],
    demo: workspace.demo,
    synthetic: workspace.synthetic,
    href: workspaceHref(workspace.id),
  };
}

/** The header, switcher and rail of a workspace; null for a workspace that is not among those given. */
export function workspaceFrame(workspaceId: string, workspaces: readonly WorkspaceRecord[]): WorkspaceFrameView | null {
  const current = workspaces.find((one) => one.id === workspaceId);
  if (current === undefined) return null;
  return {
    current: summary(current),
    others: workspaces.filter((one) => one.id !== workspaceId).map(summary),
    rail: railFor(current.type).map((entry) => ({ item: entry.item, label: entry.label, question: entry.question, href: railHref(current.id, entry.item) })),
    reportsHref: reportsHrefFor(current.type),
  };
}

function link(id: ViewId): ViewLinkView {
  const view = viewOf(id);
  return { id: view.id, label: view.label, question: view.question, href: view.current, planned: view.planned === true };
}

/** A workspace's Home: the initiatives its type takes part in. */
export function workspaceHome(workspace: WorkspaceRecord, figures: Figures): WorkspaceHomeView {
  return { workspace: summary(workspace), cards: initiativesFor(workspace.type).map((initiative) => card(initiative, figures, workspaceInitiativeHref(workspace.id, initiative.id))) };
}

/** An initiative as a workspace sees it: its card and the views it shows that type; null when the type has no role in it. */
export function workspaceInitiative(workspace: WorkspaceRecord, initiativeId: string, figures: Figures): WorkspaceInitiativeView | null {
  const initiative = initiativeOf(initiativeId);
  const role = initiative === undefined ? undefined : roleFor(initiative, workspace.type);
  if (initiative === undefined || role === undefined) return null;
  return { workspace: summary(workspace), card: card(initiative, figures, workspaceInitiativeHref(workspace.id, initiative.id)), roleLabel: role.label, views: role.views.map(link) };
}

/** A rail item of a workspace: its views, and the one shown inside the shell; null when the type's rail has no such item. */
export function railItemPage(workspace: WorkspaceRecord, item: string): RailItemPageView | null {
  const entry = railFor(workspace.type).find((one) => one.item === item && one.item !== "home");
  if (entry === undefined) return null;
  return { workspace: summary(workspace), item: entry.item as RailItemId, label: entry.label, question: entry.question, views: entry.views.map(link), filled: entry.filled ?? null };
}
