import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Provenance } from "@/domain";
import { buildDemoDataset, createDemoRepositories, demoDataset } from "./index.ts";
import { DEMO_CLOCK, DEMO_DAYS, DEMO_HOURS, DEMO_PERIOD, PERIOD_END_MS, PERIOD_START_MS } from "./clock.ts";
import { BOUNDARY_METERS, CONNECTIONS, FEEDERS, SUBSTATIONS, TRANSFORMERS } from "./network.ts";
import { SUPPLY_OFF } from "./outages.ts";

const dataset = demoDataset();
const { registry } = dataset;

const TOTAL = new Map<string, number>();
const COUNT = new Map<string, number>();
for (const interval of dataset.intervalEnergy) {
  TOTAL.set(interval.meterId, (TOTAL.get(interval.meterId) ?? 0) + (interval.importKwh ?? 0));
  COUNT.set(interval.meterId, (COUNT.get(interval.meterId) ?? 0) + 1);
}
const sumFor = (meterId: string) => TOTAL.get(meterId) ?? 0;
const BOUNDARY = [
  ...SUBSTATIONS.map((s) => BOUNDARY_METERS.incomer(s.id)),
  ...FEEDERS.map((f) => BOUNDARY_METERS.feederHead(f.id)),
  ...TRANSFORMERS.map((t) => BOUNDARY_METERS.totalizer(t.id)),
];

describe("demo dataset: synthetic and deterministic", () => {
  it("builds the same records every time", () => {
    const again = buildDemoDataset();
    assert.deepEqual(again.registry, dataset.registry);
    assert.deepEqual(again.outages, dataset.outages);
    assert.deepEqual(again.billingRecords, dataset.billingRecords);
    assert.deepEqual(again.payments, dataset.payments);
    assert.deepEqual(again.reportedKpis, dataset.reportedKpis);
    assert.equal(again.intervalEnergy.length, dataset.intervalEnergy.length);
    for (const i of [0, 1234, 98765, dataset.intervalEnergy.length - 1]) {
      assert.deepEqual(again.intervalEnergy[i], dataset.intervalEnergy[i]);
    }
    assert.deepEqual(again.telemetry.slice(0, 500), dataset.telemetry.slice(0, 500));
  });

  it("names only synthetic sources, on every record", () => {
    assert.ok(dataset.dataSources.length > 0);
    assert.ok(dataset.dataSources.every((source) => source.kind === "synthetic"));
    const known = new Set(dataset.dataSources.map((source) => source.id));
    const records: { provenance: Provenance }[] = [
      ...Object.values(registry).flat(),
      ...dataset.intervalEnergy,
      ...dataset.telemetry,
      ...dataset.heartbeats,
      ...dataset.outages,
      ...dataset.reportedKpis,
      ...dataset.billingRecords,
      ...dataset.payments,
    ];
    assert.ok(records.every((record) => known.has(record.provenance.sourceSystem)));
    assert.ok(dataset.reportedKpis.every((kpi) => kpi.source.kind === "gridintel_synthetic"));
  });

  it("holds no personal names", () => {
    assert.ok(registry.customers.every((customer) => customer.name === undefined));
  });

  it("holds nothing dated after the demo clock", () => {
    const clock = Date.parse(DEMO_CLOCK);
    const times = [
      ...dataset.intervalEnergy.map((i) => Date.parse(i.intervalStart) + i.intervalMinutes * 60_000),
      ...dataset.telemetry.map((p) => Date.parse(p.observedAt)),
      ...dataset.billingRecords.map((b) => Date.parse(b.billedAt)),
      ...dataset.payments.map((p) => Date.parse(p.receivedAt)),
      ...dataset.outages.flatMap((o) => o.exposures.flatMap((e) => (e.restoredAt ? [Date.parse(e.restoredAt)] : []))),
    ];
    assert.ok(times.every((ms) => !Number.isNaN(ms) && ms <= clock));
  });
});

