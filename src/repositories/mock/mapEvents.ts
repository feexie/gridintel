import type { Outage, UnresolvedRef } from "@/domain";
import type { LegacyData } from "./legacy.ts";
import type { MappingIssue } from "./issues.ts";
import { LEGACY_DATASETS } from "./legacy.ts";
import { mappingIssue } from "./issues.ts";
import { outageIdForEvent } from "./ids.ts";
import { EXECUTIVE_SOURCE, isZonedTimestamp, mockProvenance } from "./sources.ts";

/* ==========================================================
   MOCK ADAPTER — EVENT MAPPING

   Executive events → Outage. Events name their location as
   "region / substation / feeder" text, which is kept as an
   UnresolvedRef exactly as written. It is never matched to a
   registry record by guessing: "Adamawa / Jimeta / Feeder 4" is
   not linked to "Jimeta Feeder 01".

   Nothing the event does not state is filled in: planned status,
   cause and responsible party stay unknown, and a time without a
   date and zone is left undefined (and kept in the notes).
========================================================== */

export interface EventMapping {
  outages: Outage[];
  issues: MappingIssue[];
}

export function mapEvents(legacy: LegacyData): EventMapping {
  const issues: MappingIssue[] = [];
  const dataset = LEGACY_DATASETS.executiveEvents;

  const outages = legacy.executiveEvents.map((event): Outage => {
    const location: UnresolvedRef = {
      kind: "feeder",
      label: `${event.region} / ${event.substation} / ${event.feeder}`,
      context: `executive event ${event.id}`,
    };

    let interruptedAt: string | undefined;
    let restoredAt: string | undefined;
    if (isZonedTimestamp(event.timestamp)) {
      if (event.status === "RESTORED") restoredAt = event.timestamp;
      else interruptedAt = event.timestamp;
    } else {
      issues.push(mappingIssue("UNPARSEABLE_TIME",
        `Event time "${event.timestamp}" has no date or time zone; the interruption times are left unknown.`,
        { dataset, recordId: event.id, field: "timestamp" }));
    }
    issues.push(mappingIssue("UNMAPPED_FIELD",
      `Event status "${event.status}" is kept in the notes; an outage's state is derived from its times.`,
      { dataset, recordId: event.id, field: "status" }));

    return {
      id: outageIdForEvent(EXECUTIVE_SOURCE.id, event.id),
      origin: location,
      planned: null,
      cause: "unknown",
      responsibleParty: "unknown",
      exposures: [
        {
          affected: location,
          customersAffected: event.customersAffected,
          customerCountBasis: "recorded",
          ...(interruptedAt === undefined ? {} : { interruptedAt }),
          ...(restoredAt === undefined ? {} : { restoredAt }),
          quality: "measured",
        },
      ],
      notes: `Source time "${event.timestamp}"; source status "${event.status}".`,
      provenance: mockProvenance(EXECUTIVE_SOURCE, event.id),
    };
  });

  return { outages, issues };
}
