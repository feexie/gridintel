import type { AssetRef, IntervalEnergy, InterruptionCause, Outage, TelemetryPoint } from "@/domain";
import type { LoadShape, SiteConnection, SiteDesign } from "./design.ts";
import { DEMO_CLOCK, DEMO_DAYS, DEMO_HOURS, HOUR_MS, at, hourStart, wat, weekday } from "../clock.ts";
import { SHAPE as NETWORK_SHAPE } from "../load.ts";
import { round, seeded } from "../rng.ts";
import { demoProvenance } from "../sources.ts";
import { BATTERY_ASSET, GENERATOR_ASSET, OUTPUT_METER, PV_ASSET, SITE_METERING_SOURCE, SITE_MONITORING_SOURCE, connectionsOfSite, meterOf } from "./design.ts";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES: ONE MONTH, HOUR BY HOUR

   A site's month is simulated from the bottom up, so that every
   record agrees with every other by construction:

   1. DEMAND. Each connection has a daily demand (its group's mean,
      a factor of its own, the day of the week, and day-to-day
      variation), spread over the day by its group's load shape.
   2. SUN. Each day has an in-plane irradiation drawn around the
      site's monthly mean, spread over daylight by a fixed bell.
   3. DISPATCH, each hour, in this order: PV serves the load; any
      surplus charges the battery; what the battery cannot take is
      curtailed. A shortfall is met from the battery; when the
      battery cannot meet it, the generator runs (at no less than 30%
      of its rating, the excess charging the battery); with no
      generator able to run, the site is disconnected for the hour:
      a low-battery interruption.
   4. RECORDS. Hourly energy of the PV, generator, battery and
      site-output meters; daily energy of each customer meter;
      irradiance, state of charge, the controller's curtailment
      estimate, and the generator's hour and fuel registers; and the
      interruption log.

   Interruptions are whole hours. A connection's consumption on a
   day is its demand in the hours the site was supplying it.
========================================================== */

const SHAPES: Record<LoadShape, readonly number[]> = {
  residential: NETWORK_SHAPE.residential,
  commercial: NETWORK_SHAPE.commercial,
  // Mills, workshops and cold rooms: a working day, with a little overnight for refrigeration.
  productive: [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.15, 0.5, 0.9, 1.0, 1.0, 1.0, 0.8, 0.9, 1.0, 1.0, 0.8, 0.5, 0.2, 0.1, 0.08, 0.08, 0.08, 0.08],
  // A clinic and a school: daytime, with lighting and a vaccine fridge at night.
  public: [0.2, 0.2, 0.2, 0.2, 0.2, 0.25, 0.35, 0.6, 0.9, 1.0, 1.0, 1.0, 0.9, 0.9, 0.8, 0.6, 0.45, 0.45, 0.5, 0.5, 0.4, 0.3, 0.25, 0.2],
};
const WEEK: Record<LoadShape, readonly number[]> = {
  residential: [1.05, 1, 1, 1, 1, 1, 1.05],
  commercial: [0.6, 1, 1, 1, 1, 1, 0.95],
  productive: [0.3, 1, 1, 1, 1, 1, 0.8],
  public: [0.4, 1, 1, 1, 1, 1, 0.5],
};
const SHAPE_SUM = Object.fromEntries(Object.entries(SHAPES).map(([name, shape]) => [name, shape.reduce((a, b) => a + b, 0)])) as Record<LoadShape, number>;

/** The share of a day's irradiation that falls in each hour: a bell from 06:00 to 19:00. */
const SUN: readonly number[] = (() => {
  const raw = Array.from({ length: 24 }, (_, hour) => (hour < 6 || hour > 18 ? 0 : Math.sin((Math.PI * (hour + 0.5 - 6)) / 13) ** 1.4));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((value) => value / sum);
})();

const CHARGE_EFFICIENCY = 0.95;
const DISCHARGE_EFFICIENCY = 0.95;
const GENERATOR_MINIMUM_LOAD = 0.3;
/** Fuel: litres an hour for each kW of rating while running, plus litres for each kWh produced. */
const FUEL = { perRatedKwHour: 0.08, perKwh: 0.24 };
const EVENING_HOURS = [18, 19, 20, 21, 22];
const INITIAL_SOC = 0.5;
/** Register readings before the month began; invented starting points. */
const OPENING_RUN_HOURS = 4120;
const OPENING_FUEL_LITRES = 38250;

