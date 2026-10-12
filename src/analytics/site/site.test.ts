import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BillingRecord, Customer, GenerationAsset, IntervalEnergy, Meter, MinigridSite, Outage, Payment, Period, Provenance, ServicePoint, TelemetryPoint } from "@/domain";
import type { SiteRegistry } from "./registry.ts";
import { computeSiteAvailability } from "./availability.ts";
import { computeSiteCommercial } from "./commercial.ts";
import { computeSiteTechnical } from "./energy.ts";
import { comparableSiteKpis, computeSitePerformance } from "./performance.ts";
import { knownQuantity, missingQuantity } from "./quantity.ts";
import { buildSiteIndex } from "./registry.ts";

/* One invented site over one day, with round numbers, so that every figure can be checked by hand.

   Each hour of the day:  PV 5 kWh for 12 hours (60), generator 2 kWh for 5 hours (10)
   Battery: 20 kWh in over the day, 16 kWh out. Site output: 48 kWh. Two customers: 30 + 14 kWh. */

const AT = "2026-01-01T00:00:00Z";
const PERIOD: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };
const provenance: Provenance = { sourceSystem: "test", ingestedAt: AT };
const AUDIT = { createdAt: AT, updatedAt: AT };
const hour = (h: number) => new Date(Date.parse(PERIOD.start) + h * 3_600_000).toISOString().replace(".000Z", "Z");

const site: MinigridSite = { ...AUDIT, id: "S1", name: "Test site", operatorOrganizationId: "ORG", gridConnection: "isolated", lifecycle: "in_service", provenance };
const asset = { ...AUDIT, siteId: "S1", lifecycle: "in_service" as const, provenance };
const PV: GenerationAsset = { ...asset, id: "PV", kind: "solar_pv", name: "PV", capacityKwp: 10 };
const BATTERY: GenerationAsset = { ...asset, id: "BAT", kind: "battery", name: "Battery", energyCapacityKwh: 40, powerKw: 10 };
const GENERATOR: GenerationAsset = { ...asset, id: "GEN", kind: "generator", name: "Generator", ratingKva: 10, ratedPowerKw: 8, fuel: "diesel" };
const meter = (id: string, installation: Meter["installation"]): Meter => ({ ...AUDIT, id, serialNumber: id, meterType: "smart", installation, lifecycle: "in_service", provenance });
const point = (id: string): ServicePoint => ({ ...AUDIT, id, supply: { kind: "site", siteId: "S1" }, lifecycle: "in_service", provenance });
const customer = (id: string, servicePointId: string, more: Partial<Customer> = {}): Customer => ({ ...AUDIT, id, operatorOrganizationId: "ORG", servicePointId, accountStatus: "active", productiveUse: false, tariffTier: "T1", provenance, ...more });

function registry(change: Partial<SiteRegistry> = {}): SiteRegistry {
  return {
    sites: [site],
    generationAssets: [PV, BATTERY, GENERATOR],
    servicePoints: [point("SP1"), point("SP2")],
    meters: [
      meter("M-PV", { role: "generation", siteId: "S1", assetId: "PV" }),
      meter("M-GEN", { role: "generation", siteId: "S1", assetId: "GEN" }),
      meter("M-BAT", { role: "storage", siteId: "S1", assetId: "BAT" }),
      meter("M-OUT", { role: "site_output", siteId: "S1" }),
      meter("M-C1", { role: "service_point", servicePointId: "SP1" }),
      meter("M-C2", { role: "service_point", servicePointId: "SP2" }),
    ],
    customers: [customer("C1", "SP1", { productiveUse: true, tariffTier: "T2" }), customer("C2", "SP2")],
    ...change,
  };
}

const interval = (meterId: string, h: number, importKwh: number, exportKwh = 0, minutes = 60): IntervalEnergy => ({ meterId, intervalStart: hour(h), intervalMinutes: minutes, importKwh, exportKwh, quality: "measured", provenance });

