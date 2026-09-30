import type {
  Communication,
  Coordinates,
  Status,
  Timestamp,
} from "./common";
import type { EdgeDevice } from "./utility";

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
