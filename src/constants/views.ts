/* ==========================================================
   THE VIEWS: ONE CATALOGUE OF EVERY SCREEN (Phase NAV-B, ADR 0021
   amended; docs/design/NAV-B-PLAN.md section 4)

   A View is one screen (ADR 0017 called it a "workspace"). Its id is
   its permission key and never follows its address: a screen that
   moves keeps its id, so it keeps who may open it (Founder,
   25 November 2026).

   This catalogue is the single source for:
   - every screen's address, and route resolution both ways
     (`hrefOf`, `viewAt`);
   - each screen's permission (`permission`, below) and domain;
   - the old menu (navigation.ts derives it), the planners and the
     Metering screens (planning.ts), the reports, and the NAV-A rails
     (workspaces.ts);
   - the access tests.
   No other module writes a /dashboard address or keeps a list of
   screens: a test fails if one does (views.test.ts).

   Permissions, each explicit:
   - "own": opened by a grant holding the view's id, a key above it
     ("utility" above "utility.revenue"), or a key below it (a
     report's key opens its sector's list of reports);
   - "viewer": opened to every viewer the deployment lets in (on the
     tenant, everyone signed in). Only the refusal page and About this
     build (Founder's answer 5, 25 November 2026).

   Pure data and pure functions: no figure, no clock, no I/O.
========================================================== */

import { INITIATIVES } from "./initiatives.ts";

export const DASHBOARD = "/dashboard";

export type Domain = "platform" | "utility" | "minigrid" | "der" | "planning";

export const DOMAINS: readonly Domain[] = ["platform", "utility", "minigrid", "der", "planning"];

export const isDomain = (name: string): name is Domain => (DOMAINS as readonly string[]).includes(name);

/** The keys that stand for a whole domain's views, by the ids' first word. */
export const DOMAIN_KEYS = ["utility", "minigrid", "der"] as const;

export type ViewId =
  | "platform.home"
  | "platform.overview"
  | "platform.reports"
  | "platform.people"
  | "platform.about-this-build"
  | "platform.refused"
  | "utility.overview"
  | "utility.map"
  | "utility.ai"
  | "utility.executive"
  | "utility.operations"
  | "utility.reliability"
  | "utility.revenue"
  | "utility.assets"
  | "utility.events"
  | "utility.reports"
  | "utility.reports.reliability"
  | "utility.reports.operations"
  | "utility.reports.daily-brief"
  | "minigrid.overview"
  | "minigrid.map"
  | "minigrid.ai"
  | "minigrid.sites"
  | "minigrid.reports"
  | "minigrid.reports.site-performance"
  | "minigrid.reports.compliance"
  | "der.overview"
  | "plan.overview"
  | "plan.metering-allocation"
  | "plan.dt-sequencing"
  | "plan.metering-report"
  | "plan.dt"
  | "plan.feeders"
  | "plan.network-expansion"
  | "plan.charging-hubs"
  | "plan.unserved"
  | "plan.underserved"
  | "plan.pue"
  | "plan.rooftop-solar"
  | "plan.storage"
  | "finance.overview"
  | "finance.metering-fund"
  | "finance.marketplace"
  | "finance.pipeline"
  | "oversight.overview"
  | "oversight.monitoring"
  | "oversight.regulator"
  | "initiative.home"
  | "initiative.applications"
  | "initiative.journey";

export type Permission = "own" | "viewer";

export type MenuSector = "platform" | "utility" | "minigrid" | "der" | "planning";

export type PlannerId = "metering" | "dt" | "feeders" | "network-expansion" | "unserved" | "underserved" | "pue" | "e-mobility";
export type MeteringScreenId = "allocation" | "dt" | "fund" | "marketplace" | "monitoring" | "journey" | "about";
export type ReportId = "reliability" | "operations" | "daily-brief" | "site-performance" | "compliance";

