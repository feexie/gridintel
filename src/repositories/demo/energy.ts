import type { DeviceHeartbeat, IntervalEnergy, IsoTimestamp, MetricKey, Period, TelemetryPoint } from "@/domain";
import type { ConnectionPlan } from "./network.ts";
import { DEMO_CLOCK, DEMO_DAYS, DEMO_HOURS, PERIOD_END_MS, at, hourStart, wat, weekday } from "./clock.ts";
import { DAY_FACTOR, HOURLY_NOISE, SHAPE, WEEK } from "./load.ts";
import { BOUNDARY_METERS, CONNECTIONS, FEEDERS, MV_CUSTOMER, QUIET_MONITOR, SUBSTATIONS, SUBSTATION_LOSS, TRANSFORMERS } from "./network.ts";
import { availability, energised } from "./outages.ts";
import { round, seeded } from "./rng.ts";
import { METERING_SOURCE, SCADA_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — ENERGY MODEL

   Built from the bottom up, so that every level agrees with the
   one below it:

     connection consumption  = peak demand × hourly shape × day
                               factors × noise × supply availability
     meter reading           = consumption × recorded fraction
                               (less than 1 where a meter is bypassed)
     transformer totalizer   = Σ consumption ÷ (1 − LV loss)
     feeder head             = (Σ totalizers + MV customer) ÷ (1 − MV loss)
     substation incomer      = Σ heads of the feeders on its bus
                               section ÷ (1 − substation loss)
     power transformer load  = Σ demand of the feeders on its bus
                               section ÷ (1 − substation loss), as
                               hourly apparent power from the
                               substation's remote terminal unit

   Consumption is modelled hour by hour for every connection. What
   the dataset HOLDS is only what each kind of meter can report
   (ADR 0009):

     boundary meters         hourly interval energy
     AMI customer meters     hourly interval energy
     postpaid, not AMI       two readings of the meter's register: one
                             from August's reading round, one from
                             September's. A round takes several days
                             per route (see READING ROUTES below). Some
                             rounds miss a meter, and that reading is
                             estimated
     prepaid, not AMI        nothing from the meter. The vends in the
                             billing records are all the utility has
     unmetered               nothing

   What an unmetered connection consumes, what a prepaid meter
   registers and what a bypassed meter fails to record exist only
   inside this model. They size the bills, the vends and the boundary
   meters, and are never written out as observations.

   THE READING AT THE DEMO CLOCK. Telemetry is hourly, and the demo
   clock is the end of the month, so one more reading is taken at
   that instant, from every transformer monitor and remote terminal
   unit: "loading now" is then a reading made now. What each
   connection draws at that instant follows the same rule as any
   other hour (the midnight shape of 1 October, a Thursday). A supply
   still off under an open interruption reads zero: Farm Road's
   feeder, its ten transformers, and Hillcrest T2, which carries Farm
   Road alone. No interval energy is written for it: the month's
   energy ends at the clock.
========================================================== */

/** What the reading round found at one postpaid meter that is not an AMI meter. */
export interface RegisterRead {
  /** The register's advance between the two readings, kWh; an estimate when the meter was not read. */
  advanceKwh: number;
  /** True when the round did not reach the meter and the billing system estimated the reading. */
  estimated: boolean;
  /** [opening reading, closing reading): the consumption the advance covers. It is not the calendar month. */
  period: Period;
}

/* ==========================================================
   READING ROUTES

   A meter reader walks one transformer's meters as a route, between
   08:00 and 16:00, and a route takes several days. Every route's
   September round ends on 30 September, in time for the billing run
   that night:

     most routes          2 or 3 days: 28, 29 and 30 September
     three long routes    4 days: 27 to 30 September

   The same meter is read at the same place in the round each month,
   so its opening reading is from 30 days earlier, in August's round.
   A bill therefore covers 30 days that begin and end a day or more
   before the calendar month does.

   The energy methodology counts a register advance toward September's
   recorded consumption only when both readings are within 3 days of
   the month's ends (ADR 0010): from 29 August, and from 28 September.
   The first day of a long route falls outside that:

     DT-FRM-4, DT-FRM-7   long rural routes on Farm Road. First day:
                          read 28 August and 27 September. The
                          opening reading is outside the window, and
                          so is the closing one.
     DT-OLD-6             the largest route on Old Town. Its August
                          round began a day late, so its first day
                          was read 29 August (inside) and 27
                          September: only the closing reading is
                          outside.

   So a few advances are excluded on each ground, and the reason
   shows on screen. Everything read on 28, 29 or 30 September counts.

   AUGUST. The model has hourly consumption for September only. What
   a meter registered on the last days of August is taken to be what
   it registered on the same weekday four weeks later (31 August was
   a Monday, as 28 September is). That is an assumption of the model;
   no August consumption is written out as an observation.
========================================================== */

interface ReadingRoute {
  /** Day of September, from 0, on which the route's round begins. It ends on 30 September. */
  firstDay: number;
  days: number;
  /** How many days later than 30 days before the August round reached the same meter. */
  augustShiftDays: number;
}

const LAST_READING_DAY = DEMO_DAYS - 1;
const LONG_ROUTES: Readonly<Record<string, ReadingRoute>> = {
  FRM4: { firstDay: LAST_READING_DAY - 3, days: 4, augustShiftDays: 0 },
  FRM7: { firstDay: LAST_READING_DAY - 3, days: 4, augustShiftDays: 0 },
  OLD6: { firstDay: LAST_READING_DAY - 3, days: 4, augustShiftDays: 1 },
};
const READING_CYCLE_DAYS = 30;
/** August hours stand on the same weekday four weeks later. */
const MIRROR_HOURS = 28 * 24;

/** The reading route of a transformer's meters, by supply key. */
function readingRoute(supplyKey: string): ReadingRoute {
  const long = LONG_ROUTES[supplyKey];
  if (long !== undefined) return long;
  const days = 2 + Math.floor(seeded(`route:${supplyKey}`)() * 2);
  return { firstDay: LAST_READING_DAY - (days - 1), days, augustShiftDays: 0 };
}

export interface EnergyModel {
  intervalEnergy: IntervalEnergy[];
  telemetry: TelemetryPoint[];
  heartbeats: DeviceHeartbeat[];
  /**
   * Energy each customer meter registered over the month, kWh, by customer id. Known to the
   * model for every meter; the dataset holds it only for AMI meters. It sizes bills and vends.
   */
  recordedKwh: ReadonlyMap<string, number>;
  /** The register reading behind each postpaid bill that is not from an AMI meter, by customer id. */
  registerReads: ReadonlyMap<string, RegisterRead>;
  /** Energy lost between a section's input and its customers, kWh, by "<scope kind>:<id>". */
  technicalLossKwh: ReadonlyMap<string, number>;
}

const HOUR_STARTS: readonly IsoTimestamp[] = Array.from({ length: DEMO_HOURS }, (_, h) => wat(hourStart(h)));
const WEEKDAY: readonly number[] = Array.from({ length: DEMO_DAYS }, (_, day) => weekday(day));
/** The last check-in of the one monitor that goes quiet; nothing it would have relayed after this is held. */
const QUIET_FROM_MS = at(QUIET_MONITOR.lastCheckIn.day, QUIET_MONITOR.lastCheckIn.hour, QUIET_MONITOR.lastCheckIn.minute);
/** The day of the week the demo clock falls on: the first instant of the day after the month. */
const CLOCK_WEEKDAY = weekday(DEMO_DAYS);

function zeros(): Float64Array {
  return new Float64Array(DEMO_HOURS);
}

function sum(values: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}

const METERING = demoProvenance(METERING_SOURCE);
const GAP_FILLED = demoProvenance(METERING_SOURCE, undefined, "Gap filled by the meter data system from the same hours of the previous day.");
const SCADA = demoProvenance(SCADA_SOURCE);
const READING_ROUND = demoProvenance(METERING_SOURCE, undefined, "Register read by a meter reader on the monthly round.");
const ESTIMATED_READING = demoProvenance(
  METERING_SOURCE,
  undefined,
  "The meter was not read on this round. The billing system estimated the reading from the account's earlier consumption.",
);
const FEEDER_BY_ID = new Map(FEEDERS.map((feeder) => [feeder.id, feeder]));

/**
 * Hourly readings of a boundary meter or an AMI customer meter, added to `intervalEnergy`.
 * Returns the month's total as the meter registered it, hours it failed to report included.
 */
function pushHourly(
  intervalEnergy: IntervalEnergy[],
  meterId: string,
  kwh: ArrayLike<number>,
  options: { estimated?: (h: number) => boolean; skip?: (h: number) => boolean } = {},
): number {
  let month = 0;
  for (let h = 0; h < DEMO_HOURS; h++) {
    const reading = round(kwh[h], 3);
    month += reading;
    if (options.skip?.(h)) continue;
    const isEstimated = options.estimated?.(h) ?? false;
    intervalEnergy.push({
      meterId,
      intervalStart: HOUR_STARTS[h],
      intervalMinutes: 60,
      importKwh: reading,
      exportKwh: 0,
      quality: isEstimated ? "estimated" : "measured",
      provenance: isEstimated ? GAP_FILLED : METERING,
    });
  }
  return round(month, 3);
}

/* ==========================================================
   ONE SUPPLY AT A TIME

   Everything a connection gives the dataset depends only on that
   connection and on the supply it hangs from: its own random
   streams, its supply's daily factors and its supply's outages. So
   the connections of one supply (a transformer, or the 11 kV
   customer) can be generated without any other, and the whole
   model is the supplies in order, with the boundaries above them.

   A screen about one service point asks for one supply's records.
   The adapter then generates that supply alone (see onDemand.ts);
   the records are the same ones the whole dataset holds.
========================================================== */

const CONNECTIONS_BY_SUPPLY: ReadonlyMap<string, readonly ConnectionPlan[]> = (() => {
  const bySupply = new Map<string, ConnectionPlan[]>();
  for (const connection of CONNECTIONS) {
    const list = bySupply.get(connection.supplyKey);
    if (list === undefined) bySupply.set(connection.supplyKey, [connection]);
    else list.push(connection);
  }
  return bySupply;
})();

/** Every supply key, in the order the dataset holds their connections. */
export const SUPPLY_KEYS: readonly string[] = [...CONNECTIONS_BY_SUPPLY.keys()];

/** The connections of one supply, in the dataset's order. */
export function connectionsOf(supplyKey: string): readonly ConnectionPlan[] {
  return CONNECTIONS_BY_SUPPLY.get(supplyKey) ?? [];
}

/** What the connections of one supply give the dataset, and what the levels above need from them. */
export interface SupplyEnergy {
  /** Interval energy of the supply's AMI customer meters. */
  intervalEnergy: IntervalEnergy[];
  /** Register readings of the supply's postpaid meters that are read by hand. */
  telemetry: TelemetryPoint[];
  recordedKwh: Map<string, number>;
  registerReads: Map<string, RegisterRead>;
  /** What the connections consumed, and would have drawn with supply on, per hour. */
  consumed: Float64Array;
  demand: Float64Array;
  /** What they would draw at the demo clock, kW. */
  clockKw: number;
}

export function buildSupplyEnergy(supplyKey: string): SupplyEnergy {
  const intervalEnergy: IntervalEnergy[] = [];
  const telemetry: TelemetryPoint[] = [];
  const recordedKwh = new Map<string, number>();
  const registerReads = new Map<string, RegisterRead>();

  /** What a meter that reports nothing registered over the month: known to the model only. */
  const monthTotal = (hourlyKwh: ArrayLike<number>): number => {
    let month = 0;
    for (let day = 0; day < DEMO_DAYS; day++) {
      let kwh = 0;
      for (let h = day * 24; h < day * 24 + 24; h++) kwh += hourlyKwh[h];
      month += round(kwh, 3);
    }
    return round(month, 3);
  };

  /**
   * The two readings of a postpaid meter's register: August's round and September's, each
   * taken when the reader reached the meter on its route. The register counts from an
   * arbitrary earlier reading. Where September's round did not reach the meter, the billing
   * system estimates the closing reading instead, dated when the meter was due to be read.
   */
  const pushRegisterReads = (customerId: string, meterId: string, supplyKey: string, hourlyKwh: ArrayLike<number>, missedShare: number) => {
    const random = seeded(`register:${customerId}`);
    const opening = round(400 + random() * 18_000, 1);
    const missed = random() < missedShare;
    const error = 0.75 + random() * 0.5;
    // Where on the route the meter is: which day of the round, and at what hour of the working day.
    const route = readingRoute(supplyKey);
    const closingHour = (route.firstDay + Math.floor(random() * route.days)) * 24 + 8 + Math.floor(random() * 9);
    const openingHour = closingHour - (READING_CYCLE_DAYS - route.augustShiftDays) * 24;
    let registered = 0;
    for (let h = openingHour; h < closingHour; h++) registered += hourlyKwh[h < 0 ? h + MIRROR_HOURS : h];
    const advanceKwh = round(registered * (missed ? error : 1), 1);
    const source = { kind: "meter" as const, id: meterId };
    const openingAt = wat(hourStart(openingHour));
    const closingAt = wat(hourStart(closingHour));
    telemetry.push(
      { source, metric: "energy_import_register_kwh", observedAt: openingAt, value: opening, quality: "measured", provenance: READING_ROUND },
      {
        source,
        metric: "energy_import_register_kwh",
        observedAt: closingAt,
        value: round(opening + advanceKwh, 1),
        quality: missed ? "estimated" : "measured",
        provenance: missed ? ESTIMATED_READING : READING_ROUND,
      },
    );
    registerReads.set(customerId, { advanceKwh, estimated: missed, period: { start: openingAt, end: closingAt } });
  };

  const key = supplyKey;
  const consumed = zeros();
  const demand = zeros();
  const dayRandom = seeded(`day:${key}`);
  const days = Array.from({ length: DEMO_DAYS }, () => DAY_FACTOR.low + dayRandom() * DAY_FACTOR.span);
  // What the connections would draw at the demo clock, kW: one more draw of the same rule.
  const dayFactorAtClock = DAY_FACTOR.low + seeded(`day:${key}:clock`)() * DAY_FACTOR.span;
  let clockKw = 0;

  // One AMI customer meter stopped reporting for two days: a gap, not a zero.
  const gapMeter = key === "MKT2" ? connectionsOf(key).find((c) => c.ami)?.meterId : undefined;
  const inGap = (h: number) => h >= 13 * 24 && h < 15 * 24;

  const recorded = zeros();
  for (const connection of connectionsOf(key)) {
    const noise = seeded(`load:${connection.customerId}`);
    const shape = SHAPE[connection.category];
    const week = WEEK[connection.category];
    for (let h = 0; h < DEMO_HOURS; h++) {
      const day = (h / 24) | 0;
      const kw = connection.peakKw * shape[h % 24] * week[WEEKDAY[day]] * days[day] * (HOURLY_NOISE.low + noise() * HOURLY_NOISE.span);
      const actual = kw * availability(key, h);
      demand[h] += kw;
      consumed[h] += actual;
      recorded[h] = actual * connection.recordedFraction;
    }
    // The connection's next draw, for the instant the month ends at.
    clockKw += connection.peakKw * shape[0] * week[CLOCK_WEEKDAY] * dayFactorAtClock * (HOURLY_NOISE.low + noise() * HOURLY_NOISE.span);
    if (connection.meterId === undefined) continue;
    if (connection.ami) {
      recordedKwh.set(connection.customerId, pushHourly(intervalEnergy, connection.meterId, recorded, connection.meterId === gapMeter ? { skip: inGap } : {}));
      continue;
    }
    recordedKwh.set(connection.customerId, monthTotal(recorded));
    if (connection.metering === "postpaid" && !connection.disconnected) {
      const missedShare = FEEDER_BY_ID.get(connection.feederId)?.estimatedReadShare ?? 0;
      pushRegisterReads(connection.customerId, connection.meterId, connection.supplyKey, recorded, missedShare);
    }
  }

  return { intervalEnergy, telemetry, recordedKwh, registerReads, consumed, demand, clockKw };
}

/**
 * The whole model: every supply in order, then the boundary meters and the telemetry above
 * them. `supply` gives one supply's part; a caller that already holds some passes them in.
 */
export function buildEnergyModel(supply: (supplyKey: string) => SupplyEnergy = buildSupplyEnergy): EnergyModel {
  const intervalEnergy: IntervalEnergy[] = [];
  const telemetry: TelemetryPoint[] = [];
  const recordedKwh = new Map<string, number>();
  const registerReads = new Map<string, RegisterRead>();
  const technicalLossKwh = new Map<string, number>();
  const scada = SCADA;

  // Supply key → what its connections consumed, and would have drawn with supply on, per hour.
  const consumed = new Map<string, Float64Array>();
  const demand = new Map<string, Float64Array>();
  const clockDemand = new Map<string, number>();
  for (const key of SUPPLY_KEYS) {
    const part = supply(key);
    for (const record of part.intervalEnergy) intervalEnergy.push(record);
    for (const point of part.telemetry) telemetry.push(point);
    for (const [customerId, kwh] of part.recordedKwh) recordedKwh.set(customerId, kwh);
    for (const [customerId, read] of part.registerReads) registerReads.set(customerId, read);
    consumed.set(key, part.consumed);
    demand.set(key, part.demand);
    clockDemand.set(key, part.clockKw);
  }

  /* ---- Boundaries --------------------------------------------------- */

  /** A reading at the start of hour `h`, or at the demo clock when `h` is the number of hours in the month. */
  const telemetryPoint = (
    source: TelemetryPoint["source"],
    metric: MetricKey,
    h: number,
    value: number,
    phase: TelemetryPoint["phase"],
    deviceId: string,
  ) => {
    // A monitor that has stopped checking in relays nothing: its readings from then on are a gap, not a value.
    if (deviceId === QUIET_MONITOR.deviceId && (h === DEMO_HOURS ? PERIOD_END_MS : hourStart(h)) > QUIET_FROM_MS) return;
    telemetry.push({ source, metric, observedAt: h === DEMO_HOURS ? DEMO_CLOCK : HOUR_STARTS[h], value: round(value, 2), phase, quality: "measured", deviceId, provenance: scada });
  };

  for (const substation of SUBSTATIONS) {
    // One meter per incomer: each carries the feeders on the bus section its transformer feeds.
    const incomers = substation.incomers.map(() => zeros());
    // What each incomer's power transformer carries, kVA: the demand of the feeders on its section.
    const transformerKva = substation.incomers.map(() => zeros());
    // The same at the demo clock.
    const transformerClockKva = substation.incomers.map(() => 0);
    let substationConsumed = 0;

    for (const feeder of FEEDERS.filter((plan) => plan.substationId === substation.id)) {
      const incomer = incomers[feeder.incomer - 1];
      const head = zeros();
      const headDemandKva = zeros();
      let headClockKva = 0;
      let feederConsumed = 0;

      for (const dt of TRANSFORMERS.filter((plan) => plan.feederId === feeder.id)) {
        const dtConsumed = consumed.get(dt.key) ?? zeros();
        const dtDemand = demand.get(dt.key) ?? zeros();
        const totalizer = dtConsumed.map((kwh) => kwh / (1 - dt.lvLoss));
        // One transformer's totalizer lost four readings, which the meter data system estimated.
        const estimated = dt.key === "OLD3" ? (h: number) => h >= 9 * 24 + 17 && h < 9 * 24 + 21 : undefined;
        pushHourly(intervalEnergy, BOUNDARY_METERS.totalizer(dt.id), totalizer, { estimated });
        technicalLossKwh.set(`distribution_transformer:${dt.id}`, sum(totalizer) - sum(dtConsumed));
        feederConsumed += sum(dtConsumed);

        const source = { kind: "distribution_transformer" as const, id: dt.id };
        for (let h = 0; h < DEMO_HOURS; h++) {
          head[h] += totalizer[h];
          const on = energised(dt.key, hourStart(h));
          const kw = on ? dtDemand[h] / (1 - dt.lvLoss) : 0;
          const kva = kw / dt.powerFactor;
          headDemandKva[h] += kva;
          telemetryPoint(source, "active_power_kw", h, kw, "total", `ED-${dt.id}`);
          telemetryPoint(source, "apparent_power_kva", h, kva, "total", `ED-${dt.id}`);
          if (on) telemetryPoint(source, "power_factor", h, dt.powerFactor, "total", `ED-${dt.id}`);
        }
        const onAtClock = energised(dt.key, PERIOD_END_MS);
        const clockKw = onAtClock ? (clockDemand.get(dt.key) ?? 0) / (1 - dt.lvLoss) : 0;
        headClockKva += clockKw / dt.powerFactor;
        telemetryPoint(source, "active_power_kw", DEMO_HOURS, clockKw, "total", `ED-${dt.id}`);
        telemetryPoint(source, "apparent_power_kva", DEMO_HOURS, clockKw / dt.powerFactor, "total", `ED-${dt.id}`);
        if (onAtClock) telemetryPoint(source, "power_factor", DEMO_HOURS, dt.powerFactor, "total", `ED-${dt.id}`);
      }

      if (feeder.id === MV_CUSTOMER.feederId) {
        const mvConsumed = consumed.get(MV_CUSTOMER.key) ?? zeros();
        const mvDemand = demand.get(MV_CUSTOMER.key) ?? zeros();
        feederConsumed += sum(mvConsumed);
        for (let h = 0; h < DEMO_HOURS; h++) {
          head[h] += mvConsumed[h];
          if (energised(MV_CUSTOMER.key, hourStart(h))) headDemandKva[h] += mvDemand[h] / MV_CUSTOMER.powerFactor;
        }
        if (energised(MV_CUSTOMER.key, PERIOD_END_MS)) headClockKva += (clockDemand.get(MV_CUSTOMER.key) ?? 0) / MV_CUSTOMER.powerFactor;
      }

      for (let h = 0; h < DEMO_HOURS; h++) head[h] /= 1 - feeder.mvLoss;
      pushHourly(intervalEnergy, BOUNDARY_METERS.feederHead(feeder.id), head);
      technicalLossKwh.set(`feeder:${feeder.id}`, sum(head) - feederConsumed);
      substationConsumed += feederConsumed;

      const source = { kind: "feeder" as const, id: feeder.id };
      const device = `ED-${substation.id}`;
      for (let h = 0; h <= DEMO_HOURS; h++) {
        const atClock = h === DEMO_HOURS;
        if (!atClock) incomer[h] += head[h];
        const kva = (atClock ? headClockKva : headDemandKva[h]) / (1 - feeder.mvLoss);
        if (atClock) transformerClockKva[feeder.incomer - 1] += kva;
        else transformerKva[feeder.incomer - 1][h] += kva;
        const amps = kva / (Math.sqrt(3) * 11);
        telemetryPoint(source, "apparent_power_kva", h, kva, "total", device);
        telemetryPoint(source, "current_a", h, amps * 1.03, "A", device);
        telemetryPoint(source, "current_a", h, amps * 0.99, "B", device);
        telemetryPoint(source, "current_a", h, amps * 0.98, "C", device);
      }
    }

    let received = 0;
    incomers.forEach((incomer, i) => {
      for (let h = 0; h < DEMO_HOURS; h++) incomer[h] /= 1 - SUBSTATION_LOSS;
      pushHourly(intervalEnergy, BOUNDARY_METERS.incomer(substation, i + 1), incomer);
      received += sum(incomer);
      // The transformer's loading, read at its 11 kV side by the substation's remote terminal unit.
      const source = { kind: "power_transformer" as const, id: substation.incomers[i].powerTransformer.id };
      for (let h = 0; h <= DEMO_HOURS; h++) {
        const kva = h === DEMO_HOURS ? transformerClockKva[i] : transformerKva[i][h];
        telemetryPoint(source, "apparent_power_kva", h, kva / (1 - SUBSTATION_LOSS), "total", `ED-${substation.id}`);
      }
    });
    technicalLossKwh.set(`substation:${substation.id}`, received - substationConsumed);
  }

  return { intervalEnergy, telemetry, heartbeats: buildDemoHeartbeats(), recordedKwh, registerReads, technicalLossKwh };
}

/** Hourly check-ins over the last day. One transformer monitor went quiet nine hours before the demo clock. */
export function buildDemoHeartbeats(): DeviceHeartbeat[] {
  const provenance = SCADA;
  const heartbeats: DeviceHeartbeat[] = [];
  const devices = [...SUBSTATIONS.map((plan) => `ED-${plan.id}`), ...TRANSFORMERS.map((dt) => `ED-${dt.id}`)];
  const signal = seeded("heartbeats");
  for (const deviceId of devices) {
    const lastHour = deviceId === QUIET_MONITOR.deviceId ? QUIET_MONITOR.lastCheckIn.hour : 23;
    for (let hour = 0; hour <= lastHour; hour++) {
      const ms = at(QUIET_MONITOR.lastCheckIn.day, hour, QUIET_MONITOR.lastCheckIn.minute);
      if (ms >= PERIOD_END_MS) continue;
      heartbeats.push({
        device: { kind: "edge_device", id: deviceId },
        receivedAt: wat(ms),
        signalStrengthPct: Math.round(55 + signal() * 40),
        latencyMs: Math.round(120 + signal() * 400),
        provenance,
      });
    }
  }
  return heartbeats;
}
