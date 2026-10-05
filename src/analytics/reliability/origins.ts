import type { EntityRef, InterruptionOrigin, Outage } from "@/domain";
import type { AttributionClass } from "./exposure.ts";
import type { ComponentTotals, ReliabilityResult } from "./indices.ts";

/* ==========================================================
   ANALYTICS — WHAT INTERRUPTED SUPPLY, AND WHERE IT BEGAN

   Two ways of cutting the same reliability result, for the question
   "why, and is it ours to fix?":

   - BY A RECORDED FACT of the interruption: its cause, or the part
     of the system where it began (its origin point). These are the
     result's own breakdown, with each group's SAIDI and SAIFI.

   - BY THE ELEMENT IT BEGAN AT: the feeder, transformer or line the
     outage record names as its origin. This says which pieces of
     equipment interruptions most often start at.

   Both use only exposures the indices count, so each cut sums to the
   totals. Nothing is apportioned and nothing is inferred: an
   interruption with no origin point is grouped as "not_recorded",
   and an origin the registry does not hold keeps the name the source
   gave it.
========================================================== */

export interface BreakdownRow {
  /** The cause, or the origin point; "not_recorded" where the outage states none. */
  key: string;
  exposures: number;
  customerMinutes: number;
  customerInterruptions: number;
  /** In the unit of the result's SAIDI; null when the customers served are not known. */
  saidi: number | null;
  saifi: number | null;
  /** Share of the customer-minutes of all groups; null when there are none. */
  shareOfCustomerMinutes: number | null;
}

function served(result: ReliabilityResult): number | null {
  const value = result.saidi.inputs.customersServed?.value ?? null;
  return value !== null && value > 0 ? value : null;
}

/** Minutes of the result's SAIDI unit per minute: 1 for minutes, 1/60 for hours. */
function durationFactor(result: ReliabilityResult): number {
  return result.saidi.unit === "hours" ? 1 / 60 : 1;
}

/**
 * The result's breakdown by cause or by origin point, with each group's
 * indices, largest customer-minutes first. The breakdown holds every usable
 * sustained exposure, which under a methodology that counts every class (as
 * the reference one does) is exactly what the indices count.
 */
export function reliabilityBreakdown(result: ReliabilityResult, by: "byCause" | "byOriginPoint"): BreakdownRow[] {
  const groups = result.components.breakdown[by] as Partial<Record<string, ComponentTotals>>;
  const customers = served(result);
  const factor = durationFactor(result);
  const keys = Object.keys(groups);
  const total = keys.reduce((sum, key) => sum + (groups[key] as ComponentTotals).customerMinutes, 0);
  return keys
    .map((key): BreakdownRow => {
      const totals = groups[key] as ComponentTotals;
      return {
        key,
        exposures: totals.exposures,
        customerMinutes: totals.customerMinutes,
        customerInterruptions: totals.customerInterruptions,
        saidi: customers === null ? null : (totals.customerMinutes / customers) * factor,
        saifi: customers === null ? null : totals.customerInterruptions / customers,
        shareOfCustomerMinutes: total > 0 ? totals.customerMinutes / total : null,
      };
    })
    .sort((a, b) => b.customerMinutes - a.customerMinutes || (a.key < b.key ? -1 : 1));
}

export interface OriginTotals {
  /** The element the outage record names as its origin: a registry asset, or a name not matched to one. */
  origin: EntityRef;
  originPoint: InterruptionOrigin | null;
  /** The class the interruptions that began here are attributed to. An origin with two classes has two rows. */
  attribution: AttributionClass;
  /** Outages that began here with at least one counted exposure. */
  interruptions: number;
  customerInterruptions: number;
  customerMinutes: number;
  /** In the unit of the result's SAIDI; null when the customers served are not known. */
  saidi: number | null;
}

function originKey(origin: EntityRef): string {
  return "id" in origin ? `${origin.kind}:${origin.id}` : `${origin.kind}~${origin.label}`;
}

/**
 * The counted interruptions grouped by the element they began at and the
 * class they are attributed to, most interruptions first. `outages` must be
 * the outages the result was calculated from.
 */
export function interruptionsByOrigin(result: ReliabilityResult, outages: readonly Outage[]): OriginTotals[] {
  const byId = new Map(outages.map((outage) => [outage.id, outage]));
  const customers = served(result);
  const factor = durationFactor(result);
  const groups = new Map<string, OriginTotals & { outageIds: Set<string> }>();
  for (const exposure of result.components.exposures) {
    if (!exposure.countsForSaidi && !exposure.countsForSaifi) continue;
    const outage = byId.get(exposure.outageId);
    if (outage === undefined) continue;
    const key = `${originKey(outage.origin)}|${exposure.attribution}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = { origin: outage.origin, originPoint: outage.originPoint ?? null, attribution: exposure.attribution, interruptions: 0, customerInterruptions: 0, customerMinutes: 0, saidi: null, outageIds: new Set() };
      groups.set(key, group);
    }
    group.outageIds.add(outage.id);
    const count = exposure.customersAffected as number;
    if (exposure.countsForSaidi) group.customerMinutes += count * exposure.minutesInPeriod;
    if (exposure.countsForSaifi) group.customerInterruptions += count;
  }
  return [...groups.entries()]
    .map(([key, { outageIds, ...group }]) => ({
      key,
      totals: { ...group, interruptions: outageIds.size, saidi: customers === null ? null : (group.customerMinutes / customers) * factor },
    }))
    .sort((a, b) => b.totals.interruptions - a.totals.interruptions || b.totals.customerMinutes - a.totals.customerMinutes || (a.key < b.key ? -1 : 1))
    .map((entry) => entry.totals);
}
