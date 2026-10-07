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

   - IN PROGRESS: interrupted at or before the time, and the record
     says supply was restored after it.
   - RESTORATION NOT RECORDED: interrupted at or before the time, and
     the record holds no restoration time. That is either an
     interruption still in progress or a restoration nobody wrote
     down; the record cannot say which, and neither is assumed.
   - START NOT RECORDED: the record does not say when the exposure
     began, so its state at any time cannot be told. Counted, not
     listed.

   An exposure restored at or before the time is over and is not
   returned. A time that cannot be read is treated as not recorded.
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
  /** Set only when the exposure is in progress: when the record says supply came back. */
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
          state: endMs === null ? "restoration_not_recorded" : "in_progress",
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
