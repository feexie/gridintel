import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CLOCK, DEMO_PERIOD } from "../clock.ts";
import { SITES, connectionsOfSite } from "./design.ts";
import { MINIGRID_DATA_SOURCES, createMinigridDemoRepositories, minigridDataset } from "./index.ts";
import { buildMinigridRegistry } from "./registry.ts";
import { simulateSite } from "./simulate.ts";

/* The synthetic mini-grid dataset: what it holds, that it is the same on every build, that its
   records agree with one another, and that nothing in it can pass for real data. */

const dataset = minigridDataset();
const registry = buildMinigridRegistry();
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const energyOf = (meterId: string, channel: "importKwh" | "exportKwh" = "importKwh") => sum(dataset.intervalEnergy.filter((record) => record.meterId === meterId).map((record) => record[channel] as number));

describe("the synthetic mini-grid dataset", () => {
  it("holds four invented sites of one invented operator, and no distribution network", () => {
    assert.deepEqual(registry.sites.map((site) => [site.id, site.name]), [
      ["MG-TAM", "Tamarind Cross"],
      ["MG-DRY", "Dry River"],
      ["MG-PLM", "Palm Landing"],
      ["MG-GRN", "Granite Hill"],
    ]);
    assert.deepEqual(registry.organizations.map((organization) => [organization.name, organization.kind]), [["Demonstration Mini-grid Operator (synthetic)", "minigrid_operator"]]);
    assert.ok(registry.sites.every((site) => site.gridConnection === "isolated"));
    assert.equal(dataset.registry.substations.length + dataset.registry.feeders.length + dataset.registry.distributionTransformers.length, 0);
    assert.equal(dataset.registryCoverage.substations, "not_available");
  });

  it("gives each site a PV array, a battery, two inverters and its meters; Granite Hill has no generator", () => {
    const kinds = (siteId: string) => registry.generationAssets.filter((asset) => asset.siteId === siteId).map((asset) => asset.kind).sort();
    assert.deepEqual(kinds("MG-TAM"), ["battery", "generator", "inverter", "inverter", "solar_pv"]);
    assert.deepEqual(kinds("MG-GRN"), ["battery", "inverter", "inverter", "solar_pv"]);
    const capacity = registry.generationAssets.flatMap((asset) => (asset.kind === "solar_pv" ? [[asset.siteId, asset.capacityKwp]] : []));
    assert.deepEqual(capacity, [["MG-TAM", 100], ["MG-DRY", 45], ["MG-PLM", 80], ["MG-GRN", 60]]);
    for (const site of SITES) {
      const roles = registry.meters.filter((meter) => "siteId" in meter.installation && meter.installation.siteId === site.id).map((meter) => meter.installation.role).sort();
      assert.deepEqual(roles, site.generator === null ? ["generation", "site_output", "storage"] : ["generation", "generation", "site_output", "storage"], site.id);
    }
  });

  it("gives every connection a site, a smart meter and an account with a tier and a productive-use flag, and no name", () => {
    assert.deepEqual(SITES.map((site) => connectionsOfSite(site).length), [465, 300, 417, 130]);
    assert.equal(registry.servicePoints.length, 1312);
    assert.ok(registry.servicePoints.every((sp) => sp.supply.kind === "site"));
    assert.equal(registry.meters.filter((meter) => meter.installation.role === "service_point").length, 1312);
    assert.ok(registry.customers.every((customer) => customer.name === undefined && customer.tariffTier !== undefined && customer.productiveUse !== undefined));
    assert.equal(registry.customers.filter((customer) => customer.accountStatus === "disconnected").length, 24);
    assert.equal(registry.customers.filter((customer) => customer.productiveUse).length, 32);
  });

  it("names a synthetic source on every record, and its sources are all synthetic", () => {
    const sources = new Set(MINIGRID_DATA_SOURCES.map((source) => source.id));
    assert.ok(MINIGRID_DATA_SOURCES.every((source) => source.kind === "synthetic"));
    const records = [...registry.sites, ...registry.generationAssets, ...registry.meters, ...registry.customers, ...dataset.intervalEnergy, ...dataset.telemetry, ...dataset.outages, ...dataset.billingRecords, ...dataset.payments, ...dataset.reportedKpis];
    assert.ok(records.every((record) => sources.has(record.provenance.sourceSystem)));
    assert.ok(dataset.reportedKpis.every((kpi) => kpi.source.kind === "gridintel_synthetic" && kpi.document?.title.includes("(synthetic)")));
    assert.ok(registry.sites.every((site) => site.provenance.method?.includes("Invented location")));
  });

  it("is the same on every build", () => {
    const again = simulateSite(SITES[1]);
    assert.deepEqual(again.intervalEnergy.slice(0, 2000), dataset.intervalEnergy.filter((record) => record.meterId.includes("DRY")).slice(0, 2000));
    assert.deepEqual(again.outages, dataset.outages.filter((outage) => outage.id.startsWith("OUT-MG-DRY")));
  });

  it("holds nothing later than the demo clock, and whole months of hourly and daily records", () => {
    const clock = Date.parse(DEMO_CLOCK);
    assert.ok(dataset.telemetry.every((point) => Date.parse(point.observedAt) <= clock));
    assert.ok(dataset.billingRecords.every((record) => Date.parse(record.billedAt) < clock && Date.parse(record.billedAt) >= Date.parse(DEMO_PERIOD.start)));
    assert.equal(dataset.intervalEnergy.filter((record) => record.meterId === "M-MG-TAM-OUT").length, 720);
    assert.equal(dataset.intervalEnergy.filter((record) => record.meterId === "M-TAM-001").length, 30);
  });
});

