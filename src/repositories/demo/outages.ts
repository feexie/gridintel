import type { AssetRef, EntityRef, InterruptionCause, InterruptionOrigin, Outage, OutageExposure, ResponsibleParty } from "@/domain";
import { DEMO_DAYS, HOUR_MS, PERIOD_END_MS, at, hourStart, wat } from "./clock.ts";
import { CONNECTIONS, FEEDERS, MV_CUSTOMER, SUBSTATIONS, TRANSFORMERS, activeAccounts, incomerOf } from "./network.ts";
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
   - on Farm Road, frequent faults on the long rural 33 kV line that
     supplies it, and a few outages at the transmission station that
     line comes from;
   - a handful of individual events (faults, planned work, a 33 kV
     line fault that takes out a whole substation, a momentary trip,
     a storm).

   Every interruption records where it began (its origin point). The
   33 kV lines belong to the distribution business, so a fault on one
   is a network interruption. Only the transmission station and the
   grid are upstream (ADR 0006, amendment).

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
  origin: EntityRef;
  originPoint: InterruptionOrigin;
  planned: boolean;
  cause: InterruptionCause;
  responsibleParty: ResponsibleParty;
  notes: string;
  parts: Part[];
  /** Still open at the demo clock: its parts run to the end of the dataset and have no restoration time. */
  open?: boolean;
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
      // The feeder is opened at the substation, but the interruption begins with the
      // shortfall in the supply allocated from the grid.
      originPoint: "grid",
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

/** 33 kV lines and the transmission station are not registry assets, so they are named, not linked. */
const line = (label: string): EntityRef => ({ kind: "feeder", label, context: "33 kV lines are not in the registry." });
const FARM_ROAD = FEEDERS.find((feeder) => feeder.id === "FD-FRM") as (typeof FEEDERS)[number];
const RIVERSIDE = SUBSTATIONS.find((substation) => substation.id === "SS-RIV") as (typeof SUBSTATIONS)[number];
/** The line into the incomer whose bus section carries Farm Road. */
const RURAL_LINE = line(incomerOf(FARM_ROAD).line);
const RIVERSIDE_LINE = line(RIVERSIDE.incomers[0].line);

/** The supplies on the bus section an incomer feeds: everything that goes off when its 33 kV line does. */
function keysOnIncomer(substationId: string, incomer: number): string[] {
  return FEEDERS.filter((feeder) => feeder.substationId === substationId && feeder.incomer === incomer).flatMap((feeder) => keys(feeder.id));
}
const TRANSMISSION_STATION: EntityRef = {
  kind: "substation",
  label: "132/33 kV transmission station",
  context: "Owned by the transmission company; not in the registry.",
};

/**
 * Farm Road's chronic problem: the long rural 33 kV line into Hillcrest's second incomer
 * faults on most days, for 2 to 5 hours in the evening, on top of load shedding. On those
 * days the feeder often falls below its band's 8-hour minimum. The line belongs to the
 * distribution business, so these are network interruptions. Every sixth loss of the line
 * is not a fault on it but an outage at the transmission station it comes from, which is
 * the transmission company's.
 */
function ruralLineInterruptions(): EventPlan[] {
  const events: EventPlan[] = [];
  const random = seeded("upstream:FD-FRM");
  let n = 0;
  for (let day = 0; day < DEMO_DAYS; day++) {
    const fails = random() < 0.63;
    const startMinute = Math.floor(random() * 50);
    const minutes = 120 + Math.floor(random() * 180);
    if (!fails) continue;
    n += 1;
    // The whole bus section goes off. That is Farm Road alone: Government Avenue is on the other.
    const parts = block(keysOnIncomer(FARM_ROAD.substationId, FARM_ROAD.incomer), at(day, 17, startMinute), at(day, 17, startMinute + minutes));
    events.push(
      n % 6 === 0
        ? {
            id: `OUT-${dayLabel(day)}-FD-FRM-TS`,
            origin: TRANSMISSION_STATION,
            originPoint: "transmission_station",
            planned: false,
            cause: "upstream_supply",
            responsibleParty: "transmission",
            notes: "33 kV feeder breaker opened at the transmission station supplying the rural line.",
            parts,
          }
        : {
            id: `OUT-${dayLabel(day)}-FD-FRM-33KV`,
            origin: RURAL_LINE,
            originPoint: "subtransmission_line",
            planned: false,
            cause: "fault",
            responsibleParty: "distribution",
            notes: "Fault on the rural 33 kV line into incomer 2; bus section B lost supply.",
            parts,
          },
    );
  }
  return events;
}

