/* ==========================================================
   INITIATIVES (ADR 0021, draft)

   An initiative is a named piece of work, shown as a card on Home.
   Each one is an entry here: a new initiative is a new entry and
   needs no new screen.

   The catalogue holds NO FIGURE. A card's headline, its progress
   bar and its count of pending applications are named by id and
   resolved by a service (src/services/initiatives) into a figure
   with its status and origin. Where no service supports a figure,
   the card shows its status instead of a number.

   Card titles carry no city.
========================================================== */

import type { RailItemId, ViewId, WorkspaceType } from "./workspaces.ts";

/** Figures a card may show, each resolved by the initiatives service. */
export type InitiativeFigureId = "metering.national-rate" | "metering.pending-applications" | "charging.hubs" | "minigrid.sites-agreeing";

/** The public views a public role is sent to. */
export type PublicViewId = "meter-application" | "charging-network" | "minigrid-summary";

/** Where an organization role lands once in its workspace: a rail item, or the initiative's own page there. */
export type Landing = { kind: "rail"; item: RailItemId } | { kind: "initiative" };

type RoleBase = { id: string; label: string; description: string };

export type PublicRole = RoleBase & { audience: "public"; view: PublicViewId };

export type OrganizationRole = RoleBase & {
  audience: "organization";
  workspaceType: WorkspaceType;
  landing: Landing;
  /** The views this initiative shows a workspace of this type, on the initiative's page inside it. */
  views: readonly ViewId[];
};

export type InitiativeRole = PublicRole | OrganizationRole;

export type Initiative = {
  id: string;
  title: string;
  summary: string;
  headline: InitiativeFigureId;
  /** Shown as a bar under the headline, when the service gives a share for it. */
  progress?: InitiativeFigureId;
  /** A second, smaller figure on the card. */
  secondary?: InitiativeFigureId;
  roles: readonly InitiativeRole[];
};

export const INITIATIVES: readonly Initiative[] = [
  {
    id: "meter-every-customer",
    title: "Meter every customer",
    summary: "Every customer metered, with no upfront payment: apply, be verified and assigned, be funded, be installed.",
    headline: "metering.national-rate",
    progress: "metering.national-rate",
    secondary: "metering.pending-applications",
    roles: [
      { id: "customer", label: "Customer", description: "I want a meter for my home or business.", audience: "public", view: "meter-application" },
      {
        id: "utility",
        label: "Distribution utility (DisCo)",
        description: "I review, assign and approve applications in my network.",
        audience: "organization",
        workspaceType: "utility",
        landing: { kind: "initiative" },
        views: ["initiative.applications", "initiative.journey", "plan.metering-allocation", "plan.dt-sequencing", "finance.metering-fund"],
      },
      {
        id: "der",
        label: "DER company",
        description: "I install and operate meters or distributed energy for customers.",
        audience: "organization",
        workspaceType: "der",
        landing: { kind: "initiative" },
        views: ["initiative.journey"],
      },
      {
        id: "financier",
        label: "Financier",
        description: "I fund meters and am repaid from customers' purchases.",
        audience: "organization",
        workspaceType: "financier",
        landing: { kind: "rail", item: "finance" },
        views: ["finance.marketplace", "finance.metering-fund", "finance.pipeline"],
      },
      {
        id: "regulator",
        label: "Regulator",
        description: "I oversee the metering programme across the DisCos.",
        audience: "organization",
        workspaceType: "regulator",
        landing: { kind: "initiative" },
        views: ["oversight.monitoring"],
      },
    ],
  },
  {
    id: "charging-hubs",
    title: "Charging hubs",
    summary: "Charging and battery-swap hubs for electric motorcycles and tricycles, sited where the network can carry them.",
    headline: "charging.hubs",
    roles: [
      { id: "end-user", label: "Rider or fleet owner", description: "I want to find a charging or swap hub near me.", audience: "public", view: "charging-network" },
      {
        id: "utility",
        label: "Distribution utility (DisCo)",
        description: "I see where hubs are coming and the load they add to my network.",
        audience: "organization",
        workspaceType: "utility",
        landing: { kind: "rail", item: "plan" },
        views: ["plan.charging-hubs"],
      },
      {
        id: "der",
        label: "DER company or hub operator",
        description: "I plan, power and run charging hubs.",
        audience: "organization",
        workspaceType: "der",
        landing: { kind: "rail", item: "plan" },
        views: ["plan.charging-hubs"],
      },
    ],
  },
  {
    id: "minigrid-verification",
    title: "Mini-grid verification",
    summary: "Each mini-grid's reported results checked against its own records.",
    headline: "minigrid.sites-agreeing",
    progress: "minigrid.sites-agreeing",
    roles: [
      { id: "public", label: "Member of the public", description: "I want to see the summary figures.", audience: "public", view: "minigrid-summary" },
      {
        id: "minigrid",
        label: "Mini-grid operator",
        description: "I run sites and report on them.",
        audience: "organization",
        workspaceType: "minigrid",
        landing: { kind: "rail", item: "intelligence" },
        views: ["minigrid.sites"],
      },
      {
        id: "financier",
        label: "Financier or programme",
        description: "I fund mini-grids and pay on verified results.",
        audience: "organization",
        workspaceType: "financier",
        landing: { kind: "initiative" },
        views: ["minigrid.sites"],
      },
      {
        id: "regulator",
        label: "Regulator",
        description: "I check that operators deliver what they report.",
        audience: "organization",
        workspaceType: "regulator",
        landing: { kind: "initiative" },
        views: ["minigrid.sites"],
      },
    ],
  },
];

export function initiativeOf(id: string): Initiative | undefined {
  return INITIATIVES.find((initiative) => initiative.id === id);
}

/** The initiatives a workspace type takes part in: those with a role for it. */
export function initiativesFor(type: WorkspaceType): Initiative[] {
  return INITIATIVES.filter((initiative) => initiative.roles.some((role) => role.audience === "organization" && role.workspaceType === type));
}

/** The role of a workspace type in an initiative; undefined when it has none. */
export function roleFor(initiative: Initiative, type: WorkspaceType): OrganizationRole | undefined {
  return initiative.roles.find((role): role is OrganizationRole => role.audience === "organization" && role.workspaceType === type);
}