export type View = {
  id: ViewId;
  /** The view's name in the rail and the NAV-A shell. */
  label: string;
  /** The question the view answers. */
  question: string;
  domain: Domain;
  /** Where the screen is: the one place an address is written. Null when it has no page yet. */
  address: string | null;
  /** Answers only at exactly this address; otherwise also at the addresses below it (a feeder inside Operations). */
  exact?: boolean;
  permission: Permission;
  /** Not built yet: its page says so and holds no figure. */
  planned?: boolean;
  /** The old menu's sector the screen is shown under, when it is not its domain's (until NAV-B step 6 replaces the old menu). */
  inSector?: MenuSector;
  /** The old menu's entry (navigation.ts), until NAV-B removes the old menu. */
  menu?: { sector: MenuSector; section: "opening" | "views"; label: string; description?: string; group?: string };
  /** A planner of the Planning section (planning.ts). */
  planner?: { id: PlannerId; group: "utility" | "minigrid"; label: string; purpose: string };
  /** A screen of the Metering planner, with its step (planning.ts). */
  metering?: { id: MeteringScreenId; step: "plan" | "fund" | "monitor" | ""; label: string };
  /** A report (ADR 0019). */
  report?: { id: ReportId; sector: "utility" | "minigrid"; audience: string; description: string };
};

/** Intelligence, by domain (NAV-B step 2): the network screens of each domain. */
const INTELLIGENCE = `${DASHBOARD}/intelligence`;
const UTILITY = `${INTELLIGENCE}/utility`;
const MINIGRID = `${INTELLIGENCE}/minigrid`;
/** Each domain's reports, under Reports at the foot of the rail (NAV-B step 4). */
const REPORTS_OF = (sector: "utility" | "minigrid") => `${DASHBOARD}/reports/${sector}`;
/** Plan, Finance and Oversight, by rail item (NAV-B step 3). */
const PLAN = `${DASHBOARD}/plan`;
const FINANCE = `${DASHBOARD}/finance`;
const OVERSIGHT = `${DASHBOARD}/oversight`;

const NOT_BUILT = "Planned. Not built yet.";

const opening = (sector: "utility" | "minigrid", home: string, map: string, mapQuestion: string = map): View[] => [
  { id: `${sector}.overview`, label: "Overview", question: "What needs attention here?", domain: sector, address: home, exact: true, permission: "own", menu: { sector, section: "opening", label: "Overview", description: "What needs attention here?" } },
  { id: `${sector}.map`, label: "GIS Map", question: mapQuestion, domain: sector, address: `${home}/map`, permission: "own", menu: { sector, section: "opening", label: "GIS Map", description: map } },
  { id: `${sector}.ai`, label: "AI Assistant", question: NOT_BUILT, domain: sector, address: `${home}/ai`, permission: "own", planned: true, menu: { sector, section: "opening", label: "AI Assistant", description: NOT_BUILT } },
];

const utilityView = (id: ViewId, label: string, question: string, description: string = question): View => ({
  id,
  label,
  question,
  domain: "utility",
  address: `${UTILITY}/${id.split(".")[1]}`,
  permission: "own",
  menu: { sector: "utility", section: "views", label, description },
});

const report = (sector: "utility" | "minigrid", id: ReportId, label: string, audience: string, description: string, planned = false): View => ({
  id: `${sector}.reports.${id}` as ViewId,
  label,
  question: description,
  domain: sector,
  address: `${REPORTS_OF(sector)}/${id}`,
  permission: "own",
  ...(planned ? { planned } : {}),
  report: { id, sector, audience, description },
});

const planner = (id: ViewId, plannerId: PlannerId, group: "utility" | "minigrid", plannerLabel: string, purpose: string, label: string, question: string): View => ({
  id,
  label,
  question,
  domain: "planning",
  address: `${PLAN}/${id.slice("plan.".length)}`,
  permission: "own",
  planned: true,
  menu: { sector: "planning", section: "views", label: plannerLabel, description: purpose, group: group === "utility" ? "Utility planning" : "Mini-grid planning" },
  planner: { id: plannerId, group, label: plannerLabel, purpose },
});

const METERING_PURPOSE = "Meter every customer in five years with no upfront payment: who pays, how the meter is recovered from token purchases, and which DTs go first.";

