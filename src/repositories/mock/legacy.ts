import type { Region, Substation, Feeder, Transformer, Meter, EdgeDevice } from "@/types/utility";
import type { UtilityRegion, ExecutiveEvent } from "@/types/executive";
import { regions } from "../../data/utility/regions.ts";
import { substations } from "../../data/utility/substations.ts";
import { feeders } from "../../data/utility/feeders.ts";
import { transformers } from "../../data/utility/transformers.ts";
import { meters } from "../../data/utility/meters.ts";
import { edgeDevices } from "../../data/utility/edgeDevices.ts";
import { utilityRegions, executiveEvents } from "../../data/utility/executive.ts";

/* ==========================================================
   MOCK ADAPTER — LEGACY INPUT GATE

   The only file in the mock adapter that reads src/data or
   src/types. Legacy types are treated as the shape of the input,
   not as a domain layer: every other mock file sees them only
   under the Legacy* names below and maps them into src/domain.

   Not read: src/data/utility/revenue.ts (no year, scope or
   currency) and src/data/platform/**.
========================================================== */

export type LegacyRegion = Region;
export type LegacySubstation = Substation;
export type LegacyFeeder = Feeder;
export type LegacyTransformer = Transformer;
export type LegacyMeter = Meter;
export type LegacyEdgeDevice = EdgeDevice;
export type LegacyUtilityRegion = UtilityRegion;
export type LegacyExecutiveEvent = ExecutiveEvent;

export interface LegacyData {
  regions: readonly LegacyRegion[];
  substations: readonly LegacySubstation[];
  feeders: readonly LegacyFeeder[];
  transformers: readonly LegacyTransformer[];
  meters: readonly LegacyMeter[];
  edgeDevices: readonly LegacyEdgeDevice[];
  utilityRegions: readonly LegacyUtilityRegion[];
  executiveEvents: readonly LegacyExecutiveEvent[];
}

/** Names used in mapping issues to say which legacy dataset a value came from. */
export const LEGACY_DATASETS = {
  regions: "data/utility/regions",
  substations: "data/utility/substations",
  feeders: "data/utility/feeders",
  transformers: "data/utility/transformers",
  meters: "data/utility/meters",
  edgeDevices: "data/utility/edgeDevices",
  utilityRegions: "data/utility/executive#utilityRegions",
  executiveEvents: "data/utility/executive#executiveEvents",
} as const satisfies Record<keyof LegacyData, string>;

export const LEGACY_DATA: LegacyData = {
  regions,
  substations,
  feeders,
  transformers,
  meters,
  edgeDevices,
  utilityRegions,
  executiveEvents,
};
