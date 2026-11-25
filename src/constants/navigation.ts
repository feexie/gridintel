/* The old menu (ADR 0017), drawn until NAV-B's rail replaces it (NAV-B step 6), and derived
   entirely from the View catalogue (views.ts): its sectors, their screens, the reports and every
   address come from there, so the menu, the routes and the permissions cannot disagree.

   Across the top, the sectors; down the side, the screens of the sector the reader is in: its
   Overview, GIS Map and AI Assistant, then its views (ADR 0017 called them "workspaces"). Every
   item leads to a screen that exists; an item marked `planned` leads to a page that says what is
   not built yet. Each item's key is its View ID (ADR 0018, ADR 0021 amended). */

import { hrefOf, viewAt, VIEWS, type MenuSector, type ReportId, type View, type ViewId } from "./views.ts";

export type { ReportId };

export type NavigationItem = {
  /** The View ID of the screen, e.g. "utility.revenue": also its permission key. */
  key: ViewId;
  label: string;
  href: string;
  /** The question the screen answers. */
  description?: string;
  /** Active only on exactly this address, not on the addresses below it. */
  exact?: boolean;
  /** Not built yet. Shown with the word "Planned" in the menu. */
  planned?: boolean;
  /** The heading the item is listed under in the menu, when a sector groups its views (Planning). */
  group?: string;
};

export type SectorId = MenuSector;

export type Sector = {
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

const item = (view: View): NavigationItem => ({
  key: view.id,
  label: view.menu!.label,
  href: hrefOf(view.id),
  ...(view.menu!.description === undefined ? {} : { description: view.menu!.description }),
  ...(view.exact ? { exact: true } : {}),
  ...(view.planned ? { planned: true } : {}),
  ...(view.menu!.group === undefined ? {} : { group: view.menu!.group }),
});

const menuOf = (sector: MenuSector, section: "opening" | "views") => VIEWS.filter((view) => view.menu?.sector === sector && view.menu.section === section).map(item);

export const PLATFORM_HOME = hrefOf("platform.overview");
export const UTILITY_HOME = hrefOf("utility.overview");
export const MINIGRID_HOME = hrefOf("minigrid.overview");
export const DER_HOME = hrefOf("der.overview");
export const PLANNING_HOME = hrefOf("plan.overview");

export const UTILITY_WORKSPACES: NavigationItem[] = menuOf("utility", "views");
export const MINIGRID_WORKSPACES: NavigationItem[] = menuOf("minigrid", "views");
/** Planning's planners, under the group of who is planning (docs/geh/DESIGN.md). */
export const PLANNING_WORKSPACES: NavigationItem[] = menuOf("planning", "views");

/* ==========================================================
   REPORTS (ADR 0019)

   Each report has a View ID of its own, below its sector's Reports
   screen: "utility.reports.reliability". Holding the Reports
   screen's key opens every report of the sector; holding one
   report's key opens that report and the sector's list of reports,
   which then shows that report only. A regulator, for example, may
   be given the reliability report and nothing else.

   A report marked `planned` is listed, says it is not built, and has
   no page.
========================================================== */

export type ReportItem = {
  /** The View ID, e.g. "utility.reports.reliability". */
  key: ViewId;
  id: ReportId;
  sector: "utility" | "minigrid";
  label: string;
  /** Who the report is for. */
  audience: string;
  href: string;
  description: string;
  planned?: boolean;
};

/** Where every report the viewer may open is listed, across sectors. */
export const ALL_REPORTS_PATH = hrefOf("platform.reports");

/** Where an organization's administrator manages who may sign in and what each person may open (Phase 8A). */
export const PEOPLE_PATH = hrefOf("platform.people");
/** The key of that screen: held by an organization's administrators only. */
export const PEOPLE_KEY = "platform.people";

export const REPORTS: ReportItem[] = VIEWS.filter((view) => view.report !== undefined).map((view) => ({
  key: view.id,
  id: view.report!.id,
  sector: view.report!.sector,
  label: view.label,
  audience: view.report!.audience,
  href: hrefOf(view.id),
  description: view.report!.description,
  ...(view.planned ? { planned: true } : {}),
}));

export const sectors: Sector[] = [
  { id: "platform", label: "Platform", title: "Platform", home: PLATFORM_HOME, opening: menuOf("platform", "opening"), workspaces: [] },
  { id: "utility", label: "Utility", title: "Utility Intelligence", home: UTILITY_HOME, opening: menuOf("utility", "opening"), workspaces: UTILITY_WORKSPACES },
  { id: "minigrid", label: "Mini-grid", title: "Mini-grid Intelligence", home: MINIGRID_HOME, opening: menuOf("minigrid", "opening"), workspaces: MINIGRID_WORKSPACES },
  { id: "der", label: "DER", title: "DER Intelligence", home: DER_HOME, planned: true, opening: menuOf("der", "opening"), workspaces: [] },
  { id: "planning", label: "Planning", title: "Planning", home: PLANNING_HOME, opening: menuOf("planning", "opening"), workspaces: PLANNING_WORKSPACES },
];

/** The sector an address is in, of those given: its view's domain (views.ts), whatever the address. An address in none of them is the platform's. */
export function sectorOf(pathname: string, among: readonly Sector[] = sectors): Sector | undefined {
  const view = viewAt(pathname);
  const domain = view?.inSector ?? view?.domain;
  return among.find((sector) => sector.id !== "platform" && sector.id === domain) ?? among.find((sector) => sector.id === "platform");
}
