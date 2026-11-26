/* Lists of screens other screens link to, and the reports, derived entirely from the View
   catalogue (views.ts), so no list here can disagree with the routes or the permissions. The old
   menu (ADR 0017) that these lists were drawn for was removed in NAV-B step 8: the rail
   (access.ts, workspaceRail) replaced it. Each item's key is its View ID (ADR 0021 amended). */

import { hrefOf, VIEWS, type MenuSector, type ReportId, type View, type ViewId } from "./views.ts";

export type { ReportId };

export type NavigationItem = {
  /** The View ID of the screen, e.g. "utility.revenue": also its permission key. */
  key: ViewId;
  label: string;
  href: string;
  /** The question the screen answers. */
  description?: string;
  /** Not built yet. */
  planned?: boolean;
};

export type SectorId = MenuSector;

const item = (view: View): NavigationItem => ({
  key: view.id,
  label: view.menu!.label,
  href: hrefOf(view.id),
  ...(view.menu!.description === undefined ? {} : { description: view.menu!.description }),
  ...(view.planned ? { planned: true } : {}),
});

const menuOf = (sector: MenuSector, section: "views") => VIEWS.filter((view) => view.menu?.sector === sector && view.menu.section === section).map(item);

export const UTILITY_HOME = hrefOf("utility.overview");
export const MINIGRID_HOME = hrefOf("minigrid.overview");
export const DER_HOME = hrefOf("der.overview");
export const PLANNING_HOME = hrefOf("plan.overview");

export const UTILITY_VIEWS: NavigationItem[] = menuOf("utility", "views");
export const MINIGRID_VIEWS: NavigationItem[] = menuOf("minigrid", "views");

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
