import type { KpiKey, ScopeRef } from "@/domain";

/* ==========================================================
   MOCK ADAPTER — IDENTIFIERS

   Legacy ids are kept as GridIntel ids. The only new ids are made
   here, deterministically, so the same input always gives the
   same ids.
========================================================== */

/** The service point derived from a legacy meter (D2): one per meter. */
export function servicePointIdForMeter(meterId: string): string {
  return `SP:${meterId}`;
}

export function reportedKpiId(sourceId: string, scope: ScopeRef, metric: KpiKey): string {
  return `rk:${sourceId}:${scope.kind}:${scope.id}:${metric}`;
}

export function outageIdForEvent(sourceId: string, eventId: string): string {
  return `outage:${sourceId}:${eventId}`;
}
