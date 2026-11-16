import type { Citation, DataSource, Hub, VehicleSegment } from "@/domain";
import type { EmobilityRepository } from "../../repositories/ports/emobility.ts";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { Methodology } from "../../analytics/core/methodology.ts";
import { LOADING_REFERENCE } from "../../analytics/core/methodology.ts";
import { dayEnergy, EMOBILITY_DEMAND_REFERENCE, energyPerSwap, HORIZONS, projectDemand } from "../../analytics/planning/emobility/demand.ts";
import { EMOBILITY_HEADROOM_REFERENCE, headroomOverTime, type HeadroomAt } from "../../analytics/planning/emobility/headroom.ts";
import { comparePowerSources, EMOBILITY_POWER_SOURCE_REFERENCE, type OptionResult, type PowerOption } from "../../analytics/planning/emobility/powerSource.ts";
import { EMOBILITY_SITE_SCORE_REFERENCE, rankSites } from "../../analytics/planning/emobility/siteScore.ts";
import { EMOBILITY_SWAP_FINANCE_REFERENCE, escrowPerDay, hubMonthsToRepay, matchHubPledges } from "../../analytics/planning/emobility/swapFinance.ts";
import { EMOBILITY_VERIFY_REFERENCE, hubAgainstPlan } from "../../analytics/planning/emobility/verify.ts";
import { assetLoading } from "../analytics/loading.ts";
import { scopeReliability } from "../analytics/reliability.ts";
import { loadTopology } from "../analytics/topology.ts";
import { emobilityInputs, INSTALLED_COSTS, SYNTHETIC_DISCO_TARIFF_ORDER } from "./emobilityInputs.ts";
import type { EmobilityFigure, EmobilityView, MethodView, PowerOptionView } from "./emobilityViews.ts";
import { formatNaira } from "./metering.ts";

/* ==========================================================
   SERVICES — PLANNING: THE E-MOBILITY PLANNER (EMOB-A)

   The five questions (docs/design/EMOB-A-PLAN.md) for the synthetic
   hubs on the synthetic Savanna network: demand, sites and headroom,
   power source, finance, verify. Each hub's DT peak and its feeder's
   hours of supply come from the existing loading and reliability
   services; its tariff from the published NERC orders; the rest from
   the e-mobility records. Every result rests on synthetic records and
   is marked so. Figures are formatted here with their status; a
   screen calculates nothing.
========================================================== */

const method = (one: Methodology<unknown>): MethodView => ({ id: one.id, version: one.version, name: one.name, disclaimer: one.disclaimer });
const whole = (value: number) => Math.round(value).toLocaleString("en-GB");
const one = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nairaKwh = (value: number) => `₦${two(value)}/kWh`;

const OPTION_LABEL: Record<PowerOption, string> = {
  grid_diesel: "Grid with diesel backup",
  diesel: "Diesel only",
  solar_grid: "Solar + grid",
  solar_bess: "Solar + BESS",
  hybrid: "Hybrid (solar + BESS + grid)",
};

interface HubStudy {
  hub: Hub;
  feederId: string | null;
  feederName: string;
  band: string | null;
  tariff: number | null;
  ratingKva: number | null;
  observedPeakKva: number | null;
  hoursOfSupply: number | null;
  swapsNow: number;
  kwhNow: number;
  base: HeadroomAt[];
  options: OptionResult[];
}

const totalSwaps = (swaps: Partial<Record<VehicleSegment, number>>) => Object.values(swaps).reduce<number>((sum, count) => sum + (count ?? 0), 0);

