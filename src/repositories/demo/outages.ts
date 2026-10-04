import type { AssetRef, InterruptionCause, Outage, OutageExposure, ResponsibleParty } from "@/domain";
import { DEMO_DAYS, HOUR_MS, at, hourStart, wat } from "./clock.ts";
import { CONNECTIONS, FEEDERS, MV_CUSTOMER, TRANSFORMERS, activeAccounts } from "./network.ts";
import { seeded } from "./rng.ts";
import { OUTAGE_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — OUTAGES AND SUPPLY AVAILABILITY

   Interruptions are designed first, and the energy model then
   removes consumption for exactly the times a transformer was off,
   so the outage log and the meter data agree.

   Three kinds of interruption are modelled:
   - load shedding, in whole-hour blocks, which is what mostly sets
     the hours of supply a feeder's service band is about;
   - on Farm Road, frequent loss of the upstream 33 kV supply to the
     bus section that feeds it;
   - a handful of individual events (faults, planned work, a loss of
     supply to a whole substation, a momentary trip, a storm).

   Every interruption is recorded per transformer, so restoration in
   stages is visible and each transformer's customers are counted
   once. Events are placed in hours that load shedding never uses on
   the feeder concerned; a test checks that no supply is off twice at
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

/** The supplies on a feeder: its transformers and, on Market Road, the 11 kV customer. */
function keysOf(feederId: string): string[] {
  const keys = TRANSFORMERS.filter((dt) => dt.feederId === feederId).map((dt) => dt.key);
  return feederId === MV_CUSTOMER.feederId ? [...keys, MV_CUSTOMER.key] : keys;
}

const KEYS = new Map(FEEDERS.map((feeder) => [feeder.id, keysOf(feeder.id)]));
const keys = (feederId: string): string[] => KEYS.get(feederId) as string[];
const substationKeys = (substationId: string): string[] =>
  FEEDERS.filter((feeder) => feeder.substationId === substationId).flatMap((feeder) => keys(feeder.id));

function dayLabel(day: number): string {
  return `2026-09-${String(day + 1).padStart(2, "0")}`;
}

function block(supplyKeys: readonly string[], startMs: number, endMs: number): Part[] {
  return supplyKeys.map((supplyKey) => ({ supplyKey, startMs, endMs }));
}

function loadShedding(): EventPlan[] {
  const events: EventPlan[] = [];
  const shed = (feederId: string, day: number, n: number, startHour: number, hours: number) =>
    events.push({
      id: `OUT-${dayLabel(day)}-${feederId}-LS${n}`,
      origin: { kind: "feeder", id: feederId },
      planned: false,
      cause: "load_shedding",
      responsibleParty: "transmission",
      notes: "Feeder opened under the grid load-allocation schedule.",
      parts: block(keys(feederId), at(day, startHour), at(day, startHour + hours)),
    });

  const market = seeded("shedding:FD-MKT");
  const oldTown = seeded("shedding:FD-OLD");
  const government = seeded("shedding:FD-GOV");
  const farm = seeded("shedding:FD-FRM");
  for (let day = 0; day < DEMO_DAYS; day++) {
    // Market Road (Band A): one block of 2–5 hours on two days in three. A five-hour block
    // leaves 19 hours of supply, under the band's 20-hour minimum for that day.
    const marketStart = [1, 2, 13, 14][Math.floor(market() * 4)];
    const marketHours = 2 + Math.floor(market() * 4);
    if (day % 3 !== 0) shed("FD-MKT", day, 1, marketStart, marketHours);

    // Old Town (Band C): off for 4–5 hours overnight and 5–6 hours in the day, every day.
    shed("FD-OLD", day, 1, 0, 4 + Math.floor(oldTown() * 2));
    shed("FD-OLD", day, 2, 8 + Math.floor(oldTown() * 3), 5 + Math.floor(oldTown() * 2));

    // Government Avenue (Band B): one block of 4–9 hours every day, starting between midnight
    // and 02:00. A nine-hour block leaves 15 hours, under the band's 16-hour minimum.
    shed("FD-GOV", day, 1, Math.floor(government() * 3), 4 + Math.floor(government() * 6));

    // Farm Road (Band D): off for 6 hours overnight and 6–7 hours in the day, every day.
    shed("FD-FRM", day, 1, 0, 6);
    shed("FD-FRM", day, 2, 10, 6 + Math.floor(farm() * 2));
  }
  return events;
}

/**
 * Farm Road's chronic problem: the 33 kV supply to the bus section that feeds it fails on
 * most days, for 2 to 5 hours in the evening, on top of load shedding. On those days the
 * feeder often falls below its band's 8-hour minimum.
 */
function upstreamFailures(): EventPlan[] {
  const events: EventPlan[] = [];
  const random = seeded("upstream:FD-FRM");
  for (let day = 0; day < DEMO_DAYS; day++) {
    const fails = random() < 0.63;
    const startMinute = Math.floor(random() * 50);
    const minutes = 120 + Math.floor(random() * 180);
    if (!fails) continue;
    events.push({
      id: `OUT-${dayLabel(day)}-FD-FRM-UPSTREAM`,
      origin: { kind: "feeder", id: "FD-FRM" },
      planned: false,
      cause: "upstream_supply",
      responsibleParty: "transmission",
      notes: "Loss of the 33 kV supply to the bus section feeding Farm Road.",
      parts: block(keys("FD-FRM"), at(day, 17, startMinute), at(day, 17, startMinute + minutes)),
    });
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
      notes: "11 kV conductor down. The first section was restored by sectionalising; the rest after repair.",
      parts: keys("FD-OLD").map((supplyKey) => ({
        supplyKey,
        startMs: at(5, 18, 40),
        // Old Town Central is on the section restored first.
        endMs: supplyKey === "OLD1" ? at(5, 21, 10) : at(5, 23, 55),
      })),
    },
    {
      id: "OUT-2026-09-09-FD-MKT-TRIP",
      origin: { kind: "feeder", id: "FD-MKT" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Feeder breaker tripped and reclosed.",
      parts: block(keys("FD-MKT"), at(8, 19, 2), at(8, 19, 5)),
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
      origin: { kind: "substation", id: "SS-RIV" },
      planned: false,
      cause: "upstream_supply",
      responsibleParty: "transmission",
      notes: "Loss of the 33 kV supply to the substation.",
      parts: block(substationKeys("SS-RIV"), at(17, 19, 15), at(17, 22, 50)),
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
    {
      id: "OUT-2026-09-15-FD-GOV-FAULT",
      origin: { kind: "feeder", id: "FD-GOV" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "11 kV cable fault near the secretariat.",
      parts: block(keys("FD-GOV"), at(14, 19, 20), at(14, 22, 5)),
    },
    {
      id: "OUT-2026-09-21-DT-GOV-4-MAINT",
      origin: { kind: "distribution_transformer", id: "DT-GOV-4" },
      planned: true,
      cause: "planned_maintenance",
      responsibleParty: "distribution",
      notes: "Planned transformer maintenance.",
      parts: block(["GOV4"], at(20, 12), at(20, 16, 30)),
    },
    {
      id: "OUT-2026-09-25-DT-FRM-3-FAULT",
      origin: { kind: "distribution_transformer", id: "DT-FRM-3" },
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "LV conductor down on a farm track.",
      parts: block(["FRM3"], at(24, 6, 15), at(24, 9, 40)),
    },
  ];
}

const EVENTS: readonly EventPlan[] = [...loadShedding(), ...upstreamFailures(), ...individualEvents()];

const TRANSFORMER_ID = new Map(TRANSFORMERS.map((dt) => [dt.key, dt.id]));

function affected(supplyKey: string): AssetRef {
  if (supplyKey === MV_CUSTOMER.key) return { kind: "service_point", id: MV_CUSTOMER.servicePointId };
  return { kind: "distribution_transformer", id: TRANSFORMER_ID.get(supplyKey) as string };
}

/** When each supply was off, as [startMs, endMs) intervals in time order. */
export const SUPPLY_OFF: ReadonlyMap<string, readonly (readonly [number, number])[]> = (() => {
  const off = new Map<string, [number, number][]>();
  for (const event of EVENTS) {
    for (const part of event.parts) {
      const intervals = off.get(part.supplyKey);
      if (intervals === undefined) off.set(part.supplyKey, [[part.startMs, part.endMs]]);
      else intervals.push([part.startMs, part.endMs]);
    }
  }
  for (const intervals of off.values()) intervals.sort((a, b) => a[0] - b[0]);
  return off;
})();

/** The share of each hourly interval during which a supply was on, computed once per supply. */
const AVAILABILITY = new Map<string, Float64Array>();

function availabilityOf(supplyKey: string): Float64Array {
  let hours = AVAILABILITY.get(supplyKey);
  if (hours === undefined) {
    const count = DEMO_DAYS * 24;
    hours = new Float64Array(count).fill(1);
    for (const [offStart, offEnd] of SUPPLY_OFF.get(supplyKey) ?? []) {
      const first = Math.max(0, Math.floor((offStart - hourStart(0)) / HOUR_MS));
      const last = Math.min(count - 1, Math.floor((offEnd - 1 - hourStart(0)) / HOUR_MS));
      for (let h = first; h <= last; h++) {
        const startMs = hourStart(h);
        const overlap = Math.min(startMs + HOUR_MS, offEnd) - Math.max(startMs, offStart);
        if (overlap > 0) hours[h] -= overlap / HOUR_MS;
      }
    }
    AVAILABILITY.set(supplyKey, hours);
  }
  return hours;
}

/** The share of hourly interval `h` during which the supply was on. */
export function availability(supplyKey: string, h: number): number {
  return availabilityOf(supplyKey)[h];
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
        // As an outage system with a network model holds it: the accounts connected under the transformer.
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