describe("demo dataset: structure", () => {
  it("has the designed hierarchy", () => {
    assert.equal(registry.regions.length, 1);
    assert.equal(registry.substations.length, 2);
    assert.equal(registry.powerTransformers.length, 2);
    assert.equal(registry.feeders.length, 4);
    assert.equal(registry.distributionTransformers.length, 48);
    assert.equal(registry.servicePoints.length, CONNECTIONS.length);
    assert.equal(registry.customers.length, CONNECTIONS.length);
    assert.ok(CONNECTIONS.length > 6000);
    assert.deepEqual(registry.feeders.map((f) => [f.id, f.origin.substationId, f.serviceBand]), [
      ["FD-MKT", "SS-RIV", "A"],
      ["FD-OLD", "SS-RIV", "C"],
      ["FD-GOV", "SS-HIL", "B"],
      ["FD-FRM", "SS-HIL", "D"],
    ]);
  });

  it("gives every feeder a realistic number of transformers", () => {
    for (const feeder of FEEDERS) {
      const count = TRANSFORMERS.filter((dt) => dt.feederId === feeder.id).length;
      assert.ok(count >= 10 && count <= 14, `${feeder.id} has ${count}`);
    }
  });

  it("keeps the six hand-designed transformers as they were", () => {
    const sized = (key: string) => CONNECTIONS.filter((c) => c.supplyKey === key).length;
    assert.deepEqual(["MKT1", "MKT2", "MKT3", "OLD1", "OLD2", "OLD3"].map(sized), [60, 76, 30, 85, 135, 45]);
  });

  it("puts government accounts on Government Avenue only, as metered maximum-demand accounts", () => {
    const government = CONNECTIONS.filter((c) => c.category === "government");
    assert.ok(government.length > 50);
    assert.ok(government.every((c) => c.feederId === "FD-GOV" && c.metering === "postpaid" && c.demandClass === "md"));
    assert.ok(registry.customers.filter((c) => c.category === "government").every((c) => c.demandClass === "md"));
  });

  it("leaves the demand class of a few rural accounts unrecorded, and of no others", () => {
    const unknown = registry.customers.filter((c) => c.demandClass === undefined);
    assert.ok(unknown.length > 5 && unknown.length < 60);
    const points = new Map(CONNECTIONS.map((c) => [c.customerId, c.feederId]));
    assert.ok(unknown.every((c) => points.get(c.id) === "FD-FRM"));
  });

  it("has no dangling references", () => {
    const substations = new Set(registry.substations.map((s) => s.id));
    const feeders = new Set(registry.feeders.map((f) => f.id));
    const transformers = new Set(registry.distributionTransformers.map((t) => t.id));
    const points = new Set(registry.servicePoints.map((sp) => sp.id));
    const customers = new Set(registry.customers.map((c) => c.id));
    const meters = new Set(registry.meters.map((m) => m.id));

    assert.ok(registry.feeders.every((f) => substations.has(f.origin.substationId)));
    assert.ok(registry.distributionTransformers.every((t) => feeders.has(t.feederId)));
    assert.ok(
      registry.servicePoints.every((sp) =>
        sp.supply.kind === "feeder" ? feeders.has(sp.supply.feederId) : transformers.has(sp.supply.transformerId),
      ),
    );
    assert.ok(registry.customers.every((c) => c.servicePointId !== undefined && points.has(c.servicePointId)));
    assert.ok(dataset.intervalEnergy.every((i) => meters.has(i.meterId)));
    assert.ok(dataset.billingRecords.every((b) => customers.has(b.customerId)));
    assert.ok(dataset.payments.every((p) => customers.has(p.customerId)));
    for (const outage of dataset.outages) {
      for (const exposure of outage.exposures) {
        assert.ok("id" in exposure.affected);
        const { kind, id } = exposure.affected;
        assert.ok(kind === "distribution_transformer" ? transformers.has(id) : points.has(id));
      }
    }
  });

  it("gives every located asset and every service point coordinates, and every feeder a route", () => {
    assert.ok(registry.substations.every((s) => s.location !== undefined));
    assert.ok(registry.distributionTransformers.every((t) => t.location !== undefined));
    assert.ok(registry.servicePoints.every((sp) => sp.location !== undefined));
    assert.ok(registry.feeders.every((f) => (f.route?.length ?? 0) >= 2));
  });

  it("mixes prepaid, postpaid and unmetered connections, with one fully metered transformer", () => {
    const count = (metering: string) => CONNECTIONS.filter((c) => c.metering === metering).length;
    assert.ok(count("prepaid") > 100 && count("postpaid") > 40 && count("unmetered") > 100);
    assert.ok(CONNECTIONS.filter((c) => c.supplyKey === "MKT3").every((c) => c.metering !== "unmetered"));
    // An unmetered connection has a service point and an account, but no meter record.
    const metered = new Set(registry.meters.flatMap((m) => (m.installation.role === "service_point" ? [m.installation.servicePointId] : [])));
    assert.equal(metered.size, CONNECTIONS.filter((c) => c.meterId !== undefined).length);
  });
});