export async function emobilityView(runtime: OperationsRuntime, published: PublishedFiguresRepository, records: EmobilityRepository): Promise<EmobilityView> {
  const { repos, period, now, cache } = runtime;
  const context = { computedAt: now };
  const { index } = await loadTopology(repos.registry, now, cache);
  const [hubs, pledges, swapDays, citations, emobSources, tariffs] = await Promise.all([records.hubs(), records.pledges(), records.swapDays(), records.citations(), records.sources(), published.residentialTariffs()]);
  const publishedCitations = await published.citations();

  const sources = new Map<string, DataSource>(emobSources.map((source) => [source.id, source]));
  const citationsUsed = new Map<string, Citation>();
  for (const citation of citations) citationsUsed.set(citation.id, citation);

  const threshold = LOADING_REFERENCE.parameters.overloadThreshold;
  const pf = EMOBILITY_HEADROOM_REFERENCE.parameters.hubPowerFactor;

  const studies: HubStudy[] = [];
  for (const hub of hubs) {
    const dt = index.transformerById.get(hub.transformerId);
    const feeder = dt === undefined ? undefined : index.feederById.get(dt.feederId);
    const loading = await assetLoading({ repos, asset: { kind: "distribution_transformer", id: hub.transformerId }, asOf: now, window: period, context, cache });
    for (const source of loading.sourcing.sources) sources.set(source.id, source);
    const observedPeakKva = loading.result.peak?.peak?.apparentPowerKva ?? null;
    let hoursOfSupply: number | null = null;
    if (feeder !== undefined) {
      const reliability = await scopeReliability({ repos, scope: { kind: "feeder", id: feeder.id }, period, context, cache });
      for (const source of reliability.sourcing.sources) sources.set(source.id, source);
      hoursOfSupply = reliability.result.supply.averageHours;
    }
    const band = feeder?.serviceBand ?? null;
    const tariffRecord = band === null ? undefined : tariffs.find((row) => row.disco === SYNTHETIC_DISCO_TARIFF_ORDER && row.band === band);
    if (tariffRecord !== undefined) {
      const citation = publishedCitations.find((row) => row.id === tariffRecord.citationId);
      if (citation !== undefined) citationsUsed.set(citation.id, citation);
    }
    const tariff = tariffRecord?.nairaPerKwh ?? null;
    const energy = dayEnergy(hub.plannedSwapsPerDay);
    const demandRows = projectDemand(hub.plannedSwapsPerDay, hoursOfSupply).filter((row) => row.adoption === "base");
    const site = { ratingKva: dt?.ratingKva ?? 0, observedPeakKva: dt === undefined ? null : observedPeakKva, overloadThreshold: threshold, hoursOfSupply, chargerKw: hub.chargerKw };
    const base = headroomOverTime(site, demandRows.map((row) => ({ months: row.months, kwhPerDay: row.kwhPerDay })));
    const headroomNow = base[0].headroomKva;
    const availableKw = headroomNow === null ? null : Math.min(hub.chargerKw, Math.max(0, headroomNow) * pf);
    const options = comparePowerSources({
      swapsPerDay: hub.plannedSwapsPerDay,
      kwhPerDay: energy.kwh,
      grid: { tariffPerKwh: tariff, hoursOfSupply, availableKw },
      solar: { averagePeakSunHours: hub.solar.annualPeakSunHours, rainySeasonPeakSunHours: hub.solar.rainySeasonPeakSunHours },
      installed: INSTALLED_COSTS,
    });
    studies.push({ hub, feederId: feeder?.id ?? null, feederName: feeder?.name ?? "Not found", band, tariff, ratingKva: dt?.ratingKva ?? null, observedPeakKva, hoursOfSupply, swapsNow: energy.swaps, kwhNow: energy.kwh, base, options });
  }

  const sourcing = {
    synthetic: [...sources.values()].some((source) => source.kind === "synthetic"),
    sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)).map((source) => ({ id: source.id, name: source.name, kind: source.kind })),
    citations: [...citationsUsed.values()].map((citation) => ({ id: citation.id, title: citation.title, url: citation.url })),
  };

  return {
    demand: demandView(studies),
    sites: sitesView(studies),
    power: powerView(studies),
    finance: financeView(studies, pledges),
    verify: verifyView(studies, swapDays),
    inputs: emobilityInputs(),
    sourcing,
  };
}

const DEMONSTRATION_HUB = "HUB-02";