describe("the simulated month agrees with itself", () => {
  it("balances at each powerhouse: what was generated and discharged went to charging, the network and the powerhouse", () => {
    for (const site of SITES) {
      const generated = energyOf(`M-${site.id}-PV1`) + (site.generator === null ? 0 : energyOf(`M-${site.id}-GEN1`));
      const station = generated + energyOf(`M-${site.id}-BAT1`, "exportKwh") - energyOf(`M-${site.id}-BAT1`) - energyOf(`M-${site.id}-OUT`);
      // The powerhouse's own draw for the hours it was lit, and nothing else.
      assert.ok(station > 0 && station <= site.stationKw * 720 + 0.5, `${site.id}: ${station}`);
    }
  });

  it("loses the designed share between the powerhouse and the customer meters", () => {
    for (const site of SITES.filter((one) => one.meterGaps === undefined)) {
      const delivered = sum(connectionsOfSite(site).map((connection) => energyOf(connection.meterId)));
      const sentOut = energyOf(`M-${site.id}-OUT`);
      assert.ok(Math.abs((sentOut - delivered) / sentOut - site.distributionLoss) < 0.002, site.id);
    }
  });

  it("keeps the battery between its floor and full, and never runs a generator that is out of service", () => {
    const soc = dataset.telemetry.filter((point) => point.metric === "state_of_charge_pct");
    assert.equal(soc.length, 4 * 721);
    assert.ok(soc.every((point) => (point.value as number) >= 14.9 && (point.value as number) <= 100));
    const dry = dataset.intervalEnergy.filter((record) => record.meterId === "M-MG-DRY-GEN1");
    assert.equal(sum(dry.slice(17 * 24, 19 * 24).map((record) => record.importKwh as number)), 0);
    assert.ok(sum(dry.slice(16 * 24, 17 * 24).map((record) => record.importKwh as number)) > 0);
  });

  it("records no consumption at a customer meter in an hour its site was disconnected", () => {
    // Dry River, 6 September: the powerhouse fault from 14:00 to 17:00 takes three working hours out of the day.
    const day = (meterId: string, d: number) => dataset.intervalEnergy.filter((record) => record.meterId === meterId)[d].importKwh as number;
    const output = dataset.intervalEnergy.filter((record) => record.meterId === "M-MG-DRY-OUT");
    assert.deepEqual(output.slice(5 * 24 + 14, 5 * 24 + 17).map((record) => record.importKwh), [0, 0, 0]);
    assert.ok(output[5 * 24 + 13].importKwh as number > 0);
    assert.ok(day("M-DRY-290", 5) > 0);
  });

  it("marks the curtailment series as an estimate with its method, and the rest as measured", () => {
    const curtailed = dataset.telemetry.filter((point) => point.metric === "curtailed_power_kw");
    assert.ok(curtailed.every((point) => point.quality === "estimated" && point.provenance.method?.startsWith("Controller estimate")));
    assert.ok(dataset.telemetry.filter((point) => point.metric !== "curtailed_power_kw").every((point) => point.quality === "measured"));
  });

  it("leaves a gap, not a zero, at six Dry River meters for four days", () => {
    const short = SITES[1];
    const counts = connectionsOfSite(short).map((connection) => dataset.intervalEnergy.filter((record) => record.meterId === connection.meterId).length);
    assert.equal(counts.filter((count) => count === 26).length, 6);
    assert.equal(counts.filter((count) => count === 30).length, 294);
  });

  it("logs each interruption once, for the site, with whole hours and a customer count", () => {
    assert.deepEqual(SITES.map((site) => dataset.outages.filter((outage) => outage.id.startsWith(`OUT-${site.id}`)).length), [2, 7, 2, 1]);
    for (const outage of dataset.outages) {
      const [exposure] = outage.exposures;
      assert.ok("id" in exposure.affected && exposure.affected.kind === "site");
      assert.equal(outage.status, "closed");
      assert.ok(exposure.customersAffected !== null && exposure.customersAffected > 0);
      assert.equal((Date.parse(exposure.restoredAt as string) - Date.parse(exposure.interruptedAt as string)) % 3_600_000, 0);
    }
  });
});

