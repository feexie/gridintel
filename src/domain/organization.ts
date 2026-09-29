import type { Audit } from "./primitives";
import type { Provenance } from "./provenance";

/* ==========================================================
   GRIDINTEL DOMAIN — ORGANIZATIONS (ADMINISTRATIVE)

   The administrative hierarchy is Organization → Region. It
   describes who manages what. It is separate from the electrical
   topology in network.ts, which describes what supplies what.
========================================================== */

/** A distribution utility is an Organization with this kind, not a separate type. */
export type OrganizationKind =
  | "distribution_utility"
  | "transmission_operator"
  | "minigrid_operator"
  | "der_developer"
  | "regulator"
  | "government_agency"
  | "investor"
  | "other";

export interface Organization extends Audit {
  id: string;
  name: string;
  shortName?: string;
  kind: OrganizationKind;
  /** ISO 3166-1 alpha-2, e.g. "NG". */
  countryCode?: string;
  /** IANA time zone, e.g. "Africa/Lagos". */
  timezone?: string;
  /** ISO 4217, e.g. "NGN". */
  currency?: string;
  provenance: Provenance;
}

/**
 * An administrative region of an organization. It holds identity only:
 * counts and KPIs for a region are derived from the registry or recorded
 * as `ReportedKpi`, never stored here.
 *
 * Assets join a region through their own `adminRegionId`; if that is
 * absent, an asset takes its electrical parent's admin region. A region
 * is never treated as an electrical boundary.
 */
export interface Region extends Audit {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  provenance: Provenance;
}
