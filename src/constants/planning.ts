/* The planners of the Planning sector (GEH sprint; docs/geh/DESIGN.md, section 2). Two groups, by
   who is planning: the utility and the mini-grid operator. Metering is the one built; the others
   are planned, each with a page that says what it is for and holds no figure. */

export type PlanningGroupId = "utility" | "minigrid";

export type PlannerId = "metering" | "dt" | "feeders" | "network-expansion" | "unserved" | "underserved" | "pue" | "e-mobility";

export type Planner = {
  id: PlannerId;
  group: PlanningGroupId;
  label: string;
  /** What the planner answers, in one line. */
  purpose: string;
  /** Not built yet: its page says so and holds no figure. */
  planned: boolean;
};

export const PLANNING_HOME = "/dashboard/planning";

export const PLANNING_GROUPS: { id: PlanningGroupId; label: string }[] = [
  { id: "utility", label: "Utility planning" },
  { id: "minigrid", label: "Mini-grid planning" },
];

export const PLANNERS: Planner[] = [
  { id: "metering", group: "utility", label: "Metering", planned: false, purpose: "Meter every customer in five years with no upfront payment: who pays, how the meter is recovered from token purchases, and which DTs go first." },
  { id: "dt", group: "utility", label: "Distribution transformers (DT)", planned: true, purpose: "Which DTs are overloaded or will be, and when to upgrade one or add another." },
  { id: "feeders", group: "utility", label: "Feeders", planned: true, purpose: "Which feeders need reinforcing or splitting to hold their supply band." },
  { id: "network-expansion", group: "utility", label: "Network expansion", planned: true, purpose: "Where to extend the network to connect new customers, and the cost of each connection." },
  { id: "unserved", group: "minigrid", label: "Unserved", planned: true, purpose: "Communities with no supply, and whether a mini-grid or the grid should reach them first." },
  { id: "underserved", group: "minigrid", label: "Underserved", planned: true, purpose: "Grid-connected communities with too few hours of supply, and where a mini-grid could close the gap." },
  { id: "pue", group: "minigrid", label: "Productive use of energy (PUE)", planned: true, purpose: "Mills, cold rooms and pumps that raise a site's daytime demand and its revenue." },
  { id: "e-mobility", group: "minigrid", label: "E-mobility", planned: true, purpose: "Charging electric motorcycles and tricycles on a mini-grid: demand, tariff and battery size." },
];

export const plannerHref = (id: PlannerId) => `${PLANNING_HOME}/${id}`;

export const plannerOf = (id: string): Planner | undefined => PLANNERS.find((planner) => planner.id === id);

/** How the Platform Overview describes the sector while only Metering is built. */
export const PLANNING_STATUS = "Metering is built. The other planners are planned.";

export type MeteringScreenId = "allocation" | "dt" | "fund" | "marketplace" | "monitoring" | "about";

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
export const METERING_REPORT_HREF = `${PLANNING_HOME}/metering/report`;

/** The Metering planner's screens, in the order of the story: Plan, Fund, Monitor. */
export const METERING_SCREENS: { id: MeteringScreenId; step: string; label: string; href: string; planned: boolean }[] = [
  { id: "allocation", step: STEPS.plan, label: "DisCo allocation", href: `${PLANNING_HOME}/metering/allocation`, planned: false },
  { id: "dt", step: STEPS.plan, label: "DT sequencing", href: `${PLANNING_HOME}/metering/dt`, planned: false },
  { id: "fund", step: STEPS.fund, label: "Metering Fund", href: `${PLANNING_HOME}/metering`, planned: false },
  { id: "marketplace", step: STEPS.fund, label: "Marketplace · Match", href: `${PLANNING_HOME}/metering/marketplace`, planned: false },
  { id: "monitoring", step: STEPS.monitor, label: "Monitoring", href: `${PLANNING_HOME}/metering/monitoring`, planned: false },
  { id: "about", step: "", label: "About this build", href: `${PLANNING_HOME}/about-this-build`, planned: false },
];

/** What the bar says above a planning screen that shows no data: the Planning overview and About this build, each with its own summary. */
export const NO_DATA_NOTICE = {
  label: "NO DATA ON THIS SCREEN",
  summaries: {
    [PLANNING_HOME]: "The planners in the Planning section and which are built. No figure is shown here.",
    [`${PLANNING_HOME}/about-this-build`]: "What existed before the Global Energy Hackathon sprint and what was built during it, from the repository's sprint changelog.",
  } as Record<string, string>,
};

/** What the bar above the Metering Plan report says: published figures and assumptions, with the monitoring records synthetic. */
export const REPORT_NOTICE = {
  paths: [`${PLANNING_HOME}/metering/report`],
  label: "PUBLISHED FIGURES AND ASSUMPTIONS; MONITORING SYNTHETIC",
  summary: "NERC's published figures are cited where they are shown; every other input is an assumption or a placeholder, labelled. The monitoring records in the Availability section are synthetic.",
};

/** What the bar above the Metering Fund and the DisCo allocation says about their data: they hold no synthetic record. */
export const PUBLISHED_FIGURES_NOTICE = {
  paths: [`${PLANNING_HOME}/metering`, `${PLANNING_HOME}/metering/allocation`],
  label: "PUBLISHED FIGURES AND ASSUMPTIONS",
  summary:
    "No synthetic records on this screen. NERC's published figures are cited where they are shown; the brief case is GEH Brief 15's test scenario. Every other input is an assumption, labelled.",
  context: [
    { term: "NERC figures as of", value: "30 Jun 2026" },
    { term: "Latest reported", value: "Aug 2026" },
  ],
};