export interface SiteMonth {
  site: SiteDesign;
  connections: SiteConnection[];
  intervalEnergy: IntervalEnergy[];
  telemetry: TelemetryPoint[];
  outages: Outage[];
  /** What each connection's meter recorded in the month, kWh; absent for a meter with a gap. */
  recordedKwh: Map<string, number>;
}

interface Interruption {
  fromHour: number;
  hours: number;
  cause: InterruptionCause;
  planned: boolean;
  customers: number | null;
  note: string;
}

export function simulateSite(site: SiteDesign): SiteMonth {
  const connections = connectionsOfSite(site);
  const active = connections.filter((connection) => connection.active);
  const metering = demoProvenance(SITE_METERING_SOURCE);
  const monitoring = demoProvenance(SITE_MONITORING_SOURCE);
  const estimate = demoProvenance(SITE_MONITORING_SOURCE, undefined, "Controller estimate: PV power available at the measured irradiance, less PV power taken.");

  /* ---- 1. Demand ---- */
  // Each connection's demand on each day, and the site's demand by load shape and day.
  const demand = new Map<string, number[]>();
  const byShape: Record<LoadShape, number[]> = { residential: [], commercial: [], productive: [], public: [] };
  for (const shape of Object.keys(byShape) as LoadShape[]) byShape[shape] = new Array<number>(DEMO_DAYS).fill(0);
  for (const connection of active) {
    const random = seeded(`minigrid:demand:${connection.customerId}`);
    const own = 0.55 + random() * 0.9;
    const days: number[] = [];
    for (let day = 0; day < DEMO_DAYS; day++) {
      const kwh = connection.group.dailyKwh * own * WEEK[connection.group.shape][weekday(day)] * (0.8 + random() * 0.4);
      days.push(kwh);
      byShape[connection.group.shape][day] += kwh;
    }
    demand.set(connection.customerId, days);
  }
  const shapes = Object.keys(byShape) as LoadShape[];

  /* ---- 2. Sun ---- */
  const sky = seeded(`minigrid:sky:${site.id}`);
  const irradiance: number[] = [];
  for (let day = 0; day < DEMO_DAYS; day++) {
    const daily = site.irradiation.meanDaily * (site.irradiation.low + sky() * (site.irradiation.high - site.irradiation.low));
    for (let hour = 0; hour < 24; hour++) irradiance.push(round(daily * SUN[hour] * 1000, 1));
  }

  /* ---- 3. Dispatch ---- */
  const designed = new Map<number, (typeof site.interruptions)[number]>();
  for (const interruption of site.interruptions) for (let i = 0; i < interruption.hours; i++) designed.set(interruption.day * 24 + interruption.hour + i, interruption);
  const capacity = site.batteryKwh * site.batteryHealth;
  const floor = capacity * site.minimumSoc;
  let stored = capacity * INITIAL_SOC;
  let runHours = OPENING_RUN_HOURS;
  let fuel = OPENING_FUEL_LITRES;

  const hours: { pv: number; generator: number; charge: number; discharge: number; sentOut: number; curtailed: number }[] = [];
  /** The share of each connection's hourly demand that was served: 0, 1, or the share of connections not on a faulted branch. */
  const served: number[] = [];
  const shed: (InterruptionCause | null)[] = [];
  const soc: number[] = [round((stored / capacity) * 100, 1)];
  const registers: { runHours: number; fuel: number }[] = [{ runHours, fuel }];

  for (let h = 0; h < DEMO_HOURS; h++) {
    const day = Math.floor(h / 24);
    const hour = h % 24;
    const wanted = shapes.reduce((total, shape) => total + (byShape[shape][day] * SHAPES[shape][hour]) / SHAPE_SUM[shape], 0);
    const event = designed.get(h);
    // A fault on one branch leaves the rest of the site supplied.
    const eventShare = event === undefined ? 1 : event.customers === undefined ? 0 : 1 - event.customers / active.length;
    const potential = (site.pvKwp * irradiance[h] * site.pvSystemEfficiency) / 1000;
    const generator = site.generator;
    const generatorFit = generator !== null && !(generator.outOfService !== undefined && day >= generator.outOfService.fromDay && day < generator.outOfService.toDay);

    const run = (share: number) => {
      const sentOut = (wanted * share) / (1 - site.distributionLoss);
      const need = sentOut + site.stationKw;
      const room = Math.max(0, (capacity - stored) / CHARGE_EFFICIENCY);
      const reserve = Math.max(0, (stored - floor) * DISCHARGE_EFFICIENCY);
      const scheduled = generatorFit && generator.policy === "evening_and_backup" && EVENING_HOURS.includes(hour) && share > 0;
      let pv = 0;
      let genOut = 0;
      let charge = 0;
      let discharge = 0;
      if (potential >= need && !scheduled) {
        charge = Math.min(potential - need, site.batteryKw, room);
        pv = need + charge;
      } else {
        pv = Math.min(potential, need);
        const shortfall = need - pv;
        if (!scheduled && Math.min(site.batteryKw, reserve) >= shortfall) discharge = shortfall;
        else if (generatorFit && share > 0) {
          genOut = Math.min(generator.kw, Math.max(shortfall, generator.kw * GENERATOR_MINIMUM_LOAD));
          // What the generator makes beyond the shortfall charges the battery; what it cannot take is not made.
          charge = Math.min(Math.max(0, genOut - shortfall), site.batteryKw, room);
          genOut = Math.min(genOut, shortfall + charge);
          discharge = Math.max(0, shortfall - genOut);
          if (discharge > Math.min(site.batteryKw, reserve)) return null;
        } else return null;
      }
      return { pv, generator: genOut, charge, discharge, sentOut, curtailed: Math.max(0, potential - pv) };
    };

    /** The site with no load connected: PV keeps the powerhouse and charges the battery; at night the battery keeps it while it can. */
    const idle = () => {
      const room = Math.max(0, (capacity - stored) / CHARGE_EFFICIENCY);
      const reserve = Math.max(0, (stored - floor) * DISCHARGE_EFFICIENCY);
      if (potential >= site.stationKw) {
        const charge = Math.min(potential - site.stationKw, site.batteryKw, room);
        return { pv: site.stationKw + charge, generator: 0, charge, discharge: 0, sentOut: 0, curtailed: potential - site.stationKw - charge };
      }
      const lit = reserve >= site.stationKw - potential;
      return { pv: lit ? potential : 0, generator: 0, charge: 0, discharge: lit ? site.stationKw - potential : 0, sentOut: 0, curtailed: lit ? 0 : potential };
    };

    let share = eventShare;
    let result = share === 0 ? idle() : run(share);
    let cause: InterruptionCause | null = null;
    if (result === null) {
      // The battery is at its floor and no generator can run: the controller disconnects the site.
      cause = generator !== null && !generatorFit ? "fault" : "load_shedding";
      share = 0;
      result = idle();
    }
    stored += result.charge * CHARGE_EFFICIENCY - result.discharge / DISCHARGE_EFFICIENCY;
    if (result.generator > 0 && generator !== null) {
      runHours += 1;
      fuel += FUEL.perRatedKwHour * generator.kw + FUEL.perKwh * result.generator;
    }
    hours.push(result);
    served.push(share);
    shed.push(cause);
    soc.push(round((stored / capacity) * 100, 1));
    registers.push({ runHours, fuel: round(fuel, 1) });
  }

  /* ---- 4. Records ---- */
  const intervalEnergy: IntervalEnergy[] = [];
  const hourly = (meterId: string, h: number, importKwh: number, exportKwh = 0) =>
    intervalEnergy.push({ meterId, intervalStart: wat(hourStart(h)), intervalMinutes: 60, importKwh: round(importKwh, 3), exportKwh: round(exportKwh, 3), quality: "measured", provenance: metering });
  for (let h = 0; h < DEMO_HOURS; h++) hourly(meterOf(PV_ASSET(site)), h, hours[h].pv);
  if (site.generator !== null) for (let h = 0; h < DEMO_HOURS; h++) hourly(meterOf(GENERATOR_ASSET(site)), h, hours[h].generator);
  for (let h = 0; h < DEMO_HOURS; h++) hourly(meterOf(BATTERY_ASSET(site)), h, hours[h].charge, hours[h].discharge);
  for (let h = 0; h < DEMO_HOURS; h++) hourly(OUTPUT_METER(site), h, hours[h].sentOut);

  // The share of a day's demand of each load shape that fell in supplied hours; a faulted branch is the first connections.
  const recordedKwh = new Map<string, number>();
  const gaps = site.meterGaps;
  const branch = new Set(site.interruptions.flatMap((interruption) => (interruption.customers === undefined ? [] : active.slice(0, interruption.customers).map((connection) => connection.customerId))));
  for (const connection of connections) {
    const days = demand.get(connection.customerId);
    const onBranch = branch.has(connection.customerId);
    // The meters with a gap are spread through the register, one in every fifty.
    const gap = gaps !== undefined && connection.active && connection.number % 50 === 7 && connection.number <= gaps.meters * 50;
    let month = 0;
    for (let day = 0; day < DEMO_DAYS; day++) {
      let kwh = 0;
      if (days !== undefined) {
        const shape = connection.group.shape;
        for (let hour = 0; hour < 24; hour++) {
          const h = day * 24 + hour;
          const supplied = designed.get(h)?.customers !== undefined && shed[h] === null ? (onBranch ? 0 : 1) : served[h] > 0 ? 1 : 0;
          kwh += ((days[day] * SHAPES[shape][hour]) / SHAPE_SUM[shape]) * supplied;
        }
      }
      month += round(kwh, 3);
      if (gap && gaps !== undefined && day >= gaps.fromDay && day < gaps.fromDay + gaps.days) continue;
      // A disconnected account's meter still reports: a real zero.
      intervalEnergy.push({ meterId: connection.meterId, intervalStart: wat(at(day, 0)), intervalMinutes: 1440, importKwh: round(kwh, 3), exportKwh: 0, quality: "measured", provenance: metering });
    }
    if (!gap) recordedKwh.set(connection.customerId, round(month, 3));
  }

  const telemetry: TelemetryPoint[] = [];
  const siteRef: AssetRef = { kind: "site", id: site.id };
  const asset = (id: string): AssetRef => ({ kind: "generation_asset", id });
  const stamp = (h: number) => (h === DEMO_HOURS ? DEMO_CLOCK : wat(hourStart(h)));
  for (let h = 0; h < DEMO_HOURS; h++) {
    // A reading is the mean over the hour that ends at its time.
    telemetry.push({ source: siteRef, metric: "irradiance_poa_w_m2", observedAt: stamp(h + 1), value: irradiance[h], quality: "measured", provenance: monitoring });
    telemetry.push({ source: asset(PV_ASSET(site)), metric: "curtailed_power_kw", observedAt: stamp(h + 1), value: round(hours[h].curtailed, 3), quality: "estimated", provenance: estimate });
  }
  for (let h = 0; h <= DEMO_HOURS; h++) telemetry.push({ source: asset(BATTERY_ASSET(site)), metric: "state_of_charge_pct", observedAt: stamp(h), value: soc[h], quality: "measured", provenance: monitoring });
  if (site.generator !== null) {
    // The registers are read once a day, at midnight.
    for (let day = 0; day <= DEMO_DAYS; day++) {
      const reading = registers[day * 24];
      telemetry.push({ source: asset(GENERATOR_ASSET(site)), metric: "run_hours_register_h", observedAt: stamp(day * 24), value: reading.runHours, quality: "measured", provenance: monitoring });
      telemetry.push({ source: asset(GENERATOR_ASSET(site)), metric: "fuel_used_register_l", observedAt: stamp(day * 24), value: reading.fuel, quality: "measured", provenance: monitoring });
    }
  }

  /* ---- Interruption log: designed events, and runs of hours the controller disconnected the site ---- */
  const interruptions: Interruption[] = site.interruptions.map((event) => ({ fromHour: event.day * 24 + event.hour, hours: event.hours, cause: event.cause, planned: event.planned, customers: event.customers ?? null, note: event.note }));
  for (let h = 0; h < DEMO_HOURS; h++) {
    const cause = shed[h];
    if (cause === null) continue;
    let length = 1;
    while (h + length < DEMO_HOURS && shed[h + length] === cause) length += 1;
    interruptions.push({
      fromHour: h,
      hours: length,
      cause,
      planned: false,
      customers: null,
      note: cause === "fault" ? "Generator out of service and battery at its minimum: site disconnected." : "Battery at its minimum state of charge: site disconnected by the controller.",
    });
    h += length - 1;
  }
  interruptions.sort((a, b) => a.fromHour - b.fromHour);
  const outages: Outage[] = interruptions.map((interruption, i) => {
    const id = `OUT-${site.id}-${String(i + 1).padStart(2, "0")}`;
    return {
      id,
      origin: siteRef,
      planned: interruption.planned,
      cause: interruption.cause,
      responsibleParty: interruption.cause === "load_shedding" || interruption.note.startsWith("Generator") ? "generation" : "distribution",
      status: "closed",
      exposures: [
        {
          affected: siteRef,
          customersAffected: interruption.customers ?? active.length,
          customerCountBasis: "topology_derived",
          interruptedAt: wat(hourStart(interruption.fromHour)),
          restoredAt: wat(hourStart(interruption.fromHour) + interruption.hours * HOUR_MS),
          quality: "measured",
        },
      ],
      notes: interruption.note,
      provenance: demoProvenance(SITE_MONITORING_SOURCE, id),
    };
  });

  return { site, connections, intervalEnergy, telemetry, outages, recordedKwh };
}
