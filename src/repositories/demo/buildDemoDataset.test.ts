import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Provenance } from "@/domain";
import { buildDemoDataset, createDemoRepositories, demoDataset } from "./index.ts";
import { DEMO_CLOCK, DEMO_HOURS, DEMO_PERIOD, PERIOD_END_MS, PERIOD_START_MS } from "./clock.ts";
import { MAX_VARIATION } from "./load.ts";
import { BOUNDARY_METERS, CONNECTIONS, FEEDERS, SUBSTATIONS, TRANSFORMERS, demandBeforeVariationKva } from "./network.ts";
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
  ...SUBSTATIONS.flatMap((s) => s.incomers.map((_, i) => BOUNDARY_METERS.incomer(s, i + 1))),
  ...FEEDERS.map((f) => BOUNDARY_METERS.feederHead(f.id)),
  ...TRANSFORMERS.map((t) => BOUNDARY_METERS.totalizer(t.id)),
];

describe("demo dataset: synthetic and deterministic", () => {
  it("builds the same records every time", () => {
    const again = buildDemoDataset();
    assert.deepEqual(again.registry, dataset.registry);
    assert.deepEqual(again.outages, dataset.outages);
    assert.deepEqual(again.alarms, dataset.alarms);
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
      ...dataset.alarms,
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
      ...dataset.alarms.flatMap((a) => [a.raisedAt, a.clearedAt, a.acknowledgedAt].flatMap((time) => (time ? [Date.parse(time)] : []))),
    ];
    assert.ok(times.every((ms) => !Number.isNaN(ms) && ms <= clock));
  });
});