function intervals(): IntervalEnergy[] {
  const records: IntervalEnergy[] = [];
  for (let h = 0; h < 24; h++) {
    records.push(interval("M-PV", h, h >= 6 && h < 18 ? 5 : 0));
    records.push(interval("M-GEN", h, h >= 18 && h < 23 ? 2 : 0));
    records.push(interval("M-BAT", h, h >= 8 && h < 12 ? 5 : 0, h >= 19 && h < 23 ? 4 : 0));
    records.push(interval("M-OUT", h, 2));
  }
  // Customer meters report once a day.
  records.push(interval("M-C1", 0, 30, 0, 1440), interval("M-C2", 0, 14, 0, 1440));
  return records;
}

const reading = (kind: "site" | "generation_asset", id: string, metric: TelemetryPoint["metric"], h: number, value: number | null, quality: TelemetryPoint["quality"] = "measured"): TelemetryPoint => ({
  source: { kind, id },
  metric,
  observedAt: hour(h),
  value,
  quality,
  provenance,
});

function telemetry(): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  // 500 W/m² as the mean of each of 12 daylight hours: 6 kWh/m². The controller estimates 1 kW curtailed in 4 of them.
  for (let h = 1; h <= 24; h++) {
    points.push(reading("site", "S1", "irradiance_poa_w_m2", h, h > 6 && h <= 18 ? 500 : 0));
    points.push(reading("generation_asset", "PV", "curtailed_power_kw", h, h > 12 && h <= 16 ? 1 : 0, "estimated"));
  }
  // State of charge from 50% to 55% of a 40 kWh nameplate: 2 kWh more stored.
  points.push(reading("generation_asset", "BAT", "state_of_charge_pct", 0, 50), reading("generation_asset", "BAT", "state_of_charge_pct", 12, 90), reading("generation_asset", "BAT", "state_of_charge_pct", 24, 55));
  points.push(reading("generation_asset", "GEN", "run_hours_register_h", 0, 1000), reading("generation_asset", "GEN", "run_hours_register_h", 24, 1005));
  points.push(reading("generation_asset", "GEN", "fuel_used_register_l", 0, 500), reading("generation_asset", "GEN", "fuel_used_register_l", 24, 504));
  return points;
}

function technical(change: { registry?: Partial<SiteRegistry>; intervals?: IntervalEnergy[]; telemetry?: TelemetryPoint[]; assetsComplete?: boolean } = {}) {
  return computeSiteTechnical({
    index: buildSiteIndex(registry(change.registry)),
    siteId: "S1",
    period: PERIOD,
    intervals: change.intervals ?? intervals(),
    telemetry: change.telemetry ?? telemetry(),
    assetsComplete: change.assetsComplete ?? true,
    computedAt: AT,
  });
}

const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

describe("site energy balance", () => {
  const { energy } = technical();

  it("starts from the site's own generation: PV plus generator, each metered", () => {
    assert.deepEqual([energy.pvGeneration.value, energy.generatorGeneration.value, energy.energyGenerated.value], [60, 10, 70]);
    assert.equal(energy.energyGenerated.status, "ok");
    assert.deepEqual(energy.energyGenerated.scope, { kind: "site", id: "S1" });
    assert.equal(energy.energyGenerated.methodology.id, "gridintel.site.reference");
  });

  it("gives the renewable fraction and the generator's share of energy generated, and says what they are a share of", () => {
    close(energy.renewableFraction.value, 60 / 70);
    close(energy.generatorShare.value, 10 / 70);
    assert.deepEqual(energy.renewableFraction.basis, { shareOf: "energy_generated" });
  });

  it("meters energy sent out, and leaves station use as a residual that says it is one", () => {
    assert.deepEqual([energy.storageCharge.value, energy.storageDischarge.value, energy.storageNetIntake.value, energy.energySentOut.value], [20, 16, 4, 48]);
    // 70 generated − 4 net into storage − 48 sent out.
    assert.equal(energy.stationUse.value, 18);
    assert.equal(energy.stationUse.derivation?.kind, "residual");
  });

  it("gives distribution loss as sent out less delivered, as energy and as a share of energy sent out", () => {
    assert.equal(energy.energyDelivered.value, 44);
    assert.equal(energy.distributionLossKwh.value, 4);
    close(energy.distributionLoss.value, 4 / 48);
    assert.deepEqual(energy.distributionLoss.basis, { lossBasis: "energy_sent_out" });
    close(energy.siteLoss.value, 26 / 70);
    assert.deepEqual(energy.siteLoss.basis, { lossBasis: "energy_generated" });
    assert.deepEqual(energy.deliveredCoverage, { connections: 2, recorded: 2, unmetered: 0, incomplete: 0 });
  });

  it("keeps curtailment beside the chain, as an estimate, and never subtracts it from metered generation", () => {
    assert.equal(energy.curtailment.value, 4);
    assert.equal(energy.curtailment.status, "calculated_with_estimates");
    assert.deepEqual(energy.curtailment.estimatedInputs.map((input) => [input.name, input.share]), [["curtailed:PV", 1]]);
    // Generation is what the meter recorded, with or without a curtailment estimate.
    const without = technical({ telemetry: telemetry().filter((point_) => point_.metric !== "curtailed_power_kw") }).energy;
    assert.equal(without.energyGenerated.value, 70);
    assert.equal(without.curtailment.value, null);
    assert.equal(without.curtailment.status, "insufficient_data");
  });
});

