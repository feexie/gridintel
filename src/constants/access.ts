import type { ScreenGrant } from "../services/spatial/viewer.ts";
import { REPORTS, sectors, type NavigationItem, type ReportItem, type Sector } from "./navigation.ts";
import { domainOfKey, hrefOf, isDomain, isViewId, landingOf, PLATFORM_DEFAULT, RAIL_ITEMS, RAILS, translateKey, viewAt, viewOf, VIEWS, workspaceTypeOf, workspaceViews, type Domain, type RailItemId, type View, type ViewId, type WorkspaceType } from "./views.ts";

/* ==========================================================
   WHICH SCREENS A VIEWER MAY OPEN (ADR 0018; NAV-B, ADR 0021
   amended)

   Every screen is a View with a stable id (views.ts); the id is its
   permission key, whatever its address. A viewer holds a grant
   (ViewerContext.screens): everything, or a list of keys. A key
   opens its view, the views below it ("utility" opens every
   utility.* view), and the view above it when that view lists what
   is below (a report's key opens its sector's list of reports).

   The menu and the routes are decided here, from the one grant, so
   they cannot disagree: what a viewer is not shown, they are refused
   at its address. Nothing is open by default:
   - a key the catalogue does not know opens nothing;
   - an address that is no view is opened to no one (the proxy
     answers it "not found", `resolves`);
   - a list that holds no key opens only the views every viewer may
     (the refusal page, About this build).

   The list of every report (platform.reports) opens to anyone who
   may open one report.

   Pure functions of the grant and the address: no clock, no I/O.
========================================================== */

/** The page an address is refused with. Open to every viewer: it says only that the screen is not theirs. */
export const REFUSED_PATH = hrefOf("platform.refused");

const heldKeys = (grant: ScreenGrant): readonly string[] => (grant.kind === "everything" ? [] : grant.keys);

/** True when the grant holds the key, or a key above it ("utility" is above "utility.reports.reliability"). */
function holdsOrAbove(grant: ScreenGrant, key: string): boolean {
  return grant.kind === "everything" || heldKeys(grant).some((held) => key === held || key.startsWith(`${held}.`));
}

/** True when the grant holds a key below this one: a report below a Reports screen. */
function holdsBelow(grant: ScreenGrant, key: string): boolean {
  return grant.kind === "everything" || heldKeys(grant).some((held) => held.startsWith(`${key}.`));
}

/** True when the grant holds any key of the domain. */
function holdsDomain(grant: ScreenGrant, domain: Domain): boolean {
  return grant.kind === "everything" || heldKeys(grant).some((held) => domainOfKey(held) === domain);
}

/** True when the grant opens the view, by the view's own permission. */
export function opensView(grant: ScreenGrant, view: View): boolean {
  if (view.id === "platform.reports") return REPORTS.some((report) => !report.planned && opensView(grant, viewOf(report.key)));
  switch (view.permission) {
    case "viewer":
      return true;
    case "own":
      return holdsOrAbove(grant, view.id) || holdsBelow(grant, view.id);
  }
}

function opensKey(grant: ScreenGrant, key: string): boolean {
  return isViewId(key) && opensView(grant, viewOf(key));
}

/** The reports a viewer may open, in the catalogue's order; of one sector when it is given. A planned report is listed with the others. */
export function reportsFor(grant: ScreenGrant, sector?: ReportItem["sector"]): ReportItem[] {
  return REPORTS.filter((report) => (sector === undefined || report.sector === sector) && holdsOrAbove(grant, report.key));
}

function opens(grant: ScreenGrant, item: NavigationItem): boolean {
  return opensKey(grant, item.key);
}

