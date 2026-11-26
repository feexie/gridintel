import { workspaceTypeOf } from "../constants/views.ts";
import { dashboardHome, dashboardInitiative, dashboardRailIndex, signedInFrame, type WorkspaceRecord } from "../services/initiatives/frontDoor.ts";
import type { RailItemPageView, SignedInFrameView, WorkspaceHomeView, WorkspaceInitiativeView } from "../services/initiatives/views.ts";
import type { RailItemId } from "../constants/views.ts";
import { DEMO_WORKSPACES, workspaceFiguresFor } from "./initiatives.ts";
import { deploymentMode } from "./mode.ts";
import { getViewer } from "./viewer.ts";

/* ==========================================================
   COMPOSITION — THE WORKSPACE OF A /dashboard PAGE (NAV-B step 6;
   ADR 0021; safeguard C)

   THE PUBLIC DEMONSTRATION shows the five demo workspaces, each a
   synthetic organization, read-only and badged DEMO. Its pages are
   built ahead of time and the same for every visitor, so all five
   are given; which one a visitor looks at is chosen in the browser
   (components/workspace/DemoWorkspace.tsx), from a cookie or
   ?workspace=, validated against the catalogue (views.ts).

   A TENANT DEPLOYMENT shows the signed-in person's organization and
   nothing else. It reads neither the cookie nor ?workspace=: the
   organization comes from the session only, its workspace type from
   its sectors until the database brief records it (Founder's answer
   3), and the frame is cut to the person's grant.
========================================================== */

/** The workspaces a /dashboard page is drawn for: the five demo workspaces, or the signed-in organization alone; none for no one. */
async function records(): Promise<WorkspaceRecord[]> {
  if (deploymentMode() === "demo") return [...DEMO_WORKSPACES];
  const { signedIn } = await import("./identity.ts");
  const who = await signedIn();
  if (who === null) return [];
  const type = workspaceTypeOf(who.organization.sectors);
  if (type === null) return [];
  return [{ id: who.organization.id, name: who.organization.name, type, logo: null, demo: false, synthetic: who.organization.synthetic, disco: type === "utility" ? who.organization.id : null }];
}

export const workspace = {
  /** True on the public demonstration, where the visitor chooses among the demo workspaces. */
  isDemo: () => deploymentMode() === "demo",
  /** Each workspace's frame, cut to the viewer's grant. */
  frames: async (): Promise<SignedInFrameView[]> => {
    const viewer = await getViewer();
    return (await records()).map((record) => signedInFrame(record, viewer.screens));
  },
  /** Each workspace's Home. */
  homes: async (): Promise<WorkspaceHomeView[]> => Promise.all((await records()).map(async (record) => dashboardHome(record, await workspaceFiguresFor(record)))),
  /** An initiative as each workspace sees it; a workspace whose type has no role in it is left out. */
  initiatives: async (initiativeId: string): Promise<WorkspaceInitiativeView[]> =>
    (await Promise.all((await records()).map(async (record) => dashboardInitiative(record, initiativeId, await workspaceFiguresFor(record))))).filter((one): one is WorkspaceInitiativeView => one !== null),
  /** A rail item's index for each workspace whose rail has it. */
  railIndexes: async (item: RailItemId): Promise<RailItemPageView[]> => {
    const viewer = await getViewer();
    return (await records()).map((record) => dashboardRailIndex(record, item, viewer.screens)).filter((one): one is RailItemPageView => one !== null);
  },
};
