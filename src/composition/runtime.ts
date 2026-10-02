import type { IsoTimestamp, Period } from "@/domain";
import type { GridIntelRepositories } from "../repositories/ports/index.ts";
import type { OperationsRuntime } from "../services/operations/levels.ts";
import { createMemoryCache } from "../services/analytics/cache.ts";
import { DEMO_CLOCK, DEMO_NOTICE, DEMO_PERIOD, createDemoRepositories } from "../repositories/demo/index.ts";

/* ==========================================================
   COMPOSITION ROOT

   The one place that chooses which adapter the application runs
   on. Everything else receives repositories and never names an
   adapter. Server-side only.

   The application currently runs on the synthetic demonstration
   dataset, whose "now" is a fixed demo clock rather than the wall
   clock, so results are the same on every run.
========================================================== */

/**
 * The repositories and the result cache are held once per server PROCESS, not once per
 * module: the server bundles this file into more than one chunk (the routes, and the
 * start-up hook), and each chunk would otherwise build its own dataset and its own cache.
 */
interface ProcessState {
  repositories: GridIntelRepositories | null;
  results: ReturnType<typeof createMemoryCache>;
}

const globalState = globalThis as typeof globalThis & { __gridintel?: ProcessState };
const state: ProcessState = (globalState.__gridintel ??= { repositories: null, results: createMemoryCache() });

export function getRepositories(): GridIntelRepositories {
  state.repositories ??= createDemoRepositories();
  return state.repositories;
}

export interface RuntimeClock {
  /** The instant "now" means for as-of queries and for `computedAt`. */
  now: IsoTimestamp;
  /** The reporting period shown by default. */
  reportingPeriod: Period;
}

/** What must be said about the data the application is running on; null for real data. */
export interface DataNotice {
  label: string;
  summary: string;
  caveats: { feederLoading?: string; tariffs?: string };
}

export function getDataNotice(): DataNotice | null {
  return DEMO_NOTICE;
}

export function getClock(): RuntimeClock {
  return { now: DEMO_CLOCK, reportingPeriod: DEMO_PERIOD };
}

/* ==========================================================
   RESULT CACHE AND ITS INVALIDATION RULE

   Results are computed once per server process and reused.

   This is valid today because both things a result depends on are
   fixed for the life of the process: the synthetic dataset is
   generated once and never changes, and "now" is the fixed demo
   clock. So nothing ever invalidates the cache, and it never grows
   beyond one entry per scope and screen.

   When real data arrives, this rule must hold instead:

   1. RECORDS. The cache is valid only for the records it was
      computed from. Whenever any record is added, corrected or
      removed (an ingest, a late reading, a billing run, a registry
      edit) call `invalidateResults()`. There is no partial
      invalidation: one changed interval can change every level
      above it, so the whole cache is discarded.
   2. CLOCK. Every key includes the as-of time, so a moving clock
      never serves a stale result, but each new instant adds new
      entries. With a real clock, round "now" to the reporting
      granularity (for example the hour) and discard the cache when
      it advances.
   3. SCOPE OF USE. One cache per set of repositories. A second
      tenant or data source gets its own.
========================================================== */

export function invalidateResults(): void {
  state.results.clear();
}

/** What every read model is given: the adapter, the clock, the dataset's caveats and the cache. */
export function getRuntime(): OperationsRuntime {
  const clock = getClock();
  const caveats = getDataNotice()?.caveats;
  return {
    repos: getRepositories(),
    now: clock.now,
    period: clock.reportingPeriod,
    caveats: { feederLoading: caveats?.feederLoading, tariffs: caveats?.tariffs },
    cache: state.results,
  };
}

/** A whole screen's view model, computed once while the cache is valid. */
export function cachedView<T>(name: string, compute: (runtime: OperationsRuntime) => Promise<T>): Promise<T> {
  const runtime = getRuntime();
  return state.results.get(`screen:${name}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`, () => compute(runtime));
}
