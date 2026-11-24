import type { ReferenceOutage } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — REFERENCE SITE: RELIABILITY FROM THE FAULT LOG

   For each month with logged events, the indices of
   analytics/reliability/indices.ts on the fault log as recorded:

     SAIDI = Σ customer-hours ÷ customers served
     SAIFI = Σ customers interrupted ÷ customers served
     CAIDI = SAIDI ÷ SAIFI

   Customers served: the largest count logged against an event in the
   month (the log gives one per event, and the site grew and shrank).
   Customer-hours are the log's own column, on the recorded duration;
   where the recorded duration and the times disagree the log keeps
   both and so does this method's input.

   A month with no logged event has no index here, never 0: the log
   covers December 2020 to November 2021 only, and a month without an
   entry is "no outage logged", not "no outage".
========================================================== */

export const REFERENCE_RELIABILITY: Methodology<Record<string, never>> = {
  id: "gridintel.reference.reliability",
  version: "0.1.0",
  name: "Reliability indices from an operator's fault log",
  description: "Monthly SAIDI, SAIFI and CAIDI from the logged customer-hours and customers interrupted, over the largest count of customers served logged in the month.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export interface MonthIndices {
  /** "YYYY-MM". */
  month: string;
  events: number;
  customersServed: number | null;
  saidiHours: number | null;
  saifi: number | null;
  caidiHours: number | null;
  /** Events whose recorded duration differs from their start and end times. */
  durationDisagreements: number;
}

export function indicesByMonth(outages: readonly ReferenceOutage[]): MonthIndices[] {
  const months = new Map<string, ReferenceOutage[]>();
  for (const outage of outages) {
    const month = outage.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), outage]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, events]) => {
      const served = events.map((event) => event.customersServed).filter((value): value is number => value !== null);
      const customersServed = served.length > 0 ? Math.max(...served) : null;
      const complete = customersServed !== null && customersServed > 0 && events.every((event) => event.customerHours !== null && event.customersInterrupted !== null);
      const saidiHours = complete ? events.reduce((sum, event) => sum + (event.customerHours ?? 0), 0) / customersServed : null;
      const saifi = complete ? events.reduce((sum, event) => sum + (event.customersInterrupted ?? 0), 0) / customersServed : null;
      return {
        month,
        events: events.length,
        customersServed,
        saidiHours,
        saifi,
        caidiHours: saidiHours !== null && saifi !== null && saifi > 0 ? saidiHours / saifi : null,
        durationDisagreements: events.filter(
          (event) => event.durationHoursRecorded !== null && event.durationHoursFromTimes !== null && Math.abs(event.durationHoursRecorded - event.durationHoursFromTimes) > 1e-9,
        ).length,
      };
    });
}