describe("demo dataset: where interruptions began", () => {
  it("records an origin point on every interruption except the complaint, whose origin is not known", () => {
    const without = dataset.outages.filter((outage) => outage.originPoint === undefined);
    assert.deepEqual(without.map((outage) => outage.id), ["OUT-2026-09-21-SP-COMPLAINT"]);
  });

  it("treats 33 kV line faults as the distribution business's own, and only station outages as transmission's", () => {
    const line = dataset.outages.filter((outage) => outage.originPoint === "subtransmission_line");
    const station = dataset.outages.filter((outage) => outage.originPoint === "transmission_station");
    assert.equal(line.length, 17);
    assert.equal(station.length, 3);
    assert.ok(line.every((outage) => outage.cause === "fault" && outage.responsibleParty === "distribution"));
    assert.ok(station.every((outage) => outage.cause === "upstream_supply" && outage.responsibleParty === "transmission"));
    // Neither a 33 kV line nor the transmission station is in the registry, so each is named, not linked.
    assert.ok([...line, ...station].every((outage) => "label" in outage.origin));
    assert.ok(line.some((outage) => outage.id === "OUT-2026-09-18-SS-RIV-33KV"));
  });

  it("records load shedding as beginning on the grid, and nothing else as beginning there", () => {
    const grid = dataset.outages.filter((outage) => outage.originPoint === "grid");
    assert.ok(grid.length > 100);
    assert.ok(grid.every((outage) => outage.cause === "load_shedding"));
    assert.ok(dataset.outages.filter((outage) => outage.cause === "load_shedding").every((outage) => outage.originPoint === "grid"));
  });
});

describe("demo dataset: outages and energy agree", () => {
  it("never has a supply off twice at the same time", () => {
    for (const [key, intervals] of SUPPLY_OFF) {
      for (let i = 1; i < intervals.length; i++) {
        assert.ok(intervals[i][0] >= intervals[i - 1][1], `${key} has overlapping interruptions`);
      }
      assert.ok(intervals.every(([start, end]) => start >= PERIOD_START_MS && end <= PERIOD_END_MS && end > start));
    }
  });

  it("records no energy on a transformer while it is off", () => {
    const totalizer = BOUNDARY_METERS.totalizer("DT-OLD-2");
    // Old Town is shed from midnight for at least four hours every day.
    const overnight = dataset.intervalEnergy.filter((i) => i.meterId === totalizer && i.intervalStart.includes("T02:00:00"));
    assert.equal(overnight.length, 30);
    assert.ok(overnight.every((i) => i.importKwh === 0));
  });

  it("has complete hourly intervals for every boundary meter, and daily ones for customer meters", () => {
    for (const meterId of BOUNDARY) assert.equal(COUNT.get(meterId), DEMO_HOURS, meterId);
    const boundary = new Set(BOUNDARY);
    const customer = dataset.intervalEnergy.filter((i) => !boundary.has(i.meterId));
    assert.ok(customer.length > 100_000);
    assert.ok(customer.every((i) => i.intervalMinutes === 1440 && i.intervalStart.endsWith("T00:00:00+01:00")));
    assert.ok(dataset.intervalEnergy.filter((i) => boundary.has(i.meterId)).every((i) => i.intervalMinutes === 60));
  });

  it("loses energy at every level, never gains it", () => {
    for (const substation of SUBSTATIONS) {
      const heads = FEEDERS.filter((f) => f.substationId === substation.id).reduce((s, f) => s + sumFor(BOUNDARY_METERS.feederHead(f.id)), 0);
      assert.ok(sumFor(BOUNDARY_METERS.incomer(substation.id)) > heads, substation.id);
    }
    for (const feeder of FEEDERS) {
      const totalizers = TRANSFORMERS.filter((t) => t.feederId === feeder.id).reduce((s, t) => s + sumFor(BOUNDARY_METERS.totalizer(t.id)), 0);
      assert.ok(sumFor(BOUNDARY_METERS.feederHead(feeder.id)) > totalizers);
    }
    for (const dt of TRANSFORMERS) {
      const recorded = CONNECTIONS.filter((c) => c.supplyKey === dt.key && c.meterId).reduce((s, c) => s + sumFor(c.meterId as string), 0);
      assert.ok(sumFor(BOUNDARY_METERS.totalizer(dt.id)) > recorded, dt.id);
    }
  });

  it("leaves a gap, not zeros, where a meter stopped reporting", () => {
    const boundary = new Set(BOUNDARY);
    const short = [...COUNT.entries()].filter(([meterId, n]) => !boundary.has(meterId) && n !== DEMO_DAYS);
    assert.equal(short.length, 1);
    assert.equal(short[0][1], DEMO_DAYS - 2);
  });
});