export const VIEWS: readonly View[] = [
  // The platform's own screens.
  // Home is where a workspace lands (NAV-B step 6); the Platform Overview moved under Intelligence with its map.
  { id: "platform.home", label: "Home", question: "What am I working on?", domain: "platform", address: DASHBOARD, exact: true, permission: "own" },
  { id: "platform.overview", label: "Platform overview", question: "What does GridIntel show, across every sector?", domain: "platform", address: INTELLIGENCE, exact: true, permission: "own", menu: { sector: "platform", section: "opening", label: "Overview" } },
  { id: "platform.reports", label: "Reports", question: "Which reports can I download, for which period?", domain: "platform", address: `${DASHBOARD}/reports`, exact: true, permission: "own" },
  { id: "platform.people", label: "People", question: "Who may sign in, and what may each open?", domain: "platform", address: `${DASHBOARD}/account/people`, permission: "own" },
  { id: "platform.about-this-build", label: "About this build", question: "What existed before the sprint, and what was built during it?", domain: "platform", address: `${DASHBOARD}/about-this-build`, permission: "viewer", inSector: "planning", metering: { id: "about", step: "", label: "About this build" } },
  { id: "platform.refused", label: "Not open to you", question: "This screen is not open to you.", domain: "platform", address: `${DASHBOARD}/refused`, exact: true, permission: "viewer" },

  // Utility.
  ...opening("utility", UTILITY, "Where is the network, what is wrong on it now, and where are the losses?", "Where is the network, and what is wrong on it now?"),
  utilityView("utility.executive", "Executive", "What is happening across the portfolio, and where should I look first?"),
  utilityView("utility.operations", "Operations", "What does the network look like, level by level?", "What does the network look like, level by level, from region to service point?"),
  utilityView("utility.reliability", "Reliability", "Which feeders fail their customers, and why?", "Which feeders fail their customers, why, and is it ours to fix?"),
  utilityView("utility.revenue", "Revenue", "Where is revenue not realised?", "Where is revenue not realised, who is not paying, and is the loss commercial or collection?"),
  utilityView("utility.assets", "Assets", "Which assets require attention?"),
  utilityView("utility.events", "Events / Alarms", "What is wrong now, where, and who is affected?"),
  { ...utilityView("utility.reports", "Reports", "Which reports can I download, for which period?"), address: REPORTS_OF("utility") },
  report("utility", "reliability", "Reliability and service standards", "Regulator; the DisCo's network planning", "SAIDI, SAIFI and CAIDI by feeder and substation, attribution by where interruptions began, service-band compliance by day, and the DisCo's reported figures against the calculation on their basis."),
  report("utility", "operations", "DisCo operations", "DisCo management", "ATC&C and its parts, revenue not realised, collection by customer class, reliability and hours of supply, assets requiring attention, outages and alarms."),
  report("utility", "daily-brief", "Daily operations brief", "Control room; DisCo management", "Any day in two printed pages: hours of supply by feeder, interruptions in progress, standing alarms and derived conditions at the day's end, and assets loaded above rating."),

  // Mini-grid.
  ...opening("minigrid", MINIGRID, "Where are the sites, and how does each one stand?"),
  { id: "minigrid.sites", label: "Sites", question: "Which sites are underperforming, and do their reports match the records?", domain: "minigrid", address: `${MINIGRID}/sites`, permission: "own", menu: { sector: "minigrid", section: "views", label: "Sites", description: "Which sites are underperforming and why, and do their reports match the records?" } },
  { id: "minigrid.reports", label: "Reports", question: "Which reports can I download, for which period?", domain: "minigrid", address: REPORTS_OF("minigrid"), permission: "own", menu: { sector: "minigrid", section: "views", label: "Reports", description: "Which reports can I download, for which period?" } },
  report("minigrid", "site-performance", "Mini-grid site performance", "Mini-grid operator", "The sites side by side, then each site: energy flow, PV, battery and generator, supply and interruptions, sales and collection."),
  report("minigrid", "compliance", "Mini-grid compliance and results", "Mini-grid regulator; programme funder", "Availability and hours of supply, connections, the tariff as an assumption, and each site's report against its records."),

  // DER (planned).
  { id: "der.overview", label: "DER fleet", question: NOT_BUILT, domain: "der", address: `${INTELLIGENCE}/der`, exact: true, permission: "own", planned: true, menu: { sector: "der", section: "opening", label: "Overview", description: NOT_BUILT } },

  // Planning.
  { id: "plan.overview", label: "Plan", question: "Which planners are built, and which are planned?", domain: "planning", address: PLAN, exact: true, permission: "own", menu: { sector: "planning", section: "opening", label: "Overview", description: "Which planners are built, and which are planned?" } },
  {
    id: "finance.metering-fund",
    label: "Metering Fund",
    question: "Who pays for the meters, and how is each repaid?",
    domain: "planning",
    address: `${FINANCE}/metering-fund`,
    permission: "own",
    menu: { sector: "planning", section: "views", label: "Metering", description: METERING_PURPOSE, group: "Utility planning" },
    planner: { id: "metering", group: "utility", label: "Metering", purpose: METERING_PURPOSE },
    metering: { id: "fund", step: "fund", label: "Metering Fund" },
  },
  { id: "plan.metering-allocation", label: "Metering allocation", question: "Where do the first meters go, DisCo by DisCo?", domain: "planning", address: `${PLAN}/metering-allocation`, permission: "own", metering: { id: "allocation", step: "plan", label: "DisCo allocation" } },
  { id: "plan.dt-sequencing", label: "DT sequencing", question: "Which DTs go first?", domain: "planning", address: `${PLAN}/dt-sequencing`, permission: "own", metering: { id: "dt", step: "plan", label: "DT sequencing" } },
  { id: "finance.marketplace", label: "Marketplace · Match", question: "Which funders' money goes to which approved meters?", domain: "planning", address: `${FINANCE}/marketplace`, permission: "own", metering: { id: "marketplace", step: "fund", label: "Marketplace · Match" } },
  { id: "oversight.monitoring", label: "Monitoring", question: "Is the rollout delivering against plan, operator by operator?", domain: "planning", address: `${OVERSIGHT}/monitoring`, permission: "own", metering: { id: "monitoring", step: "monitor", label: "Monitoring" } },
  { id: "initiative.journey", label: "One meter's journey", question: "How does one household get a meter, step by step?", domain: "planning", address: `${DASHBOARD}/initiatives/meter-every-customer/journey`, permission: "own", metering: { id: "journey", step: "", label: "Journey" } },
  { id: "plan.metering-report", label: "Metering Plan report", question: "Every step's figures on paper, ready to print or save as PDF.", domain: "planning", address: `${DASHBOARD}/reports/metering-plan`, permission: "own" },
  planner("plan.dt", "dt", "utility", "Distribution transformers (DT)", "Which DTs are overloaded or will be, and when to upgrade one or add another.", "Distribution transformers", "Which DTs are overloaded or will be?"),
  planner("plan.feeders", "feeders", "utility", "Feeders", "Which feeders need reinforcing or splitting to hold their supply band.", "Feeders", "Which feeders need reinforcing or splitting?"),
  planner("plan.network-expansion", "network-expansion", "utility", "Network expansion", "Where to extend the network to connect new customers, and the cost of each connection.", "Network expansion", "Where to extend the network, and at what cost?"),
  planner("plan.unserved", "unserved", "minigrid", "Unserved", "Communities with no supply, and whether a mini-grid or the grid should reach them first.", "Unserved", "Communities with no supply: mini-grid or grid first?"),
  planner("plan.underserved", "underserved", "minigrid", "Underserved", "Grid-connected communities with too few hours of supply, and where a mini-grid could close the gap.", "Underserved", "Where could a mini-grid close a supply gap?"),
  planner("plan.pue", "pue", "minigrid", "Productive use of energy (PUE)", "Mills, cold rooms and pumps that raise a site's daytime demand and its revenue.", "Productive use of energy", "Which loads raise a site's daytime demand?"),
  planner("plan.charging-hubs", "e-mobility", "minigrid", "E-mobility", "Charging electric motorcycles and tricycles on a mini-grid: demand, tariff and battery size.", "Charging hubs: siting and load", "Where should charging hubs go, and can the network carry them?"),

  // New in NAV-B, with no page yet (they get theirs in later steps, or stay planned).
  // New in NAV-B (step 6): the rail items' indexes, an initiative inside a workspace, and the planned views' pages (no figure).
  { id: "plan.rooftop-solar", label: "Rooftop and C&I solar", question: NOT_BUILT, domain: "planning", address: `${PLAN}/rooftop-solar`, permission: "own", planned: true },
  { id: "plan.storage", label: "Storage", question: NOT_BUILT, domain: "planning", address: `${PLAN}/storage`, permission: "own", planned: true },
  { id: "finance.overview", label: "Finance", question: "Who pays, and how is it repaid?", domain: "planning", address: FINANCE, exact: true, permission: "own" },
  { id: "finance.pipeline", label: "Funding pipeline", question: "Which approved applications and hub requests are ready to fund? (masked)", domain: "planning", address: `${FINANCE}/pipeline`, permission: "own", planned: true },
  { id: "oversight.overview", label: "Oversight", question: "Is the programme delivering, across operators?", domain: "planning", address: OVERSIGHT, exact: true, permission: "own" },
  { id: "oversight.regulator", label: "Regulator view", question: NOT_BUILT, domain: "planning", address: `${OVERSIGHT}/regulator`, permission: "own", planned: true },
  { id: "initiative.home", label: "Initiative", question: "The initiative as this workspace sees it.", domain: "platform", address: `${DASHBOARD}/initiatives`, permission: "own" },
  { id: "initiative.applications", label: "Applications", question: "Which meter applications wait for us, and what is each waiting for?", domain: "utility", address: `${DASHBOARD}/initiatives/meter-every-customer/applications`, permission: "own", planned: true },
];

