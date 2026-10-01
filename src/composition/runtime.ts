import type { IsoTimestamp, Period } from "@/domain";
import type { GridIntelRepositories } from "../repositories/ports/index.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../repositories/demo/index.ts";

/* ==========================================================
   COMPOSITION ROOT

   The one place that chooses which adapter the application runs
   on. Everything else receives repositories and never names an
   adapter. Server-side only.

   The application currently runs on the synthetic demonstration
   dataset, whose "now" is a fixed demo clock rather than the wall
   clock, so results are the same on every run.
========================================================== */

let repositories: GridIntelRepositories | null = null;

export function getRepositories(): GridIntelRepositories {
  repositories ??= createDemoRepositories();
  return repositories;
}

export interface RuntimeClock {
  /** The instant "now" means for as-of queries and for `computedAt`. */
  now: IsoTimestamp;
  /** The reporting period shown by default. */
  reportingPeriod: Period;
}

export function getClock(): RuntimeClock {
  return { now: DEMO_CLOCK, reportingPeriod: DEMO_PERIOD };
}