describe("missing is never zero in a site's balance", () => {
  it("a gap in the PV meter makes generation unavailable and names the meter", () => {
    const { energy } = technical({ intervals: intervals().filter((record) => !(record.meterId === "M-PV" && record.intervalStart === hour(9))) });
    assert.equal(energy.pvGeneration.value, null);
    assert.equal(energy.energyGenerated.status, "insufficient_data");
    assert.ok(energy.energyGenerated.missingInputs.some((name) => name.includes("M-PV")));
    assert.equal(energy.renewableFraction.value, null);
    // What does not depend on the PV meter is still given.
    assert.equal(energy.energySentOut.value, 48);
  });

  it("an asset with no meter is named as missing, not counted as nothing", () => {
    const { energy } = technical({ registry: { meters: registry().meters.filter((one) => one.id !== "M-GEN") } });
    assert.equal(energy.generatorGeneration.value, null);
    assert.deepEqual(energy.generatorGeneration.missingInputs, ["generation meter for generator GEN"]);
  });

  it("a site with no generator generated nothing from one only when its asset register is complete", () => {
    const none = { generationAssets: [PV, BATTERY], meters: registry().meters.filter((one) => one.id !== "M-GEN") };
    const complete = technical({ registry: none });
    assert.equal(complete.energy.generatorGeneration.value, 0);
    assert.equal(complete.energy.generatorGeneration.status, "ok");
    assert.equal(complete.energy.renewableFraction.value, 1);
    assert.equal(complete.generator, null);
    const partial = technical({ registry: none, assetsComplete: false });
    assert.equal(partial.energy.generatorGeneration.value, null);
    assert.equal(partial.energy.renewableFraction.status, "insufficient_data");
  });

  it("one customer meter that did not report makes energy delivered and the losses unavailable, and says how many did", () => {
    const { energy } = technical({ intervals: intervals().filter((record) => record.meterId !== "M-C2") });
    assert.equal(energy.energyDelivered.value, null);
    assert.equal(energy.distributionLoss.status, "insufficient_data");
    assert.equal(energy.siteLoss.status, "insufficient_data");
    assert.deepEqual(energy.deliveredCoverage, { connections: 2, recorded: 1, unmetered: 0, incomplete: 1 });
    assert.match(energy.energyDelivered.warnings.map((warning) => warning.message).join(" "), /1 of 2 connection/);
  });

  it("nothing generated makes a share not computable, not zero", () => {
    const { energy } = technical({ intervals: intervals().map((record) => (record.meterId === "M-PV" || record.meterId === "M-GEN" ? { ...record, importKwh: 0 } : record)) });
    assert.equal(energy.energyGenerated.value, 0);
    assert.equal(energy.renewableFraction.status, "not_computable");
    assert.equal(energy.renewableFraction.value, null);
  });
});