/* ==========================================================
   WORKSPACE TYPES AND THEIR RAILS (ADR 0021): which views each
   type's rail lists. Home is first in every one; Oversight only for
   a regulator. `filled` is the one view the NAV-A shell shows inside
   a rail item, until NAV-B's rail replaces the shell.
========================================================== */

export type WorkspaceType = "utility" | "der" | "minigrid" | "financier" | "regulator";

export const WORKSPACE_TYPES: readonly WorkspaceType[] = ["utility", "minigrid", "der", "financier", "regulator"];

export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  utility: "Utility",
  der: "DER",
  minigrid: "Mini-grid",
  financier: "Financier",
  regulator: "Regulator",
};

/** The items of the signed-in rail, in order. Deliver and Customers are not among them (ADR 0021). */
export type RailItemId = "home" | "intelligence" | "plan" | "finance" | "oversight";

export const RAIL_ITEMS: readonly { id: RailItemId; label: string; question: string }[] = [
  { id: "home", label: "Home", question: "What am I working on?" },
  { id: "intelligence", label: "Intelligence", question: "What is happening on the network now?" },
  { id: "plan", label: "Plan", question: "What should we build next?" },
  { id: "finance", label: "Finance", question: "Who pays, and how is it repaid?" },
  { id: "oversight", label: "Oversight", question: "Is the programme delivering, across operators?" },
];

