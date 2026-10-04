import type { IsoDate, IsoTimestamp, Period } from "./primitives";
import type { Provenance } from "./provenance";
import type { ScopeRef, UnresolvedRef } from "./refs";
import type { InterruptionClass, InterruptionOrigin } from "./events";

/* ==========================================================
   GRIDINTEL DOMAIN — REPORTED FIGURES

   A ReportedKpi is a figure as someone else published it: a
   regulator, a utility, a partner, or a synthetic demonstration dataset.
   It is stored exactly as stated.

   Reported figures are never treated as observations, never
   overwrite calculated values, and are never overwritten by them.
   Analytics compare the two side by side and explain differences.
========================================================== */

/**
 * Metric identifiers. Transformer counts are split by type, because
 * "transformers" is used for both power and distribution transformers
 * in source data; use `transformer_count_unspecified` when the source
 * does not say which.
 */
export type KpiKey =
  | "atcc"
  | "technical_loss"
  | "commercial_loss"
  | "billing_efficiency"
  | "collection_efficiency"
  | "saidi"
  | "saifi"
  | "caidi"
  | "asai"
  | "availability"
  | "revenue_billed"
  | "revenue_collected"
  | "energy_received"
  | "energy_billed"
  | "customer_count"
  | "meter_count"
  | "prepaid_meter_count"
  | "postpaid_meter_count"
  | "substation_count"
  | "feeder_count"
  | "power_transformer_count"
  | "distribution_transformer_count"
  | "transformer_count_unspecified"
  | "active_outage_count"
  | "active_alarm_count"
  | "outage_count"
  | "outage_hours"
  | "transformer_loading"
  | "installed_capacity"
  | "available_capacity"
  | "load_allocation";

/** "percent" is 0–100 as published; "fraction" is 0–1. */
export type KpiUnit =
  | "percent"
  | "fraction"
  | "kWh"
  | "MWh"
  | "kW"
  | "MW"
  | "kVA"
  | "MVA"
  | "hours"
  | "minutes"
  | "interruptions_per_customer"
  | "count"
  | "currency";

/**
 * What a figure includes: the definitions that change its value without
 * changing its name. Two figures are like for like only when every
 * dimension that matters for their metric is stated and equal. A
 * dimension left out is "not stated", which is never assumed to match.
 */
export interface KpiBasis {
  /** Reliability indices: the classes of interruption that are counted. */
  interruptionClasses?: readonly InterruptionClass[];
  /** Reliability indices: whether planned interruptions are counted. */
  plannedInterruptions?: "included" | "excluded";
  /**
   * Reliability indices: the attribution rule, as the origin points the
   * figure treats as upstream of the business it measures. An interruption
   * that began anywhere else is put on that business's own network.
   *
   * `interruptionClasses` says which classes a figure counts; this says how
   * an interruption was put in a class. Two figures can count the same
   * classes and still classify the same event differently. Left out when the
   * source does not say; it is never assumed.
   */
  upstreamOrigins?: readonly InterruptionOrigin[];
  /**
   * Collection figures: "cash" is money received in the period over
   * charges raised in it; "accrual" is money received against the
   * period's own charges, whenever it arrives.
   */
  collection?: "cash" | "accrual";
  /** Loss figures: what energy the loss is a fraction of. */
  lossBasis?: "energy_input_net_of_transfers_out" | "energy_input_gross";
}

/**
 * A figure exactly as a source reported it.
 *
 * `period`, `asOf`, `document`, `methodology` and `reportedAt` are
 * `| null` rather than optional, so every record states explicitly when
 * something is unknown. A rate (ATC&C, SAIDI…) needs a period and a
 * point-in-time count needs `asOf` before it can be compared with
 * anything.
 */
export interface ReportedKpi {
  id: string;
  metric: KpiKey;
  /** What the figure is for. An unresolved name when the source's scope is not in the registry. */
  scope: ScopeRef | UnresolvedRef;
  period: Period | null;
  asOf: IsoTimestamp | null;
  /** The value as the source states it, in `unit`. */
  value: number;
  unit: KpiUnit;
  /** ISO 4217 code; required in practice when `unit` is "currency". */
  currency?: string;
  source: {
    name: string;
    kind:
      | "regulator"
      | "utility"
      | "government"
      | "development_partner"
      /** A figure invented as part of a synthetic demonstration dataset. */
      | "gridintel_synthetic"
      | "other";
    organizationId?: string;
  };
  document: {
    title: string;
    reference?: string;
    url?: string;
    page?: string;
    publishedAt?: IsoDate;
  } | null;
  /**
   * What the figure includes, as the source defines it. null when the
   * source does not say, in which case it cannot be compared with a
   * calculated figure.
   */
  basis: KpiBasis | null;
  /** The methodology as the source describes it; not a GridIntel methodology. */
  methodology: {
    name: string;
    version?: string;
    description?: string;
  } | null;
  reportedAt: IsoTimestamp | null;
  notes?: string;
  provenance: Provenance;
}
