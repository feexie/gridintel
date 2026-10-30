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

/** What the bar above the Metering Fund says about its data: it holds no synthetic record. */
export const PUBLISHED_FIGURES_NOTICE = {
  path: `${PLANNING_HOME}/metering`,
  label: "PUBLISHED FIGURES AND ASSUMPTIONS",
  summary:
    "No synthetic records on this screen. The Nigeria case uses NERC's published figures, cited where they are shown; the brief case is GEH Brief 15's test scenario. Every other input is an assumption, labelled.",
  context: [
    { term: "NERC figures as of", value: "30 Jun 2026" },
    { term: "Latest reported", value: "Aug 2026" },
  ],
};