/** A rail item as one workspace type has it: the views it lists, and the one view the NAV-A shell shows inside it, if any. */
export type RailEntry = {
  item: RailItemId;
  views: readonly ViewId[];
  /** Shown inside the shell in NAV-A, by the existing screen's view model. Only one item per type. */
  filled?: ViewId;
};

/** The rail of each workspace type. Home is first in every one; Oversight only for a regulator. */
export const RAILS: Record<WorkspaceType, readonly RailEntry[]> = {
  utility: [
    { item: "home", views: [] },
    { item: "intelligence", views: ["utility.executive", "utility.operations", "utility.reliability", "utility.revenue", "utility.assets", "utility.events", "utility.map", "utility.ai"], filled: "utility.executive" },
    { item: "plan", views: ["plan.metering-allocation", "plan.dt-sequencing", "plan.feeders", "plan.network-expansion", "plan.charging-hubs"] },
    { item: "finance", views: ["finance.metering-fund", "finance.marketplace"] },
  ],
  minigrid: [
    { item: "home", views: [] },
    { item: "intelligence", views: ["minigrid.sites", "minigrid.map", "minigrid.ai"], filled: "minigrid.sites" },
    { item: "plan", views: ["plan.unserved", "plan.underserved", "plan.pue"] },
  ],
  der: [
    { item: "home", views: [] },
    { item: "intelligence", views: ["der.overview"] },
    { item: "plan", views: ["plan.charging-hubs", "plan.rooftop-solar", "plan.storage"], filled: "plan.charging-hubs" },
  ],
  financier: [
    { item: "home", views: [] },
    { item: "finance", views: ["finance.marketplace", "finance.metering-fund", "finance.pipeline"], filled: "finance.marketplace" },
  ],
  regulator: [
    { item: "home", views: [] },
    { item: "oversight", views: ["oversight.monitoring", "oversight.regulator"], filled: "oversight.monitoring" },
  ],
};

