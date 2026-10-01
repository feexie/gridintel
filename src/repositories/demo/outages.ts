import type { AssetRef, InterruptionCause, Outage, OutageExposure, ResponsibleParty } from "@/domain";
import { DEMO_DAYS, HOUR_MS, at, hourStart, wat } from "./clock.ts";
import { CONNECTIONS, DEMO_SUBSTATION_ID, MV_CUSTOMER, TRANSFORMERS, activeAccounts } from "./network.ts";
import { seeded } from "./rng.ts";
import { OUTAGE_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — OUTAGES AND SUPPLY AVAILABILITY

   Interruptions are designed first, and the energy model then
   removes consumption for exactly the times a transformer was off,
   so the outage log and the meter data agree.

   Two kinds of interruption are modelled:
   - load shedding, in whole-hour blocks, which is what sets the
     hours of supply a feeder's service band is about;
   - a handful of individual events (fault, planned work, upstream
     loss, a momentary trip, a storm).

   Every interruption is recorded per transformer, so restoration in
   stages is visible and each transformer's customers are counted
   once.
========================================================== */

interface Part {
  /** A transformer key, or the MV customer's key. */
  supplyKey: string;
  startMs: number;
  endMs: number;
}

interface EventPlan {
  id: string;
  origin: AssetRef;
  planned: boolean;
  cause: InterruptionCause;
  responsibleParty: ResponsibleParty;
  notes: string;
  parts: Part[];
}

const MKT_KEYS = ["MKT1", "MKT2", "MKT3", MV_CUSTOMER.key];
const OLD_KEYS = ["OLD1", "OLD2", "OLD3"];

function dayLabel(day: number): string {
  return `2026-09-${String(day + 1).padStart(2, "0")}`;
}

function block(keys: readonly string[], startMs: number, endMs: number): Part[] {
  return keys.map((supplyKey) => ({ supplyKey, startMs, endMs }));
}

function loadShedding(): EventPlan[] {
  const events: EventPlan[] = [];
  const shed = (feederId: string, keys: readonly string[], day: number, n: number, startHour: number, hours: number) =>
    events.push({
      id: `OUT-${dayLabel(day)}-${feederId}-LS${n}`,
      origin: { kind: "feeder", id: feederId },
      planned: false,
      cause: "load_shedding",
      responsibleParty: "transmission",
      notes: "Feeder opened under the grid load-allocation schedule.",
      parts: block(keys, at(day, startHour), at(day, startHour + hours)),
    });

  const market = seeded("shedding:FD-MKT");
  const oldTown = seeded("shedding:FD-OLD");
  for (let day = 0; day < DEMO_DAYS; day++) {
    // Market Road (Band A): one block of 2–4 hours on two days in three.
    const marketStart = [1, 2, 13, 14][Math.floor(market() * 4)];
    const marketHours = 2 + Math.floor(market() * 3);
    if (day % 3 !== 0) shed("FD-MKT", MKT_KEYS, day, 1, marketStart, marketHours);

    // Old Town (Band C): off for 4–5 hours overnight and 5–6 hours in the day, every day.
    shed("FD-OLD", OLD_KEYS, day, 1, 0, 4 + Math.floor(oldTown() * 2));
    shed("FD-OLD", OLD_KEYS, day, 2, 8 + Math.floor(oldTown() * 3), 5 + Math.floor(oldTown() * 2));
  }
  return events;
}

/** Individual events, placed in hours that load shedding never uses on the feeder concerned. */
function individualEvents(): EventPlan[] {
  return [
    {
      id: "OUT-2026-09-06-FD-OLD-FAULT",
      origin: { kind: "feeder", id: "FD-OLD" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "11 kV conductor down. Old Town Central restored by sectionalising; the rest after repair.",
      parts: [
        { supplyKey: "OLD1", startMs: at(5, 18, 40), endMs: at(5, 21, 10) },
        { supplyKey: "OLD2", startMs: at(5, 18, 40), endMs: at(5, 23, 55) },
        { supplyKey: "OLD3", startMs: at(5, 18, 40), endMs: at(5, 23, 55) },
      ],
    },
    {
      id: "OUT-2026-09-09-FD-MKT-TRIP",
      origin: { kind: "feeder", id: "FD-MKT" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Feeder breaker tripped and reclosed.",
      parts: block(MKT_KEYS, at(8, 19, 2), at(8, 19, 5)),
    },
    {
      id: "OUT-2026-09-12-DT-MKT-2-MAINT",
      origin: { kind: "distribution_transformer", id: "DT-MKT-2" },
      planned: true,
      cause: "planned_maintenance",
      responsibleParty: "distribution",
      notes: "Planned transformer maintenance.",
      parts: block(["MKT2"], at(11, 7), at(11, 11, 30)),
    },
    {
      id: "OUT-2026-09-18-SS-RIV-UPSTREAM",
      origin: { kind: "substation", id: DEMO_SUBSTATION_ID },
      planned: false,
      cause: "upstream_supply",
      responsibleParty: "transmission",
      notes: "Loss of the 33 kV supply to the substation.",
      parts: block([...MKT_KEYS, ...OLD_KEYS], at(17, 19, 15), at(17, 22, 50)),
    },
    {
      id: "OUT-2026-09-23-DT-OLD-2-FAULT",
      origin: { kind: "distribution_transformer", id: "DT-OLD-2" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Transformer LV fuses blown.",
      parts: block(["OLD2"], at(22, 16, 30), at(22, 23, 10)),
    },
    {
      id: "OUT-2026-09-27-DT-OLD-3-STORM",
      origin: { kind: "distribution_transformer", id: "DT-OLD-3" },
      planned: false,
      cause: "weather",
      responsibleParty: "distribution",
      notes: "LV line down in a storm.",
      parts: block(["OLD3"], at(26, 6, 10), at(26, 7, 25)),
    },
  ];
}

const EVENTS: readonly EventPlan[] = [...loadShedding(), ...individualEvents()];

function affected(supplyKey: string): AssetRef {
  if (supplyKey === MV_CUSTOMER.key) return { kind: "service_point", id: MV_CUSTOMER.servicePointId };
  const dt = TRANSFORMERS.find((plan) => plan.key === supplyKey);
  return { kind: "distribution_transformer", id: (dt as { id: string }).id };
}

/** When each supply was off, as [startMs, endMs) intervals in time order. */
export const SUPPLY_OFF: ReadonlyMap<string, readonly (readonly [number, number])[]> = (() => {
  const off = new Map<string, [number, number][]>();
  for (const event of EVENTS) {
    for (const part of event.parts) {
      off.set(part.supplyKey, [...(off.get(part.supplyKey) ?? []), [part.startMs, part.endMs]]);
    }
  }
  for (const intervals of off.values()) intervals.sort((a, b) => a[0] - b[0]);
  return off;
})();

/** The share of hourly interval `h` during which the supply was on. */
export function availability(supplyKey: string, h: number): number {
  const startMs = hourStart(h);
  const endMs = startMs + HOUR_MS;
  let offMs = 0;
  for (const [offStart, offEnd] of SUPPLY_OFF.get(supplyKey) ?? []) {
    const overlap = Math.min(endMs, offEnd) - Math.max(startMs, offStart);
    if (overlap > 0) offMs += overlap;
  }
  return 1 - offMs / HOUR_MS;
}

/** Whether the supply was on at an instant. */
export function energised(supplyKey: string, ms: number): boolean {
  return !(SUPPLY_OFF.get(supplyKey) ?? []).some(([offStart, offEnd]) => ms >= offStart && ms < offEnd);
}

export function buildDemoOutages(): Outage[] {
  const outages: Outage[] = EVENTS.map((event) => ({
    id: event.id,
    origin: event.origin,
    planned: event.planned,
    cause: event.cause,
    responsibleParty: event.responsibleParty,
    exposures: event.parts.map(
      (part): OutageExposure => ({
        affected: affected(part.supplyKey),
        customersAffected: activeAccounts(part.supplyKey),
        customerCountBasis: "topology_derived",
        interruptedAt: wat(part.startMs),
        restoredAt: wat(part.endMs),
        quality: "measured",
      }),
    ),
    notes: event.notes,
    provenance: demoProvenance(OUTAGE_SOURCE, event.id),
  }));

  // A complaint that was logged but never closed: its restoration time is not known, so it
  // cannot count toward any index. It does not change the energy model.
  const complainant = CONNECTIONS.find((c) => c.supplyKey === "MKT2" && !c.disconnected) as { servicePointId: string };
  outages.push({
    id: "OUT-2026-09-21-SP-COMPLAINT",
    origin: { kind: "service_point", id: complainant.servicePointId },
    planned: false,
    cause: "unknown",
    responsibleParty: "unknown",
    exposures: [
      {
        affected: { kind: "service_point", id: complainant.servicePointId },
        customersAffected: 1,
        customerCountBasis: "recorded",
        interruptedAt: wat(at(20, 9, 15)),
        quality: "measured",
      },
    ],
    notes: "Single-customer complaint; no restoration was recorded.",
    provenance: demoProvenance(OUTAGE_SOURCE, "OUT-2026-09-21-SP-COMPLAINT"),
  });

  return outages.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
