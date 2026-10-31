import { holdsSector, opensScreen } from "../constants/access.ts";
import { minigridOverviewView } from "../services/minigrid/overview.ts";
import { cutPlatformOverview, cutSectorOverview } from "../services/overview/links.ts";
import { platformOverviewView } from "../services/platform/overview.ts";
import { utilityOverviewView } from "../services/utility/overview.ts";
import { assets } from "./assets.ts";
import { events } from "./events.ts";
import { executive } from "./executive.ts";
import { minigrid } from "./minigrid.ts";
import { reliability } from "./reliability.ts";
import { getViewer } from "./viewer.ts";

/* ==========================================================
   COMPOSITION — OVERVIEWS

   The Platform Overview and each sector's Overview. They are put
   together from the read models of the screens they lead to, which
   are cached where they are computed, so nothing is cached here and
   no overview can disagree with the screen behind one of its lines.

   The utility's and the mini-grid operator's records are two sets
   of repositories (runtime.ts). They meet only on the Platform
   Overview, side by side and never added together.

   Every overview is handed over with its links cut to the viewer's
   grant (services/overview/links.ts). In a tenant deployment the
   Platform Overview is put together from the sectors the viewer
   holds only: another organization's sector is not computed at all.
========================================================== */

const utility = async () => utilityOverviewView({ executive: await executive.view("top"), events: await events.view(), assets: await assets.view("top"), reliability: await reliability.view() });
const minigridOverview = async () => minigridOverviewView(await minigrid.portfolioView());

async function opens() {
  const viewer = await getViewer();
  return { viewer, opens: (key: string) => opensScreen(viewer.screens, key) };
}

export const overview = {
  /** What needs attention in the Utility sector. */
  utility: async () => cutSectorOverview(await utility(), (await opens()).opens),
  /** What needs attention in the Mini-grid sector. */
  minigrid: async () => cutSectorOverview(await minigridOverview(), (await opens()).opens),
  /** The first lines of each sector the viewer holds, for a first-time visitor. */
  platform: async () => {
    const { viewer, opens: open } = await opens();
    const held = (["utility", "minigrid"] as const).filter((sector) => holdsSector(viewer.screens, sector));
    const views = [];
    for (const sector of held) views.push(sector === "utility" ? await utility() : await minigridOverview());
    const entered = ["utility", "minigrid", "der", "planning"].filter((sector) => holdsSector(viewer.screens, sector));
    return cutPlatformOverview(platformOverviewView(views), open, entered);
  },
};
