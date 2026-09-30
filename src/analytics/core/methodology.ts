import type { Fraction, MethodologyRef } from "@/domain";

/* ==========================================================
   ANALYTICS — METHODOLOGIES

   A methodology is a named, versioned set of parameters. Every
   calculated result names the methodology id and version that
   produced it. A changed rule is a new version, never an edit.

   The methodologies below are GridIntel REFERENCE methodologies in
   draft. They are not regulatory formulas, and must not be
   presented as any regulator's official method. A regulatory
   methodology, once its source text is obtained, is added as a
   separate record with authority "regulatory".
========================================================== */

export interface Methodology<P> extends MethodologyRef {
  name: string;
  description: string;
  authority: "gridintel_reference" | "regulatory" | "utility_internal" | "custom";
  status: "draft" | "approved" | "superseded";
  /** Shown wherever a result from this methodology is displayed. */
  disclaimer: string;
  parameters: P;
}

export const REFERENCE_DISCLAIMER =
  "GridIntel reference calculation — not a regulatory figure.";

export function methodologyRef<P>(methodology: Methodology<P>): MethodologyRef {
  return { id: methodology.id, version: methodology.version };
}

/* ==========================================================
   ENERGY ACCOUNTING
========================================================== */

export interface EnergyParameters {
  /**
   * Whether separately measured DER/BESS energy may be added to the
   * energy received at the input boundary.
   * - "none": never. Boundary-meter readings are used as measured.
   * - "separately_measured_only": only adjustments explicitly flagged
   *   as measured separately from the boundary are applied.
   */
  embeddedAdjustment: "none" | "separately_measured_only";
}

export const ENERGY_REFERENCE: Methodology<EnergyParameters> = {
  id: "gridintel.energy.reference",
  version: "0.1.0",
  name: "GridIntel reference energy accounting",
  description:
    "Energy received is the net flow through the scope's input boundary meters. " +
    "Missing intervals make totals unavailable; nothing is substituted.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { embeddedAdjustment: "none" },
};

/* ==========================================================
   LOSSES, ATC&C AND COLLECTION
========================================================== */

export interface AtccParameters {
  /** The denominator for loss fractions and billing efficiency. */
  lossBasis: "energy_input_net_of_transfers_out";
}

export const ATCC_REFERENCE: Methodology<AtccParameters> = {
  id: "gridintel.atcc.reference",
  version: "0.1.0",
  name: "GridIntel reference ATC&C",
  description:
    "Billing efficiency = energy billed ÷ energy input; collection efficiency = " +
    "revenue collected ÷ revenue billed; ATC&C = 1 − billing efficiency × collection efficiency.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { lossBasis: "energy_input_net_of_transfers_out" },
};

/* ==========================================================
   RELIABILITY
========================================================== */

export interface ReliabilityParameters {
  /** Interruptions shorter than this are momentary and excluded from SAIDI and SAIFI. */
  sustainedThresholdMinutes: number;
  /** Which classes of sustained interruption count toward the indices. */
  include: {
    planned: boolean;
    /** Outages whose planned status is not known. */
    plannedUnknown: boolean;
    /** Attributed to transmission or generation, or caused by upstream supply loss. */
    upstream: boolean;
    loadShedding: boolean;
    majorEvents: boolean;
  };
  /** "declared_only": an outage is a major event only if one was formally declared. */
  majorEventRule: "none" | "declared_only";
  /**
   * Which exposures SAIFI counts for a period:
   * - "interruption_starts_in_period": the interruption began in the period,
   *   so an interruption is counted in exactly one period;
   * - "overlaps_period": any part of the interruption fell in the period.
   */
  saifiCounting: "interruption_starts_in_period" | "overlaps_period";
  durationUnit: "minutes" | "hours";
}

export const RELIABILITY_REFERENCE: Methodology<ReliabilityParameters> = {
  id: "gridintel.reliability.reference",
  version: "0.1.0",
  name: "GridIntel reference reliability indices",
  description:
    "SAIDI, SAIFI, CAIDI and ASAI from outage exposure segments. Durations are clipped " +
    "to the reporting period. Exposures without times or customer counts are excluded.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {
    sustainedThresholdMinutes: 5,
    include: {
      planned: true,
      plannedUnknown: true,
      upstream: true,
      loadShedding: true,
      majorEvents: true,
    },
    majorEventRule: "declared_only",
    saifiCounting: "interruption_starts_in_period",
    durationUnit: "minutes",
  },
};

/* ==========================================================
   EQUIPMENT LOADING
========================================================== */

export interface LoadingParameters {
  /** Loading above this fraction of rating is an overload (1 = 100%). */
  overloadThreshold: Fraction;
  /** Readings older than this, relative to the as-of time, are not used. */
  maxReadingAgeMinutes: number;
  /** Readings combined in one calculation must be at most this far apart. */
  maxReadingSkewMinutes: number;
}

export const LOADING_REFERENCE: Methodology<LoadingParameters> = {
  id: "gridintel.loading.reference",
  version: "0.1.0",
  name: "GridIntel reference equipment loading",
  description:
    "Loading = apparent power ÷ rated capacity, or phase current ÷ rated current. " +
    "Only measured quantities with known electrical semantics are used.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { overloadThreshold: 1, maxReadingAgeMinutes: 60, maxReadingSkewMinutes: 15 },
};
