import type { DataQuality, IsoTimestamp, Severity } from "./primitives";
import type { Provenance } from "./provenance";
import type { AssetRef, EntityRef } from "./refs";

/* ==========================================================
   GRIDINTEL DOMAIN — EVENTS

   Alarms, outages and maintenance are append-only records. Times
   that the source did not record stay undefined; they are never
   filled in with a guess. Records without the times a metric needs
   are excluded from that metric, with a warning.
========================================================== */

/**
 * An alarm on an asset or on an unresolved source-data reference.
 * It is active while raised and not cleared.
 */
export interface Alarm {
  id: string;
  subject: EntityRef;
  code: string;
  severity: Severity;
  message: string;
  raisedAt?: IsoTimestamp;
  clearedAt?: IsoTimestamp;
  acknowledgedAt?: IsoTimestamp;
  acknowledgedBy?: string;
  quality: DataQuality;
  provenance: Provenance;
}

export type InterruptionCause =
  | "fault"
  | "planned_maintenance"
  | "load_shedding"
  | "upstream_supply"
  | "weather"
  | "vandalism"
  | "other"
  | "unknown";

/**
 * Who an interruption is attributed to, from its cause and responsible
 * party. The classes are exclusive and cover every interruption, in this
 * order of precedence:
 * - load_management: load shedding, whoever ordered it;
 * - upstream_supply: attributed to transmission or generation, or caused
 *   by loss of upstream supply;
 * - network: any other interruption the distribution business is
 *   responsible for (faults, planned work, weather damage);
 * - other: the customer, a third party, or not known.
 */
export type InterruptionClass = "network" | "upstream_supply" | "load_management" | "other";

/** Which part of the power system the interruption is attributed to. */
export type ResponsibleParty =
  | "distribution"
  | "transmission"
  | "generation"
  | "customer"
  | "third_party"
  | "unknown";

/**
 * A supply interruption. Classification is recorded as facts (planned,
 * cause, responsible party, declarations); which interruptions count
 * toward a reliability index is decided by the methodology, not here.
 *
 * SAIDI and SAIFI cannot be computed from an outage's overall duration
 * alone, because of partial restoration, sectionalising and load
 * shedding. They are computed from `exposures`.
 */
export interface Outage {
  id: string;
  /** Where the interruption started, or the device that operated. */
  origin: EntityRef;
  /** null when it is not known whether the outage was planned. */
  planned: boolean | null;
  cause: InterruptionCause;
  responsibleParty: ResponsibleParty;
  /** Formal declarations, e.g. a major event, as made by the named party. */
  declarations?: {
    kind: "major_event" | "force_majeure" | "other";
    declaredBy: string;
    reference?: string;
  }[];
  /** At least one. Each restoration step is the `restoredAt` of one or more exposures. */
  exposures: OutageExposure[];
  notes?: string;
  provenance: Provenance;
}

/**
 * One group of customers that lost supply over one interval. An outage
 * restored in stages has one exposure per stage.
 */
export interface OutageExposure {
  /** The element that lost supply: a DT, a feeder, a service point, or an unresolved name. */
  affected: EntityRef;
  /** null when not recorded; never 0 as a placeholder. */
  customersAffected: number | null;
  /**
   * How `customersAffected` was obtained:
   * - recorded: counted for this interruption and written down;
   * - topology_derived: read from the network model, as the accounts
   *   connected under the affected element. Derived, not estimated;
   * - estimated: a judgement, with no count and no model behind it.
   */
  customerCountBasis: "recorded" | "topology_derived" | "estimated";
  interruptedAt?: IsoTimestamp;
  restoredAt?: IsoTimestamp;
  quality: DataQuality;
}

/** Maintenance carried out on an asset. Open while `completedAt` is undefined. */
export interface MaintenanceRecord {
  id: string;
  asset: AssetRef;
  kind: "preventive" | "corrective" | "inspection" | "unspecified";
  startedAt?: IsoTimestamp;
  completedAt?: IsoTimestamp;
  notes?: string;
  provenance: Provenance;
}
