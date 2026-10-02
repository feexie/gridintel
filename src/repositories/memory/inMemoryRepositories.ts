import type { IntervalEnergy, IsoTimestamp, Outage, OutageExposure, Period } from "@/domain";
import type { GridIntelRepositories } from "../ports/index.ts";
import type { DomainDataset } from "./dataset.ts";

/* ==========================================================
   IN-MEMORY REPOSITORIES

   Implements the repository ports over a DomainDataset. The only
   work done here is selecting records by identity, scope and time.

   A record whose time cannot be read is always returned rather than
   silently dropped: whether it can be used is for analytics to
   decide and report.
========================================================== */

const EXPLICIT_ZONE = /(Z|[+-]\d{2}:\d{2})$/;
const MS_PER_MINUTE = 60_000;

// The same few timestamps recur across thousands of records; each is parsed once.
const PARSED = new Map<string, number | null>();

/** Epoch ms, or null when the timestamp is invalid or has no explicit zone. */
function epochMs(timestamp: IsoTimestamp | undefined): number | null {
  if (timestamp === undefined) return null;
  const known = PARSED.get(timestamp);
  if (known !== undefined) return known;
  let ms: number | null = null;
  if (EXPLICIT_ZONE.test(timestamp)) {
    const parsed = Date.parse(timestamp);
    ms = Number.isNaN(parsed) ? null : parsed;
  }
  if (PARSED.size >= 100_000) PARSED.clear();
  PARSED.set(timestamp, ms);
  return ms;
}

function queryBounds(period: Period): { startMs: number; endMs: number } {
  const startMs = epochMs(period.start);
  const endMs = epochMs(period.end);
  if (startMs === null || endMs === null || endMs <= startMs) {
    throw new RangeError(`Invalid query period [${period.start}, ${period.end}).`);
  }
  return { startMs, endMs };
}

function queryInstant(name: string, timestamp: IsoTimestamp): number {
  const ms = epochMs(timestamp);
  if (ms === null) throw new RangeError(`Invalid query time ${name}: "${timestamp}".`);
  return ms;
}

/** true or false when the exposure's times place it; null when they cannot. */
function exposureOverlaps(exposure: OutageExposure, startMs: number, endMs: number): boolean | null {
  const interruptedMs = epochMs(exposure.interruptedAt);
  if (interruptedMs === null) return null;
  if (exposure.restoredAt === undefined) return interruptedMs < endMs;
  const restoredMs = epochMs(exposure.restoredAt);
  if (restoredMs === null) return null;
  return interruptedMs < endMs && restoredMs > startMs;
}

function outageSelected(outage: Outage, startMs: number, endMs: number): boolean {
  return outage.exposures.some((exposure) => exposureOverlaps(exposure, startMs, endMs) !== false);
}

export function createInMemoryRepositories(dataset: DomainDataset): GridIntelRepositories {
  // Built on first use: interval records by meter, each list in dataset order.
  let byMeter: Map<string, IntervalEnergy[]> | null = null;
  const intervalsOf = (meterId: string): readonly IntervalEnergy[] => {
    if (byMeter === null) {
      byMeter = new Map();
      for (const interval of dataset.intervalEnergy) {
        const list = byMeter.get(interval.meterId);
        if (list === undefined) byMeter.set(interval.meterId, [interval]);
        else list.push(interval);
      }
    }
    return byMeter.get(meterId) ?? [];
  };

  return {
    registry: {
      async getSnapshot(query) {
        queryInstant("asOf", query.asOf);
        return { snapshot: dataset.registry, topologyBasis: "current_only", coverage: dataset.registryCoverage };
      },
    },

    observations: {
      async listIntervalEnergy(query) {
        const { startMs, endMs } = queryBounds(query.period);
        // Records are returned grouped by meter, in the order the meters were asked for.
        const records = [...new Set(query.meterIds)].flatMap((meterId) =>
          intervalsOf(meterId).filter((interval) => {
            const intervalStartMs = epochMs(interval.intervalStart);
            if (intervalStartMs === null) return true;
            return intervalStartMs < endMs && intervalStartMs + interval.intervalMinutes * MS_PER_MINUTE > startMs;
          }),
        );
        return { records, completeness: dataset.completeness.intervalEnergy };
      },

      async listTelemetry(query) {
        const fromMs = queryInstant("from", query.from);
        const asOfMs = queryInstant("asOf", query.asOf);
        const records = dataset.telemetry.filter((point) => {
          const selected = query.sources.some(
            (source) => source.kind === point.source.kind && source.id === point.source.id,
          );
          if (!selected) return false;
          const observedMs = epochMs(point.observedAt);
          if (observedMs === null) return true;
          return observedMs >= fromMs && observedMs <= asOfMs;
        });
        return { records, completeness: dataset.completeness.telemetry };
      },
    },

    events: {
      async listOutages(query) {
        const { startMs, endMs } = queryBounds(query.period);
        const records = dataset.outages.filter((outage) => outageSelected(outage, startMs, endMs));
        return { records, completeness: dataset.completeness.outages };
      },
    },

    reported: {
      async listReportedKpis(query) {
        const metrics = query.metrics === undefined ? null : new Set(query.metrics);
        const records = dataset.reportedKpis.filter((kpi) => {
          if (metrics !== null && !metrics.has(kpi.metric)) return false;
          if (query.scopes === undefined) return true;
          const scope = kpi.scope;
          return "id" in scope && query.scopes.some((wanted) => wanted.kind === scope.kind && wanted.id === scope.id);
        });
        return { records, completeness: dataset.completeness.reportedKpis };
      },
    },

    billing: {
      async listBillingRecords(query) {
        const { startMs, endMs } = queryBounds(query.period);
        const records = dataset.billingRecords.filter((record) => {
          const billedMs = epochMs(record.billedAt);
          return billedMs === null || (billedMs >= startMs && billedMs < endMs);
        });
        return { records, completeness: dataset.completeness.billing };
      },

      async listPayments(query) {
        const { startMs, endMs } = queryBounds(query.period);
        const records = dataset.payments.filter((payment) => {
          const receivedMs = epochMs(payment.receivedAt);
          return receivedMs === null || (receivedMs >= startMs && receivedMs < endMs);
        });
        return { records, completeness: dataset.completeness.billing };
      },
    },

    sources: {
      async listDataSources() {
        return [...dataset.dataSources];
      },
    },
  };
}