describe("PV performance", () => {
  it("gives irradiation, specific yield and performance ratio, with irradiance as an input", () => {
    const { pv } = technical();
    assert.ok(pv !== null);
    close(pv.irradiation.value, 6);
    assert.equal(pv.specificYield.value, 6);
    // 60 kWh ÷ (10 kWp × 6 kWh/m² ÷ 1 kW/m²).
    close(pv.performanceRatio.value, 1);
    assert.equal(pv.performanceRatio.status, "ok");
    assert.deepEqual(Object.keys(pv.performanceRatio.inputs), ["pvGeneration", "ratedPower", "irradiation"]);
  });

  it("gives the ratio before curtailment as a figure with an estimated input", () => {
    const { pv } = technical();
    close(pv?.performanceRatioBeforeCurtailment.value ?? null, 64 / 60);
    assert.equal(pv?.performanceRatioBeforeCurtailment.status, "calculated_with_estimates");
  });

  it("has no performance ratio when an irradiance reading is missing; nothing is interpolated", () => {
    const { pv } = technical({ telemetry: telemetry().filter((point_) => !(point_.metric === "irradiance_poa_w_m2" && point_.observedAt === hour(10))) });
    assert.equal(pv?.irradiation.status, "insufficient_data");
    assert.equal(pv?.performanceRatio.value, null);
    assert.match(pv?.performanceRatio.missingInputs.join(" ") ?? "", /23 usable of 24/);
    // Specific yield needs no irradiance.
    assert.equal(pv?.specificYield.value, 6);
  });

  it("is absent for a site with no PV array", () => {
    assert.equal(technical({ registry: { generationAssets: [BATTERY, GENERATOR] } }).pv, null);
  });
});

describe("storage", () => {
  it("estimates the change in stored energy from state of charge and nameplate, and so the storage loss", () => {
    const { storage } = technical();
    assert.ok(storage !== null);
    close(storage.storedEnergyChange.value, 2);
    // 20 in − 16 out − 2 more stored.
    close(storage.storageLoss.value, 2);
    assert.equal(storage.storageLoss.status, "calculated_with_estimates");
    assert.equal(storage.storageLoss.derivation?.kind, "residual");
    close(storage.roundTripEfficiency.value, 18 / 20);
    close(storage.equivalentFullCycles.value, 16 / 40);
    assert.deepEqual([storage.stateOfChargeMin.value, storage.stateOfChargeAtEnd.value], [50, 55]);
    close(storage.stateOfChargeMean.value, 65);
  });

  it("has no storage loss without a state-of-charge reading at each end, while the metered flows stand", () => {
    const result = technical({ telemetry: telemetry().filter((point_) => !(point_.metric === "state_of_charge_pct" && point_.observedAt === hour(24))) });
    assert.equal(result.storage?.storageLoss.status, "insufficient_data");
    assert.match(result.storage?.storageLoss.missingInputs.join(" ") ?? "", /state of charge of battery BAT at the end/);
    assert.equal(result.energy.storageNetIntake.value, 4);
    assert.equal(result.energy.stationUse.value, 18);
  });
});

describe("generator", () => {
  it("takes running hours and fuel from the advance of their registers, and fuel per kWh from the meter", () => {
    const { generator } = technical();
    assert.deepEqual([generator?.runtime.value, generator?.fuelUsed.value], [5, 4]);
    close(generator?.specificFuelConsumption.value ?? null, 0.4);
    assert.equal(generator?.runtime.unit, "hours");
  });

  it("has no running hours when a register has no reading at an end or went backwards", () => {
    const noEnd = technical({ telemetry: telemetry().filter((point_) => !(point_.metric === "run_hours_register_h" && point_.observedAt === hour(24))) });
    assert.equal(noEnd.generator?.runtime.status, "insufficient_data");
    const reset = technical({ telemetry: telemetry().map((point_) => (point_.metric === "run_hours_register_h" && point_.observedAt === hour(24) ? { ...point_, value: 3 } : point_)) });
    assert.equal(reset.generator?.runtime.value, null);
    assert.ok(reset.generator?.runtime.warnings.some((warning) => warning.code === "REGISTER_WENT_BACKWARDS"));
  });

  it("has no fuel per kWh for a generator that produced nothing", () => {
    const idle = technical({ intervals: intervals().map((record) => (record.meterId === "M-GEN" ? { ...record, importKwh: 0 } : record)) });
    assert.equal(idle.generator?.specificFuelConsumption.status, "not_computable");
  });
});

