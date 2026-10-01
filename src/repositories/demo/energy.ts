import type { DeviceHeartbeat, IntervalEnergy, IsoTimestamp, MetricKey, Provenance, TelemetryPoint } from "@/domain";
import type { CustomerCategory } from "./network.ts";
import { DEMO_HOURS, PERIOD_END_MS, at, hourStart, wat, weekday } from "./clock.ts";
import {
  BOUNDARY_METERS,
  CONNECTIONS,
  DEMO_SUBSTATION_ID,
  FEEDERS,
  MV_CUSTOMER,
  SUBSTATION_LOSS,
  TRANSFORMERS,
} from "./network.ts";
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
};

/** Demand on a day of the week relative to a weekday: [Sunday … Saturday]. */
const WEEK: Record<CustomerCategory, readonly number[]> = {
  residential: [1.06, 1, 1, 1, 1, 1, 1.06],
  commercial: [0.5, 1, 1, 1, 1, 1, 0.85],
  industrial: [0.6, 1, 1, 1, 1, 1, 0.9],
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

function zeros(): number[] {
  return new Array<number>(DEMO_HOURS).fill(0);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
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

  const pushIntervals = (
    meterId: string,
    kwh: readonly number[],
    options: { skip?: (h: number) => boolean; estimated?: (h: number) => boolean } = {},
  ) => {
    for (let h = 0; h < DEMO_HOURS; h++) {
      if (options.skip?.(h)) continue;
      const isEstimated = options.estimated?.(h) ?? false;
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

  /* ---- Connections -------------------------------------------------- */

  // Supply key → what its connections consumed, and would have drawn with supply on, per hour.
  const consumed = new Map<string, number[]>();
  const demand = new Map<string, number[]>();
  const dayFactor = new Map<string, number[]>();
  const dayFactors = (supplyKey: string): number[] => {
    let factors = dayFactor.get(supplyKey);
    if (factors === undefined) {
      const random = seeded(`day:${supplyKey}`);
      factors = Array.from({ length: DEMO_HOURS / 24 }, () => 0.92 + random() * 0.16);
      dayFactor.set(supplyKey, factors);
    }
    return factors;
  };

  // One customer meter stopped reporting for two days: a gap, not a zero.
  const gapMeter = CONNECTIONS.find((c) => c.supplyKey === "MKT2" && c.metering === "prepaid")?.meterId;
  const inGap = (h: number) => h >= 13 * 24 && h < 15 * 24;

  for (const connection of CONNECTIONS) {
    const key = connection.supplyKey;
    const noise = seeded(`load:${connection.customerId}`);
    const days = dayFactors(key);
    const actual = zeros();
    const wanted = zeros();
    for (let h = 0; h < DEMO_HOURS; h++) {
      const day = Math.floor(h / 24);
      const kw =
        connection.peakKw *
        SHAPE[connection.category][h % 24] *
        WEEK[connection.category][weekday(day)] *
        days[day] *
        (0.8 + noise() * 0.4);
      wanted[h] = kw;
      actual[h] = kw * availability(key, h);
    }
    const supplyConsumed = consumed.get(key) ?? zeros();
    const supplyDemand = demand.get(key) ?? zeros();
    for (let h = 0; h < DEMO_HOURS; h++) {
      supplyConsumed[h] += actual[h];
      supplyDemand[h] += wanted[h];
    }
    consumed.set(key, supplyConsumed);
    demand.set(key, supplyDemand);

    if (connection.meterId !== undefined) {
      const recorded = actual.map((kwh) => kwh * connection.recordedFraction);
      recordedKwh.set(connection.customerId, round(sum(recorded.map((kwh) => round(kwh, 3))), 3));
      pushIntervals(connection.meterId, recorded, connection.meterId === gapMeter ? { skip: inGap } : {});
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

  const incomer = zeros();
  let substationConsumed = 0;

  for (const feeder of FEEDERS) {
    const head = zeros();
    const headDemandKva = zeros();
    let feederConsumed = 0;

    for (const dt of TRANSFORMERS.filter((plan) => plan.feederId === feeder.id)) {
      const dtConsumed = consumed.get(dt.key) ?? zeros();
      const dtDemand = demand.get(dt.key) ?? zeros();
      const totalizer = dtConsumed.map((kwh) => kwh / (1 - dt.lvLoss));
      // One transformer's totalizer lost four readings, which the meter data system estimated.
      const estimated = dt.key === "OLD3" ? (h: number) => h >= 9 * 24 + 17 && h < 9 * 24 + 21 : undefined;
      pushIntervals(BOUNDARY_METERS.totalizer(dt.id), totalizer, { estimated });
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
    pushIntervals(BOUNDARY_METERS.feederHead(feeder.id), head);
    technicalLossKwh.set(`feeder:${feeder.id}`, sum(head) - feederConsumed);
    substationConsumed += feederConsumed;

    const source = { kind: "feeder" as const, id: feeder.id };
    for (let h = 0; h < DEMO_HOURS; h++) {
      incomer[h] += head[h];
      const kva = headDemandKva[h] / (1 - feeder.mvLoss);
      const amps = kva / (Math.sqrt(3) * 11);
      telemetryPoint(source, "apparent_power_kva", h, kva, "total", "ED-SS-RIV");
      telemetryPoint(source, "current_a", h, amps * 1.03, "A", "ED-SS-RIV");
      telemetryPoint(source, "current_a", h, amps * 0.99, "B", "ED-SS-RIV");
      telemetryPoint(source, "current_a", h, amps * 0.98, "C", "ED-SS-RIV");
    }
  }

  for (let h = 0; h < DEMO_HOURS; h++) incomer[h] /= 1 - SUBSTATION_LOSS;
  pushIntervals(BOUNDARY_METERS.incomer, incomer);
  technicalLossKwh.set(`substation:${DEMO_SUBSTATION_ID}`, sum(incomer) - substationConsumed);

  return { intervalEnergy, telemetry, heartbeats: buildHeartbeats(scada), recordedKwh, technicalLossKwh };
}

/** Hourly check-ins over the last day. One transformer monitor went quiet nine hours before the demo clock. */
function buildHeartbeats(provenance: Provenance): DeviceHeartbeat[] {
  const heartbeats: DeviceHeartbeat[] = [];
  const devices = ["ED-SS-RIV", ...TRANSFORMERS.map((dt) => `ED-${dt.id}`)];
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
