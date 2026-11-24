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
  demand: { label: string; rows: MinigridDemandRowView[]; exclusions: string[]; notes: string[]; method: MinigridMethodView };
  sizing: { designDay: string; figures: MinigridPlanFigure[]; utilisation: { year: string; p50: string; p90: string }[]; oversized: string | null; method: MinigridMethodView } | null;
  productiveUse: { figure: MinigridPlanFigure; examples: string[]; method: MinigridMethodView } | null;
  tariff: { base: string; scenarios: { label: string; elasticity: string; rows: { tariff: string; kwhPerDay: string; revenuePerDay: string }[]; confounders: string[] }[]; note: string | null; method: MinigridMethodView };
  subsidyGap: { figures: MinigridPlanFigure[]; method: MinigridMethodView };
  notClaimed: { method: string; claims: string }[];
  attribution: ReferenceAttributionView[];
  sourcing: { synthetic: boolean; sources: { id: string; name: string; kind: string }[]; citations: { id: string; title: string; url: string | null }[] };
}
