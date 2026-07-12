import type {
  Communication,
  Coordinates,
  EdgeDevice,
  Status,
  Timestamp,
} from "./common";

/* ==========================================================
   BASE ASSET
========================================================== */

export interface BaseAsset extends Timestamp {
  id: string;

  name: string;

  status: Status;

  location?: Coordinates;

  communication?: Communication;

  edgeDevice?: EdgeDevice;

  tags?: string[];

  metadata?: Record<string, unknown>;
}
