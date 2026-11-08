import { demoWorkspaceId } from "../constants/frontDoor.ts";
import { createSyntheticMarketplace } from "../repositories/demo/marketplace.ts";
import { nercPublishedFigures } from "../repositories/published/nerc.ts";
import { initiativesFor } from "../constants/initiatives.ts";
import { railFor } from "../constants/workspaces.ts";
import { initiativeFigures, minigridSummary } from "../services/initiatives/figures.ts";
import { DISCO_NAMES } from "../services/planning/metering.ts";
import { publicCards, railItemPage, rolePage, rolePicker, workspaceFrame, workspaceHome, workspaceInitiative, type WorkspaceRecord } from "../services/initiatives/frontDoor.ts";
import { TENANT_ORGANIZATIONS } from "./identityFixture.ts";
import { minigrid } from "./minigrid.ts";
import { deploymentMode } from "./mode.ts";
import { DEMO_ORGANIZATION_ID } from "../repositories/demo/sources.ts";
import { MINIGRID_ORGANIZATION_ID } from "../repositories/demo/minigrid/design.ts";

/* ==========================================================
   COMPOSITION — THE FRONT DOOR (ADR 0021, Phase NAV-A)

   The public layer and the demo workspaces, under /preview, on the
   public demonstration only: on a tenant deployment `available()`
   is false and every page under /preview is not found.

   THE DEMO WORKSPACES. One per workspace type, each a synthetic
   organization: read-only, open without login, badged DEMO. The
   DisCo and the mini-grid operator are the two organizations of
   the demonstration dataset (their names from the same records as
   the tenant fixture); the other three are named so that no one
   could take them for real (Founder, 2026-11-08). None has a logo,
   so each header shows the GridIntel fallback mark.

   SIGN IN. The tenant deployment's sign-in page, from
   GRIDINTEL_TENANT_SIGN_IN_URL (an https address, read when the
   page is built). Unset, the Sign in button says so and leads
   nowhere. The public demonstration has no sign-in page of its own
   (ADR 0020).
========================================================== */

const nameOf = (id: string) => TENANT_ORGANIZATIONS.find((one) => one.id === id)?.name ?? null;

export const DEMO_WORKSPACES: readonly WorkspaceRecord[] = [
  { id: demoWorkspaceId("utility"), name: nameOf(DEMO_ORGANIZATION_ID) ?? "Demonstration DisCo (synthetic)", type: "utility", logo: null, demo: true, synthetic: true },
  { id: demoWorkspaceId("minigrid"), name: nameOf(MINIGRID_ORGANIZATION_ID) ?? "Demonstration Mini-grid Operator (synthetic)", type: "minigrid", logo: null, demo: true, synthetic: true },
  { id: demoWorkspaceId("der"), name: "Demonstration DER Developer (synthetic)", type: "der", logo: null, demo: true, synthetic: true },
  { id: demoWorkspaceId("financier"), name: "Demonstration Financier (synthetic)", type: "financier", logo: null, demo: true, synthetic: true },
  { id: demoWorkspaceId("regulator"), name: "Demonstration Regulator (synthetic)", type: "regulator", logo: null, demo: true, synthetic: true },
];

const published = nercPublishedFigures();
const marketplace = createSyntheticMarketplace();

let figures: ReturnType<typeof initiativeFigures> | null = null;
/** The cards' figures, once per process: published figures and designed records that do not change while it runs. */
const cardFigures = () => (figures ??= initiativeFigures({ published, marketplace, minigrid: minigrid.portfolioView }));

/** The tenant deployment's sign-in page; null when it is not set, or is not an https address. */
export function tenantSignInHref(): string | null {
  const value = process.env.GRIDINTEL_TENANT_SIGN_IN_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const workspace = (id: string) => DEMO_WORKSPACES.find((one) => one.id === id) ?? null;

export const frontDoor = {
  /** The front door is served by the public demonstration only (ADR 0021, gate 1). */
  available: () => deploymentMode() === "demo",
  cards: async () => publicCards(await cardFigures()),
  rolePicker: (initiativeId: string) => rolePicker(initiativeId),
  rolePage: (initiativeId: string, roleId: string) => rolePage(initiativeId, roleId, DEMO_WORKSPACES, tenantSignInHref()),
  minigridSummary: async () => minigridSummary(await minigrid.portfolioView()),
  /** The DisCos a customer may choose on the meter application. */
  discoOptions: () => Object.entries(DISCO_NAMES).map(([id, name]) => ({ id, name })),
  workspaceIds: () => DEMO_WORKSPACES.map((one) => one.id),
  /** Every initiative page of every demo workspace, for building them ahead of time. */
  workspaceInitiatives: () => DEMO_WORKSPACES.flatMap((one) => initiativesFor(one.type).map((initiative) => ({ workspace: one.id, initiative: initiative.id }))),
  /** Every rail item but Home of every demo workspace, for building them ahead of time. */
  railItems: () => DEMO_WORKSPACES.flatMap((one) => railFor(one.type).filter((entry) => entry.item !== "home").map((entry) => ({ workspace: one.id, item: entry.item }))),
  frame: (workspaceId: string) => workspaceFrame(workspaceId, DEMO_WORKSPACES),
  home: async (workspaceId: string) => {
    const found = workspace(workspaceId);
    return found === null ? null : workspaceHome(found, await cardFigures());
  },
  initiative: async (workspaceId: string, initiativeId: string) => {
    const found = workspace(workspaceId);
    return found === null ? null : workspaceInitiative(found, initiativeId, await cardFigures());
  },
  railItem: (workspaceId: string, item: string) => {
    const found = workspace(workspaceId);
    return found === null ? null : railItemPage(found, item);
  },
};
