import type { MetricView, MethodView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — SPATIAL VIEW MODELS

   What a map, and anything else that asks a spatial question,
   receives. Plain, serialisable data. Every number is a MetricView
   from the service that owns it, with its status and origin; a map
   draws and never calculates.

   Every result says whether it is limited to the viewer's territory
   (`scopeLimited`). When it is, an empty list means "nothing of
   yours", never "nothing there".
========================================================== */

export interface PointView {
  latitude: number;
  longitude: number;
}

export type GeometryView =
  | { type: "point"; point: PointView }
  | { type: "line"; path: PointView[] }
  | { type: "area"; polygons: { outer: PointView[]; holes: PointView[][] }[] };

export interface BoundsView {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** How a geometry was obtained; anything but "surveyed" or "digitised" must be said where it is drawn. */
export type BasisView = "surveyed" | "digitised" | "schematic" | "inherited" | "unspecified";

/** Any located thing, of any module: a substation, a feeder route, and later a site or a DER asset. */
export interface EntityView {
  kind: string;
  id: string;
  name: string;
  /** The kind in words, e.g. "Distribution transformer". */
  kindLabel: string;
  /** The module that holds it, e.g. "utility". */
  module: string;
  /** null when the entity has no location; `notLocatedReason` then says why. */
  geometry: GeometryView | null;
  basis: BasisView | null;
  /** With basis "inherited": the entity whose location this is. */
  inheritedFrom: { kind: string; id: string } | null;
  notLocatedReason: string | null;
}

export interface AreaView {
  id: string;
  kind: string;
  name: string;
  geometry: GeometryView;
}

export type CoverageView = "complete" | "partial" | "not_available";

/** What every spatial result carries. */
export interface SpatialResultBase {
  /** True when the result holds only what lies in the viewer's territory. */
  scopeLimited: boolean;
  sourcing: SourcingView;
}

/* ---------------- What is here ---------------- */

export interface HereView extends SpatialResultBase {
  point: PointView;
  withinMetres: number;
  /** Nearest first. */
  entities: (EntityView & { distanceMetres: number })[];
  /** The areas the point is in. */
  areas: AreaView[];
  /** How complete the entity lists searched are. */
  coverage: CoverageView;
}

/* ---------------- What is inside an area ---------------- */

export interface EntityGroupView {
  kind: string;
  kindLabel: string;
  count: number;
  /** null when there are too many to list and the kind was not asked for by name. */
  entities: EntityView[] | null;
}

export interface InsideView extends SpatialResultBase {
  area: AreaView;
  /** Entities wholly inside the area, by kind. */
  inside: EntityGroupView[];
  /** Lines and areas that are partly inside and partly outside: in neither, and listed so. */
  crossing: EntityView[];
  coverage: CoverageView;
  method: MethodView;
}

/* ---------------- What is behind an asset ---------------- */

export interface BehindView extends SpatialResultBase {
  subject: EntityView;
  /** What supplies the subject, nearest first. */
  upstream: EntityView[];
  /** What is supplied through the subject, by kind. */
  downstream: EntityGroupView[];
  /** False when the source does not record what the subject supplies. */
  downstreamKnown: boolean;
  /** Counts of what is behind it, e.g. active accounts, each with its origin. */
  facts: MetricView[];
  /** The areas the subject is in. */
  areas: AreaView[];
}

/* ---------------- Totals by area ---------------- */

export interface AreaTotalRow {
  area: AreaView;
  total: MetricView;
  /** How many entities' figures are in the total. */
  entities: number;
}

export interface AreaTotalsView extends SpatialResultBase {
  measure: { id: string; label: string; module: string; entityKindLabel: string };
  rows: AreaTotalRow[];
  /** Figures of entities that are located but in none of the areas. */
  outsideEveryArea: MetricView;
  /** Figures of entities with no location. */
  notLocated: MetricView;
  /**
   * What the figure for the whole holds that no entity carries. null when the measure states
   * no whole, or when the viewer is limited to a territory: the whole is then not theirs to see.
   */
  remainder: MetricView | null;
  /** What the remainder is made of, in the measure's words. */
  remainderNote: string | null;
  /** What the figure is and is not; must be shown with it. */
  definition: string;
  areaCoverage: CoverageView;
  method: MethodView;
}

/* ---------------- Layers and the map ---------------- */

/** How a class of a legend is to be drawn: a meaning, which the design system turns into a colour. */
export type LegendTone = "neutral" | "good" | "watch" | "alert" | "no_data";

export interface LegendEntryView {
  key: string;
  label: string;
  tone: LegendTone;
}

/** A layer a module has registered, as the layer picker lists it. */
export interface LayerSummaryView {
  id: string;
  module: string;
  title: string;
  description: string;
  shape: "point" | "line" | "area";
  /** Layers with the same group colour the same things: one of them is shown at a time. */
  exclusiveGroup: string | null;
  legend: LegendEntryView[];
  onByDefault: boolean;
}

export interface FeatureView {
  entity: EntityView;
  /** The figure the layer colours by, from the service that owns it; null on a layer with no figure. */
  metric: MetricView | null;
  /** The legend class the feature is in; null on a layer with no figure. */
  classKey: string | null;
}

export interface MapLayerView extends LayerSummaryView {
  features: FeatureView[];
  /** Entities of this layer that cannot be drawn because they have no location. Never dropped silently. */
  notLocated: EntityView[];
  coverage: CoverageView;
  sourcing: SourcingView;
}

export interface MapView extends SpatialResultBase {
  modules: { id: string; title: string; layers: LayerSummaryView[] }[];
  /** The layers asked for, in the order asked. */
  layers: MapLayerView[];
  /** The box holding everything drawn; null when nothing is. */
  bounds: BoundsView | null;
  period: { start: string; end: string };
  asOf: string;
}
