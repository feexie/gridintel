import type { DeviceHeartbeat, IntervalEnergy, IsoTimestamp, MetricKey, Provenance, TelemetryPoint } from "@/domain";
import type { CustomerCategory } from "./network.ts";
import { DEMO_DAYS, DEMO_HOURS, PERIOD_END_MS, at, hourStart, wat, weekday } from "./clock.ts";
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
     substation incomer      = Σ feeder heads ÷ (1 − substation loss)

   Consumption is modelled hour by hour. Boundary meters (incomers,
   feeder heads, transformer totalizers) report it hourly. Customer
   meters report one reading a day, the sum of that day's hours,
   which keeps the dataset small with thousands of connections.

   What an unmetered connection consumes, and what a bypassed meter
   fails to record, exist only inside this model. The dataset holds
   only what a utility could actually observe: boundary meters and
   the customer meters that exist.
========================================================== */

/** Demand as a share of the category's peak, by hour of the day in WAT. */
const SHAPE: Record<CustomerCategory, readonly number[]> = {
  residential: [
    0.35, 0.3, 0.28, 0.27, 0.28, 0.35, 0.5, 0.6, 0.5, 0.4, 0.38, 0.38,
    0.42, 0.45, 0.42, 0.4, 0.45, 0.6, 0.8, 0.95, 1.0, 0.95, 0.75, 0.5,
  ],
  commercial: [
    0.1, 0.1, 0.1, 0.1, 0.1, 0.12, 0.2, 0.4, 0.7, 0.9, 1.0, 1.0,
    0.95, 0.95, 1.0, 0.95, 0.9, 0.8, 0.6, 0.4, 0.25, 0.15, 0.12, 0.1,
  ],
  industrial: [
    0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.7, 0.7, 0.7, 0.7, 0.7,
  ],
  // Offices: a working-day load with little outside office hours.
  government: [
    0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.15, 0.35, 0.8, 1.0, 1.0, 1.0,
    0.95, 0.95, 1.0, 0.95, 0.7, 0.35, 0.2, 0.15, 0.12, 0.12, 0.12, 0.12,
  ],
};

/** Demand on a day of the week relative to a weekday: [Sunday … Saturday]. */
const WEEK: Record<CustomerCategory, readonly number[]> = {
  residential: [1.06, 1, 1, 1, 1, 1, 1.06],
  commercial: [0.5, 1, 1, 1, 1, 1, 0.85],
  industrial: [0.6, 1, 1, 1, 1, 1, 0.9],
  government: [0.2, 1, 1, 1, 1, 1, 0.25],
};

export interface EnergyModel {
  intervalEnergy: IntervalEnergy[];
  telemetry: TelemetryPoint[];
  heartbeats: DeviceHeartbeat[];
  /** Energy each customer meter recorded over the month, kWh, by customer id. */
  recordedKwh: ReadonlyMap<string, number>;
  /** Energy lost between a section's input and its customers, kWh, by "<scope kind>:<id>". */
  technicalLossKwh: ReadonlyMap<string, number>;
}

const HOUR_STARTS: readonly IsoTimestamp[] = Array.from({ length: DEMO_HOURS }, (_, h) => wat(hourStart(h)));
const DAY_STARTS: readonly IsoTimestamp[] = Array.from({ length: DEMO_DAYS }, (_, day) => wat(at(day, 0)));
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
  const intervalEnergy: IntervalEnergy[] = [];
  const telemetry: TelemetryPoint[] = [];
  const recordedKwh = new Map<string, number>();
  const technicalLossKwh = new Map<string, number>();

  /** Hourly readings of a boundary meter. */
  const pushHourly = (meterId: string, kwh: ArrayLike<number>, estimated?: (h: number) => boolean) => {
    for (let h = 0; h < DEMO_HOURS; h++) {
      const isEstimated = estimated?.(h) ?? false;
      intervalEnergy.push({
        meterId,
        intervalStart: HOUR_STARTS[h],
        intervalMinutes: 60,
        importKwh: round(kwh[h], 3),
        exportKwh: 0,
        quality: isEstimated ? "estimated" : "measured",
        provenance: isEstimated ? estimatedProvenance : metering,
      });
    }
  };

  /** Daily readings of a customer meter: each the sum of that day's hours. Returns the month's total. */
  const pushDaily = (meterId: string, hourlyKwh: ArrayLike<number>, skipDay?: (day: number) => boolean): number => {
    let month = 0;
    for (let day = 0; day < DEMO_DAYS; day++) {
      let kwh = 0;
      for (let h = day * 24; h < day * 24 + 24; h++) kwh += hourlyKwh[h];
      const reading = round(kwh, 3);
      month += reading;
      if (skipDay?.(day)) continue;
      intervalEnergy.push({
        meterId,
        intervalStart: DAY_STARTS[day],
        intervalMinutes: 24 * 60,
        importKwh: reading,
        exportKwh: 0,
        quality: "measured",
        provenance: metering,
      });
    }
    return round(month, 3);
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
      factors = Array.from({ length: DEMO_DAYS }, () => 0.92 + random() * 0.16);
      dayFactor.set(supplyKey, factors);
    }
    return factors;
  };

  // One customer meter stopped reporting for two days: a gap, not a zero.
  const gapMeter = CONNECTIONS.find((c) => c.supplyKey === "MKT2" && c.metering === "prepaid")?.meterId;
  const inGap = (day: number) => day === 13 || day === 14;

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
      const kw = connection.peakKw * shape[h % 24] * week[WEEKDAY[day]] * days[day] * (0.8 + noise() * 0.4);
      const actual = kw * availability(key, h);
      supplyDemand[h] += kw;
      supplyConsumed[h] += actual;
      recorded[h] = actual * connection.recordedFraction;
    }
    if (connection.meterId !== undefined) {
      recordedKwh.set(connection.customerId, pushDaily(connection.meterId, recorded, connection.meterId === gapMeter ? inGap : undefined));
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
    const incomer = zeros();
    let substationConsumed = 0;

    for (const feeder of FEEDERS.filter((plan) => plan.substationId === substation.id)) {
      const head = zeros();
      const headDemandKva = zeros();
      let feederConsumed = 0;

      for (const dt of TRANSFORMERS.filter((plan) => plan.feederId === feeder.id)) {
        const dtConsumed = consumed.get(dt.key) ?? zeros();
        const dtDemand = demand.get(dt.key) ?? zeros();
        const totalizer = dtConsumed.map((kwh) => kwh / (1 - dt.lvLoss));
        // One transformer's totalizer lost four readings, which the meter data system estimated.
        const estimated = dt.key === "OLD3" ? (h: number) => h >= 9 * 24 + 17 && h < 9 * 24 + 21 : undefined;
        pushHourly(BOUNDARY_METERS.totalizer(dt.id), totalizer, estimated);
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

    for (let h = 0; h < DEMO_HOURS; h++) incomer[h] /= 1 - SUBSTATION_LOSS;
    pushHourly(BOUNDARY_METERS.incomer(substation.id), incomer);
    technicalLossKwh.set(`substation:${substation.id}`, sum(incomer) - substationConsumed);
  }

  return { intervalEnergy, telemetry, heartbeats: buildHeartbeats(scada), recordedKwh, technicalLossKwh };
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
