import type { DeviceHeartbeat, IntervalEnergy, IsoTimestamp, MetricKey, Period, Provenance, TelemetryPoint } from "@/domain";
import { DEMO_DAYS, DEMO_HOURS, PERIOD_END_MS, at, hourStart, wat, weekday } from "./clock.ts";
import { DAY_FACTOR, HOURLY_NOISE, SHAPE, WEEK } from "./load.ts";
import { BOUNDARY_METERS, CONNECTIONS, FEEDERS, MV_CUSTOMER, SUBSTATIONS, SUBSTATION_LOSS, TRANSFORMERS } from "./network.ts";
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

   Consumption is modelled hour by hour for every connection. What
   the dataset HOLDS is only what each kind of meter can report
   (ADR 0009):

     boundary meters         hourly interval energy
     AMI customer meters     hourly interval energy
     postpaid, not AMI       two readings of the meter's register: one
                             at the start of the month, one at the
                             month-end reading round. Some rounds miss
                             a meter, and that reading is estimated
     prepaid, not AMI        nothing from the meter. The vends in the
                             billing records are all the utility has
     unmetered               nothing

   What an unmetered connection consumes, what a prepaid meter
   registers and what a bypassed meter fails to record exist only
   inside this model. They size the bills, the vends and the boundary
   meters, and are never written out as observations.
========================================================== */

