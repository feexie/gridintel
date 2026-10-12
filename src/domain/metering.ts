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

   That rule is about generation and storage EMBEDDED in a
   distribution network. A mini-grid SITE is a different case (ADR
   0015): it has no upstream boundary, and its energy account starts
   from its own generation. Its meters have roles of their own
   ("generation", "storage", "site_output"), they belong to the site
   and to no network section, and they are never added to a network
   section's account, so nothing is counted twice.

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
  | { role: "grid_interface"; substationId: string; feederId?: string }
  /**
   * The output of a generating asset of a site (a PV array, a generator).
   * Import is energy the asset delivers to the site; export is energy it
   * draws, e.g. an inverter's standby consumption at night.
   */
  | { role: "generation"; siteId: string; assetId: string }
  /**
   * The terminals of a storage asset of a site. Import is energy into
   * storage (charging); export is energy out of it (discharging).
   */
  | { role: "storage"; siteId: string; assetId: string }
  /**
   * Where a site's generation and storage hand over to its distribution
   * network: the energy sent out to customers. Import is energy flowing out
   * to the network; export is reverse flow.
   */
  | { role: "site_output"; siteId: string };

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
  /**
   * "government" is a ministry, department or agency (MDA) account. It is
   * kept apart from "public" (street lighting, water works and the like)
   * because MDA accounts are billed like any customer and are a distinct
   * collection problem.
   */
  category?: "residential" | "commercial" | "industrial" | "government" | "public" | "special";
  paymentMode?: "prepaid" | "postpaid";
  /**
   * Whether the account is billed on a maximum-demand (MD) tariff. MD
   * accounts are few and large and are priced differently, so figures
   * meant to describe ordinary customers leave them out. Absent when the
   * source does not record it; an absent class is unknown, and is never
   * taken to mean non-MD.
   */
  demandClass?: "md" | "non_md";
  /**
   * The tariff tier or service level the account is on, as the operator
   * names it, e.g. "Tier 2". Operators that sell by tier define their own;
   * no meaning is read into the name. Absent when the source records none.
   */
  tariffTier?: string;
  /**
   * Whether the connection powers an income-earning activity (a mill, a
   * workshop, cold storage): productive use of energy. Absent when the
   * source does not record it; absent is unknown, never "no".
   */
  productiveUse?: boolean;
  accountStatus: "active" | "disconnected" | "closed";
  provenance: Provenance;
}
