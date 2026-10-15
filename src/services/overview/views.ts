import type { LevelKind, MetricView, ReportedComparisonView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — OVERVIEW VIEW MODELS

   What the overview screens receive: the Platform Overview and each
   sector's Overview. An overview answers "what needs attention
   here?" in a few lines and leads into the screens that hold the
   detail. It adds no figure of its own: every number on it is a
   MetricView taken, unchanged, from the read model of the screen
   it links to, and every line names the rule by which it is listed.

   Every sector has the same shape, so one component shows a finding
   wherever it appears.
========================================================== */

/** How a line is to be marked: a meaning, which the design system turns into a mark, a word and a colour. */
export type AttentionTone = "alert" | "watch" | "note";

/** A workspace of a sector, by a stable key the UI turns into an address. */
export type WorkspaceKey =
  | "utility.executive"
  | "utility.operations"
  | "utility.reliability"
  | "utility.revenue"
  | "utility.assets"
  | "utility.events"
  | "minigrid.sites";

/** Where a line leads: the screen that holds the figure's full source and method. */
export type AttentionTarget = { type: "level"; kind: LevelKind; id: string } | { type: "site"; id: string } | { type: "workspace"; workspace: WorkspaceKey };

export interface AttentionItemView {
  /** Stable within a screen: "<rule>:<subject>". */
  id: string;
  /** The fixed rule that listed it, e.g. "in_progress". */
  rule: string;
  tone: AttentionTone;
  /** What kind of line it is, in words, e.g. "In progress now". */
  kind: string;
  /** One sentence: what was found. */
  statement: string;
  /** The figure shown with the statement, from the read model of the screen it leads to; null when the line has none. */
  figure: MetricView | null;
  /** Set when the figure is a difference: it is written with its sign. */
  figureSigned: boolean;
  /** Words that belong after the figure. */
  figureNote: string | null;
  /** More figures behind the statement, one tap away. */
  more: MetricView[];
  /** Further rules the same subject met, each with its own figure; shown under the statement. Absent on most lines. */
  findings?: AttentionFindingView[];
  /** For a line about a report: each claim that differs, beside the calculation on its basis. */
  comparisons: ReportedComparisonView[];
  /** The rule, in words, so that a reader can see why this is listed and something else is not. */
  ruleText: string;
  target: AttentionTarget;
  /** What the link says, e.g. "Open Farm Road 11 kV feeder". */
  targetLabel: string;
}

/** One rule a subject met, with the figure that met it. */
export interface AttentionFindingView {
  title: string;
  figure: MetricView;
  /** Set when the figure is a difference: it is written with its sign. */
  signed: boolean;
  /** Words that belong after the figure, e.g. "69 hours over rating". */
  note: string | null;
  /** A figure beside the finding that is not what it was found by, with what it is part of. */
  context: { figure: MetricView; note: string } | null;
}

/** A workspace of the sector, with the question it answers and how much of the attention list it holds. */
export interface WorkspaceLinkView {
  workspace: WorkspaceKey;
  label: string;
  question: string;
}

export interface SectorOverviewView {
  sector: "utility" | "minigrid";
  title: string;
  organization: string | null;
  /** What needs attention, in the fixed order of the rules. Never ranked or cut by the screen. */
  attention: AttentionItemView[];
  /** Said when nothing is listed, and why that can or cannot be read as "nothing is wrong". */
  attentionNote: string | null;
  /** The few figures that say how the sector stands, each from the workspace that owns it. */
  headline: MetricView[];
  workspaces: WorkspaceLinkView[];
  sourcing: SourcingView;
}

/** The split of ATC&C loss into its three parts, as the Executive read model holds it. */
export interface LossSplitView {
  total: MetricView;
  parts: { key: "technical" | "commercial" | "collection"; metric: MetricView }[];
  /** Whose figures they are, when summed over sections. */
  scopeNote: string | null;
}

export interface UtilityOverviewView extends SectorOverviewView {
  sector: "utility";
  /** null when the losses could not be accounted; `lossSplitNote` then says why. */
  lossSplit: LossSplitView | null;
  lossSplitNote: string | null;
}

/** One site's renewable fraction, for the generation-mix strip. */
export interface SiteMixView {
  id: string;
  name: string;
  plant: string;
  renewableFraction: MetricView;
  availability: MetricView;
  collectionEfficiency: MetricView;
}

export interface MinigridOverviewView extends SectorOverviewView {
  sector: "minigrid";
  /** How complete the list of sites is; anything but "complete" means a site may exist that is not shown. */
  completeness: "complete" | "partial" | "not_available";
  sites: SiteMixView[];
}

/* ---------------- The platform ---------------- */

export interface PlatformSectorView {
  sector: "utility" | "minigrid";
  title: string;
  organization: string | null;
  /** The sector's first few lines, by the rule in `selectionRule`. */
  findings: AttentionItemView[];
  /** How many lines the sector's own Overview holds, shown here or not. */
  findingsTotal: number;
  /** How many of them are not shown here. */
  findingsMore: number;
  headline: MetricView[];
}

export interface PlatformOverviewView {
  sectors: PlatformSectorView[];
  /** How the lines shown for each sector were chosen from its Overview, in words. */
  selectionRule: string;
  sourcing: SourcingView;
}