/** What the month-end reading round found at one postpaid meter that is not an AMI meter. */
export interface RegisterRead {
  /** The register's advance between the two readings, kWh; an estimate when the meter was not read. */
  advanceKwh: number;
  /** True when the round did not reach the meter and the billing system estimated the reading. */
  estimated: boolean;
  /** [opening reading, closing reading): the consumption the advance covers. */
  period: Period;
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
/**
 * The month-end reading round reaches a meter at 23:00 on 30 September, half an hour before
 * the billing run. A register reading covers what was used up to that moment and no later.
 */
export const READING_ROUND_HOUR = DEMO_HOURS - 1;
const WEEKDAY: readonly number[] = Array.from({ length: DEMO_DAYS }, (_, day) => weekday(day));

function zeros(): Float64Array {
  return new Float64Array(DEMO_HOURS);
}

function sum(values: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}

export function buildEnergyModel(): EnergyModel {
  const metering = demoProvenance(METERING_SOURCE);
  const estimatedProvenance = demoProvenance(
    METERING_SOURCE,
    undefined,
    "Gap filled by the meter data system from the same hours of the previous day.",
  );
  const scada = demoProvenance(SCADA_SOURCE);
  const readingRound = demoProvenance(METERING_SOURCE, undefined, "Register read by a meter reader on the monthly round.");
  const estimatedReading = demoProvenance(
    METERING_SOURCE,
    undefined,
    "The meter was not read on this round. The billing system estimated the reading from the account's earlier consumption.",
  );
  const intervalEnergy: IntervalEnergy[] = [];
  const telemetry: TelemetryPoint[] = [];
  const recordedKwh = new Map<string, number>();
  const registerReads = new Map<string, RegisterRead>();
  const feederById = new Map(FEEDERS.map((feeder) => [feeder.id, feeder]));
  const technicalLossKwh = new Map<string, number>();

  /**
   * Hourly readings of a boundary meter or an AMI customer meter. Returns the month's total as
   * the meter registered it, hours it failed to report included.
   */
  const pushHourly = (
    meterId: string,
    kwh: ArrayLike<number>,
    options: { estimated?: (h: number) => boolean; skip?: (h: number) => boolean } = {},
  ): number => {
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
        provenance: isEstimated ? estimatedProvenance : metering,
      });
    }
    return round(month, 3);
  };

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
   * The two readings of a postpaid meter's register that the month-end round brackets the
   * month with. The register counts from an arbitrary earlier reading. Where the round did
   * not reach the meter, the billing system estimates the closing reading instead.
   */
  const pushRegisterReads = (customerId: string, meterId: string, hourlyKwh: ArrayLike<number>, missedShare: number) => {
    const random = seeded(`register:${customerId}`);
    const opening = round(400 + random() * 18_000, 1);
    const missed = random() < missedShare;
    const error = 0.75 + random() * 0.5;
    let registered = 0;
    for (let h = 0; h < READING_ROUND_HOUR; h++) registered += hourlyKwh[h];
    const advanceKwh = round(registered * (missed ? error : 1), 1);
    const source = { kind: "meter" as const, id: meterId };
    telemetry.push(
      { source, metric: "energy_import_register_kwh", observedAt: HOUR_STARTS[0], value: opening, quality: "measured", provenance: readingRound },
      {
        source,
        metric: "energy_import_register_kwh",
        observedAt: HOUR_STARTS[READING_ROUND_HOUR],
        value: round(opening + advanceKwh, 1),
        quality: missed ? "estimated" : "measured",
        provenance: missed ? estimatedReading : readingRound,
      },
    );
    registerReads.set(customerId, {
      advanceKwh,
      estimated: missed,
      period: { start: HOUR_STARTS[0], end: HOUR_STARTS[READING_ROUND_HOUR] },
    });
  };

  /* ---- Connections -------------------------------------------------- */

  // Supply key → what its connections consumed, and would have drawn with supply on, per hour.
  const consumed = new Map<string, Float64Array>();
  const demand = new Map<string, Float64Array>();
  const dayFactor = new Map<string, number[]>();
  const dayFactors = (supplyKey: string): number[] => {
    let factors = dayFactor.get(supplyKey);
    if (factors === undefined) {
      const random = seeded(`day:${supplyKey}`);
      factors = Array.from({ length: DEMO_DAYS }, () => DAY_FACTOR.low + random() * DAY_FACTOR.span);
      dayFactor.set(supplyKey, factors);
    }
    return factors;
  };

  // One AMI customer meter stopped reporting for two days: a gap, not a zero.
  const gapMeter = CONNECTIONS.find((c) => c.supplyKey === "MKT2" && c.ami)?.meterId;
  const inGap = (h: number) => h >= 13 * 24 && h < 15 * 24;

  const recorded = zeros();
  for (const connection of CONNECTIONS) {
    const key = connection.supplyKey;
    const noise = seeded(`load:${connection.customerId}`);
    const days = dayFactors(key);
    const shape = SHAPE[connection.category];
    const week = WEEK[connection.category];
    let supplyConsumed = consumed.get(key);
    let supplyDemand = demand.get(key);
    if (supplyConsumed === undefined || supplyDemand === undefined) {
      supplyConsumed = zeros();
      supplyDemand = zeros();
      consumed.set(key, supplyConsumed);
      demand.set(key, supplyDemand);
    }
    for (let h = 0; h < DEMO_HOURS; h++) {
      const day = (h / 24) | 0;
      const kw = connection.peakKw * shape[h % 24] * week[WEEKDAY[day]] * days[day] * (HOURLY_NOISE.low + noise() * HOURLY_NOISE.span);
      const actual = kw * availability(key, h);
      supplyDemand[h] += kw;
      supplyConsumed[h] += actual;
      recorded[h] = actual * connection.recordedFraction;
    }
    if (connection.meterId === undefined) continue;
    if (connection.ami) {
      recordedKwh.set(connection.customerId, pushHourly(connection.meterId, recorded, connection.meterId === gapMeter ? { skip: inGap } : {}));
      continue;
    }
    recordedKwh.set(connection.customerId, monthTotal(recorded));
    if (connection.metering === "postpaid" && !connection.disconnected) {
      const missedShare = feederById.get(connection.feederId)?.estimatedReadShare ?? 0;
      pushRegisterReads(connection.customerId, connection.meterId, recorded, missedShare);
    }
  }

  /* ---- Boundaries --------------------------------------------------- */

  const telemetryPoint = (
    source: TelemetryPoint["source"],
    metric: MetricKey,
    h: number,
    value: number,
    phase: TelemetryPoint["phase"],
    deviceId: string,
  ) =>
    telemetry.push({ source, metric, observedAt: HOUR_STARTS[h], value: round(value, 2), phase, quality: "measured", deviceId, provenance: scada });

  for (const substation of SUBSTATIONS) {
    // One meter per incomer: each carries the feeders on the bus section its transformer feeds.
    const incomers = substation.incomers.map(() => zeros());
    let substationConsumed = 0;

    for (const feeder of FEEDERS.filter((plan) => plan.substationId === substation.id)) {
      const incomer = incomers[feeder.incomer - 1];
      const head = zeros();
      const headDemandKva = zeros();
      let feederConsumed = 0;

      for (const dt of TRANSFORMERS.filter((plan) => plan.feederId === feeder.id)) {
        const dtConsumed = consumed.get(dt.key) ?? zeros();
        const dtDemand = demand.get(dt.key) ?? zeros();
        const totalizer = dtConsumed.map((kwh) => kwh / (1 - dt.lvLoss));
        // One transformer's totalizer lost four readings, which the meter data system estimated.
        const estimated = dt.key === "OLD3" ? (h: number) => h >= 9 * 24 + 17 && h < 9 * 24 + 21 : undefined;
        pushHourly(BOUNDARY_METERS.totalizer(dt.id), totalizer, { estimated });
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
      }

      if (feeder.id === MV_CUSTOMER.feederId) {
        const mvConsumed = consumed.get(MV_CUSTOMER.key) ?? zeros();
        const mvDemand = demand.get(MV_CUSTOMER.key) ?? zeros();
        feederConsumed += sum(mvConsumed);
        for (let h = 0; h < DEMO_HOURS; h++) {
          head[h] += mvConsumed[h];
          if (energised(MV_CUSTOMER.key, hourStart(h))) headDemandKva[h] += mvDemand[h] / MV_CUSTOMER.powerFactor;
        }
      }

      for (let h = 0; h < DEMO_HOURS; h++) head[h] /= 1 - feeder.mvLoss;
      pushHourly(BOUNDARY_METERS.feederHead(feeder.id), head);
      technicalLossKwh.set(`feeder:${feeder.id}`, sum(head) - feederConsumed);
      substationConsumed += feederConsumed;

      const source = { kind: "feeder" as const, id: feeder.id };
      const device = `ED-${substation.id}`;
      for (let h = 0; h < DEMO_HOURS; h++) {
        incomer[h] += head[h];
        const kva = headDemandKva[h] / (1 - feeder.mvLoss);
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
      pushHourly(BOUNDARY_METERS.incomer(substation, i + 1), incomer);
      received += sum(incomer);
    });
    technicalLossKwh.set(`substation:${substation.id}`, received - substationConsumed);
  }

  return { intervalEnergy, telemetry, heartbeats: buildHeartbeats(scada), recordedKwh, registerReads, technicalLossKwh };
}

/** Hourly check-ins over the last day. One transformer monitor went quiet nine hours before the demo clock. */
function buildHeartbeats(provenance: Provenance): DeviceHeartbeat[] {
  const heartbeats: DeviceHeartbeat[] = [];
  const devices = [...SUBSTATIONS.map((plan) => `ED-${plan.id}`), ...TRANSFORMERS.map((dt) => `ED-${dt.id}`)];
  const signal = seeded("heartbeats");
  for (const deviceId of devices) {
    const lastHour = deviceId === "ED-DT-OLD-3" ? 14 : 23;
    for (let hour = 0; hour <= lastHour; hour++) {
      const ms = at(29, hour, 55);
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
