/* ==========================================================
   GRIDINTEL DOMAIN — PRIMITIVES

   The domain layer is types only and imports nothing outside
   src/domain. It has no runtime code.

   Conventions used across the domain:
   - null means "not known". It is never a stand-in for zero, and
     zero is never a stand-in for "not known". A missing
     measurement must stay null; it must not be summed as 0.
   - Optional (`?`) means "not applicable or not recorded for this
     record". Where the difference between "unknown" and "absent"
     matters, the field is `| null` instead, so the value has to be
     stated explicitly.
   - Units are part of the field name (kv, kva, mva, kw, kwh, a, c).
========================================================== */

/** ISO 8601 timestamp in UTC, e.g. "2026-07-11T09:45:12Z". */
export type IsoTimestamp = string;

/** Calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

/** A half-open time interval: [start, end). */
export interface Period {
  start: IsoTimestamp;
  end: IsoTimestamp;
}

/** A ratio from 0 to 1. Percentages are converted to fractions internally. */
export type Fraction = number;

/**
 * A monetary amount in the currency's minor unit (e.g. kobo for NGN),
 * so amounts stay exact integers. For transactions such as bills and
 * payments. Reported figures keep the value exactly as published instead
 * (see `ReportedKpi`).
 */
export interface Money {
  amountMinor: number;
  /** ISO 4217, e.g. "NGN". */
  currency: string;
}

/* ==========================================================
   AUDIT, VALIDITY AND LIFECYCLE
========================================================== */

/**
 * When the record itself was created or last changed in the registry.
 * Audit times are not observation times: a reading's time lives on the
 * observation (e.g. `TelemetryPoint.observedAt`), never in `updatedAt`.
 */
export interface Audit {
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/**
 * The time range over which a record is valid: [effectiveFrom,
 * effectiveTo). An absent `effectiveTo` means it is still in effect.
 * This is validity in the real world, not audit time.
 */
export interface Effective {
  effectiveFrom: IsoTimestamp;
  effectiveTo?: IsoTimestamp;
}

/**
 * Where an asset is in its life. This is registry state, not operating
 * state: whether an asset is online, faulted or in alarm is derived from
 * observations and events, and is never stored on the asset.
 */
export type LifecycleStatus =
  | "planned"
  | "in_service"
  | "out_of_service"
  | "decommissioned";

export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

/* ==========================================================
   DATA QUALITY
========================================================== */

/**
 * How a single value was obtained. Quality travels with the value;
 * where it came from travels with the record (see `Provenance`).
 *
 * - measured: read directly from a meter, sensor or device.
 * - estimated: produced by a method rather than measured
 *   (`Provenance.method` says which).
 * - substituted: a gap or bad reading replaced by another value,
 *   e.g. interpolation (`Provenance.method` says which).
 * - suspect: a value exists but failed a validation check.
 * - missing: no usable value; the value field is null.
 *
 * DataQuality is CATEGORICAL, not ordinal. There is a conceptual
 * severity order, from best to worst:
 *
 *   measured < estimated < substituted < suspect < missing
 *
 * but it is not encoded in the type. Analytics must rank quality through
 * an explicit quality-ranking function, and must never compare these
 * values as strings or rely on their declaration order.
 */
export type DataQuality =
  | "measured"
  | "estimated"
  | "substituted"
  | "suspect"
  | "missing";

/* ==========================================================
   EXTERNAL IDENTIFIERS
========================================================== */

/**
 * The identifier of this record in another system (a SCADA tag, a GIS
 * feature id, a billing account). GridIntel ids stay the primary key.
 */
export interface ExternalId {
  system: string;
  id: string;
}
