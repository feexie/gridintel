import type {
  DataQuality,
  EntityRef,
  InterruptionCause,
  IsoTimestamp,
  Outage,
  Period,
  ResponsibleParty,
} from "@/domain";
import type { Methodology, ReliabilityParameters } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { MS_PER_MINUTE, overlapMinutes, periodBounds, toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — OUTAGE EXPOSURE CLASSIFICATION

   Each OutageExposure is one group of customers that lost supply
   over one interval. Reliability is computed from these segments,
   never by assuming every customer on a feeder was off for the
   whole outage.

   Durations are CLIPPED to the reporting period: only the part of
   an exposure inside the period counts toward customer-minutes.

   Nothing is invented. An exposure without an interruption time, a
   restoration time or a customer count is excluded, with a reason.
   Without a restoration time the duration is unknown, so the
   exposure cannot be classified as sustained or momentary and is
   excluded from both SAIDI and SAIFI.
========================================================== */

export type ExclusionReason =
  | "INTERRUPTION_TIME_UNKNOWN"
  | "RESTORATION_TIME_UNKNOWN"
  | "INVALID_TIMESTAMP"
  | "RESTORED_BEFORE_INTERRUPTED"
  | "CUSTOMERS_UNKNOWN"
  | "OUTSIDE_PERIOD";

export type MethodologyExclusion =
  | "MOMENTARY"
  | "PLANNED"
  | "PLANNED_UNKNOWN"
  | "UPSTREAM"
  | "LOAD_SHEDDING"
  | "MAJOR_EVENT";

/**
 * Who an interruption is attributed to, from the cause and responsible
 * party recorded on the outage. The classes are exclusive and cover every
 * exposure, in this order of precedence:
 * - load_management: load shedding, whoever ordered it;
 * - upstream_supply: attributed to transmission or generation, or caused
 *   by loss of upstream supply;
 * - network: any other interruption the distribution business is
 *   responsible for (faults, planned work, weather damage);
 * - other: the customer, a third party, or not known.
 */
export type AttributionClass = "network" | "upstream_supply" | "load_management" | "other";

export const ATTRIBUTION_CLASSES: readonly AttributionClass[] = ["network", "upstream_supply", "load_management", "other"];

export interface ClassifiedExposure {
  outageId: string;
  /** Position of the exposure within its outage. */
  exposureIndex: number;
  affected: EntityRef;
  customersAffected: number | null;
  interruptedAt: IsoTimestamp | null;
  restoredAt: IsoTimestamp | null;
  /** Full duration of the exposure, regardless of the period. */
  durationMinutes: number | null;
  /** The part of the exposure inside the period. */
  minutesInPeriod: number;
  durationClass: "sustained" | "momentary" | null;
  planned: boolean | null;
  cause: InterruptionCause;
  responsibleParty: ResponsibleParty;
  upstream: boolean;
  loadShedding: boolean;
  attribution: AttributionClass;
  majorEvent: boolean;
  /** Set when the data does not support using this exposure at all. */
  dataExclusion: ExclusionReason | null;
  /** Set when the methodology excludes a usable exposure. */
  methodologyExclusions: MethodologyExclusion[];
  countsForSaidi: boolean;
  countsForSaifi: boolean;
  quality: DataQuality;
}

function isMajorEvent(outage: Outage, parameters: ReliabilityParameters): boolean {
  if (parameters.majorEventRule === "none") return false;
  return (outage.declarations ?? []).some((declaration) => declaration.kind === "major_event");
}

export function classifyExposures(params: {
  outages: readonly Outage[];
  period: Period;
  methodology: Methodology<ReliabilityParameters>;
}): ClassifiedExposure[] {
  const { outages, period } = params;
  const parameters = params.methodology.parameters;
  const bounds = periodBounds(period);
  const result: ClassifiedExposure[] = [];

  const ordered = [...outages].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const outage of ordered) {
    const upstream =
      outage.responsibleParty === "transmission" ||
      outage.responsibleParty === "generation" ||
      outage.cause === "upstream_supply";
    const loadShedding = outage.cause === "load_shedding";
    const majorEvent = isMajorEvent(outage, parameters);
    const attribution: AttributionClass = loadShedding
      ? "load_management"
      : upstream
        ? "upstream_supply"
        : outage.responsibleParty === "distribution"
          ? "network"
          : "other";

    outage.exposures.forEach((exposure, exposureIndex) => {
      const startMs = exposure.interruptedAt === undefined ? undefined : toEpochMs(exposure.interruptedAt);
      const endMs = exposure.restoredAt === undefined ? undefined : toEpochMs(exposure.restoredAt);

      let dataExclusion: ExclusionReason | null = null;
      if (startMs === undefined) dataExclusion = "INTERRUPTION_TIME_UNKNOWN";
      else if (startMs === null || endMs === null || bounds === null) dataExclusion = "INVALID_TIMESTAMP";
      else if (endMs === undefined) dataExclusion = "RESTORATION_TIME_UNKNOWN";
      else if (endMs < startMs) dataExclusion = "RESTORED_BEFORE_INTERRUPTED";
      else if (exposure.customersAffected === null) dataExclusion = "CUSTOMERS_UNKNOWN";

      let durationMinutes: number | null = null;
      let minutesInPeriod = 0;
      let startsInPeriod = false;
      if (dataExclusion === null) {
        const s = startMs as number;
        const e = endMs as number;
        const b = bounds as { startMs: number; endMs: number };
        durationMinutes = (e - s) / MS_PER_MINUTE;
        minutesInPeriod = overlapMinutes(s, e, b.startMs, b.endMs);
        startsInPeriod = s >= b.startMs && s < b.endMs;
        if (minutesInPeriod === 0 && !startsInPeriod) dataExclusion = "OUTSIDE_PERIOD";
      }

      const durationClass =
        durationMinutes === null
          ? null
          : durationMinutes < parameters.sustainedThresholdMinutes
            ? "momentary"
            : "sustained";

      const methodologyExclusions: MethodologyExclusion[] = [];
      if (dataExclusion === null) {
        if (durationClass === "momentary") methodologyExclusions.push("MOMENTARY");
        if (outage.planned === true && !parameters.include.planned) methodologyExclusions.push("PLANNED");
        if (outage.planned === null && !parameters.include.plannedUnknown) methodologyExclusions.push("PLANNED_UNKNOWN");
        if (upstream && !parameters.include.upstream) methodologyExclusions.push("UPSTREAM");
        if (loadShedding && !parameters.include.loadShedding) methodologyExclusions.push("LOAD_SHEDDING");
        if (majorEvent && !parameters.include.majorEvents) methodologyExclusions.push("MAJOR_EVENT");
      }

      const included = dataExclusion === null && methodologyExclusions.length === 0;
      const countsForSaifi =
        included &&
        (parameters.saifiCounting === "interruption_starts_in_period" ? startsInPeriod : minutesInPeriod > 0);

      // A customer count that was not recorded directly is at best an estimate.
      const basisQuality: DataQuality = exposure.customerCountBasis === "recorded" ? "measured" : "estimated";

      result.push({
        outageId: outage.id,
        exposureIndex,
        affected: exposure.affected,
        customersAffected: exposure.customersAffected,
        interruptedAt: exposure.interruptedAt ?? null,
        restoredAt: exposure.restoredAt ?? null,
        durationMinutes,
        minutesInPeriod,
        durationClass,
        planned: outage.planned,
        cause: outage.cause,
        responsibleParty: outage.responsibleParty,
        upstream,
        loadShedding,
        attribution,
        majorEvent,
        dataExclusion,
        methodologyExclusions,
        countsForSaidi: included && minutesInPeriod > 0,
        countsForSaifi,
        quality: worstQuality([exposure.quality, basisQuality]) as DataQuality,
      });
    });
  }
  return result;
}
