/* ==========================================================
   GRIDINTEL DOMAIN — REFERENCES

   Typed pointers between records. A reference names the kind of
   record as well as its id, so one field can point at different
   kinds of asset without ambiguity.
========================================================== */

/** Kinds of equipment and connection point held in the registry. */
export type AssetKind =
  | "substation"
  | "power_transformer"
  | "feeder"
  | "distribution_transformer"
  | "service_point"
  | "meter"
  | "edge_device"
  /** A mini-grid site (site.ts). */
  | "site"
  /** A PV array, battery, generator or inverter of a site (site.ts). */
  | "generation_asset";

export interface AssetRef {
  kind: AssetKind;
  id: string;
}

/**
 * Kinds of record that figures can be reported or aggregated for.
 * "organization" and "region" are administrative scopes; the rest are
 * electrical scopes: three levels of a distribution network, and a site. The two are never interchangeable: a region is
 * not an electrical boundary.
 */
export type ScopeKind =
  | "organization"
  | "region"
  | "substation"
  | "feeder"
  | "distribution_transformer"
  /**
   * A mini-grid site: an electrical scope of its own, under no substation.
   * Its energy is accounted from its own generation (the site energy
   * balance), never as a section of a distribution network.
   */
  | "site";

export interface ScopeRef {
  kind: ScopeKind;
  id: string;
}

/**
 * A name found in source data that has not been matched to a registry
 * record, e.g. "Adamawa / Jimeta / Feeder 4". It is kept as written and
 * is never linked automatically by guessing; matching is an explicit
 * later step.
 */
export interface UnresolvedRef {
  kind: AssetKind | ScopeKind;
  label: string;
  /** Where the label was found, to help whoever resolves it. */
  context?: string;
}

/** A reference that may or may not be resolved yet. */
export type EntityRef = AssetRef | UnresolvedRef;
