import type { Audit, ExternalId, IsoDate, LifecycleStatus } from "./primitives";
import type { Provenance } from "./provenance";
import type { Coordinates } from "./geo";

/* ==========================================================
   GRIDINTEL DOMAIN — ELECTRICAL NETWORK

   Two hierarchies meet on these records, and they are kept apart
   on purpose:

   ELECTRICAL (what supplies what):
     Substation.supplyFeederIds → upstream feeders into a substation
     Feeder.origin              → the substation a feeder leaves from
     DistributionTransformer.feederId
     ServicePoint.supply
     Meter.installation         (metering.ts)

   ADMINISTRATIVE (who manages it):
     adminRegionId on Substation, Feeder, DistributionTransformer
     and ServicePoint. If absent, an asset takes its electrical
     parent's admin region. Setting it explicitly is how a feeder
     that crosses a region line is assigned.

   No other link between the two is inferred. An electrical source
   is never an administrative parent, and a region is never an
   electrical boundary.

   Each asset stores its CURRENT electrical parent. Analytics must
   resolve topology through an as-of topology index rather than
   reading these fields directly, so that effective-dated history
   can replace them later without changing calculations.

   Nominal voltages and nameplate ratings are master data and live
   here, in kV / kVA / MVA / A. Measured values live in telemetry.
========================================================== */

export interface Substation extends Audit {
  id: string;
  code?: string;
  name: string;
  externalIds?: ExternalId[];
  /** "unspecified" until the kind is confirmed; it is never guessed from the name. */
  kind: "transmission" | "injection" | "distribution" | "unspecified";
  /**
   * Owner when it is not the organization that manages the region,
   * e.g. a transmission operator's station that supplies the network.
   */
  ownerOrganizationId?: string;
  primaryVoltageKv?: number;
  secondaryVoltageKv?: number;
  /** Declared total capacity, used when the power transformers are not registered individually. */
  declaredCapacityMva?: number;
  /**
   * ELECTRICAL: the upstream feeders that supply this substation, e.g.
   * the 33 kV feeder into an injection substation. This does not make
   * the feeder the substation's administrative parent.
   */
  supplyFeederIds?: string[];
  /** ADMINISTRATIVE: the region that manages this substation. */
  adminRegionId?: string;
  location?: Coordinates;
  lifecycle: LifecycleStatus;
  commissionedAt?: IsoDate;
  provenance: Provenance;
}

/** A transformer inside a substation (as opposed to a distribution transformer on a feeder). */
export interface PowerTransformer extends Audit {
  id: string;
  /** ELECTRICAL: the substation this transformer sits in. */
  substationId: string;
  name: string;
  code?: string;
  ratingMva: number;
  primaryVoltageKv: number;
  secondaryVoltageKv: number;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}

/**
 * ELECTRICAL source of a feeder. A discriminated union so that other
 * kinds of source can be added later without changing existing records.
 */
export type FeederOrigin = {
  kind: "substation";
  substationId: string;
  /** The power transformer the feeder is fed from, when known. */
  powerTransformerId?: string;
};

export interface Feeder extends Audit {
  id: string;
  code?: string;
  name: string;
  externalIds?: ExternalId[];
  /** ELECTRICAL: where the feeder is supplied from. */
  origin: FeederOrigin;
  /** ADMINISTRATIVE: overrides the region inherited from the origin substation. */
  adminRegionId?: string;
  nominalVoltageKv: number;
  ratedCurrentA?: number;
  ratedCapacityMva?: number;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}

export interface DistributionTransformer extends Audit {
  id: string;
  code?: string;
  name: string;
  externalIds?: ExternalId[];
  /** ELECTRICAL: the feeder currently supplying this transformer. */
  feederId: string;
  /** ADMINISTRATIVE: overrides the region inherited from the feeder. */
  adminRegionId?: string;
  ratingKva: number;
  primaryVoltageKv?: number;
  secondaryVoltageKv?: number;
  phases?: 1 | 3;
  location?: Coordinates;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}

/** ELECTRICAL supply of a service point. */
export type ServicePointSupply =
  | { kind: "distribution_transformer"; transformerId: string }
  /** Supplied directly from a feeder, e.g. an MV customer. */
  | { kind: "feeder"; feederId: string };

/**
 * The electrical connection point where a customer is supplied. It is
 * separate from the meter (the device) and from the customer (the
 * account), so a meter swap or a change of tenant does not break the
 * connection's history.
 */
export interface ServicePoint extends Audit {
  id: string;
  code?: string;
  supply: ServicePointSupply;
  /** ADMINISTRATIVE: overrides the region inherited from the supply. */
  adminRegionId?: string;
  location?: Coordinates;
  lifecycle: LifecycleStatus;
  provenance: Provenance;
}