function demandView(studies: HubStudy[]): EmobilityView["demand"] {
  const motorcycle = energyPerSwap("motorcycle");
  const tricycle = energyPerSwap("tricycle");
  const hubs = studies.map((study) => {
    const rows = projectDemand(study.hub.plannedSwapsPerDay, study.hoursOfSupply);
    return {
      hubId: study.hub.id,
      hub: study.hub.name,
      status: study.hub.status,
      swapsNow: whole(study.swapsNow),
      kwhPerSwap: `${two(motorcycle.base)} kWh a motorcycle swap, ${two(tricycle.base)} a tricycle swap (${two(motorcycle.upper)} and ${two(tricycle.upper)} at full depletion)`,
      rows: rows.map((row) => ({
        adoption: row.adoption,
        months: String(row.months),
        swapsPerDay: whole(row.totalSwapsPerDay),
        vehicles: whole(row.vehiclesServed),
        kwhPerDay: whole(row.kwhPerDay),
        kwhPerDayUpper: whole(row.kwhPerDayUpper),
        chargingKw: row.chargingKw === null ? "Not available: no hours of supply" : one(row.chargingKw),
      })),
      notCounted: rows[0].notCounted.length === 0 ? null : `Not counted, no battery or use in the inputs: ${rows[0].notCounted.join(", ")}`,
    };
  });
  const demo = hubs.find((hub) => hub.hubId === DEMONSTRATION_HUB);
  const base24 = demo?.rows.find((row) => row.adoption === "base" && row.months === "24");
  const now = demo?.rows.find((row) => row.adoption === "base" && row.months === "0");
  return {
    headline:
      demo === undefined || now === undefined || base24 === undefined
        ? "No demonstration hub in the records."
        : `The demonstration hub draws ${now.kwhPerDay} kWh a day for ${now.swapsPerDay} swaps (${now.kwhPerDayUpper} kWh if every battery came back empty), and ${base24.kwhPerDay} kWh at 24 months under base adoption.`,
    how: "How this is calculated: kWh a swap = pack kWh × (1 − state of charge on return) ÷ charging efficiency; swaps grow at the adoption case's rate, compounding yearly; charging power = kWh a day ÷ the feeder's hours of supply. Adoption cases are assumptions, not forecasts. Every hub is synthetic.",
    hubs,
    method: method(EMOBILITY_DEMAND_REFERENCE),
  };
}

function finding(base: HeadroomAt[]): string {
  const now = base[0];
  if (now.fits === null) return `Not known now: ${now.unknown.join("; ")}`;
  if (!now.fits) return `Does not fit now (${now.limits.join(" and ")})`;
  const failing = base.find((row) => row.fits === false);
  if (failing === undefined) return `Fits now and at ${base[base.length - 1].months} months`;
  return `Fits now; not at ${failing.months} months (${failing.limits.join(" and ")})`;
}

function sitesView(studies: HubStudy[]): EmobilityView["sites"] {
  const hubs = studies.map((study) => ({
    hubId: study.hub.id,
    hub: study.hub.name,
    transformer: study.hub.transformerId,
    rating: study.ratingKva === null ? "Not found" : `${whole(study.ratingKva)} kVA`,
    observedPeak: study.observedPeakKva === null ? "Not available: no telemetry" : `${one(study.observedPeakKva)} kVA`,
    feeder: study.feederName,
    band: study.band === null ? "Not recorded" : `Band ${study.band}`,
    tariff: study.tariff === null ? "Not available: no published tariff for the band" : nairaKwh(study.tariff),
    hoursOfSupply: study.hoursOfSupply === null ? "Not available" : `${one(study.hoursOfSupply)} h a day`,
    horizons: study.base.map((row) => ({
      months: String(row.months),
      dtLoad: row.dtLoadKva === null ? "Not available" : `${one(row.dtLoadKva)} kVA`,
      headroom: row.headroomKva === null ? "Not available" : `${one(row.headroomKva)} kVA`,
      hubDraw: row.hubDrawKva === null ? "Not available" : `${one(row.hubDrawKva)} kVA`,
      fits: row.fits === null ? "Not known" : row.fits ? "Fits" : "Does not fit",
      limits: row.limits.length === 0 ? "—" : row.limits.join(", "),
    })),
    finding: finding(study.base),
  }));
  const fitNow = studies.filter((study) => study.base[0].fits === true).length;
  const fit24 = studies.filter((study) => study.base.find((row) => row.months === 24)?.fits === true).length;
  const ranked = rankSites(
    studies.map((study) => {
      const at24 = study.base.find((row) => row.months === 24)!;
      return {
        id: study.hub.id,
        fitsOnGridAt24: at24.fits,
        headroomLeftAt24Kva: at24.headroomKva === null || at24.hubDrawKva === null ? null : at24.headroomKva - at24.hubDrawKva,
        options: study.options,
      };
    }),
  );
  const names = new Map(studies.map((study) => [study.hub.id, study.hub.name]));
  return {
    headline: `${fitNow} of ${studies.length} hubs fit on the grid now; ${fit24} still fit at 24 months under base adoption.`,
    how: "How this is calculated: the DT's observed peak in the month, grown 5% a year, against its rating; the hub's draw (kWh a day ÷ the feeder's hours of supply, at most its chargers) ÷ power factor 0.95, taken at the DT's peak; and whether the chargers can take the day's energy in the feeder's hours. Hours of supply are calculated from the outage log, never read from the band. Synthetic network and hubs.",
    hubs,
    order: ranked.map((row) => ({ rank: String(row.rank), hub: names.get(row.id) ?? row.id, reasons: row.reasons })),
    orderHow: "How this is ordered: fit on the grid at 24 months first, then the cheapest option that can be costed (fuel and tariff only), then the DT headroom left at 24 months. No weights.",
    methods: [method(EMOBILITY_HEADROOM_REFERENCE), method(EMOBILITY_SITE_SCORE_REFERENCE)],
  };
}

