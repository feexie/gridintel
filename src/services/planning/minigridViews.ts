/* View models of the mini-grid planner (Phase MG-PLAN-A; no screen yet). Every figure is formatted
   here and carries its status: reported, calculated (with its method), an assumption, a
   placeholder, an input, synthetic or not available. Every benchmark says how many reference
   sites it rests on and carries the reference dataset's credit. A screen displays them; it
   calculates nothing. */

import type { ReferenceAttributionView } from "../minigrid/referenceViews.ts";

export type MinigridPlanStatus = "reported" | "calculated" | "assumption" | "placeholder" | "input" | "synthetic" | "not_available";

export interface MinigridPlanFigure {
  key: string;
  label: string;
  /** Formatted; says why when there is no figure. */
  value: string;
  status: MinigridPlanStatus;
  /** The source, the method, or the basis. */
  basis: string;
}

export interface MinigridMethodView {
  id: string;
  version: string;
  name: string;
  disclaimer: string;
}

export interface MinigridDemandRowView {
  year: string;
  p50: string;
  p90: string;
  noDiversityUpperBound: string;
  p50WithUplift: string | null;
  ramp: string;
  buyingShare: string;
}

export interface MinigridPlanView {
  community: { id: string; name: string; customers: string; point: string; status: "synthetic" };
  /** "1 reference site: RMG01". */
  references: string;
  inputs: MinigridPlanFigure[];
  demand: {
    label: string;
    rows: MinigridDemandRowView[];
    /** What happened at the reference sites year by year: a labelled, confounded scenario, never the default. */
    scenario: { label: string; rows: { year: string; p50: string; p90: string }[] };
    exclusions: string[]; notes: string[]; method: MinigridMethodView };
  sizing: { designDay: string; figures: MinigridPlanFigure[]; utilisation: { year: string; p50: string; p90: string }[]; oversized: string | null; method: MinigridMethodView } | null;
  productiveUse: { figure: MinigridPlanFigure; examples: string[]; method: MinigridMethodView } | null;
  tariff: {
    base: string;
    /** The fixed budget is the middle case; no scenario has a positive elasticity. */
    scenarios: { label: string; elasticity: string; middle: boolean; rows: { tariff: string; kwhPerDay: string; revenuePerDay: string }[]; confounders: string[] }[];
    range: string;
    /** Changes (or a user figure) with a positive elasticity: shown with their confounders, used in no scenario. */
    notUsable: { label: string; elasticity: string; reason: string; confounders: string[] }[];
    note: string | null;
    method: MinigridMethodView;
  };
  subsidyGap: {
    /** The scaled reference cost, and "Not calculated" while an input is unset. */
    figures: MinigridPlanFigure[];
    /** Side by side under each tariff scenario: the fixed budget (the middle case, with its note), each usable reference change, the user's. Never a positive e. */
    scenarios: { label: string; elasticity: string; middle: boolean; gap: MinigridPlanFigure; repay: MinigridPlanFigure; note: string | null }[];
    method: MinigridMethodView;
  };
  notClaimed: { method: string; claims: string }[];
  attribution: ReferenceAttributionView[];
  sourcing: { synthetic: boolean; sources: { id: string; name: string; kind: string }[]; citations: { id: string; title: string; url: string | null }[] };
}