/** Individual events, placed in hours that load shedding never uses on the feeder concerned. */
function individualEvents(): EventPlan[] {
  return [
    {
      id: "OUT-2026-09-06-FD-OLD-FAULT",
      origin: { kind: "feeder", id: "FD-OLD" },
      originPoint: "mv_feeder",
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
      originPoint: "mv_feeder",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Feeder breaker tripped and reclosed.",
      parts: block(keys("FD-MKT"), at(8, 19, 2), at(8, 19, 5)),
    },
    {
      id: "OUT-2026-09-12-DT-MKT-2-MAINT",
      origin: { kind: "distribution_transformer", id: "DT-MKT-2" },
      originPoint: "distribution_transformer",
      planned: true,
      cause: "planned_maintenance",
      responsibleParty: "distribution",
      notes: "Planned transformer maintenance.",
      parts: block(["MKT2"], at(11, 7), at(11, 11, 30)),
    },
    {
      // The substation lost its 33 kV supply because the line feeding it faulted. The line is
      // the distribution business's own, so this is a network interruption, not an upstream one.
      id: "OUT-2026-09-18-SS-RIV-33KV",
      origin: RIVERSIDE_LINE,
      originPoint: "subtransmission_line",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Fault on the 33 kV line feeding the substation; all of Riverside lost supply.",
      parts: block(substationKeys("SS-RIV"), at(17, 19, 15), at(17, 22, 50)),
    },
    {
      id: "OUT-2026-09-23-DT-OLD-2-FAULT",
      origin: { kind: "distribution_transformer", id: "DT-OLD-2" },
      originPoint: "distribution_transformer",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "Transformer LV fuses blown.",
      parts: block(["OLD2"], at(22, 16, 30), at(22, 23, 10)),
    },
    {
      id: "OUT-2026-09-27-DT-OLD-3-STORM",
      origin: { kind: "distribution_transformer", id: "DT-OLD-3" },
      originPoint: "lv_network",
      planned: false,
      cause: "weather",
      responsibleParty: "distribution",
      notes: "LV line down in a storm.",
      parts: block(["OLD3"], at(26, 6, 10), at(26, 7, 25)),
    },
    {
      id: "OUT-2026-09-15-FD-GOV-FAULT",
      origin: { kind: "feeder", id: "FD-GOV" },
      originPoint: "mv_feeder",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "11 kV cable fault near the secretariat.",
      parts: block(keys("FD-GOV"), at(14, 19, 20), at(14, 22, 5)),
    },
    {
      id: "OUT-2026-09-21-DT-GOV-4-MAINT",
      origin: { kind: "distribution_transformer", id: "DT-GOV-4" },
      originPoint: "distribution_transformer",
      planned: true,
      cause: "planned_maintenance",
      responsibleParty: "distribution",
      notes: "Planned transformer maintenance.",
      parts: block(["GOV4"], at(20, 12), at(20, 16, 30)),
    },
    {
      id: "OUT-2026-09-25-DT-FRM-3-FAULT",
      origin: { kind: "distribution_transformer", id: "DT-FRM-3" },
      originPoint: "lv_network",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "LV conductor down on a farm track.",
      parts: block(["FRM3"], at(24, 6, 15), at(24, 9, 40)),
    },
    {
      // In progress at the demo clock: the control room's normal case. The feeder locked out
      // forty minutes before midnight and nothing has been restored, so the record has no
      // restoration time and its status is open.
      id: "OUT-2026-09-30-FD-FRM-FAULT",
      origin: { kind: "feeder", id: "FD-FRM" },
      originPoint: "mv_feeder",
      planned: false,
      cause: "fault",
      responsibleParty: "distribution",
      notes: "11 kV conductor down beyond the river crossing; patrol dispatched. Not restored.",
      parts: block(keys("FD-FRM"), at(29, 23, 20), PERIOD_END_MS),
      open: true,
    },
  ];
}

const EVENTS: readonly EventPlan[] = [...loadShedding(), ...ruralLineInterruptions(), ...individualEvents()];

/** An interruption that was not load shedding, as the alarm list needs it: what, where, and from when to when. */
export interface InterruptionWindow {
  id: string;
  origin: EntityRef;
  originPoint: InterruptionOrigin;
  planned: boolean;
  cause: InterruptionCause;
  startMs: number;
  /** When the last part was restored; the end of the dataset for an interruption still open. */
  endMs: number;
  /** Not restored at the demo clock. */
  open: boolean;
}

/** Every interruption that was not load shedding, in the order designed. Load shedding raises no alarm: the feeder is opened on purpose. */
export const INTERRUPTION_WINDOWS: readonly InterruptionWindow[] = EVENTS.filter((event) => event.cause !== "load_shedding").map((event) => ({
  id: event.id,
  origin: event.origin,
  originPoint: event.originPoint,
  planned: event.planned,
  cause: event.cause,
  startMs: Math.min(...event.parts.map((part) => part.startMs)),
  endMs: Math.max(...event.parts.map((part) => part.endMs)),
  open: event.open === true,
}));

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

/** The supplies still off at the demo clock: those under an interruption that is open. Its intervals end at the clock only because the dataset does. */
const OFF_AT_CLOCK: ReadonlySet<string> = new Set(EVENTS.filter((event) => event.open).flatMap((event) => event.parts.map((part) => part.supplyKey)));

/** Whether the supply was on at an instant. At the demo clock, a supply under an open interruption is still off. */
export function energised(supplyKey: string, ms: number): boolean {
  if (ms >= PERIOD_END_MS && OFF_AT_CLOCK.has(supplyKey)) return false;
  return !(SUPPLY_OFF.get(supplyKey) ?? []).some(([offStart, offEnd]) => ms >= offStart && ms < offEnd);
}

export function buildDemoOutages(): Outage[] {
  const outages: Outage[] = EVENTS.map((event) => ({
    id: event.id,
    origin: event.origin,
    originPoint: event.originPoint,
    planned: event.planned,
    cause: event.cause,
    responsibleParty: event.responsibleParty,
    status: event.open ? "open" : "closed",
    exposures: event.parts.map(
      (part): OutageExposure => ({
        affected: affected(part.supplyKey),
        customersAffected: activeAccounts(part.supplyKey),
        // As an outage system with a network model holds it: the accounts connected under the transformer.
        customerCountBasis: "topology_derived",
        interruptedAt: wat(part.startMs),
        ...(event.open ? {} : { restoredAt: wat(part.endMs) }),
        quality: "measured",
      }),
    ),
    notes: event.notes,
    provenance: demoProvenance(OUTAGE_SOURCE, event.id),
  }));

  // A complaint that was logged and never followed up: the log holds no restoration time and
  // no status for it, so it is a gap in the record, not an interruption in progress, and it
  // cannot count toward any index. Nor is it known where it began, so it has no origin point.
  // It does not change the energy model.
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
