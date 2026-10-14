import { minigridOverviewView } from "../services/minigrid/overview.ts";
import { platformOverviewView } from "../services/platform/overview.ts";
import { utilityOverviewView } from "../services/utility/overview.ts";
import { assets } from "./assets.ts";
import { events } from "./events.ts";
import { executive } from "./executive.ts";
import { minigrid } from "./minigrid.ts";
import { reliability } from "./reliability.ts";

/* ==========================================================
   COMPOSITION — OVERVIEWS

   The Platform Overview and each sector's Overview. They are put
   together from the read models of the screens they lead to, which
   are cached where they are computed, so nothing is cached here and
   no overview can disagree with the screen behind one of its lines.

   The utility's and the mini-grid operator's records are two sets
   of repositories (runtime.ts). They meet only on the Platform
   Overview, side by side and never added together.
========================================================== */

const utility = async () => utilityOverviewView({ executive: await executive.view("top"), events: await events.view(), assets: await assets.view("top"), reliability: await reliability.view() });
const minigridOverview = async () => minigridOverviewView(await minigrid.portfolioView());

export const overview = {
  /** What needs attention in the Utility sector. */
  utility,
  /** What needs attention in the Mini-grid sector. */
  minigrid: minigridOverview,
  /** The first lines of each sector, for a first-time visitor. */
  platform: async () => platformOverviewView([await utility(), await minigridOverview()]),
};