/** The sectors and screens a viewer may open, in the menu's order. A sector with none is left out. */
export function navigationFor(grant: ScreenGrant): Sector[] {
  return sectors.flatMap((sector) => {
    const opening = sector.opening.filter((item) => opens(grant, item));
    const workspaces = sector.workspaces.filter((item) => opens(grant, item));
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

/* ==========================================================
   THE SIGNED-IN RAIL (ADR 0021 decision 5; NAV-B step 6)

   A workspace type's rail (views.ts, RAILS), cut to what the grant
   opens: each item leads to its landing and lists its views; an item
   left with nothing the grant opens is not shown. Every view is in
   one item only. Reports, Help and the account are at its foot.
========================================================== */

export interface RailItemLinks {
  item: RailItemId;
  label: string;
  question: string;
  /** The item's landing page. */
  href: string;
  /** The views it lists, in the rail's order, with their addresses. */
  views: { id: ViewId; label: string; href: string; planned: boolean }[];
}

/** The rail of a workspace type, as a grant opens it. */
export function workspaceRail(type: WorkspaceType, grant: ScreenGrant): RailItemLinks[] {
  return RAILS[type].flatMap((entry) => {
    const meta = RAIL_ITEMS.find((one) => one.id === entry.item)!;
    const landing = landingOf(type, entry.item);
    const views = entry.views
      .map((id) => viewOf(id))
      .filter((view) => view.address !== null && opensView(grant, view))
      .map((view) => ({ id: view.id, label: view.label, href: hrefOf(view.id), planned: view.planned === true }));
    const lands = landing !== null && viewOf(landing).address !== null && opensView(grant, viewOf(landing));
    if (!lands && views.length === 0) return [];
    return [{ item: entry.item, label: meta.label, question: meta.question, href: lands ? hrefOf(landing!) : views[0].href, views }];
  });
}

/** Where a viewer starts: Home when it opens to them, else the first screen of the catalogue they may open; null when there is none. */
export function landingFor(grant: ScreenGrant): string | null {
  if (opensView(grant, viewOf("platform.home"))) return hrefOf("platform.home");
  const first = VIEWS.find((view) => view.address !== null && view.permission === "own" && !view.planned && opensView(grant, view));
  return first === undefined ? null : hrefOf(first.id);
}

/** The key an address needs: the id of the view it is; null for an address that is no view. */
export function keyFor(pathname: string): string | null {
  return viewAt(pathname)?.id ?? null;
}

/** True when the address is a view (or below one). The proxy answers any other address "not found". */
export function resolves(pathname: string): boolean {
  return viewAt(pathname) !== null;
}

/** True when the viewer may open the screen at this address. An address that is no view is opened to no one. */
export function canOpen(grant: ScreenGrant, pathname: string): boolean {
  const view = viewAt(pathname);
  return view !== null && opensView(grant, view);
}

/** True when the grant opens the screen with this permission key (a view, a sector's map). */
export function opensScreen(grant: ScreenGrant, key: string): boolean {
  return opensKey(grant, key);
}

/* ==========================================================
   A MEMBER'S GRANT (Phase 8A, ADR 0020; NAV-B, Founder,
   25 November 2026)

   What an organization opens is what the catalogue shows its
   workspace type (views.ts, workspaceViews), with the platform's own
   screens; never a whole sector. A membership that lists no screen
   holds all of it; one that lists screens holds those of them, each
   old key translated to View IDs (views.ts, OLD_KEYS). Any other key
   is dropped, whatever the membership says, so a grant can never
   reach another organization's records. People is held by an
   administrator only.
========================================================== */

const PEOPLE = "platform.people";

/** The views an organization holding these sectors may open: its workspace type's, and the platform's own. */
export function defaultViewsFor(organizationSectors: readonly string[]): ViewId[] {
  const type = workspaceTypeOf(organizationSectors);
  return [...new Set<ViewId>([...PLATFORM_DEFAULT, ...(type === null ? [] : workspaceViews(type))])];
}

/** True when a held key stays inside what the organization may open: a view of it, or a key above views that all are. */
function within(allowed: ReadonlySet<string>, key: string): boolean {
  if (isViewId(key)) return allowed.has(key);
  const below = VIEWS.filter((view) => view.id.startsWith(`${key}.`));
  return below.length > 0 && below.every((view) => allowed.has(view.id));
}

export function grantFor(organizationSectors: readonly string[], screens: readonly string[] | null, administrator: boolean): ScreenGrant {
  const allowed = new Set<string>(defaultViewsFor(organizationSectors));
  const keys = screens === null ? [...allowed] : [...new Set(screens.flatMap(translateKey))].filter((key) => key !== PEOPLE && within(allowed, key));
  return { kind: "listed", keys: administrator ? [...keys, PEOPLE] : keys };
}

/** True when the grant reaches any screen of the domain: the domain's records may then be read. */
export function holdsSector(grant: ScreenGrant, sector: string): boolean {
  return isDomain(sector) && holdsDomain(grant, sector);
}

/**
 * The data layer's check (composition/runtime.ts, `gate`): a sector's records may be read for a
 * request when the grant holds the sector and opens the address asked for. A request whose
 * address is not known reads nothing.
 */
export function admitsRead(grant: ScreenGrant, sector: string, path: string | null): boolean {
  return holdsSector(grant, sector) && path !== null && canOpen(grant, path);
}