function optionView(result: OptionResult): PowerOptionView {
  const label = OPTION_LABEL[result.option];
  const unstudied = (key: string, name: string): EmobilityFigure => ({ key, label: name, value: `Not available: ${result.reasons.join("; ")}`, status: "not_available", basis: "The option cannot be studied without the feeder's figures." });
  if (result.days === null) {
    return { option: label, energy: "Not available", rainySeason: "Not available", costPerKwh: unstudied("costPerKwh", "Cost per kWh"), costPerSwap: unstudied("costPerSwap", "Cost per swap"), dieselLitres: "Not available", co2Avoided: unstudied("co2", "CO2 avoided"), sizes: "—", payback: unstudied("payback", "Payback against diesel") };
  }
  const average = result.days.average;
  const rainy = result.days.rainy_season;
  const placeholder = result.reasons.includes("placeholder: no EPC quote");
  const cost = (value: number | null, key: string, name: string, unit: (v: number) => string): EmobilityFigure =>
    value === null
      ? { key, label: name, value: "Placeholder: no EPC quote", status: "placeholder", basis: "A solar option's cost is not shown until its installed cost is supplied: its backup's fuel alone would make it look free." }
      : { key, label: name, value: unit(value), status: "calculated", basis: "Fuel and tariff only: diesel at the reported price ÷ the assumed yield, excluding genset O&M and replacement; grid at the feeder's band tariff." };
  const co2: EmobilityFigure =
    average.kgCo2AvoidedPerDay === null
      ? { key: "co2", label: "CO2 avoided against petrol vehicles", value: "Not available: no grid emission factor", status: "not_available", basis: "No cited grid emission factor is held." }
      : { key: "co2", label: "CO2 avoided against petrol vehicles", value: `${whole(average.kgCo2AvoidedPerDay)} kg a day (${two(average.kgCo2AvoidedPerSwap ?? 0)} kg a swap)`, status: "calculated", basis: "Petrol the same distance would burn × 2.31 kg a litre, less the hub's diesel × 2.68 kg a litre (IPCC 2006). Solar counts operating emissions only." };
  const payback: EmobilityFigure =
    result.paybackMonths !== null
      ? { key: "payback", label: "Payback against diesel", value: `${one(result.paybackMonths)} months`, status: "calculated", basis: "Installed cost ÷ the fuel saved a day against diesel only ÷ 30.4." }
      : placeholder
        ? { key: "payback", label: "Payback against diesel", value: "Placeholder: no EPC quote", status: "placeholder", basis: "No payback is shown until the PV and BESS cost is supplied." }
        : { key: "payback", label: "Payback against diesel", value: "No installed cost counted", status: "not_available", basis: "The option's own equipment cost is not in the inputs." };
  const sizes = [result.pvKwp === null ? null : `PV ${one(result.pvKwp)} kWp`, result.bessKwh === null ? null : `BESS ${one(result.bessKwh)} kWh`].filter((part) => part !== null).join(", ");
  return {
    option: label,
    energy: `Solar ${whole(average.solarKwh)}, grid ${whole(average.gridKwh)}, diesel ${whole(average.dieselKwh)} kWh a day`,
    rainySeason: `Solar ${whole(rainy.solarKwh)}, grid ${whole(rainy.gridKwh)}, diesel ${whole(rainy.dieselKwh)} kWh a day`,
    costPerKwh: cost(average.costPerKwh, "costPerKwh", "Cost per kWh, fuel and tariff only", nairaKwh),
    costPerSwap: cost(average.costPerSwap, "costPerSwap", "Cost per swap, fuel and tariff only", (v) => `₦${whole(v)}`),
    dieselLitres: `${whole(average.dieselLitres)} litres a day (${whole(rainy.dieselLitres)} in the rainy season)`,
    co2Avoided: co2,
    sizes: sizes === "" ? "—" : sizes,
    payback,
  };
}

