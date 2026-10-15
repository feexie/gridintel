import type { ScreenGrant } from "../services/spatial/viewer.ts";
import { ALL_REPORTS_PATH, PLATFORM_HOME, REPORTS, sectors, type NavigationItem, type ReportItem, type Sector } from "./navigation.ts";

/* ==========================================================
   WHICH SCREENS A VIEWER MAY OPEN (ADR 0018)

   Every sector and every screen has a permission key
   (navigation.ts). A viewer holds a grant (ViewerContext.screens):
   everything, or a list of keys. A sector's key opens every screen
   of that sector; a screen's key opens that screen and the screens
   below it (a feeder inside Operations, a site inside Sites).

   The row of sectors, the menu and the routes are all decided here,
   from the one grant, so they cannot disagree: what a viewer is not
   shown, they are refused at its address. Nothing is open by
   default: a list that holds no key opens nothing.

   A report has a key below its sector's Reports screen
   ("utility.reports.reliability", ADR 0019). Holding a key opens
   everything below it, so "utility.reports" opens every report of the
   sector. Holding a report's key also opens the screen above it, the
   sector's list of reports, which shows that viewer only the reports
   they may open; and the list of every report (/dashboard/reports)
   opens to anyone who may open one.

   A department is a set of keys, e.g. a revenue department holds
   "utility.overview", "utility.map" and "utility.revenue". Who holds
   which grant is kept with logging in (Phase 8); until then the one
   viewer is the public demonstration, which holds everything.

   Pure functions of the grant and the address: no clock, no I/O.
========================================================== */

/** The page an address is refused with. Open to every viewer: it says only that the screen is not theirs. */
export const REFUSED_PATH = `${PLATFORM_HOME}/refused`;

function holds(grant: ScreenGrant, key: string): boolean {
  return grant.kind === "everything" || grant.keys.includes(key);
}

/** True when the grant holds the key or a key above it ("utility.reports" is above "utility.reports.reliability"). */
function holdsOrAbove(grant: ScreenGrant, key: string): boolean {
  const parts = key.split(".");
  return parts.some((_, i) => holds(grant, parts.slice(0, i + 1).join(".")));
}

/** True when the grant holds a key below this one: a report below a Reports screen. */
function holdsBelow(grant: ScreenGrant, key: string): boolean {
  return grant.kind === "everything" || grant.keys.some((held) => held.startsWith(`${key}.`));
}

function opensKey(grant: ScreenGrant, key: string): boolean {
  if (key === "platform.reports") return REPORTS.some((report) => !report.planned && opensKey(grant, report.key));
  return holdsOrAbove(grant, key) || holdsBelow(grant, key);
}

function opens(grant: ScreenGrant, sector: Sector, item: NavigationItem): boolean {
  return holds(grant, sector.id) || opensKey(grant, item.key);
}

/** The reports a viewer may open, in the catalogue's order; of one sector when it is given. A planned report is listed with the others. */
export function reportsFor(grant: ScreenGrant, sector?: ReportItem["sector"]): ReportItem[] {
  return REPORTS.filter((report) => (sector === undefined || report.sector === sector) && holdsOrAbove(grant, report.key));
}

/** The sectors and screens a viewer may open, in the menu's order. A sector with none is left out. */
export function navigationFor(grant: ScreenGrant): Sector[] {
  return sectors.flatMap((sector) => {
    const opening = sector.opening.filter((item) => opens(grant, sector, item));
    const workspaces = sector.workspaces.filter((item) => opens(grant, sector, item));
    if (opening.length + workspaces.length === 0) return [];
    // A sector the viewer cannot open the Overview of is entered at its first screen they can.
    const home = (opening[0] ?? workspaces[0]).href;
    return [{ ...sector, home, opening, workspaces }];
  });
}

/** Where a viewer's GridIntel starts: the first screen they may open; null when there is none. */
export function homeFor(navigation: readonly Sector[]): string | null {
  const [first] = navigation;
  return first === undefined ? null : (first.opening[0] ?? first.workspaces[0]).href;
}

function within(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The key an address needs: the screen it is, or is below; else the sector it is in; else the
 * platform's. Every address under /dashboard needs one, except the refusal page.
 */
export function keyFor(pathname: string): string | null {
  if (pathname === REFUSED_PATH) return null;
  if (pathname === ALL_REPORTS_PATH) return "platform.reports";
  for (const report of REPORTS) if (within(pathname, report.href)) return report.key;
  for (const sector of sectors) {
    for (const item of [...sector.opening, ...sector.workspaces]) {
      if (item.exact ? pathname === item.href : within(pathname, item.href)) return item.key;
    }
  }
  const sector = sectors.find((one) => one.id !== "platform" && within(pathname, one.home));
  return sector?.id ?? "platform";
}

/** True when the viewer may open the screen at this address. */
export function canOpen(grant: ScreenGrant, pathname: string): boolean {
  const key = keyFor(pathname);
  return key === null || opensKey(grant, key);
}