/* ---------------- Availability ---------------- */

function outage(id: string, change: Partial<Outage> & { from?: number; to?: number | null; customers?: number | null } = {}): Outage {
  const { from = 2, to = 5, customers = 100, ...rest } = change;
  return {
    id,
    origin: { kind: "site", id: "S1" },
    planned: false,
    cause: "fault",
    responsibleParty: "distribution",
    exposures: [{ affected: { kind: "site", id: "S1" }, customersAffected: customers, customerCountBasis: "recorded", interruptedAt: hour(from), ...(to === null ? {} : { restoredAt: hour(to) }), quality: "measured" }],
    provenance,
    ...rest,
  };
}

const availability = (outages: Outage[], more: { recordsAvailable?: boolean; connections?: number | null } = {}) =>
  computeSiteAvailability({ siteId: "S1", period: PERIOD, outages, recordsAvailable: more.recordsAvailable ?? true, connections: more.connections === undefined ? 100 : more.connections, computedAt: AT });

describe("site availability", () => {
  it("is customer-weighted: three hours for everyone and four for a quarter of the site", () => {
    const result = availability([outage("A"), outage("B", { from: 10, to: 14, customers: 25, cause: "weather" })]);
    // (100 × 3 + 25 × 4) customer-hours of 100 × 24.
    close(result.all.availability.value, 1 - 400 / 2400);
    close(result.all.hoursOfSupply.value, 20);
    close(result.all.interruptionsPerConnection.value, 1.25);
    assert.equal(result.interruptions, 2);
    assert.deepEqual(result.hoursLostByCause, { fault: 3, weather: 1 });
    assert.equal(result.all.availability.status, "ok");
  });

  it("gives every figure with planned interruptions and without, each stating its basis", () => {
    const result = availability([outage("A"), outage("P", { from: 8, to: 10, planned: true, cause: "planned_maintenance" })]);
    close(result.all.availability.value, 1 - 5 / 24);
    close(result.unplannedOnly.availability.value, 1 - 3 / 24);
    assert.equal(result.all.basis.plannedInterruptions, "included");
    assert.equal(result.unplannedOnly.availability.basis.plannedInterruptions, "excluded");
  });

  it("clips an interruption to the period, and counts one that began before it in the hours only", () => {
    const result = availability([outage("A", { from: -3, to: 2 })]);
    close(result.all.availability.value, 1 - 2 / 24);
    assert.equal(result.interruptions, 0);
    assert.equal(result.all.interruptionsPerConnection.value, 0);
  });

  it("counts an interruption its source says is open to the end of the period, provisionally", () => {
    const result = availability([outage("A", { from: 18, to: null, status: "open" })]);
    close(result.all.availability.value, 1 - 6 / 24);
    assert.equal(result.provisional, true);
    assert.ok(result.all.availability.warnings.some((warning) => warning.code === "PROVISIONAL_OPEN_INTERRUPTION"));
  });

  it("leaves out an exposure with no restoration time that is not said to be open, or with no customer count, and says so", () => {
    const result = availability([outage("A", { to: null }), outage("B", { customers: null })]);
    assert.equal(result.all.availability.value, 1);
    assert.equal(result.excludedExposures, 2);
    assert.equal(result.all.availability.warnings.filter((warning) => warning.code === "EXPOSURE_EXCLUDED").length, 2);
  });

  it("is a real 100% with a complete record that holds no interruption, and unknown with no record at all", () => {
    assert.equal(availability([]).all.availability.value, 1);
    const unknown = availability([], { recordsAvailable: false });
    assert.equal(unknown.all.availability.value, null);
    assert.equal(unknown.all.availability.status, "insufficient_data");
    assert.equal(unknown.interruptions, null);
    assert.equal(unknown.hoursLostByCause, null);
  });

  it("is unknown without the number of connections, and ignores another site's interruptions", () => {
    assert.equal(availability([outage("A")], { connections: null }).all.availability.status, "insufficient_data");
    const other = outage("X");
    other.exposures[0].affected = { kind: "site", id: "S2" };
    assert.equal(availability([other]).all.availability.value, 1);
  });
});

