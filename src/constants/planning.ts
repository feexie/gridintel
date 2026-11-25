/* The planners of the Planning sector (GEH sprint; docs/geh/DESIGN.md, section 2). Two groups, by
   who is planning: the utility and the mini-grid operator. Metering is the one built; the others
   are planned, each with a page that says what it is for and holds no figure.

   The planners and the Metering screens are Views (views.ts): their ids, addresses and labels
   are taken from the catalogue here, never written twice (NAV-B). */

import { hrefOf, VIEWS, type MeteringScreenId, type PlannerId, type ViewId } from "./views.ts";

export type { MeteringScreenId, PlannerId };

export type PlanningGroupId = "utility" | "minigrid";

export type Planner = {
  id: PlannerId;
  /** The View ID of the planner's page. */
  view: ViewId;
  group: PlanningGroupId;
  label: string;
  /** What the planner answers, in one line. */
  purpose: string;
  /** Not built yet: its page says so and holds no figure. */
  planned: boolean;
};

export const PLANNING_HOME = hrefOf("plan.overview");

export const PLANNING_GROUPS: { id: PlanningGroupId; label: string }[] = [
  { id: "utility", label: "Utility planning" },
  { id: "minigrid", label: "Mini-grid planning" },
];

export const PLANNERS: Planner[] = VIEWS.filter((view) => view.planner !== undefined).map((view) => ({
  id: view.planner!.id,
  view: view.id,
  group: view.planner!.group,
  label: view.planner!.label,
  purpose: view.planner!.purpose,
  planned: view.planned === true,
}));

export const plannerHref = (id: PlannerId) => hrefOf(PLANNERS.find((planner) => planner.id === id)!.view);

export const plannerOf = (id: string): Planner | undefined => PLANNERS.find((planner) => planner.id === id);

/** The planner whose page is at this last segment of its address (the catalogue's: "charging-hubs" for E-mobility). */
export const plannerAt = (segment: string): Planner | undefined => PLANNERS.find((planner) => hrefOf(planner.view).split("/").at(-1) === segment);

/** The last segment of a planner's address. */
export const plannerSegment = (planner: Planner): string => hrefOf(planner.view).split("/").at(-1)!;

/** How the Platform Overview describes the sector while only Metering is built. */
export const PLANNING_STATUS = "Metering is built. The other planners are planned.";

/* The three steps of the Metering planner, each paired with the hackathon's three A's: plan for
   access, fund for affordability, monitor for availability. */
export const STEPS = {
  plan: "Plan · Access",
  fund: "Fund · Affordability",
  monitor: "Monitor · Availability",
} as const;

export const POSITIONING_LINE = "Plan for access, fund for affordability, monitor for availability.";

/** What each step covers, in the order of the story. */
export const STEP_SCOPES: { step: string; covers: string }[] = [
  { step: STEPS.plan, covers: "DisCo allocation and DT sequencing: where the first meters go, DisCo by DisCo and DT by DT." },
  { step: STEPS.fund, covers: "The Metering Fund: the charge under the cap, the charge in each band, Lifeline customers exempt, and the GridIntel structure." },
  { step: STEPS.monitor, covers: "Monitoring of verified installs, with the five-year rollout and the estimated bills it removes." },
];

/** The Metering Plan report: every step's figures on paper, ready to print or save as PDF. */
export const METERING_REPORT_HREF = hrefOf("plan.metering-report");

/** The Metering planner's screens, in the order of the story: Plan, Fund, Monitor. */
export const METERING_SCREENS: { id: MeteringScreenId; view: ViewId; step: string; label: string; href: string; planned: boolean }[] = (
  ["allocation", "dt", "fund", "marketplace", "monitoring", "journey", "about"] as const
).map((id) => {
  const view = VIEWS.find((one) => one.metering?.id === id)!;
  const step = view.metering!.step;
  return { id, view: view.id, step: step === "" ? "" : STEPS[step], label: view.metering!.label, href: hrefOf(view.id), planned: view.planned === true };
});

/** What the bar says above a planning screen that shows no data: the Planning overview and About this build, each with its own summary. */
export const NO_DATA_NOTICE = {
  label: "NO DATA ON THIS SCREEN",
  summaries: {
    [PLANNING_HOME]: "The planners in the Planning section and which are built. No figure is shown here.",
    [hrefOf("platform.about-this-build")]: "What existed before the Global Energy Hackathon sprint and what was built during it, from the repository's sprint changelog.",
  } as Record<string, string>,
};

/** What the bar above the Metering Plan report says: published figures and assumptions, with the monitoring records synthetic. */
export const REPORT_NOTICE = {
  paths: [METERING_REPORT_HREF],
  label: "PUBLISHED FIGURES AND ASSUMPTIONS; MONITORING SYNTHETIC",
  summary: "NERC's published figures are cited where they are shown; every other input is an assumption or a placeholder, labelled. The monitoring records in the Availability section are synthetic.",
};

/** What the bar above the Metering Fund and the DisCo allocation says about their data: they hold no synthetic record. */
export const PUBLISHED_FIGURES_NOTICE = {
  paths: [hrefOf("finance.metering-fund"), hrefOf("plan.metering-allocation")],
  label: "PUBLISHED FIGURES AND ASSUMPTIONS",
  summary:
    "No synthetic records on this screen. NERC's published figures are cited where they are shown; the brief case is GEH Brief 15's test scenario. Every other input is an assumption, labelled.",
  context: [
    { term: "NERC figures as of", value: "30 Jun 2026" },
    { term: "Latest reported", value: "Aug 2026" },
  ],
};