/* ==========================================================
   WHAT EACH WORKSPACE TYPE SHOWS, AND SO OPENS BY DEFAULT
   (Founder, 25 November 2026, correcting answer 2)

   A workspace type's default access is exactly the views the
   catalogue shows that type, never a whole sector:
   - the views its rail lists (RAILS);
   - the landing page of each rail item it has (Plan's index, its
     Intelligence domain's Overview);
   - its Reports foot (the reports of its domain; for a Utility, the
     Metering Plan report too);
   - the views its initiatives' roles list for it (INITIATIVES).
   The rail and the grant both read this one function, and a test
   holds a type's default grant equal to it.
========================================================== */

const LANDINGS: Record<WorkspaceType, Partial<Record<RailItemId, ViewId>>> = {
  utility: { home: "platform.home", intelligence: "utility.overview", plan: "plan.overview", finance: "finance.overview" },
  minigrid: { home: "platform.home", intelligence: "minigrid.overview", plan: "plan.overview" },
  der: { home: "platform.home", intelligence: "der.overview", plan: "plan.overview" },
  financier: { home: "platform.home", finance: "finance.overview" },
  regulator: { home: "platform.home", oversight: "oversight.overview" },
};

/** The reports a type's Reports foot lists (ADR 0019; the Metering Plan report is a Utility's). */
export const REPORTS_FOOT: Record<WorkspaceType, readonly ViewId[]> = {
  utility: ["utility.reports", "utility.reports.reliability", "utility.reports.operations", "utility.reports.daily-brief", "plan.metering-report"],
  minigrid: ["minigrid.reports", "minigrid.reports.site-performance", "minigrid.reports.compliance"],
  der: [],
  financier: [],
  regulator: [],
};

/** Every view a workspace type shows: its default access. */
export function workspaceViews(type: WorkspaceType): ViewId[] {
  const ids = new Set<ViewId>();
  for (const entry of RAILS[type]) {
    const landing = LANDINGS[type][entry.item];
    if (landing !== undefined) ids.add(landing);
    for (const id of entry.views) ids.add(id);
  }
  for (const id of REPORTS_FOOT[type]) ids.add(id);
  for (const initiative of INITIATIVES) for (const role of initiative.roles) if (role.audience === "organization" && role.workspaceType === type) for (const id of role.views) ids.add(id);
  return VIEWS.map((view) => view.id).filter((id) => ids.has(id));
}

/** An organization's workspace type, taken from its sectors until the database brief records it (Founder's answer 3). */
export function workspaceTypeOf(organizationSectors: readonly string[]): WorkspaceType | null {
  for (const type of ["utility", "minigrid", "der"] as const) if (organizationSectors.includes(type)) return type;
  return null;
}

/** The platform's own views every member of an organization holds by default; People is an administrator's only. */
export const PLATFORM_DEFAULT: readonly ViewId[] = ["platform.overview", "platform.home", "platform.reports", "initiative.home"];

/* ==========================================================
   THE DEMO WORKSPACE (ADR 0021 decision 6; NAV-B safeguard C)

   On the public demonstration a visitor looks at one of the five
   synthetic demo workspaces, chosen by a cookie or by ?workspace= on
   a link. Either value is only ever one of the catalogue's five
   types; anything else falls back to the default. A tenant
   deployment reads neither: its workspace is the organization of the
   person signed in.
========================================================== */

export const DEMO_WORKSPACE_COOKIE = "gridintel-demo-workspace";
export const DEMO_WORKSPACE_QUERY = "workspace";
export const DEFAULT_DEMO_WORKSPACE: WorkspaceType = "utility";

/** A demo workspace type from a cookie's or a query's value: one of the five, or the default; never the value as given. */
export function demoWorkspaceType(value: string | null | undefined): WorkspaceType {
  return WORKSPACE_TYPES.find((type) => type === value) ?? DEFAULT_DEMO_WORKSPACE;
}

/** The demo workspace that shows a view: the one preferred if its catalogue shows the view, else the first that does. */
export function demoTypeFor(viewId: ViewId | null, preferred: WorkspaceType): WorkspaceType {
  if (viewId === null || workspaceViews(preferred).includes(viewId) || VIEWS.find((view) => view.id === viewId)?.domain === "platform") return preferred;
  return WORKSPACE_TYPES.find((type) => workspaceViews(type).includes(viewId)) ?? preferred;
}