/* ---------------- Commercial ---------------- */

const charge = (id: string, customerId: string, kwh: number | null, ngn: number, basis: BillingRecord["basis"] = "prepaid_vend", currency = "NGN"): BillingRecord => ({
  id,
  customerId,
  basis,
  billedAt: hour(10),
  energyKwh: kwh,
  amount: { amountMinor: ngn * 100, currency },
  provenance,
});
const payment = (id: string, customerId: string, ngn: number): Payment => ({ id, customerId, receivedAt: hour(11), amount: { amountMinor: ngn * 100, currency: "NGN" }, provenance });

function commercial(change: { registry?: Partial<SiteRegistry>; charges?: BillingRecord[]; payments?: Payment[]; recordsAvailable?: boolean } = {}) {
  return computeSiteCommercial({
    index: buildSiteIndex(registry(change.registry)),
    siteId: "S1",
    period: PERIOD,
    recordsAvailable: change.recordsAvailable ?? true,
    billingRecords: change.charges ?? [charge("V1", "C1", 30, 6000), charge("V2", "C2", 10, 2000, "meter_reading"), charge("V9", "OTHER", 999, 99999)],
    payments: change.payments ?? [payment("P1", "C1", 6000), payment("P2", "C2", 500), payment("P9", "OTHER", 99999)],
    currency: "NGN",
    energyDelivered: knownQuantity(44, "kWh", "test"),
    computedAt: AT,
  });
}