describe("demo dataset: structure", () => {
  it("has the designed hierarchy", () => {
    assert.equal(registry.regions.length, 1);
    assert.equal(registry.substations.length, 2);
    assert.equal(registry.powerTransformers.length, 3);
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

  it("gives Hillcrest two incomers, two power transformers and two bus sections, one feeder on each", () => {
    const hillcrest = registry.powerTransformers.filter((pt) => pt.substationId === "SS-HIL");
    assert.deepEqual(hillcrest.map((pt) => [pt.id, pt.busSection]), [["PT-HIL-1", "A"], ["PT-HIL-2", "B"]]);
    const fedFrom = (feederId: string) => registry.feeders.find((f) => f.id === feederId)?.origin.powerTransformerId;
    assert.equal(fedFrom("FD-GOV"), "PT-HIL-1");
    assert.equal(fedFrom("FD-FRM"), "PT-HIL-2");
    const incomers = registry.meters.filter((m) => m.installation.role === "substation_incomer" && m.installation.substationId === "SS-HIL");
    assert.deepEqual(incomers.map((m) => m.id), ["M-SS-HIL-IN-1", "M-SS-HIL-IN-2"]);
    // Each incomer carries its own bus section: more than that section's feeder head, by the transformer's loss.
    assert.ok(sumFor("M-SS-HIL-IN-1") > sumFor(BOUNDARY_METERS.feederHead("FD-GOV")));
    assert.ok(sumFor("M-SS-HIL-IN-2") > sumFor(BOUNDARY_METERS.feederHead("FD-FRM")));
    assert.ok(sumFor("M-SS-HIL-IN-2") < sumFor(BOUNDARY_METERS.feederHead("FD-GOV")));
    // Riverside is unchanged: one incomer, one transformer, no sectioned bus.
    const riverside = registry.powerTransformers.filter((pt) => pt.substationId === "SS-RIV");
    assert.deepEqual(riverside.map((pt) => [pt.id, pt.busSection]), [["PT-RIV-1", undefined]]);
  });

  it("puts the rural 33 kV line's interruptions on Farm Road's bus section only", () => {
    const rural = dataset.outages.filter((outage) => outage.id.endsWith("-FD-FRM-33KV") || outage.id.endsWith("-FD-FRM-TS"));
    // 16 faults on the line itself and 3 outages at the transmission station it comes from.
    assert.equal(rural.length, 19);
    const farm = new Set(TRANSFORMERS.filter((dt) => dt.feederId === "FD-FRM").map((dt) => dt.id));
    for (const outage of rural) {
      assert.equal(outage.exposures.length, farm.size);
      assert.ok(outage.exposures.every((exposure) => "id" in exposure.affected && farm.has(exposure.affected.id)));
    }
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

  describe("alarms recorded by the source systems", () => {
    const byId = new Map(dataset.outages.map((outage) => [outage.id, outage]));

    it("raises one alarm for each unplanned interruption that protection or a monitor would see, at the times of the outage log", () => {
      const tied = dataset.alarms.filter((alarm) => byId.has(alarm.id.replace(/^ALM-/, "OUT-")));
      // 19 losses of the rural 33 kV line, the Riverside line fault, four feeder faults and three transformer or LV faults.
      assert.equal(tied.length, 27);
      for (const alarm of tied) {
        const outage = byId.get(alarm.id.replace(/^ALM-/, "OUT-"))!;
        assert.equal(outage.planned, false, alarm.id);
        assert.notEqual(outage.cause, "load_shedding", alarm.id);
        const starts = outage.exposures.map((exposure) => Date.parse(exposure.interruptedAt as string));
        const ends = outage.exposures.map((exposure) => Date.parse(exposure.restoredAt as string));
        assert.equal(Date.parse(alarm.raisedAt as string), Math.min(...starts), alarm.id);
        assert.equal(Date.parse(alarm.clearedAt as string), Math.max(...ends), alarm.id);
      }
    });

    it("raises none for load shedding or planned work, and no overload alarm", () => {
      const alarmed = new Set(dataset.alarms.map((alarm) => alarm.id.replace(/^ALM-/, "OUT-")));
      for (const outage of dataset.outages) {
        if (outage.cause === "load_shedding" || outage.planned === true) assert.ok(!alarmed.has(outage.id), outage.id);
      }
      // No overload alarm: the source systems do not raise one, so loading above rating is derived only.
      assert.ok(!dataset.alarms.some((alarm) => alarm.kind === "overload" || /overload|rating/i.test(alarm.code)));
    });

    it("raises a communications failure for a remote unit that misses two polls, in step with the heartbeats", () => {
      const comms = dataset.alarms.filter((alarm) => alarm.kind === "communications_failure");
      assert.deepEqual(comms.map((alarm) => [alarm.id, alarm.code, "id" in alarm.subject ? alarm.subject.id : null, alarm.clearedAt === undefined]), [
        ["ALM-2026-09-12-ED-SS-RIV-COMMS", "RTU-COMMS-FAIL", "ED-SS-RIV", false],
        ["ALM-2026-09-30-ED-DT-OLD-3-COMMS", "RTU-COMMS-FAIL", "ED-DT-OLD-3", true],
      ]);
      // The standing one is raised exactly two hourly polls after the device's last check-in.
      const last = Math.max(...dataset.heartbeats.filter((beat) => beat.device.id === "ED-DT-OLD-3").map((beat) => Date.parse(beat.receivedAt)));
      assert.equal(Date.parse(comms[1].raisedAt as string) - last, 2 * 60 * 60 * 1000);
      // Every other device checked in to the end, and has no standing communications alarm.
      const lastOf = new Map<string, number>();
      for (const beat of dataset.heartbeats) lastOf.set(beat.device.id, Math.max(lastOf.get(beat.device.id) ?? 0, Date.parse(beat.receivedAt)));
      assert.deepEqual([...lastOf].filter(([, ms]) => ms < Date.parse(dataset.heartbeats[0].receivedAt) + 23 * 60 * 60 * 1000).map(([id]) => id), ["ED-DT-OLD-3"]);
      // The link that dropped and came back did so between two hourly readings: no telemetry reading is missing for it.
      const [raised, cleared] = [Date.parse(comms[0].raisedAt as string), Date.parse(comms[0].clearedAt as string)];
      assert.ok(!dataset.telemetry.some((point) => point.deviceId === "ED-SS-RIV" && Date.parse(point.observedAt) >= raised && Date.parse(point.observedAt) <= cleared));
      assert.equal(new Date(raised).getUTCHours(), new Date(cleared).getUTCHours());
    });

    it("maps each source code it knows to a kind, and leaves the rest without one", () => {
      const kinds = new Map<string, Set<string | undefined>>();
      for (const alarm of dataset.alarms) kinds.set(alarm.code, (kinds.get(alarm.code) ?? new Set()).add(alarm.kind));
      assert.deepEqual(
        [...kinds].map(([code, set]) => [code, [...set]]).sort(),
        [
          ["DC-SUPPLY-LOW", ["equipment"]],
          ["DOOR-OPEN", [undefined]],
          ["DT-LV-LOSS", ["loss_of_supply"]],
          ["FDR-EF-TRIP", ["earth_fault_trip"]],
          ["FDR-OC-TRIP", ["overcurrent_trip"]],
          ["INCOMER-UV", ["loss_of_supply"]],
          ["PT-OIL-TEMP-HIGH", ["equipment"]],
          ["RTU-COMMS-FAIL", ["communications_failure"]],
        ],
      );
    });

    it("names only assets that are in the registry, and holds the three states a list must show", () => {
      const known = new Set([...registry.substations, ...registry.powerTransformers, ...registry.feeders, ...registry.distributionTransformers, ...registry.edgeDevices].map((asset) => asset.id));
      assert.ok(dataset.alarms.every((alarm) => "id" in alarm.subject && known.has(alarm.subject.id)));
      const standing = dataset.alarms.filter((alarm) => alarm.raisedAt !== undefined && alarm.clearedAt === undefined);
      assert.deepEqual(standing.map((alarm) => [alarm.id, alarm.acknowledgedAt !== undefined]), [
        ["ALM-2026-09-26-PT-RIV-1-OIL", true],
        ["ALM-2026-09-30-ED-DT-OLD-3-COMMS", true],
        // The trip of the fault still open at the demo clock.
        ["ALM-2026-09-30-FD-FRM-FAULT", true],
        ["ALM-2026-09-30-SS-HIL-DC", false],
      ]);
      assert.deepEqual(dataset.alarms.filter((alarm) => alarm.raisedAt === undefined).map((alarm) => alarm.id), ["ALM-SS-RIV-DOOR"]);
      assert.equal(dataset.alarms.length, 32);
    });
  });

  describe("power transformer telemetry", () => {
    it("gives each power transformer an hourly apparent power: the demand of the feeders on its bus section", () => {
      const reading = (kind: string, id: string, h: number) =>
        dataset.telemetry.find((point) => point.source.kind === kind && point.source.id === id && point.metric === "apparent_power_kva" && Date.parse(point.observedAt) === PERIOD_START_MS + h * 3_600_000)?.value as number;
      for (const pt of registry.powerTransformers) {
        const points = dataset.telemetry.filter((point) => point.source.kind === "power_transformer" && point.source.id === pt.id);
        assert.equal(points.length, DEMO_HOURS, pt.id);
        assert.ok(points.every((point) => point.metric === "apparent_power_kva" && point.deviceId === `ED-${pt.substationId}`), pt.id);
      }
      // At any hour a transformer carries its feeders' demand, plus the substation's own 1% loss.
      for (const h of [10, 200, 475, 700]) {
        assert.ok(Math.abs(reading("power_transformer", "PT-RIV-1", h) - (reading("feeder", "FD-MKT", h) + reading("feeder", "FD-OLD", h)) / 0.99) < 0.05, `Riverside T1, hour ${h}`);
        assert.ok(Math.abs(reading("power_transformer", "PT-HIL-1", h) - reading("feeder", "FD-GOV", h) / 0.99) < 0.05, `Hillcrest T1, hour ${h}`);
        assert.ok(Math.abs(reading("power_transformer", "PT-HIL-2", h) - reading("feeder", "FD-FRM", h) / 0.99) < 0.05, `Hillcrest T2, hour ${h}`);
      }
    });

    it("loads no power transformer above its rating", () => {
      for (const pt of registry.powerTransformers) {
        const peak = Math.max(...dataset.telemetry.filter((point) => point.source.kind === "power_transformer" && point.source.id === pt.id).map((point) => point.value as number));
        assert.ok(peak > 0 && peak < pt.ratingMva * 1000, `${pt.id}: ${peak.toFixed(0)} kVA on ${pt.ratingMva} MVA`);
      }
    });
  });

  describe("overloaded transformers are a design decision", () => {
    // The highest apparent power each transformer's monitor reported, and when.
    const peak = new Map<string, { kva: number; at: string }>();
    for (const point of dataset.telemetry) {
      if (point.source.kind !== "distribution_transformer" || point.metric !== "apparent_power_kva" || point.value === null) continue;
      if (point.value > (peak.get(point.source.id)?.kva ?? -1)) peak.set(point.source.id, { kva: point.value, at: point.observedAt });
    }
    const loading = (dt: (typeof TRANSFORMERS)[number]) => (peak.get(dt.id)?.kva ?? 0) / dt.ratingKva;

    it("loads exactly two transformers above their rating, each on purpose", () => {
      assert.deepEqual(TRANSFORMERS.filter((dt) => loading(dt) > 1).map((dt) => dt.id), ["DT-OLD-2", "DT-GOV-3"]);
      assert.deepEqual(TRANSFORMERS.filter((dt) => dt.designedOverload !== undefined).map((dt) => dt.id), ["DT-GOV-3"]);
    });

    it("overloads DT-GOV-3 by day, on a working day, from government load", () => {
      const dt = TRANSFORMERS.find((plan) => plan.id === "DT-GOV-3") as (typeof TRANSFORMERS)[number];
      assert.equal(dt.ratingKva, 300);
      assert.match(dt.designedOverload ?? "", /government \(MDA\) accounts/);
      const at = new Date(peak.get("DT-GOV-3")?.at as string);
      const hour = (at.getUTCHours() + 1) % 24;
      const weekday = new Date(at.getTime() + 3_600_000).getUTCDay();
      assert.ok(hour >= 9 && hour <= 16, `peaks at ${hour}:00 WAT`);
      assert.ok(weekday >= 1 && weekday <= 5);
      // Its busiest hour before variation is an office hour too, and government accounts are most of it.
      const before = demandBeforeVariationKva(dt);
      assert.ok(before.hour >= 9 && before.hour <= 16 && before.weekday >= 1 && before.weekday <= 5);
      const connections = CONNECTIONS.filter((c) => c.supplyKey === dt.key);
      const government = connections.filter((c) => c.category === "government");
      assert.equal(government.length, 9);
      const kw = (list: typeof connections) => list.reduce((total, c) => total + c.peakKw, 0);
      assert.ok(kw(government) > kw(connections.filter((c) => c.category !== "government")) * 0.5);
    });

    it("gives every other generated transformer on Government Avenue a rating it cannot exceed, whatever is drawn", () => {
      const sized = TRANSFORMERS.filter((dt) => dt.feederId === "FD-GOV" && dt.designedOverload === undefined);
      assert.equal(sized.length, 11);
      for (const dt of sized) {
        // The bound uses the largest daily factor and hourly noise there can be, not the ones drawn.
        const most = demandBeforeVariationKva(dt).kva * MAX_VARIATION;
        assert.ok(most < dt.ratingKva, `${dt.id}: at most ${most.toFixed(1)} kVA on ${dt.ratingKva} kVA`);
        assert.ok((peak.get(dt.id)?.kva as number) <= most, dt.id);
        assert.ok([50, 100, 200, 300, 500, 750, 1000].includes(dt.ratingKva), dt.id);
      }
      // The rule is not slack: every one of them is loaded past half its rating at its peak.
      assert.ok(sized.every((dt) => loading(dt) > 0.5));
    });

    it("changes no connection: only ratings were raised", () => {
      assert.equal(CONNECTIONS.length, 6448);
      assert.equal(CONNECTIONS.filter((c) => c.feederId === "FD-GOV").length, 1766);
      assert.deepEqual(
        TRANSFORMERS.filter((dt) => dt.feederId === "FD-GOV").map((dt) => dt.ratingKva),
        [500, 300, 300, 300, 750, 200, 500, 300, 500, 300, 100, 300],
      );
    });
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

describe("demo dataset: the status of an outage", () => {
  it("has one outage open at the demo clock, with no restoration time and an alarm still standing", () => {
    const open = dataset.outages.filter((outage) => outage.status === "open");
    assert.deepEqual(open.map((outage) => outage.id), ["OUT-2026-09-30-FD-FRM-FAULT"]);
    const [fault] = open;
    assert.equal(fault.exposures.length, 10);
    for (const exposure of fault.exposures) {
      assert.equal(exposure.interruptedAt, "2026-09-30T23:20:00+01:00");
      assert.equal(exposure.restoredAt, undefined);
    }
    const alarm = dataset.alarms.find((entry) => entry.id === "ALM-2026-09-30-FD-FRM-FAULT");
    assert.deepEqual([alarm?.raisedAt, alarm?.clearedAt, alarm?.code], ["2026-09-30T23:20:00+01:00", undefined, "FDR-EF-TRIP"]);
  });

  it("gives every other designed outage the status closed, and the complaint none", () => {
    const unstated = dataset.outages.filter((outage) => outage.status === undefined);
    assert.deepEqual(unstated.map((outage) => outage.id), ["OUT-2026-09-21-SP-COMPLAINT"]);
    for (const outage of dataset.outages.filter((entry) => entry.status === "closed")) {
      assert.ok(outage.exposures.every((exposure) => exposure.restoredAt !== undefined), outage.id);
    }
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

  it("has complete hourly intervals for every boundary meter", () => {
    for (const meterId of BOUNDARY) assert.equal(COUNT.get(meterId), DEMO_HOURS, meterId);
    assert.ok(dataset.intervalEnergy.every((i) => i.intervalMinutes === 60));
  });

  it("loses energy at every level, never gains it", () => {
    for (const substation of SUBSTATIONS) {
      const heads = FEEDERS.filter((f) => f.substationId === substation.id).reduce((s, f) => s + sumFor(BOUNDARY_METERS.feederHead(f.id)), 0);
      const incomers = substation.incomers.reduce((s, _, i) => s + sumFor(BOUNDARY_METERS.incomer(substation, i + 1)), 0);
      assert.ok(incomers > heads, substation.id);
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

  it("leaves a gap, not zeros, where an AMI meter stopped reporting", () => {
    const boundary = new Set(BOUNDARY);
    const short = [...COUNT.entries()].filter(([meterId, n]) => !boundary.has(meterId) && n !== DEMO_HOURS);
    assert.equal(short.length, 1);
    // Two days of hourly intervals are absent, on a meter of Garden Estate.
    assert.equal(short[0][1], DEMO_HOURS - 48);
    assert.equal(CONNECTIONS.find((c) => c.meterId === short[0][0])?.supplyKey, "MKT2");
  });
});

describe("demo dataset: what each kind of customer meter reports (ADR 0009)", () => {
  const REGISTER = dataset.telemetry.filter((point) => point.metric === "energy_import_register_kwh");
  const readingsOf = new Map<string, typeof REGISTER>();
  for (const point of REGISTER) readingsOf.set(point.source.id, [...(readingsOf.get(point.source.id) ?? []), point]);
  const metered = CONNECTIONS.filter((c) => c.meterId !== undefined);
  const typeOf = new Map(registry.meters.map((m) => [m.id, m.meterType]));
  const maximumDemand = (c: (typeof CONNECTIONS)[number]) => c.category === "government" || c.category === "industrial";

  it("puts an AMI meter on every maximum-demand account and on about 5% of the other metered accounts", () => {
    assert.ok(metered.filter(maximumDemand).every((c) => c.ami));
    const others = metered.filter((c) => !maximumDemand(c));
    const share = others.filter((c) => c.ami).length / others.length;
    assert.ok(share > 0.04 && share < 0.06, `AMI share is ${share}`);
    // Mostly on the two better-run feeders; almost none on Old Town and Farm Road.
    const on = (feederId: string) => others.filter((c) => c.feederId === feederId && c.ami).length;
    assert.ok(on("FD-MKT") > 50 && on("FD-GOV") > 50 && on("FD-OLD") < 15 && on("FD-FRM") < 15);
    assert.ok(CONNECTIONS.filter((c) => c.metering === "unmetered").every((c) => !c.ami));
  });

  it("says truthfully what kind of meter each is", () => {
    for (const c of metered) assert.equal(typeOf.get(c.meterId as string), c.ami ? "smart" : "conventional", c.meterId);
    for (const meterId of BOUNDARY) assert.equal(typeOf.get(meterId), "smart");
  });

  it("holds interval energy for AMI meters and for no other customer meter", () => {
    for (const c of metered) {
      if (c.ami) assert.ok((COUNT.get(c.meterId as string) ?? 0) >= DEMO_HOURS - 48, c.meterId);
      else assert.equal(COUNT.get(c.meterId as string), undefined, c.meterId);
    }
  });

  it("holds nothing from an ordinary prepaid meter but its vends", () => {
    const prepaid = metered.filter((c) => c.metering === "prepaid" && !c.ami);
    assert.ok(prepaid.length > 2000);
    assert.ok(prepaid.every((c) => !readingsOf.has(c.meterId as string) && !COUNT.has(c.meterId as string)));
    const vended = new Set(dataset.billingRecords.filter((b) => b.basis === "prepaid_vend").map((b) => b.customerId));
    assert.ok(prepaid.filter((c) => !c.disconnected).every((c) => vended.has(c.customerId)));
  });

  it("holds two register readings for a postpaid meter that is not AMI, and for no other meter", () => {
    const byHand = new Set(metered.filter((c) => c.metering === "postpaid" && !c.ami && !c.disconnected).map((c) => c.meterId as string));
    assert.ok(byHand.size > 1000);
    assert.deepEqual(new Set(readingsOf.keys()), byHand);
    for (const [meterId, readings] of readingsOf) {
      assert.equal(readings.length, 2, meterId);
      const [opening, closing] = readings;
      assert.equal(opening.quality, "measured");
      assert.ok((closing.value as number) >= (opening.value as number), meterId);
    }
  });

  it("spreads each reading round over several days per route, in working hours, a reading cycle apart", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const end = Date.parse(DEMO_PERIOD.end);
    const routeOf = new Map(metered.map((c) => [c.meterId as string, c.supplyKey]));
    const closingDays = new Map<string, Set<string>>();
    const cycles = new Map<string, Set<number>>();
    for (const [meterId, [opening, closing]] of readingsOf) {
      // A reader works from 08:00 to 16:00, West Africa Time, and every round ends on 30 September.
      for (const point of [opening, closing]) {
        const hour = Number(point.observedAt.slice(11, 13));
        assert.ok(hour >= 8 && hour <= 16 && point.observedAt.endsWith(":00:00+01:00"), `${meterId} ${point.observedAt}`);
      }
      assert.ok(Date.parse(closing.observedAt) < end && Date.parse(closing.observedAt) >= end - 4 * DAY, meterId);
      const route = routeOf.get(meterId) as string;
      closingDays.set(route, (closingDays.get(route) ?? new Set()).add(closing.observedAt.slice(0, 10)));
      cycles.set(route, (cycles.get(route) ?? new Set()).add((Date.parse(closing.observedAt) - Date.parse(opening.observedAt)) / DAY));
    }
    // The same meter is read at the same place in the round each month: 30 days apart. Old Town's largest
    // route began its August round a day late, so its readings are 29 days apart.
    for (const [route, days] of cycles) assert.deepEqual([...days], [route === "OLD6" ? 29 : 30], route);
    // Three long routes take four days and begin on 27 September; every other takes two or three, from 28 or 29 September.
    const long = [...closingDays].filter(([, days]) => days.has("2026-09-27")).map(([route]) => route).sort();
    assert.deepEqual(long, ["FRM4", "FRM7", "OLD6"]);
    for (const [route, days] of closingDays) {
      // A route with more meters than days is read on more than one day.
      const meters = [...readingsOf.keys()].filter((meterId) => routeOf.get(meterId) === route).length;
      if (meters >= 10) assert.ok(days.size >= 2, `${route} was read on ${days.size} day(s)`);
      assert.ok(days.size <= (long.includes(route) ? 4 : 3), route);
    }
  });

  it("puts a few readings outside the 3-day reading window, on both grounds", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const [start, end] = [Date.parse(DEMO_PERIOD.start), Date.parse(DEMO_PERIOD.end)];
    const routeOf = new Map(metered.map((c) => [c.meterId as string, c.supplyKey]));
    const outside = { opening: new Map<string, number>(), closingOnly: new Map<string, number>() };
    for (const [meterId, [opening, closing]] of readingsOf) {
      const route = routeOf.get(meterId) as string;
      const openingOut = Math.abs(Date.parse(opening.observedAt) - start) > 3 * DAY;
      const closingOut = Math.abs(Date.parse(closing.observedAt) - end) > 3 * DAY;
      if (openingOut) outside.opening.set(route, (outside.opening.get(route) ?? 0) + 1);
      else if (closingOut) outside.closingOnly.set(route, (outside.closingOnly.get(route) ?? 0) + 1);
    }
    // Farm Road's two long rural routes: the first day was read on 28 August and 27 September, both outside.
    assert.deepEqual([...outside.opening.keys()].sort(), ["FRM4", "FRM7"]);
    // Old Town's largest route: its first day was read on 29 August (inside) and 27 September (outside).
    assert.deepEqual([...outside.closingOnly.keys()], ["OLD6"]);
    const count = (map: Map<string, number>) => [...map.values()].reduce((total, n) => total + n, 0);
    assert.deepEqual([count(outside.opening), count(outside.closingOnly)], [8, 16]);
    // A few, not many: under 2% of the meters read by hand.
    assert.ok((count(outside.opening) + count(outside.closingOnly)) / readingsOf.size < 0.02);
  });

  it("estimates some register readings where the round missed the meter, and says how", () => {
    const estimated = REGISTER.filter((point) => point.quality === "estimated");
    const share = estimated.length / readingsOf.size;
    assert.ok(share > 0.05 && share < 0.2, `estimated share is ${share}`);
    assert.ok(estimated.every((point) => /not read/.test(point.provenance.method ?? "")));
    assert.ok(REGISTER.every((point) => point.quality === "measured" || point.quality === "estimated"));
  });

  it("bills a register-read account on the advance of its register, as an estimate when the reading was one", () => {
    const bills = new Map(dataset.billingRecords.filter((b) => b.basis !== "prepaid_vend").map((b) => [b.customerId, b]));
    let estimated = 0;
    for (const c of metered) {
      const readings = readingsOf.get(c.meterId as string);
      if (readings === undefined) continue;
      const bill = bills.get(c.customerId);
      assert.ok(bill, c.customerId);
      const advance = (readings[1].value as number) - (readings[0].value as number);
      assert.ok(Math.abs((bill.energyKwh as number) - advance) < 1e-6, c.customerId);
      // The bill covers the time between the two readings: a reading cycle, which is not the calendar month.
      assert.deepEqual(bill.consumptionPeriod, { start: readings[0].observedAt, end: readings[1].observedAt });
      const wasEstimated = readings[1].quality === "estimated";
      assert.equal(bill.basis, wasEstimated ? "estimated" : "meter_reading", c.customerId);
      if (wasEstimated) {
        estimated += 1;
        assert.match(bill.provenance.method ?? "", /estimated reading/);
      }
    }
    assert.ok(estimated > 50);
  });

  it("keeps one transformer on which every meter is AMI, so its downstream boundary is complete", () => {
    const hilltop = CONNECTIONS.filter((c) => c.supplyKey === "MKT3");
    assert.equal(hilltop.length, 30);
    assert.ok(hilltop.every((c) => c.ami));
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
      else if (connection.metering === "unmetered") assert.deepEqual(bases, ["estimated"]);
      // A metered postpaid account has one bill: on a reading, or on an estimate where the meter was not read.
      else assert.ok(bases.length === 1 && (bases[0] === "meter_reading" || (bases[0] === "estimated" && !connection.ami)), connection.customerId);
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
    // Two different reasons for an estimate, and each bill says which is its own.
    const unmetered = new Set(CONNECTIONS.filter((c) => c.metering === "unmetered").map((c) => c.customerId));
    for (const record of estimated) {
      assert.match(record.provenance.method ?? "", unmetered.has(record.customerId) ? /fixed monthly energy/ : /meter was not read/);
    }
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
