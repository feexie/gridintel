import type { Audit, ExternalId, IsoDate, LifecycleStatus } from "./primitives";
import type { Provenance } from "./provenance";
import type { Coordinates, LocationBasis } from "./geo";

/* ==========================================================
   GRIDINTEL DOMAIN — SITES AND GENERATION ASSETS

   A site is a place where electricity is generated, stored and
   distributed as one system: a mini-grid. It hangs from NO
   substation and NO feeder. Energy does not enter it from upstream:
   it is generated there.

   ELECTRICAL (what supplies what):
     GenerationAsset.siteId          a generation or storage asset of
                                     the site
     ServicePoint.supply             { kind: "site" }: a connection
                                     supplied by the site's own
                                     distribution network (network.ts)
     Meter.installation              the generation, storage and
                                     site-output roles (metering.ts)

   ADMINISTRATIVE (who operates it):
     MinigridSite.operatorOrganizationId

   A site holds identity and nameplate data only. What it generated,
   whether it was available and what it earned are calculated from
   its meters, telemetry, interruption records and charges, never
   stored here.

   Nameplate ratings are master data and live here (kWp, kWh, kW,
   kVA). Measured values live in observations.
========================================================== */

export interface MinigridSite extends Audit {
  id: string;
  code?: string;
  name: string;
  externalIds?: ExternalId[];
  /** ADMINISTRATIVE: the organization that operates the site. */
  operatorOrganizationId: string;
  /**
   * Whether the site's network is connected to another operator's network.
   * "isolated": it is not. "interconnected": it is, and energy may cross
   * that connection. "unspecified" until confirmed; never guessed.
   */
  gridConnection: "isolated" | "interconnected" | "unspecified";
  /** Nominal voltage of the distribution network, e.g. 0.4. */
  distributionVoltageKv?: number;
  location?: Coordinates;
  /** How the location was obtained, when the source says. */
  locationBasis?: LocationBasis;
  lifecycle: LifecycleStatus;
  commissionedAt?: IsoDate;
  provenance: Provenance;
}

interface GenerationAssetBase extends Audit {
  id: string;
  /** ELECTRICAL: the site this asset is part of. */
  siteId: string;
  name: string;
  code?: string;
  manufacturer?: string;
  model?: string;
  lifecycle: LifecycleStatus;
  commissionedAt?: IsoDate;
  provenance: Provenance;
}

/** A solar PV array. */
export interface SolarPvArray extends GenerationAssetBase {
  kind: "solar_pv";
  /** Rated DC power at standard test conditions. */
  capacityKwp: number;
}

/** A battery energy storage system. */
export interface BatteryStorage extends GenerationAssetBase {
  kind: "battery";
  /** Rated (nameplate) energy capacity. What the battery can hold today is not stored here. */
  energyCapacityKwh: number;
  /** Rated charge and discharge power. */
  powerKw: number;
  chemistry?: "lithium_iron_phosphate" | "lithium_nmc" | "lead_acid" | "other";
}

/** A fuel-burning generator, whether it runs as backup or as a main source. */
export interface FuelGenerator extends GenerationAssetBase {
  kind: "generator";
  ratingKva: number;
  /** Rated continuous active power. */
  ratedPowerKw: number;
  fuel: "diesel" | "petrol" | "gas" | "other";
}

/** A power-conversion unit: a PV inverter, a battery inverter, or one that does both. */
export interface Inverter extends GenerationAssetBase {
  kind: "inverter";
  ratingKva: number;
  role: "pv" | "battery" | "hybrid";
  /** The arrays and batteries connected through this inverter, when recorded. */
  servesAssetIds?: string[];
}

export type GenerationAsset = SolarPvArray | BatteryStorage | FuelGenerator | Inverter;
export type GenerationAssetKind = GenerationAsset["kind"];