describe("mini-grid charges and payments", () => {
  it("pays every vend as it is raised, and bills only public institutions and Palm Landing's productive-use accounts after the month", () => {
    const vends = dataset.billingRecords.filter((record) => record.basis === "prepaid_vend");
    const paid = new Map(dataset.payments.map((payment) => [payment.billingRecordId, payment.amount.amountMinor]));
    assert.ok(vends.length > 4000 && vends.every((vend) => paid.get(vend.id) === vend.amount.amountMinor));
    const bills = dataset.billingRecords.filter((record) => record.basis !== "prepaid_vend");
    // The public institutions of the four sites, and Palm Landing's eight mills and workshops on credit.
    assert.equal(bills.length, 6 + 3 + 5 + 2 + 8);
    // No household and no shop is sold to on credit: a prepaid account cannot owe.
    const postpaid = registry.customers.filter((customer) => customer.paymentMode === "postpaid");
    assert.ok(postpaid.every((customer) => customer.category === "public" || customer.productiveUse === true));
    assert.equal(postpaid.length, 24);
    assert.ok(bills.every((bill) => bill.consumptionPeriod === DEMO_PERIOD && bill.tariffCode !== undefined));
  });

  it("charges no disconnected account", () => {
    const disconnected = new Set(registry.customers.filter((customer) => customer.accountStatus === "disconnected").map((customer) => customer.id));
    assert.ok(dataset.billingRecords.every((record) => !disconnected.has(record.customerId)));
  });
});

describe("the mini-grid repositories", () => {
  it("answer the site register without simulating the month, and say the network registry is not held", async () => {
    const repos = createMinigridDemoRepositories();
    const sites = await repos.sites.getSnapshot({ asOf: DEMO_CLOCK });
    assert.equal(sites.snapshot.sites.length, 4);
    assert.equal(sites.coverage.sites, "complete");
    assert.equal((await repos.registry.getSnapshot({ asOf: DEMO_CLOCK })).coverage.feeders, "not_available");
    assert.equal((await repos.sources.listDataSources()).length, 5);
    assert.equal((await repos.events.listAlarms({ period: DEMO_PERIOD })).completeness, "not_available");
    assert.equal((await repos.events.listOutages({ period: DEMO_PERIOD })).records.length, 12);
  });
});