/** Where each rail item of a workspace type opens: its landing page. */
export function landingOf(type: WorkspaceType, item: RailItemId): ViewId | null {
  return LANDINGS[type][item] ?? null;
}

const BY_ID = new Map<string, View>(VIEWS.map((view) => [view.id, view]));

/** The view with this id; throws for an id the catalogue does not hold. */
export function viewOf(id: ViewId): View {
  const view = BY_ID.get(id);
  if (view === undefined) throw new Error(`Unknown view ${id}`);
  return view;
}

/** True when the catalogue holds a view with this id. */
export const isViewId = (id: string): id is ViewId => BY_ID.has(id);

/** The view's address, with the rest of the address below it (an id, a period); throws for a view with no page. */
export function hrefOf(id: ViewId, ...below: (string | number)[]): string {
  const { address } = viewOf(id);
  if (address === null) throw new Error(`The view ${id} has no page yet`);
  return [address, ...below.map((part) => encodeURIComponent(String(part)))].join("/");
}

/** The view an address is: the one whose address it is, or is below (the most specific). Null when it is none. */
export function viewAt(pathname: string): View | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  let found: View | null = null;
  for (const view of VIEWS) {
    if (view.address === null) continue;
    const here = path === view.address || (!view.exact && path.startsWith(`${view.address}/`));
    if (here && (found === null || view.address.length > (found.address ?? "").length)) found = view;
  }
  return found;
}

/** The period a report's page is for: the one segment below a report's address; null on any other address. */
export function reportPeriodAt(pathname: string): string | null {
  const view = viewAt(pathname);
  if (view?.report === undefined || view.address === null || !pathname.startsWith(`${view.address}/`)) return null;
  const rest = pathname.slice(view.address.length + 1);
  return rest === "" || rest.includes("/") ? null : decodeURIComponent(rest);
}

/** The views of a domain, in the catalogue's order. */
export const viewsOf = (domain: Domain): View[] => VIEWS.filter((view) => view.domain === domain);

/** The domain a grant key stands for: a view's, or a whole domain's; null for a key the catalogue does not know. */
export function domainOfKey(key: string): Domain | null {
  const view = BY_ID.get(key);
  if (view !== undefined) return view.domain;
  return (DOMAIN_KEYS as readonly string[]).includes(key) ? (key as Domain) : null;
}

/* ==========================================================
   OLD PERMISSION KEYS (ADR 0018) TO VIEW IDS

   A membership may hold keys from before NAV-B. Each is translated
   where a grant is built (access.ts, grantFor); a key that is a View
   ID, or a domain's key, is itself. Any other key opens nothing.
   Held by the frozen fixture test (access.pinned.test.ts): every old
   key at every old address answers as before.
========================================================== */

const METERING_VIEWS: ViewId[] = ["plan.metering-allocation", "plan.dt-sequencing", "finance.metering-fund", "finance.marketplace", "oversight.monitoring", "initiative.journey", "plan.metering-report"];

export const OLD_KEYS: Readonly<Record<string, readonly ViewId[]>> = {
  // People is an administrator's only, given by grantFor, never by a key (Founder, 25 November 2026).
  platform: ["platform.overview", "platform.home"],
  "platform.overview": ["platform.overview", "platform.home"],
  planning: viewsOf("planning").map((view) => view.id),
  "planning.overview": ["plan.overview"],
  "planning.metering": METERING_VIEWS,
  "planning.dt": ["plan.dt"],
  "planning.feeders": ["plan.feeders"],
  "planning.network-expansion": ["plan.network-expansion"],
  "planning.unserved": ["plan.unserved"],
  "planning.underserved": ["plan.underserved"],
  "planning.pue": ["plan.pue"],
  "planning.e-mobility": ["plan.charging-hubs"],
};

/** A held key as View IDs or a domain's key; empty for a key the catalogue does not know (deny). */
export function translateKey(key: string): string[] {
  const old = OLD_KEYS[key];
  if (old !== undefined) return [...old];
  return domainOfKey(key) === null ? [] : [key];
}
