import type { AssetRef, IntervalEnergy, Period, TelemetryPoint } from "@/domain";
import type { Methodology, SiteParameters } from "../core/methodology.ts";
import type { CalculatedKpi, Warning } from "../core/result.ts";
import type { Quantity, SiteKpiContext } from "./quantity.ts";
import type { SiteIndex } from "./registry.ts";
import { SITE_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { periodBounds } from "../core/time.ts";
import { integrateMeans, intervalsByMeter, knownQuantity, kpiQuantity, meteredEnergy, missingQuantity, over, readingAt, readingsIn, registerAdvanceOver, siteKpi } from "./quantity.ts";
import { siteAssets, siteMeters, siteScope, siteServicePoints } from "./registry.ts";

/* ==========================================================
   ANALYTICS — SITE ENERGY BALANCE AND TECHNICAL PERFORMANCE

   A site's energy account starts from its own generation, not from
   an upstream boundary (ADR 0015). For one site and one period:

     PV generation          metered output of the PV arrays
   + Generator generation   metered output of the generators
   = Energy generated
   − Net into storage       energy into storage − energy out of it
   − Station use            RESIDUAL: what is left; the powerhouse's
                            own use and anything unaccounted for
   = Energy sent out        metered where the powerhouse hands over
                            to the distribution network. This is the
                            energy AVAILABLE to customers.
   − Distribution loss      RESIDUAL: sent out − delivered. Technical
                            loss and unmetered use together; they
                            cannot be told apart without a study.
   = Energy delivered       what customer meters recorded

   Three things stand BESIDE the chain and are never subtracted from
   a metered figure:

   - STORAGE LOSS = net into storage − change in stored energy. The
     change in stored energy is estimated (change in state of charge
     × nameplate capacity), so storage loss is calculated with an
     estimate. Net into storage is metered and is what the chain uses.
   - CURTAILMENT is PV energy that was available and not taken. It
     cannot be metered. It is the site controller's own estimate, and
     it happened BEFORE the generation meter: metered generation is
     already net of it. Subtracting it from energy generated would
     count it twice, so it is shown beside PV generation, as an
     estimate, and without a controller estimate it is not available.
   - IRRADIATION is an input to PV performance, measured on site.

   PV performance (IEC 61724 terms):
     specific yield      PV generation ÷ rated power           kWh/kWp
     performance ratio   specific yield ÷ (in-plane irradiation
                         ÷ reference irradiance of 1 kW/m²)
   The performance ratio counts curtailment as a loss, as the
   standard does. "Before curtailment" adds the estimated curtailed
   energy back, to tell an array that is held back from one that is
   underperforming.

   A site with no generator in a COMPLETE registry generated nothing
   from one: a real zero. With an incomplete registry the same
   absence is unknown.
========================================================== */

export interface SiteEnergy {
  pvGeneration: CalculatedKpi;
  generatorGeneration: CalculatedKpi;
  energyGenerated: CalculatedKpi;
  renewableFraction: CalculatedKpi;
  generatorShare: CalculatedKpi;
  /** Estimated; null value when the site's controller reports none. */
  curtailment: CalculatedKpi;
  storageCharge: CalculatedKpi;
  storageDischarge: CalculatedKpi;
  /** Energy into storage less energy out of it: metered. */
  storageNetIntake: CalculatedKpi;
  energySentOut: CalculatedKpi;
  stationUse: CalculatedKpi;
  energyDelivered: CalculatedKpi;
  distributionLossKwh: CalculatedKpi;
  /** Fraction of energy sent out. */
  distributionLoss: CalculatedKpi;
  /** Energy generated that did not reach a customer meter, as a fraction of energy generated. */
  siteLoss: CalculatedKpi;
  /** Connections whose meter did not record the whole period, of those the site supplies. */
  deliveredCoverage: { connections: number; recorded: number; unmetered: number; incomplete: number };
}

export interface PvPerformance {
  capacityKwp: number | null;
  irradiation: CalculatedKpi;
  specificYield: CalculatedKpi;
  performanceRatio: CalculatedKpi;
  performanceRatioBeforeCurtailment: CalculatedKpi;
}

export interface StoragePerformance {
  energyCapacityKwh: number;
  /** Estimated from state of charge and nameplate capacity. */
  storedEnergyChange: CalculatedKpi;
  storageLoss: CalculatedKpi;
  roundTripEfficiency: CalculatedKpi;
  /** Energy out of storage ÷ nameplate energy capacity. */
  equivalentFullCycles: CalculatedKpi;
  stateOfChargeMin: CalculatedKpi;
  stateOfChargeMean: CalculatedKpi;
  stateOfChargeAtEnd: CalculatedKpi;
}

export interface GeneratorPerformance {
  ratedPowerKw: number;
  runtime: CalculatedKpi;
  fuelUsed: CalculatedKpi;
  specificFuelConsumption: CalculatedKpi;
}

export interface SiteTechnical {
  energy: SiteEnergy;
  /** null when the site has no PV array. */
  pv: PvPerformance | null;
  /** null when the site has no battery. */
  storage: StoragePerformance | null;
  /** null when the site has no generator. */
  generator: GeneratorPerformance | null;
}

const SHARE_OF_GENERATED = { shareOf: "energy_generated" } as const;

export function computeSiteTechnical(params: {
  index: SiteIndex;
  siteId: string;
  period: Period;
  intervals: readonly IntervalEnergy[];
  telemetry: readonly TelemetryPoint[];
  /** True when the registry holds every asset of the site, so that an asset it does not list does not exist. */
  assetsComplete: boolean;
  methodology?: Methodology<SiteParameters>;
  computedAt: string;
}): SiteTechnical {
  const { index, siteId, period, telemetry } = params;
  const methodology = params.methodology ?? SITE_REFERENCE;
  const { endReadingToleranceMinutes: tolerance, referenceIrradianceWm2 } = methodology.parameters;
  const context: SiteKpiContext = { scope: siteScope(siteId), period, methodology: methodologyRef(methodology), computedAt: params.computedAt };
  const intervals = intervalsByMeter(params.intervals);
  const site: AssetRef = { kind: "site", id: siteId };
  const assetRef = (id: string): AssetRef => ({ kind: "generation_asset", id });
  const kpi = siteKpi.bind(null, context);

  const arrays = siteAssets(index, siteId, "solar_pv");
  const generators = siteAssets(index, siteId, "generator");
  const batteries = siteAssets(index, siteId, "battery");

  /** The metered energy of every asset of a kind; a real zero when a complete registry holds none. */
  const ofAssets = (assets: readonly { id: string; kind: string }[], role: "generation" | "storage", channel: "import" | "export" | "net", none: string): Quantity => {
    if (assets.length === 0) return params.assetsComplete ? knownQuantity(0, "kWh", `registry:${none}`) : missingQuantity("kWh", `a complete register of the site's assets (${none})`);
    return meteredEnergy(assets.map((asset) => ({ what: `${role} meter for ${asset.kind} ${asset.id}`, meters: siteMeters(index, role, asset.id) })), intervals, period, channel);
  };

  /* ---- Generation ---- */
  const pvGeneration = kpi("pv_generation", "kWh", { pvMeters: ofAssets(arrays, "generation", "net", "no PV array registered") }, (v) => v("pvMeters"));
  const generatorGeneration = kpi("generator_generation", "kWh", { generatorMeters: ofAssets(generators, "generation", "net", "no generator registered") }, (v) => v("generatorMeters"));
  const pv = kpiQuantity(pvGeneration);
  const generator = kpiQuantity(generatorGeneration);
  const energyGenerated = kpi("energy_generated", "kWh", { pvGeneration: pv, generatorGeneration: generator }, (v) => v("pvGeneration") + v("generatorGeneration"));
  const generated = kpiQuantity(energyGenerated);
  const renewableFraction = kpi("renewable_fraction", "fraction", { pvGeneration: pv, energyGenerated: generated }, (v) => over(v("pvGeneration"), v("energyGenerated")), {
    basis: SHARE_OF_GENERATED,
    undefinedBecause: "Nothing was generated in the period, so no share of it is defined.",
  });
  const generatorShare = kpi("generator_share", "fraction", { generatorGeneration: generator, energyGenerated: generated }, (v) => over(v("generatorGeneration"), v("energyGenerated")), {
    basis: SHARE_OF_GENERATED,
    undefinedBecause: "Nothing was generated in the period, so no share of it is defined.",
  });

  /* ---- Curtailment: the controller's estimate, beside the chain ---- */
  const curtailedByArray: Record<string, Quantity> = {};
  for (const array of arrays) curtailedByArray[`curtailed:${array.id}`] = integrateMeans(telemetry, assetRef(array.id), "curtailed_power_kw", period, "kWh");
  const curtailment =
    arrays.length === 0
      ? kpi("pv_curtailment", "kWh", { arrays: params.assetsComplete ? knownQuantity(0, "kWh", "registry:no PV array registered") : missingQuantity("kWh", "a complete register of the site's assets") }, (v) => v("arrays"))
      : kpi("pv_curtailment", "kWh", curtailedByArray, (v) => Object.keys(curtailedByArray).reduce((total, name) => total + v(name), 0));

  /* ---- Storage flows ---- */
  const storageCharge = kpi("storage_charge", "kWh", { storageMeters: ofAssets(batteries, "storage", "import", "no battery registered") }, (v) => v("storageMeters"));
  const storageDischarge = kpi("storage_discharge", "kWh", { storageMeters: ofAssets(batteries, "storage", "export", "no battery registered") }, (v) => v("storageMeters"));
  const charge = kpiQuantity(storageCharge);
  const discharge = kpiQuantity(storageDischarge);
  const storageNetIntake = kpi("storage_net_intake", "kWh", { storageCharge: charge, storageDischarge: discharge }, (v) => v("storageCharge") - v("storageDischarge"));
  const netIntake = kpiQuantity(storageNetIntake);

  /* ---- Sent out, delivered, and the two residuals ---- */
  const energySentOut = kpi(
    "energy_sent_out",
    "kWh",
    { siteOutputMeter: meteredEnergy([{ what: `site_output meter for site ${siteId}`, meters: siteMeters(index, "site_output", siteId) }], intervals, period, "net") },
    (v) => v("siteOutputMeter"),
  );
  const sentOut = kpiQuantity(energySentOut);
  const stationUse = kpi("station_use", "kWh", { energyGenerated: generated, storageNetIntake: netIntake, energySentOut: sentOut }, (v) => v("energyGenerated") - v("storageNetIntake") - v("energySentOut"), {
    residual: "Energy generated − net energy into storage − energy sent out. Not measured: the powerhouse's own use, conversion losses outside the storage meter, and anything unaccounted for.",
  });

  const points = siteServicePoints(index, siteId);
  const customerGroups = points.map((sp) => ({ what: `service_point meter for service_point ${sp.id}`, meters: siteMeters(index, "service_point", sp.id) }));
  const deliveredCoverage = { connections: points.length, recorded: 0, unmetered: 0, incomplete: 0 };
  for (const group of customerGroups) {
    if (group.meters.length === 0) deliveredCoverage.unmetered += 1;
    else if (meteredEnergy([group], intervals, period, "import").value === null) deliveredCoverage.incomplete += 1;
    else deliveredCoverage.recorded += 1;
  }
  const customerMeters = meteredEnergy(customerGroups, intervals, period, "import");
  const deliveredWarnings: Warning[] =
    customerMeters.value === null
      ? [{ code: "DELIVERED_NOT_COMPLETE", message: `${deliveredCoverage.recorded} of ${deliveredCoverage.connections} connection(s) have a meter that recorded the whole period; the rest are not known and are not taken as zero.` }]
      : [];
  const energyDelivered = kpi("energy_delivered", "kWh", { customerMeters }, (v) => v("customerMeters"), { warnings: deliveredWarnings });
  const delivered = kpiQuantity(energyDelivered);
  const lossNote = "Energy sent out − energy delivered. Not measured: technical loss in the distribution network and energy used without being metered, together.";
  const distributionLossKwh = kpi("distribution_loss", "kWh", { energySentOut: sentOut, energyDelivered: delivered }, (v) => v("energySentOut") - v("energyDelivered"), { residual: lossNote });
  const distributionLoss = kpi("distribution_loss", "fraction", { energySentOut: sentOut, energyDelivered: delivered }, (v) => over(v("energySentOut") - v("energyDelivered"), v("energySentOut")), {
    basis: { lossBasis: "energy_sent_out" },
    residual: lossNote,
    undefinedBecause: "Nothing was sent out in the period.",
  });
  const siteLoss = kpi("site_loss", "fraction", { energyGenerated: generated, energyDelivered: delivered }, (v) => over(v("energyGenerated") - v("energyDelivered"), v("energyGenerated")), {
    basis: { lossBasis: "energy_generated" },
    residual: "Energy generated − energy delivered: storage loss, change in stored energy, station use and distribution loss together.",
    undefinedBecause: "Nothing was generated in the period.",
  });

  const energy: SiteEnergy = {
    pvGeneration,
    generatorGeneration,
    energyGenerated,
    renewableFraction,
    generatorShare,
    curtailment,
    storageCharge,
    storageDischarge,
    storageNetIntake,
    energySentOut,
    stationUse,
    energyDelivered,
    distributionLossKwh,
    distributionLoss,
    siteLoss,
    deliveredCoverage,
  };

  /* ---- PV performance ---- */
  let pvPerformance: PvPerformance | null = null;
  if (arrays.length > 0) {
    const capacityKwp = arrays.reduce((total, array) => total + array.capacityKwp, 0);
    const capacity = knownQuantity(capacityKwp, "kW", "registry:rated PV power (kWp)");
    const irradiation = kpi("irradiation", "kWh_per_m2", { irradiance: integrateMeans(telemetry, site, "irradiance_poa_w_m2", period, "kWh_per_m2", 1 / 1000) }, (v) => v("irradiance"));
    const insolation = kpiQuantity(irradiation);
    const referenceKwM2 = referenceIrradianceWm2 / 1000;
    const specificYield = kpi("specific_yield", "kWh_per_kWp", { pvGeneration: pv, ratedPower: capacity }, (v) => over(v("pvGeneration"), v("ratedPower")));
    const performanceRatio = kpi("performance_ratio", "fraction", { pvGeneration: pv, ratedPower: capacity, irradiation: insolation }, (v) => over(v("pvGeneration"), (v("ratedPower") * v("irradiation")) / referenceKwM2), {
      undefinedBecause: "No irradiation was recorded in the period, so the ratio is undefined.",
    });
    const performanceRatioBeforeCurtailment = kpi(
      "performance_ratio",
      "fraction",
      { pvGeneration: pv, curtailment: kpiQuantity(curtailment), ratedPower: capacity, irradiation: insolation },
      (v) => over(v("pvGeneration") + v("curtailment"), (v("ratedPower") * v("irradiation")) / referenceKwM2),
      { undefinedBecause: "No irradiation was recorded in the period, so the ratio is undefined." },
    );
    pvPerformance = { capacityKwp, irradiation, specificYield, performanceRatio, performanceRatioBeforeCurtailment };
  }

  /* ---- Storage performance ---- */
  let storage: StoragePerformance | null = null;
  const bounds = periodBounds(period);
  if (batteries.length > 0) {
    const energyCapacityKwh = batteries.reduce((total, battery) => total + battery.energyCapacityKwh, 0);
    // The change in stored energy of each battery: change in state of charge × its nameplate capacity.
    const changes: Record<string, Quantity> = {};
    const socSeries: number[] = [];
    let socAtEnd: Quantity = missingQuantity("percent", "a state-of-charge reading at the end of the period");
    for (const battery of batteries) {
      const ref = assetRef(battery.id);
      const opening = bounds === null ? null : readingAt(telemetry, ref, "state_of_charge_pct", bounds.startMs, tolerance);
      const closing = bounds === null ? null : readingAt(telemetry, ref, "state_of_charge_pct", bounds.endMs, tolerance);
      changes[`storedChange:${battery.id}`] =
        opening === null || closing === null
          ? missingQuantity("kWh", `state of charge of battery ${battery.id} at the ${[opening === null ? "start" : null, closing === null ? "end" : null].filter((end) => end !== null).join(" and ")} of the period`)
          : {
              value: (((closing.value as number) - (opening.value as number)) / 100) * battery.energyCapacityKwh,
              unit: "kWh",
              origin: "calculated",
              // Nameplate capacity stands in for what the battery can hold today.
              quality: "estimated",
              estimatedShare: 1,
              ref: `state_of_charge_pct:${battery.id} × nameplate ${battery.energyCapacityKwh} kWh`,
              missing: [],
              warnings: [],
            };
      // One battery's readings describe it; with several, a single site figure would need weighting, so only the first is summarised.
      if (battery === batteries[0]) {
        for (const point of readingsIn(telemetry, ref, "state_of_charge_pct", period)) socSeries.push(point.value as number);
        if (closing !== null) socAtEnd = { value: closing.value, unit: "percent", origin: "observed", quality: closing.quality, ref: `state_of_charge_pct:${battery.id}`, missing: [], warnings: [] };
      }
    }
    const storedEnergyChange = kpi("stored_energy_change", "kWh", changes, (v) => Object.keys(changes).reduce((total, name) => total + v(name), 0));
    const stored = kpiQuantity(storedEnergyChange);
    stored.quality = stored.value === null ? "missing" : "estimated";
    if (stored.value !== null) stored.estimatedShare = 1;
    const storageLoss = kpi("storage_loss", "kWh", { storageNetIntake: netIntake, storedEnergyChange: stored }, (v) => v("storageNetIntake") - v("storedEnergyChange"), {
      residual: "Energy into storage − energy out of storage − change in stored energy. The change in stored energy is estimated from state of charge and nameplate capacity.",
    });
    const roundTripEfficiency = kpi("storage_round_trip_efficiency", "fraction", { storageCharge: charge, storageDischarge: discharge, storedEnergyChange: stored }, (v) => over(v("storageDischarge") + v("storedEnergyChange"), v("storageCharge")), {
      undefinedBecause: "No energy went into storage in the period.",
    });
    const equivalentFullCycles = kpi("storage_cycles", "cycles", { storageDischarge: discharge, nameplateCapacity: knownQuantity(energyCapacityKwh, "kWh", "registry:rated energy capacity") }, (v) => over(v("storageDischarge"), v("nameplateCapacity")));
    const series = (what: string): Quantity =>
      socSeries.length === 0
        ? missingQuantity("percent", `state-of-charge readings of battery ${batteries[0].id} in the period`)
        : { value: what === "min" ? Math.min(...socSeries) : socSeries.reduce((total, value) => total + value, 0) / socSeries.length, unit: "percent", origin: "observed", quality: "measured", ref: `state_of_charge_pct:${batteries[0].id} (${socSeries.length} readings)`, missing: [], warnings: [] };
    storage = {
      energyCapacityKwh,
      storedEnergyChange,
      storageLoss,
      roundTripEfficiency,
      equivalentFullCycles,
      stateOfChargeMin: kpi("state_of_charge", "percent", { lowestReading: series("min") }, (v) => v("lowestReading")),
      stateOfChargeMean: kpi("state_of_charge", "percent", { meanOfReadings: series("mean") }, (v) => v("meanOfReadings")),
      stateOfChargeAtEnd: kpi("state_of_charge", "percent", { readingAtEnd: socAtEnd }, (v) => v("readingAtEnd")),
    };
  }

  /* ---- Generator ---- */
  let generatorPerformance: GeneratorPerformance | null = null;
  if (generators.length > 0) {
    const hours: Record<string, Quantity> = {};
    const fuel: Record<string, Quantity> = {};
    for (const unit of generators) {
      hours[`runHours:${unit.id}`] = registerAdvanceOver(telemetry, assetRef(unit.id), "run_hours_register_h", period, tolerance, "hours");
      fuel[`fuel:${unit.id}`] = registerAdvanceOver(telemetry, assetRef(unit.id), "fuel_used_register_l", period, tolerance, "litres");
    }
    const sum = (quantities: Record<string, Quantity>) => (v: (name: string) => number) => Object.keys(quantities).reduce((total, name) => total + v(name), 0);
    const runtime = kpi("generator_runtime", "hours", hours, sum(hours));
    const fuelUsed = kpi("fuel_used", "litres", fuel, sum(fuel));
    generatorPerformance = {
      ratedPowerKw: generators.reduce((total, unit) => total + unit.ratedPowerKw, 0),
      runtime,
      fuelUsed,
      specificFuelConsumption: kpi("specific_fuel_consumption", "litres_per_kWh", { fuelUsed: kpiQuantity(fuelUsed), generatorGeneration: generator }, (v) => over(v("fuelUsed"), v("generatorGeneration")), {
        undefinedBecause: "The generator produced no energy in the period.",
      }),
    };
  }

  return { energy, pv: pvPerformance, storage, generator: generatorPerformance };
}
