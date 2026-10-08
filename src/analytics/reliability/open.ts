import type {
  EntityRef,
  InterruptionCause,
  InterruptionOrigin,
  IsoTimestamp,
  Outage,
  OutageExposure,
} from "@/domain";
import { toEpochMs } from "../core/time.ts";

/* ==========================================================
   ANALYTICS — INTERRUPTIONS OPEN AT A TIME

   Which recorded exposures had begun and had not been restored at a
   given time. A fact read from the times the source recorded; no
   index is calculated here.

   Three cases, never merged:

   - IN PROGRESS: interrupted at or before the time, and either the
     record says supply was restored after it, or it holds no
     restoration time and the source says the outage is OPEN. An
     open outage with no restoration time is the normal case in a
     control room: the restoration has not happened yet.
   - RESTORATION NOT RECORDED: interrupted at or before the time,
     no restoration time, and the source says the outage is closed
     or does not say. A data-quality item: the outage is over, or
     may be, and nobody wrote down when supply came back. It is not
     counted as in progress.
   - START NOT RECORDED: the record does not say when the exposure
     began, so its state at any time cannot be told. Counted, not
     listed.

   An exposure restored at or before the time is over and is not
   returned, even in an open outage: an outage restored in stages
   stays open until its last part is back. A time that cannot be
   read is treated as not recorded. The status is the source's; it
   is never inferred from the times (ADR 0013, amendment).
========================================================== */

export type OpenExposureState = "in_progress" | "restoration_not_recorded";

export interface OpenExposure {
  outageId: string;
  /** The exposure's position in its outage's list. */
  exposureIndex: number;
  state: OpenExposureState;
  /** The element that lost supply. */
  affected: EntityRef;
  /** Where the outage record says the interruption began. */
  origin: EntityRef;
  originPoint: InterruptionOrigin | null;
  cause: InterruptionCause;
  planned: boolean | null;
  customersAffected: number | null;
  customerCountBasis: OutageExposure["customerCountBasis"];
  interruptedAt: IsoTimestamp;
  /** When the record says supply came back; null when it holds no restoration time. */
  restoredAt: IsoTimestamp | null;
}

export interface OpenExposures {
  /** In progress first, then restoration not recorded; within each, the longest standing first, then by outage id. */
  exposures: OpenExposure[];
  /** Exposures whose start the source did not record. */
  startNotRecorded: number;
}

export function openExposuresAt(
  outages: readonly Outage[],
  at: IsoTimestamp,
): OpenExposures {
  const atMs = toEpochMs(at);
  const found: { exposure: OpenExposure; startMs: number }[] = [];
  let startNotRecorded = 0;
  for (const outage of outages) {
    outage.exposures.forEach((exposure, exposureIndex) => {
      const startMs =
        exposure.interruptedAt === undefined
          ? null
          : toEpochMs(exposure.interruptedAt);
      if (
        startMs === null ||
        atMs === null ||
        exposure.interruptedAt === undefined
      ) {
        startNotRecorded += 1;
        return;
      }
      if (startMs > atMs) return;
      const endMs =
        exposure.restoredAt === undefined
          ? null
          : toEpochMs(exposure.restoredAt);
      if (endMs !== null && endMs <= atMs) return;
      found.push({
        startMs,
        exposure: {
          outageId: outage.id,
          exposureIndex,
          state:
            endMs !== null || outage.status === "open"
              ? "in_progress"
              : "restoration_not_recorded",
          affected: exposure.affected,
          origin: outage.origin,
          originPoint: outage.originPoint ?? null,
          cause: outage.cause,
          planned: outage.planned,
          customersAffected: exposure.customersAffected,
          customerCountBasis: exposure.customerCountBasis,
          interruptedAt: exposure.interruptedAt,
          restoredAt: endMs === null ? null : (exposure.restoredAt ?? null),
        },
      });
    });
  }
  const order: Record<OpenExposureState, number> = {
    in_progress: 0,
    restoration_not_recorded: 1,
  };
  found.sort(
    (a, b) =>
      order[a.exposure.state] - order[b.exposure.state] ||
      a.startMs - b.startMs ||
      (a.exposure.outageId < b.exposure.outageId
        ? -1
        : a.exposure.outageId > b.exposure.outageId
          ? 1
          : a.exposure.exposureIndex - b.exposure.exposureIndex),
  );
  return { exposures: found.map((entry) => entry.exposure), startNotRecorded };
}

/** The exposures of one outage that are in one state at the time: what a list shows as one interruption. */
export interface OpenOutage {
  outageId: string;
  state: OpenExposureState;
  /** The status the source gives the outage; null when it gives none. */
  status: "open" | "closed" | null;
  origin: EntityRef;
  originPoint: InterruptionOrigin | null;
  cause: InterruptionCause;
  planned: boolean | null;
  /** When the first of these exposures began. */
  interruptedAt: IsoTimestamp;
  exposures: OpenExposure[];
  /** The sum over the exposures; null when any of them gives no count, so that a partial sum is never shown as the total. */
  customersAffected: number | null;
  /** How the counts were obtained; "mixed" when the exposures differ. */
  customerCountBasis: OutageExposure["customerCountBasis"] | "mixed";
}

/**
 * The open exposures grouped by outage and state, in the order of
 * `openExposuresAt`. An outage restored in stages appears once, with the
 * parts still off.
 */
export function openOutagesAt(outages: readonly Outage[], at: IsoTimestamp): { outages: OpenOutage[]; startNotRecorded: number } {
  const { exposures, startNotRecorded } = openExposuresAt(outages, at);
  const statusOf = new Map(outages.map((outage) => [outage.id, outage.status ?? null]));
  const groups = new Map<string, OpenOutage>();
  for (const exposure of exposures) {
    const key = `${exposure.state}|${exposure.outageId}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        outageId: exposure.outageId,
        state: exposure.state,
        status: statusOf.get(exposure.outageId) ?? null,
        origin: exposure.origin,
        originPoint: exposure.originPoint,
        cause: exposure.cause,
        planned: exposure.planned,
        interruptedAt: exposure.interruptedAt,
        exposures: [exposure],
        customersAffected: exposure.customersAffected,
        customerCountBasis: exposure.customerCountBasis,
      });
      continue;
    }
    group.exposures.push(exposure);
    group.customersAffected = group.customersAffected === null || exposure.customersAffected === null ? null : group.customersAffected + exposure.customersAffected;
    if (group.customerCountBasis !== exposure.customerCountBasis) group.customerCountBasis = "mixed";
  }
  return { outages: [...groups.values()], startNotRecorded };
}
