/* ==========================================================
   MOCK ADAPTER — MAPPING ISSUES

   Everything the mapping could not carry across faithfully is
   recorded here rather than corrected or hidden.

   Severity:
   - info: expected and harmless (e.g. PII deliberately dropped).
   - warning: the output is usable but limited or rests on an
     assumption.
   - error: a reference is broken, or a record could not be built
     at all. The current mock data must produce none.
========================================================== */

export type MappingIssueSeverity = "info" | "warning" | "error";

export type MappingIssueCode =
  /** Personal data deliberately not carried into the domain. */
  | "PII_DROPPED"
  /** Operating state (status, online…) that the domain derives rather than stores. */
  | "DERIVED_STATE_NOT_STORED"
  /** A legacy field with no faithful domain home (no time, no unit, unclear meaning). */
  | "UNMAPPED_FIELD"
  /** The registry holds only a sample of this kind of record. */
  | "REGISTRY_SAMPLE_ONLY"
  /** Two legacy datasets state different values for the same metric and scope. */
  | "CONFLICTING_SOURCES"
  /** A time that is not a zoned ISO 8601 timestamp. */
  | "UNPARSEABLE_TIME"
  /** A reference to a record that does not exist. */
  | "DANGLING_REFERENCE"
  /** A value the source does not state, filled in under an approved Phase 4 decision. */
  | "ASSUMED_VALUE";

export interface MappingIssue {
  code: MappingIssueCode;
  severity: MappingIssueSeverity;
  message: string;
  source: {
    /** A LEGACY_DATASETS name. */
    dataset: string;
    recordId?: string;
    field?: string;
  };
}

export interface MappingReport {
  issues: MappingIssue[];
}

/**
 * The usual severity of each code. UNPARSEABLE_TIME and UNMAPPED_FIELD
 * are raised as "error" instead when the value is required to build the
 * record, so the record is left out.
 */
export const DEFAULT_SEVERITY: Record<MappingIssueCode, MappingIssueSeverity> = {
  PII_DROPPED: "info",
  DERIVED_STATE_NOT_STORED: "info",
  UNMAPPED_FIELD: "warning",
  REGISTRY_SAMPLE_ONLY: "warning",
  CONFLICTING_SOURCES: "warning",
  UNPARSEABLE_TIME: "warning",
  DANGLING_REFERENCE: "error",
  ASSUMED_VALUE: "warning",
};

export function mappingIssue(
  code: MappingIssueCode,
  message: string,
  source: MappingIssue["source"],
  severity: MappingIssueSeverity = DEFAULT_SEVERITY[code],
): MappingIssue {
  return { code, severity, message, source };
}
