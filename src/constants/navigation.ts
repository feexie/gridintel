/* The menu. Across the top, the sectors; down the side, the screens of the sector the reader is
   in. Every sector has the same structure: Overview, GIS Map, AI Assistant, then its workspaces
   (ADR 0017). A sector that joins later (DER, Planning) is one more entry of the same shape.

   Every item leads to a screen that exists. An item marked `planned` leads to a page that says
   what is not built yet, and the menu marks it so before it is opened.

   Every sector and every screen has a permission key (ADR 0018): a sector's key is its id
   ("utility"), a screen's is the sector's and the screen's ("utility.revenue"). Which of them a
   viewer holds decides what the row of sectors, the menu and the routes show
   (`src/constants/access.ts`). */

export type NavigationItem = {
  /** The permission key of the screen, e.g. "utility.revenue". */
  key: string;
  label: string;
  href: string;
  /** The question the screen answers. */
  description?: string;
  /** Active only on exactly this address, not on the addresses below it. */
  exact?: boolean;
  /** Not built yet. Shown with the word "Planned" in the menu. */
  planned?: boolean;
};

export type SectorId = "platform" | "utility" | "minigrid" | "der" | "planning";

export type Sector = {
  /** Also the sector's permission key: holding it opens every screen of the sector. */
  id: SectorId;
  /** The short name, in the row of sectors. */
  label: string;
  /** The full name, above the sector's own screens. */
  title: string;
  home: string;
  /** Not built yet. Shown with the word "Planned" in the row of sectors. */
  planned?: boolean;
  /** The screens every sector opens with. */
  opening: NavigationItem[];
  workspaces: NavigationItem[];
};

export const PLATFORM_HOME = "/dashboard";
export const UTILITY_HOME = "/dashboard/utility";
export const MINIGRID_HOME = "/dashboard/minigrid";
export const DER_HOME = "/dashboard/der";
export const PLANNING_HOME = "/dashboard/planning";

export const UTILITY_WORKSPACES: NavigationItem[] = [
  { key: "utility.executive", label: "Executive", href: `${UTILITY_HOME}/executive`, description: "What is happening across the portfolio, and where should I look first?" },
  { key: "utility.operations", label: "Operations", href: `${UTILITY_HOME}/operations`, description: "What does the network look like, level by level, from region to service point?" },
  { key: "utility.reliability", label: "Reliability", href: `${UTILITY_HOME}/reliability`, description: "Which feeders fail their customers, why, and is it ours to fix?" },
  { key: "utility.revenue", label: "Revenue", href: `${UTILITY_HOME}/revenue`, description: "Where is revenue not realised, who is not paying, and is the loss commercial or collection?" },
  { key: "utility.assets", label: "Assets", href: `${UTILITY_HOME}/assets`, description: "Which assets require attention?" },
  { key: "utility.events", label: "Events / Alarms", href: `${UTILITY_HOME}/events`, description: "What is wrong now, where, and who is affected?" },
];

export const MINIGRID_WORKSPACES: NavigationItem[] = [
  { key: "minigrid.sites", label: "Sites", href: `${MINIGRID_HOME}/sites`, description: "Which sites are underperforming and why, and do their reports match the records?" },
];

/** The three screens every sector opens with, in this order. */
function opening(sector: SectorId, home: string, map: string): NavigationItem[] {
  return [
    { key: `${sector}.overview`, label: "Overview", href: home, exact: true, description: "What needs attention here?" },
    { key: `${sector}.map`, label: "GIS Map", href: `${home}/map`, description: map },
    { key: `${sector}.ai`, label: "AI Assistant", href: `${home}/ai`, planned: true, description: "Planned. Not built yet." },
  ];
}

/** A sector that is not built has one page, which says so. */
function notBuilt(sector: SectorId, home: string): NavigationItem[] {
  return [{ key: `${sector}.overview`, label: "Overview", href: home, exact: true, planned: true, description: "Planned. Not built yet." }];
}

export const sectors: Sector[] = [
  { id: "platform", label: "Platform", title: "Platform", home: PLATFORM_HOME, opening: [{ key: "platform.overview", label: "Overview", href: PLATFORM_HOME, exact: true }], workspaces: [] },
  {
    id: "utility",
    label: "Utility",
    title: "Utility Intelligence",
    home: UTILITY_HOME,
    opening: opening("utility", UTILITY_HOME, "Where is the network, what is wrong on it now, and where are the losses?"),
    workspaces: UTILITY_WORKSPACES,
  },
  {
    id: "minigrid",
    label: "Mini-grid",
    title: "Mini-grid Intelligence",
    home: MINIGRID_HOME,
    opening: opening("minigrid", MINIGRID_HOME, "Where are the sites, and how does each one stand?"),
    workspaces: MINIGRID_WORKSPACES,
  },
  { id: "der", label: "DER", title: "DER Intelligence", home: DER_HOME, planned: true, opening: notBuilt("der", DER_HOME), workspaces: [] },
  { id: "planning", label: "Planning", title: "Planning", home: PLANNING_HOME, planned: true, opening: notBuilt("planning", PLANNING_HOME), workspaces: [] },
];

/** The sector an address is in, of those given. An address in none of them is the platform's. */
export function sectorOf(pathname: string, among: readonly Sector[] = sectors): Sector | undefined {
  return among.find((sector) => sector.id !== "platform" && (pathname === sector.home || pathname.startsWith(`${sector.home}/`))) ?? among.find((sector) => sector.id === "platform");
}
