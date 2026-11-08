/* ==========================================================
   WORKSPACES, THEIR RAIL AND THEIR VIEWS (ADR 0021, draft)

   A workspace is an organization's branded environment; in code it
   is the Organization (the tenant of ADR 0020). Its type decides the
   rail it is given. A View is one screen within a rail item (the
   word ADR 0017 used to call a "workspace").

   Phase NAV-A: this catalogue draws the clickable shell under
   /preview. Each view names the address it has today; nothing moves
   until NAV-B. The current menu (navigation.ts) is unchanged.

   Pure data and pure functions: no figure, no clock, no I/O.
========================================================== */

import { MINIGRID_HOME, UTILITY_HOME } from "./navigation.ts";
import { METERING_SCREENS, plannerHref } from "./planning.ts";

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

export type ViewId =
  | "utility.executive"
  | "utility.operations"
  | "utility.reliability"
  | "utility.revenue"
  | "utility.assets"
  | "utility.events"
  | "utility.map"
  | "utility.ai"
  | "minigrid.sites"
  | "minigrid.map"
  | "minigrid.ai"
  | "der.overview"
  | "plan.metering-allocation"
  | "plan.dt-sequencing"
  | "plan.feeders"
  | "plan.network-expansion"
  | "plan.charging-hubs"
  | "plan.unserved"
  | "plan.underserved"
  | "plan.pue"
  | "plan.rooftop-solar"
  | "plan.storage"
  | "finance.metering-fund"
  | "finance.marketplace"
  | "finance.pipeline"
  | "oversight.monitoring"
  | "oversight.regulator"
  | "initiative.applications"
  | "initiative.journey";

export type View = {
  id: ViewId;
  label: string;
  /** The question the view answers. */
  question: string;
  /** Where the screen is today; null when it has no page yet. NAV-B moves it. */
  current: string | null;
  /** Not built yet: shown with the word "Planned", and holding no figure. */
  planned?: boolean;
};

const metering = (id: (typeof METERING_SCREENS)[number]["id"]) => METERING_SCREENS.find((screen) => screen.id === id)!.href;

export const VIEWS: readonly View[] = [
  { id: "utility.executive", label: "Executive", question: "What is happening across the portfolio, and where should I look first?", current: `${UTILITY_HOME}/executive` },
  { id: "utility.operations", label: "Operations", question: "What does the network look like, level by level?", current: `${UTILITY_HOME}/operations` },
  { id: "utility.reliability", label: "Reliability", question: "Which feeders fail their customers, and why?", current: `${UTILITY_HOME}/reliability` },
  { id: "utility.revenue", label: "Revenue", question: "Where is revenue not realised?", current: `${UTILITY_HOME}/revenue` },
  { id: "utility.assets", label: "Assets", question: "Which assets require attention?", current: `${UTILITY_HOME}/assets` },
  { id: "utility.events", label: "Events / Alarms", question: "What is wrong now, where, and who is affected?", current: `${UTILITY_HOME}/events` },
  { id: "utility.map", label: "GIS Map", question: "Where is the network, and what is wrong on it now?", current: `${UTILITY_HOME}/map` },
  { id: "utility.ai", label: "AI Assistant", question: "Planned. Not built yet.", current: `${UTILITY_HOME}/ai`, planned: true },
  { id: "minigrid.sites", label: "Sites", question: "Which sites are underperforming, and do their reports match the records?", current: `${MINIGRID_HOME}/sites` },
  { id: "minigrid.map", label: "GIS Map", question: "Where are the sites, and how does each one stand?", current: `${MINIGRID_HOME}/map` },
  { id: "minigrid.ai", label: "AI Assistant", question: "Planned. Not built yet.", current: `${MINIGRID_HOME}/ai`, planned: true },
  { id: "der.overview", label: "DER fleet", question: "Planned. Not built yet.", current: "/dashboard/der", planned: true },
  { id: "plan.metering-allocation", label: "Metering allocation", question: "Where do the first meters go, DisCo by DisCo?", current: metering("allocation") },
  { id: "plan.dt-sequencing", label: "DT sequencing", question: "Which DTs go first?", current: metering("dt") },
  { id: "plan.feeders", label: "Feeders", question: "Which feeders need reinforcing or splitting?", current: plannerHref("feeders"), planned: true },
  { id: "plan.network-expansion", label: "Network expansion", question: "Where to extend the network, and at what cost?", current: plannerHref("network-expansion"), planned: true },
  { id: "plan.charging-hubs", label: "Charging hubs: siting and load", question: "Where should charging hubs go, and can the network carry them?", current: plannerHref("e-mobility"), planned: true },
  { id: "plan.unserved", label: "Unserved", question: "Communities with no supply: mini-grid or grid first?", current: plannerHref("unserved"), planned: true },
  { id: "plan.underserved", label: "Underserved", question: "Where could a mini-grid close a supply gap?", current: plannerHref("underserved"), planned: true },
  { id: "plan.pue", label: "Productive use of energy", question: "Which loads raise a site's daytime demand?", current: plannerHref("pue"), planned: true },
  { id: "plan.rooftop-solar", label: "Rooftop and C&I solar", question: "Planned. Not built yet.", current: null, planned: true },
  { id: "plan.storage", label: "Storage", question: "Planned. Not built yet.", current: null, planned: true },
  { id: "finance.metering-fund", label: "Metering Fund", question: "Who pays for the meters, and how is each repaid?", current: metering("fund") },
  { id: "finance.marketplace", label: "Marketplace · Match", question: "Which funders' money goes to which approved meters?", current: metering("marketplace") },
  { id: "finance.pipeline", label: "Funding pipeline", question: "Which approved applications and hub requests are ready to fund? (masked)", current: null, planned: true },
  { id: "oversight.monitoring", label: "Monitoring", question: "Is the rollout delivering against plan, operator by operator?", current: metering("monitoring") },
  { id: "oversight.regulator", label: "Regulator view", question: "Planned. Not built yet.", current: null, planned: true },
  { id: "initiative.applications", label: "Applications", question: "Which meter applications wait for us, and what is each waiting for?", current: null, planned: true },
  { id: "initiative.journey", label: "One meter's journey", question: "How does one household get a meter, step by step?", current: metering("journey") },
];

export function viewOf(id: ViewId): View {
  const view = VIEWS.find((one) => one.id === id);
  if (view === undefined) throw new Error(`Unknown view ${id}`);
  return view;
}

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

/** The rail of a workspace type, with each item's label and question. */
export function railFor(type: WorkspaceType): (RailEntry & { label: string; question: string })[] {
  return RAILS[type].map((entry) => {
    const item = RAIL_ITEMS.find((one) => one.id === entry.item)!;
    return { ...entry, label: item.label, question: item.question };
  });
}

/** Where every workspace's reports are listed today (ADR 0019). Reports are login-only: never on a public page. */
export function reportsHrefFor(type: WorkspaceType): string {
  if (type === "utility") return `${UTILITY_HOME}/reports`;
  if (type === "minigrid") return `${MINIGRID_HOME}/reports`;
  return "/dashboard/reports";
}