function powerView(studies: HubStudy[]): EmobilityView["power"] {
  const hubs = studies.map((study) => ({
    hubId: study.hub.id,
    hub: study.hub.name,
    energy: `${whole(study.kwhNow)} kWh a day for ${whole(study.swapsNow)} swaps`,
    peakSunHours: `${two(study.hub.solar.annualPeakSunHours)} h a day on average; ${two(study.hub.solar.rainySeasonPeakSunHours)} h in ${study.hub.solar.rainySeasonMonth} (reported: NASA POWER)`,
    options: study.options.map(optionView),
  }));
  const demo = studies.find((study) => study.hub.id === DEMONSTRATION_HUB);
  const diesel = demo?.options.find((option) => option.option === "diesel")?.days?.average.costPerKwh ?? null;
  const grid = demo?.options.find((option) => option.option === "grid_diesel")?.days?.average.costPerKwh ?? null;
  return {
    headline:
      demo === undefined || diesel === null || grid === null
        ? "The demonstration hub's options cannot all be costed."
        : `At the demonstration hub, diesel costs ${nairaKwh(diesel)} in fuel against ${nairaKwh(grid)} on the Band ${demo.band} grid with diesel backup; solar options wait for an EPC quote.`,
    how: "How this is calculated: each hub at its own feeder's band tariff and hours of supply; diesel ₦1,750 a litre (reported) ÷ 3 kWh a litre (assumption), fuel only; PV sized to the average day at the hub's peak sun hours × 0.80, so a rainy-season day leaves a shortfall the backup meets; CO2 avoided against petrol vehicles over the same distance. Synthetic hubs.",
    hubs,
    method: method(EMOBILITY_POWER_SOURCE_REFERENCE),
  };
}

