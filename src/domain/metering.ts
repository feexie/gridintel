import type { Audit, LifecycleStatus } from "./primitives";
import type { Provenance } from "./provenance";

/* ==========================================================
   GRIDINTEL DOMAIN — METERING AND CUSTOMERS

   ENERGY-ACCOUNTING BOUNDARIES
   A meter's installation role says what it measures. Roles other
   than "service_point" are boundary meters: they measure the energy
   crossing into an accounting section (a DT, a feeder or a
   substation).

   Boundary meter measurements are AUTHORITATIVE for network energy
   accounting. Energy from embedded generation or battery storage
   (DER/BESS) that is connected inside a section already appears in
   that section's boundary-meter readings. It must NOT be added to or
   subtracted from network energy a second time.

   A separate DER/BESS adjustment is allowed only when BOTH hold:
   - the DER/BESS flow is measured separately from the accounting
     boundary, and
   - the selected methodology explicitly requires the adjustment.
   Otherwise the boundary reading is used as-is. The purpose of this
   rule is to prevent double counting.

   Phase 2 has no DER, BESS or mini-grid records and no meter role
   for them, so every such flow is, by definition, inside the
   boundary readings.

   Direction convention: for a boundary meter, "import" is energy
   flowing downstream (into the section) and "export" is reverse
   flow. For a service-point meter, import is the customer's
   consumption and export is energy the customer injects.
========================================================== */

/** What a meter is installed to measure. */
export type MeterInstallation =
  /** A customer connection. */
  | { role: "service_point"; servicePointId: string }
  /** The sending end of a feeder. */
  | { role: "feeder_head"; feederId: string }
  /** The LV side of a distribution transformer, totalling everything it supplies. */
  | { role: "dt_totalizer"; transformerId: string }
  /** An incoming supply into a substation. */
  | { role: "substation_incomer"; substationId: string; supplyFeederId?: string }
  /** The point where energy enters the organization's network from another operator. */
  | { role: "grid_interface"; substationId: string; feederId?: string };

export interface Meter extends Audit {
  id: string;
  serialNumber: string;
  manufacturer?: string;
  model?: string;
  meterType: "smart" | "amr" | "conventional" | "unspecified";
  phases?: 1 | 3;
  /** ELECTRICAL: where the meter is installed, which also sets its accounting role. */
  installation: MeterInstallation;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}

/**
 * A customer account. Splitting the person from the account is deferred.
 *
 * PII: `name` (and any other personal detail) must never appear in
 * analytics output or in prompts sent to AI models. Analytics refer to
 * customers by `id` only.
 */
export interface Customer extends Audit {
  id: string;
  /** The organization that holds the account. */
  operatorOrganizationId: string;
  accountNumber?: string;
  /** PII. Never used in analytics output or AI prompts. */
  name?: string;
  /**
   * The service point currently supplying this account. Absent for
   * accounts that are not connected yet.
   *
   * This holds the CURRENT relationship only. In a later phase it must
   * become effective-dated, so that which account was at which service
   * point on a given date can be reconstructed for historical reports.
   */
  servicePointId?: string;
  category?: "residential" | "commercial" | "industrial" | "public" | "special";
  paymentMode?: "prepaid" | "postpaid";
  /**
   * Whether the account is billed on a maximum-demand (MD) tariff. MD
   * accounts are few and large and are priced differently, so figures
   * meant to describe ordinary customers leave them out. Absent when the
   * source does not record it; an absent class is unknown, and is never
   * taken to mean non-MD.
   */
  demandClass?: "md" | "non_md";
  accountStatus: "active" | "disconnected" | "closed";
  provenance: Provenance;
}