describe("site revenue and collection", () => {
  const result = commercial();

  it("sums the charges and payments of the site's own accounts only", () => {
    assert.deepEqual([result.energySold.value, result.revenueBilled.value, result.revenueCollected.value], [40, 8000, 6500]);
    close(result.collectionEfficiency.value, 6500 / 8000);
    assert.deepEqual(result.collectionEfficiency.basis, { collection: "cash" });
    assert.deepEqual(result.collectionEfficiency.scope, { kind: "site", id: "S1" });
  });

  it("gives energy sold, consumption and revenue per active connection, each saying what it counts", () => {
    assert.equal(result.connections.value, 2);
    assert.equal(result.energySoldPerConnection.value, 20);
    assert.deepEqual(result.energySoldPerConnection.basis, { energySold: "billed", connections: "active" });
    assert.equal(result.consumptionPerConnection.value, 22);
    assert.equal(result.revenuePerConnection.value, 4000);
  });

  it("counts active connections apart from every account on the register", () => {
    const withDisconnected = commercial({ registry: { servicePoints: [point("SP1"), point("SP2"), point("SP3")], customers: [...registry().customers, customer("C3", "SP3", { accountStatus: "disconnected" })] } });
    assert.equal(withDisconnected.connections.value, 2);
    assert.equal(withDisconnected.connectionsAll.value, 3);
    assert.deepEqual(withDisconnected.connectionsAll.basis, { connections: "all" });
  });

  it("gives the productive-use share of energy sold, and by tier", () => {
    close(result.productiveUseShare.value, 30 / 40);
    assert.deepEqual(result.productiveUse, { accounts: 1, notRecorded: 0 });
    assert.deepEqual(result.byTier, [
      { tier: "T1", accounts: 1, activeAccounts: 1, energySoldKwh: 10, revenueBilled: 2000, revenueCollected: 500 },
      { tier: "T2", accounts: 1, activeAccounts: 1, energySoldKwh: 30, revenueBilled: 6000, revenueCollected: 6000 },
    ]);
    assert.deepEqual(result.chargesByBasis, { meter_reading: 1, prepaid_vend: 1, estimated: 0 });
  });

  it("gives collection by customer class, with how many accounts of each are prepaid and postpaid", () => {
    const classed = commercial({ registry: { customers: [customer("C1", "SP1", { productiveUse: true, paymentMode: "postpaid", category: "commercial" }), customer("C2", "SP2", { category: "residential", paymentMode: "prepaid" })] }, payments: [payment("P1", "C1", 1500), payment("P2", "C2", 2000)] });
    assert.deepEqual(classed.byClass, [
      { customerClass: "productive_use", accounts: 1, prepaidAccounts: 0, postpaidAccounts: 1, revenueBilled: 6000, revenueCollected: 1500, notCollected: 4500, collectionEfficiency: 0.25 },
      { customerClass: "residential", accounts: 1, prepaidAccounts: 1, postpaidAccounts: 0, revenueBilled: 2000, revenueCollected: 2000, notCollected: 0, collectionEfficiency: 1 },
    ]);
    // A class that was billed nothing has no rate, not a rate of zero.
    assert.equal(commercial({ charges: [], payments: [] }).byClass[0].collectionEfficiency, null);
  });

  it("does not take an account with no productive-use flag to be a household", () => {
    const unknown = commercial({ registry: { customers: [customer("C1", "SP1", { productiveUse: true }), customer("C2", "SP2", { productiveUse: undefined })] } });
    assert.equal(unknown.productiveUseShare.status, "insufficient_data");
    assert.match(unknown.productiveUseShare.missingInputs.join(" "), /1 account\(s\) are productive use/);
  });

  it("marks energy sold as partly estimated when a charge was raised on an estimate", () => {
    const estimated = commercial({ charges: [charge("V1", "C1", 30, 6000), charge("V2", "C2", 10, 2000, "estimated")] });
    assert.equal(estimated.energySold.status, "calculated_with_estimates");
    assert.deepEqual(estimated.energySold.estimatedInputs.map((input) => input.share), [0.25]);
  });

  it("has no figure at all without billing records, a real zero with records and no charge, and no revenue across currencies", () => {
    const none = commercial({ recordsAvailable: false, charges: [], payments: [] });
    assert.deepEqual([none.energySold.value, none.revenueBilled.value, none.collectionEfficiency.value], [null, null, null]);
    assert.equal(none.energySold.status, "insufficient_data");
    const quiet = commercial({ charges: [], payments: [] });
    assert.deepEqual([quiet.energySold.value, quiet.revenueBilled.value], [0, 0]);
    assert.equal(quiet.collectionEfficiency.status, "not_computable");
    const foreign = commercial({ charges: [charge("V1", "C1", 30, 6000), charge("V2", "C2", 10, 20, "prepaid_vend", "USD")] });
    assert.equal(foreign.revenueBilled.value, null);
    assert.match(foreign.revenueBilled.missingInputs.join(" "), /another currency/);
  });

  it("has no consumption per connection when energy delivered is not known", () => {
    const result_ = computeSiteCommercial({ index: buildSiteIndex(registry()), siteId: "S1", period: PERIOD, recordsAvailable: true, billingRecords: [], payments: [], currency: "NGN", energyDelivered: missingQuantity("kWh", "a customer meter"), computedAt: AT });
    assert.equal(result_.consumptionPerConnection.status, "insufficient_data");
  });
});

describe("site performance", () => {
  const performance = computeSitePerformance({
    index: buildSiteIndex(registry()),
    siteId: "S1",
    period: PERIOD,
    intervals: intervals(),
    telemetry: telemetry(),
    outages: [outage("A", { customers: 2 })],
    outagesAvailable: true,
    billingRecords: [charge("V1", "C1", 30, 6000)],
    payments: [],
    billingAvailable: true,
    currency: "NGN",
    registryComplete: true,
    computedAt: AT,
  });

  it("uses the same energy delivered and the same connection count throughout", () => {
    assert.equal(performance.commercial.consumptionPerConnection.value, 22);
    close(performance.availability.all.availability.value, 1 - 3 / 24);
  });

  it("lists the figures a report may state, each for the site and the period", () => {
    const kpis = comparableSiteKpis(performance);
    assert.ok(kpis.every((kpi) => kpi.scope.kind === "site" && kpi.scope.id === "S1" && kpi.period === PERIOD));
    assert.equal(kpis.filter((kpi) => kpi.metric === "availability").length, 2);
    assert.equal(kpis.filter((kpi) => kpi.metric === "connection_count").length, 2);
  });
});