function financeView(studies: HubStudy[], pledges: Awaited<ReturnType<EmobilityRepository["pledges"]>>): EmobilityView["finance"] {
  const fundable = studies.filter((study) => study.hub.status !== "installed" && study.feederId !== null);
  const inputs = fundable.map((study) => ({ id: study.hub.id, feederId: study.feederId!, cost: study.hub.costNaira, swapsPerDay: study.swapsNow }));
  const result = matchHubPledges(
    pledges.map((pledge) => ({ id: pledge.id, kind: pledge.kind, amountNaira: pledge.amountNaira, returnPercent: pledge.returnPercent, tenorMonths: pledge.tenorMonths, feeders: pledge.feeders })),
    inputs,
  );
  const funderOf = new Map(result.matches.map((match) => [match.hubId, match.pledgeId]));
  const pledgeById = new Map(pledges.map((pledge) => [pledge.id, pledge]));
  const names = new Map(studies.map((study) => [study.hub.id, study.hub.name]));
  const placed = Object.values(result.pledges).reduce((sum, row) => sum + row.placed, 0);
  const queued = Object.values(result.pledges).reduce((sum, row) => sum + row.queued, 0);
  const pledged = pledges.reduce((sum, pledge) => sum + pledge.amountNaira, 0);
  return {
    headline: `${formatNaira(placed)} of the ${formatNaira(pledged)} pledged is placed on ${result.matches.length} hubs; ${formatNaira(queued)} is queued.`,
    how: "How this is calculated: each swap's ₦1,000 add-on (reported) goes into escrow; months to repay = the hub's cost repaid from escrow at the funder's return. Pledges are placed lowest return first, then fewer feeders, then id; a pledge funds a hub on a feeder it names, when it has the whole cost left and the hub repays within its tenor. Hub costs are synthetic, only to exercise the matching; they are not investment figures.",
    pledges: pledges.map((pledge) => {
      const row = result.pledges[pledge.id] ?? { placed: 0, queued: pledge.amountNaira, hubs: 0 };
      return {
        id: pledge.id,
        funder: pledge.funder,
        kind: pledge.kind,
        pledged: formatNaira(pledge.amountNaira),
        returnAsked: `${pledge.returnPercent}% a year`,
        tenor: pledge.tenorMonths === null ? "Grant: not repaid" : `${pledge.tenorMonths} months`,
        feeders: pledge.feeders.join(", "),
        hubs: result.matches.filter((match) => match.pledgeId === pledge.id).map((match) => names.get(match.hubId) ?? match.hubId).join(", ") || "None",
        placed: formatNaira(row.placed),
        queued: row.queued > 0 ? `Queued for the next allocation: ${formatNaira(row.queued)}` : "Nothing queued",
        hasQueued: row.queued > 0,
      };
    }),
    hubs: inputs.map((input) => {
      const pledgeId = funderOf.get(input.id);
      const pledge = pledgeId === undefined ? undefined : pledgeById.get(pledgeId);
      const months = pledge === undefined ? null : hubMonthsToRepay(input, pledge.returnPercent / 100);
      return {
        hubId: input.id,
        hub: names.get(input.id) ?? input.id,
        cost: input.cost === null ? { key: "cost", label: "Hub cost", value: "Not available", status: "not_available" as const, basis: "No cost is held for the hub." } : { key: "cost", label: "Hub cost", value: `${formatNaira(input.cost)} (synthetic)`, status: "synthetic" as const, basis: "A synthetic round figure to exercise the matching. Not an investment figure." },
        escrowPerDay: `${formatNaira(escrowPerDay(input.swapsPerDay))} a day`,
        fundedBy: pledge === undefined ? "Waiting" : pledge.funder,
        monthsToRepay: months === null ? "—" : `${one(months)} months at ${pledge!.returnPercent}%`,
      };
    }),
    waiting: result.waiting.map((id) => names.get(id) ?? id),
    method: method(EMOBILITY_SWAP_FINANCE_REFERENCE),
  };
}

function verifyView(studies: HubStudy[], swapDays: Awaited<ReturnType<EmobilityRepository["swapDays"]>>): EmobilityView["verify"] {
  const installed = studies.filter((study) => study.hub.status === "installed");
  const hubs = installed.map((study) => {
    const days = swapDays.filter((day) => day.hubId === study.hub.id);
    const summary = hubAgainstPlan(days, totalSwaps(study.hub.plannedSwapsPerDay), study.kwhNow);
    const share = (value: number | null) => (value === null ? "Not available" : `${Math.round(value * 100)}%`);
    const figures: EmobilityFigure[] =
      summary === null
        ? [{ key: "none", label: "Swaps recorded", value: "Not available: no days recorded", status: "not_available", basis: "The hub has recorded no swaps." }]
        : [
            { key: "swaps", label: "Swaps against plan", value: `${whole(summary.swaps)} of ${whole(summary.plannedSwaps)} planned (${share(summary.swapsShare)})`, status: "synthetic", basis: "Synthetic swap records against the hub's planned swaps a day × days recorded." },
            { key: "energy", label: "Energy charged against plan", value: `${whole(summary.kwhCharged)} of ${whole(summary.plannedKwh)} kWh planned (${share(summary.kwhShare)})`, status: "synthetic", basis: "Synthetic metered kWh against the planned day's kWh × days recorded." },
            { key: "availability", label: "Availability", value: share(summary.availability), status: "synthetic", basis: "Minutes the hub could swap ÷ minutes in the days recorded." },
          ];
    return { hubId: study.hub.id, hub: study.hub.name, installedOn: study.hub.installedOn ?? "Not recorded", days: String(days.length), figures };
  });
  return {
    headline: hubs.length === 0 ? "No hub is installed yet." : `${hubs.length} hub installed, with ${hubs[0].days} days of synthetic swap records; real figures come with a pilot.`,
    how: "How this is calculated: swaps, energy charged and minutes available over the days recorded, against the hub's plan. Synthetic until a pilot.",
    hubs,
    method: method(EMOBILITY_VERIFY_REFERENCE),
  };
}

/** The horizons the planner reports, for a screen's column headings. */
export const EMOBILITY_HORIZONS = HORIZONS;