describe("demo dataset: billing", () => {
  it("is all in NGN, with whole kobo amounts", () => {
    const amounts = [...dataset.billingRecords, ...dataset.payments].map((record) => record.amount);
    assert.ok(amounts.every((amount) => amount.currency === "NGN" && Number.isInteger(amount.amountMinor) && amount.amountMinor > 0));
  });

  it("charges each kind of account in its own way", () => {
    const byCustomer = new Map<string, string[]>();
    for (const record of dataset.billingRecords) {
      byCustomer.set(record.customerId, [...(byCustomer.get(record.customerId) ?? []), record.basis]);
    }
    for (const connection of CONNECTIONS) {
      const bases = byCustomer.get(connection.customerId) ?? [];
      if (connection.disconnected) assert.deepEqual(bases, []);
      else if (connection.metering === "prepaid") assert.ok(bases.length >= 2 && bases.every((b) => b === "prepaid_vend"));
      else assert.deepEqual(bases, [connection.metering === "unmetered" ? "estimated" : "meter_reading"]);
    }
  });

  it("pays every prepaid vend in full at the moment it is raised", () => {
    const vends = dataset.billingRecords.filter((record) => record.basis === "prepaid_vend");
    const paid = new Map(dataset.payments.flatMap((p) => (p.billingRecordId ? [[p.billingRecordId, p] as const] : [])));
    assert.ok(vends.every((vend) => paid.get(vend.id)?.amount.amountMinor === vend.amount.amountMinor && paid.get(vend.id)?.receivedAt === vend.billedAt));
  });

  it("says how an estimated bill was arrived at", () => {
    const estimated = dataset.billingRecords.filter((record) => record.basis === "estimated");
    assert.ok(estimated.length > 100);
    assert.ok(estimated.every((record) => record.provenance.method !== undefined));
  });
});

describe("demo repositories", () => {
  it("serve billing records and payments by time", async () => {
    const repos = createDemoRepositories();
    const all = await repos.billing.listBillingRecords({ period: DEMO_PERIOD });
    assert.equal(all.completeness, "complete");
    assert.equal(all.records.length, dataset.billingRecords.length);
    const firstDay = { start: DEMO_PERIOD.start, end: "2026-09-02T00:00:00+01:00" };
    const day = await repos.billing.listBillingRecords({ period: firstDay });
    assert.ok(day.records.length > 0 && day.records.length < all.records.length);
    assert.ok(day.records.every((record) => record.basis === "prepaid_vend"));
    const payments = await repos.billing.listPayments({ period: firstDay });
    assert.ok(payments.records.every((p) => Date.parse(p.receivedAt) < Date.parse(firstDay.end)));
  });
});
