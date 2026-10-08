import type { Fraction, InterruptionOrigin, MethodologyRef } from "@/domain";

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
  /**
   * How far from an end of the period a register reading may be for the
   * register's advance to count as consumption recorded in the period, in
   * days, on either side of that end. The advance is taken as it is and is
   * never pro-rated to the period (ADR 0010).
   */
  registerReadingWindowDays: number;
}

export const ENERGY_REFERENCE: Methodology<EnergyParameters> = {
  id: "gridintel.energy.reference",
  // 0.2.0: a register advance counts toward recorded consumption within a reading window (ADR 0010).
  version: "0.2.0",
  name: "GridIntel reference energy accounting",
  description:
    "Energy received is the net flow through the scope's input boundary meters. " +
    "Missing intervals make totals unavailable; nothing is substituted. " +
    "Recorded consumption is interval energy plus the advance of registers read within " +
    "3 days of both ends of the period, each kept as its own source; an advance is never pro-rated.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { embeddedAdjustment: "none", registerReadingWindowDays: 3 },
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
    /** Began at an upstream origin point; or, with no origin point recorded, attributed to transmission or generation, or caused by upstream supply loss. */
    upstream: boolean;
    loadShedding: boolean;
    majorEvents: boolean;
  };
  /**
   * The origin points that are upstream of the distribution business. An
   * interruption that began at any other recorded origin point began on the
   * business's own network, whatever its record calls the cause.
   */
  upstreamOrigins: readonly InterruptionOrigin[];
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
  // 0.2.0: attribution follows the origin point where one is recorded (ADR 0006, amendment).
  // 0.3.0: an interruption still open at the end of the period counts to the period's end, and
  // the result is provisional (ADR 0013, second amendment).
  version: "0.3.0",
  name: "GridIntel reference reliability indices",
  description:
    "SAIDI, SAIFI, CAIDI and ASAI from outage exposure segments. Durations are clipped " +
    "to the reporting period. Exposures without times or customer counts are excluded, " +
    "except that an interruption its source says is still open counts to the end of the " +
    "period and makes the result provisional. " +
    "An interruption is attributed by where it began: only the grid and the transmission " +
    "station are upstream; sub-transmission lines are part of the distribution network.",
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
    upstreamOrigins: ["grid", "transmission_station"],
    majorEventRule: "declared_only",
    saifiCounting: "interruption_starts_in_period",
    durationUnit: "minutes",
  },
};

const STATED_RULE_PREFIX = `${RELIABILITY_REFERENCE.id}+upstream:`;

function sameOrigins(a: readonly InterruptionOrigin[], b: readonly InterruptionOrigin[]): boolean {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((origin, i) => origin === y[i]);
}

/**
 * The reference reliability methodology with the attribution rule a
 * reported figure states: the origin points IT treats as upstream. Used
 * only to set a calculation beside that figure on its own rule. With the
 * reference rule's own origins this is the reference methodology itself;
 * otherwise it is a variant with its own id, so a result never passes for
 * a reference result.
 */
export function reliabilityOnStatedRule(upstreamOrigins: readonly InterruptionOrigin[]): Methodology<ReliabilityParameters> {
  if (sameOrigins(upstreamOrigins, RELIABILITY_REFERENCE.parameters.upstreamOrigins)) return RELIABILITY_REFERENCE;
  const origins = [...new Set(upstreamOrigins)].sort();
  return {
    ...RELIABILITY_REFERENCE,
    id: `${STATED_RULE_PREFIX}${origins.join(",") || "none"}`,
    name: "GridIntel reference reliability indices, on a reported attribution rule",
    description:
      "The reference reliability indices, except that an interruption is upstream when it began at one of the " +
      `origin points the reported figure names: ${origins.join(", ").replaceAll("_", " ") || "none"}.`,
    authority: "custom",
    parameters: { ...RELIABILITY_REFERENCE.parameters, upstreamOrigins: origins },
  };
}

/** The name and disclaimer of a stated-rule variant, from its reference alone; null for any other methodology. */
export function statedRuleMethodology(ref: MethodologyRef): { name: string; disclaimer: string } | null {
  if (!ref.id.startsWith(STATED_RULE_PREFIX)) return null;
  return { name: "GridIntel reference reliability indices, on a reported attribution rule", disclaimer: REFERENCE_DISCLAIMER };
}

/* ==========================================================
   DERIVED CONDITIONS
========================================================== */

export interface ConditionParameters {
  /** A monitoring device is quiet when its last check-in is older than this at the as-of time. */
  quietAfterMinutes: number;
}

export const CONDITIONS_REFERENCE: Methodology<ConditionParameters> = {
  id: "gridintel.conditions.reference",
  // 0.2.0: each rule names the kind of source alarm it corresponds to, and a condition says whether one was raised.
  version: "0.2.0",
  name: "GridIntel reference derived conditions",
  description:
    "Conditions GridIntel derives from telemetry under fixed rules: an asset loaded above its rating at a reading in the " +
    "period, and a monitoring device whose last check-in is too old. They are calculated, and are not alarms from any source system. " +
    "Each rule names the kind of source alarm that is about the same thing, and each condition says whether an alarm of that kind " +
    "was standing on the same subject while it held.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: "GridIntel derived condition, calculated from telemetry. It is not an alarm recorded by a source system.",
  // Two missed check-ins of a device that reports hourly.
  parameters: { quietAfterMinutes: 120 },
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
