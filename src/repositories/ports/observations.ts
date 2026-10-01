import type { AssetRef, IntervalEnergy, IsoTimestamp, Period, TelemetryPoint } from "@/domain";
import type { RepositoryResult } from "./common.ts";

/* ==========================================================
   REPOSITORY PORTS — OBSERVATIONS

   Raw records only, one per meter or source. Nothing is summed
   across meters, so no measurement can be counted twice before
   analytics sees it.
========================================================== */

export interface IntervalEnergyQuery {
  meterIds: readonly string[];
  /** Intervals that overlap [start, end) are returned. */
  period: Period;
}

export interface TelemetryQuery {
  sources: readonly AssetRef[];
  /** Points with from ≤ observedAt ≤ asOf are returned. */
  from: IsoTimestamp;
  asOf: IsoTimestamp;
}

export interface ObservationRepository {
  listIntervalEnergy(query: IntervalEnergyQuery): Promise<RepositoryResult<IntervalEnergy>>;
  listTelemetry(query: TelemetryQuery): Promise<RepositoryResult<TelemetryPoint>>;
}
