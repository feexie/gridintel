import type { IsoTimestamp, KpiBasis, Period, ScopeRef } from "@/domain";
import type { GridIntelRepositories, NetworkRegistrySnapshot, RegistryCoverage } from "../../repositories/ports/index.ts";
import type { CalculatedKpi, CalculationContext, RevenueGap, TopologyIndex } from "../../analytics/index.ts";
import type { ServiceCache } from "../analytics/cache.ts";
import type {
  ChildRow,
  ChildTable,
  Crumb,
  LevelHeader,
  LoadingView,
  LossesView,
  MetricView,
  NetworkLevelView,
  NotAvailableView,
  OverviewView,
  ReliabilityView,
  ReportedComparisonView,
  RevenueGapView,
  ServicePointView,
} from "./views.ts";
import {
  ATCC_REFERENCE,
  ENERGY_REFERENCE,
  LOADING_REFERENCE,
  REVENUE_GAP_REFERENCE,
  SUPPLY_HOURS_REFERENCE,
  billingByAccount,
  compareOnBasis,
  convertUnit,
  feedersOfSubstation,
  isComputed,
  metersWithRole,
  methodologyRef,
  reliabilityOnBasis,
  servicePointsDirectOnFeeder,
  servicePointsOnTransformer,
  servicePointsUnder,
  sumMeterEnergy,
  transformersOnFeeder,
} from "../../analytics/index.ts";
import { registryCurrency } from "../analytics/billing.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { scopeRevenueGap } from "../analytics/revenueGap.ts";
import { assetLoading } from "../analytics/loading.ts";
import { sectionLosses } from "../analytics/losses.ts";
import { scopeReliability } from "../analytics/reliability.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { loadTopology } from "../analytics/topology.ts";
import { figureMetric, inputMetric, inputView, kpiMetric, methodView, registryCount, sourcingView, unavailable } from "./metric.ts";

/* ==========================================================
   SERVICES — OPERATIONS READ MODELS

   One function per drill-down level: region, substation, feeder,
   distribution transformer, service point. Each gathers what the
   level's screen shows by calling the analytics services, and
   returns a view model. Nothing is calculated here.
========================================================== */

/** What the read models need from the composition root. */
export interface OperationsRuntime {
  repos: GridIntelRepositories;
  /** The instant "now" means. */
  now: IsoTimestamp;
  period: Period;
  /** Caveats about the dataset that must travel with particular figures. */
  caveats: { feederLoading?: string; tariffs?: string };
  /** Reuses results for as long as the records do not change; see services/analytics/cache.ts. */
  cache?: ServiceCache;
}

/** One block of a screen, computed once per scope while the cache is valid. */
function block<T>(runtime: OperationsRuntime, name: string, scope: { kind: string; id: string }, compute: () => Promise<T>): Promise<T> {
  return (runtime.cache ?? NO_CACHE).get(`view:${name}|${scope.kind}|${scope.id}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`, compute);
}

export interface Loaded {
  index: TopologyIndex;
  snapshot: NetworkRegistrySnapshot;
  coverage: RegistryCoverage;
}

export const ALARMS: NotAvailableView = {
  title: "Alarms",
  reason:
    "Not available. The platform has no alarm data source yet, so no alarms are shown rather than an invented list. " +
    "Alarms are planned for Phase 6.",
};

const BASIS_LABEL: Record<string, string> = {
  meter_reading: "Billed from meter reading",
  prepaid_vend: "Prepaid vends",
  estimated: "Estimated bills (no meter)",
};

function context(runtime: OperationsRuntime): CalculationContext {
  return { computedAt: runtime.now };
}

function localDate(iso: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(new Date(iso));
}

export function timeZoneOf(snapshot: NetworkRegistrySnapshot): string | undefined {
  return snapshot.organizations[0]?.timezone;
}

/* ---------------- Blocks ---------------- */

const CLASS_WORDS: Record<string, string> = {
  network: "network interruptions",
  upstream_supply: "loss of upstream supply",
  load_management: "load shedding",
  other: "other and unattributed interruptions",
};

/** A basis in words, for the dimensions it states. */
export function describeBasis(basis: KpiBasis | null): string | null {
  if (basis === null) return null;
  const parts: string[] = [];
  if (basis.interruptionClasses !== undefined) {
    const all = basis.interruptionClasses.length === Object.keys(CLASS_WORDS).length;
    parts.push(all ? "all interruptions, whatever their cause" : `${basis.interruptionClasses.map((name) => CLASS_WORDS[name]).join(", ")} only`);
  }
  if (basis.plannedInterruptions !== undefined) parts.push(`planned work ${basis.plannedInterruptions}`);
  if (basis.lossBasis !== undefined) parts.push(basis.lossBasis === "energy_input_gross" ? "fraction of gross energy input" : "fraction of energy input net of transfers out");
  if (basis.collection !== undefined) parts.push(`collection on ${basis.collection === "cash" ? "a cash" : "an accrual"} basis`);
  return parts.length === 0 ? null : parts.join("; ");
}

/**
 * Reported figures beside calculated ones. `candidates` gives, for a
 * reported figure, the calculated figures it could be matched with; the
 * one on the reported figure's own basis is used.
 */
async function reportedComparisons(
  runtime: OperationsRuntime,
  scope: ScopeRef,
  pairs: {
    metric: "atcc" | "collection_efficiency" | "saidi" | "saifi";
    label: string;
    candidates: (basis: KpiBasis | null) => CalculatedKpi[];
  }[],
): Promise<ReportedComparisonView[]> {
  const reported = await runtime.repos.reported.listReportedKpis({ metrics: pairs.map((pair) => pair.metric), scopes: [scope] });
  return pairs.flatMap((pair) =>
    reported.records
      .filter((kpi) => kpi.metric === pair.metric)
      .map((kpi): ReportedComparisonView => {
        const comparison = compareOnBasis(kpi, pair.candidates(kpi.basis));
        const ratio = kpi.unit === "percent" || kpi.unit === "fraction";
        const reportedValue = kpi.unit === "percent" ? convertUnit(kpi.value, "percent", "fraction") : kpi.value;
        return {
          label: pair.label,
          reported: {
            label: `${pair.label} (reported)`,
            value: reportedValue,
            unit: ratio ? "fraction" : kpi.unit === "hours" ? "hours" : "interruptions_per_customer",
            currency: null,
            status: "ok",
            origin: "reported",
            derivation: `As published by ${kpi.source.name}.`,
            method: null,
            inputs: [],
            estimatedInputs: [],
            missingInputs: [],
            warnings: [],
            note: null,
          },
          calculated: kpiMetric(`${pair.label} (calculated)`, comparison.calculated),
          reportedBasis: describeBasis(kpi.basis),
          calculatedBasis: describeBasis(comparison.calculated.basis),
          sameBasis: comparison.sameBasis,
          comparable: comparison.comparable,
          variance: comparison.variance.absolute,
          varianceUnit: comparison.variance.absoluteUnit,
          reasons: comparison.issues.filter((issue) => issue.blocking).map((issue) => issue.message),
          caveats: comparison.issues.filter((issue) => !issue.blocking).map((issue) => issue.message),
          document: kpi.document?.title ?? null,
        };
      }),
  );
}

export function lossesBlock(runtime: OperationsRuntime, scope: ScopeRef): Promise<LossesView> {
  return block(runtime, "losses", scope, () => buildLosses(runtime, scope));
}

async function buildLosses(runtime: OperationsRuntime, scope: ScopeRef): Promise<LossesView> {
  const { result, sourcing } = await sectionLosses({ repos: runtime.repos, scope, period: runtime.period, context: context(runtime), cache: runtime.cache });
  const summed = result.sections.length !== 1 || result.sections[0].kind !== scope.kind || result.sections[0].id !== scope.id;
  const scopeNote = !summed
    ? null
    : result.sections.length === 0
      ? result.technicalLossNote
      : `Summed over ${result.sections.length} electrical section(s): ${result.sections.map((section) => section.id).join(", ")}. ${scope.kind === "organization" ? "An organization" : "A region"} is not an electrical boundary, so its account is the sum of the sections wholly inside it; each connection is counted once.`;
  const { account, atcc, split, decomposition, billing } = result;
  const energy = methodologyRef(ENERGY_REFERENCE);
  const unmetered = account.crossChecks.missingInputs.filter((name) => name.startsWith("service_point meter for")).length;
  const otherMissing = account.crossChecks.missingInputs.length - unmetered;

  const collectionComputed = isComputed(atcc.billingEfficiency.status) && isComputed(atcc.collectionEfficiency.status);
  const collectionPart: MetricView = {
    label: "Collection loss",
    value: decomposition.collection,
    unit: "fraction",
    currency: null,
    status: !collectionComputed
      ? "insufficient_data"
      : atcc.billingEfficiency.status === "ok" && atcc.collectionEfficiency.status === "ok"
        ? "ok"
        : "calculated_with_estimates",
    origin: "calculated",
    derivation: "Billing efficiency × (1 − collection efficiency): the share of energy input that was billed but not paid for. Cash basis.",
    method: methodView(methodologyRef(ATCC_REFERENCE)),
    inputs: [
      { name: "billingEfficiency", value: atcc.billingEfficiency.value, unit: "fraction", origin: "calculated", quality: atcc.billingEfficiency.quality ?? "missing", estimatedShare: null, ref: null },
      { name: "collectionEfficiency", value: atcc.collectionEfficiency.value, unit: "fraction", origin: "calculated", quality: atcc.collectionEfficiency.quality ?? "missing", estimatedShare: null, ref: null },
    ],
    estimatedInputs: atcc.billingEfficiency.estimatedInputs.map((input) => ({ name: input.name, share: input.share })),
    missingInputs: [...atcc.billingEfficiency.missingInputs, ...atcc.collectionEfficiency.missingInputs],
    warnings: [],
    note: null,
  };

  const technicalNote = result.technicalLossStudy
    ? `Estimate from a loss study: ${result.technicalLossStudy.document?.title ?? result.technicalLossStudy.id}. Technical loss is not metered.`
    : result.technicalLossNote;

  return {
    sourcing: sourcingView(sourcing),
    sections: result.sections.map((section) => ({ kind: section.kind as "substation" | "feeder" | "distribution_transformer", id: section.id })),
    scopeNote,
    status: account.status,
    chain: [
      figureMetric("Energy received", account.received, "measured", energy),
      { ...figureMetric("Technical loss", account.technicalLoss, "reported", energy), note: technicalNote },
      figureMetric("Energy delivered", account.delivered, "calculated", energy),
      {
        ...figureMetric("Energy billed", account.energyBilled, "measured", energy),
        derivation: "Sum of the energy on charges raised in the period (meter readings, prepaid vends and estimated bills).",
      },
      {
        ...figureMetric("Unbilled energy", account.unbilled, "derived", energy),
        note: "Residual: delivered − billed. Not measured; inherits the uncertainty of the technical-loss estimate.",
      },
    ],
    crossChecks: {
      status: account.crossChecks.status,
      metrics: [
        figureMetric("Downstream measured", account.downstreamMeasured, "measured", energy),
        figureMetric("Section residual", account.sectionResidual, "calculated", energy),
        figureMetric("Recorded consumption", account.recordedConsumption, "measured", energy),
      ],
      missingCount: account.crossChecks.missingInputs.length,
      note:
        account.crossChecks.missingInputs.length === 0
          ? null
          : [
              unmetered > 0 ? `${unmetered} connection(s) have no meter, so consumption under this section cannot be measured in full.` : "",
              otherMissing > 0 ? `${otherMissing} other meter input(s) are incomplete in the period.` : "",
            ]
              .filter(Boolean)
              .join(" "),
    },
    atcc: kpiMetric("ATC&C", atcc.atcc),
    parts: {
      technical: kpiMetric("Technical loss", split.technicalLoss, { note: "Estimated: from a loss study, not metered." }),
      commercial: kpiMetric("Commercial loss", split.commercialLoss, { note: "Derived residual; inherits the technical-loss estimate." }),
      collection: collectionPart,
    },
    billingEfficiency: kpiMetric("Billing efficiency", atcc.billingEfficiency),
    collectionEfficiency: kpiMetric("Collection efficiency", atcc.collectionEfficiency, { note: "Cash basis: received in the period ÷ billed in the period." }),
    revenueBilled: inputMetric("Revenue billed", billing.revenueBilled, "currency", "Sum of charges raised in the period."),
    revenueCollected: inputMetric("Revenue collected", billing.revenueCollected, "currency", "Sum of payments received in the period (cash basis)."),
    collectionBasis: billing.collectionBasis,
    billingByBasis: (Object.keys(billing.byBasis) as (keyof typeof billing.byBasis)[]).map((basis) => ({
      basis,
      label: BASIS_LABEL[basis],
      records: billing.byBasis[basis].records,
      energyKwh: billing.byBasis[basis].energyKwh,
      amount: billing.byBasis[basis].amount,
    })),
    accounts: { inScope: billing.accountsInScope, billed: billing.accountsBilled },
    reported: await reportedComparisons(runtime, scope, [
      { metric: "atcc", label: "ATC&C", candidates: () => [atcc.atcc] },
      { metric: "collection_efficiency", label: "Collection efficiency", candidates: () => [atcc.collectionEfficiency] },
    ]),
  };
}

const ATTRIBUTION_LABELS = [
  { key: "network", label: "Network", description: "Faults, planned work and weather on the distribution network." },
  { key: "upstream_supply", label: "Upstream supply", description: "Loss of supply from transmission or generation." },
  { key: "load_management", label: "Load shedding", description: "Supply withheld under load management." },
  { key: "other", label: "Other", description: "Customer, third party, or not known." },
] as const;

export function reliabilityBlock(runtime: OperationsRuntime, scope: ScopeRef, timeZone: string | undefined): Promise<ReliabilityView> {
  return block(runtime, `reliability:${timeZone ?? "UTC"}`, scope, () => buildReliability(runtime, scope, timeZone));
}

async function buildReliability(runtime: OperationsRuntime, scope: ScopeRef, timeZone: string | undefined): Promise<ReliabilityView> {
  const { result, sourcing } = await scopeReliability({ repos: runtime.repos, scope, period: runtime.period, context: context(runtime), cache: runtime.cache });
  const { reliability, supply } = result;
  const supplyMethod = methodView(methodologyRef(SUPPLY_HOURS_REFERENCE));
  const supplyStatus = supply.status;
  return {
    sourcing: sourcingView(sourcing),
    saidi: kpiMetric("SAIDI", reliability.saidi),
    saifi: kpiMetric("SAIFI", reliability.saifi),
    caidi: kpiMetric("CAIDI", reliability.caidi),
    asai: kpiMetric("ASAI", reliability.asai),
    customersServed: inputMetric("Customers served", reliability.saidi.inputs.customersServed, "count", "Active accounts connected under the scope, counted from the registry."),
    attribution: ATTRIBUTION_LABELS.map(({ key, label, description }) => {
      const part = reliability.attribution[key];
      return {
        key,
        label,
        description,
        saidiHours: part.saidi === null ? null : convertUnit(part.saidi, reliability.saidi.unit, "hours"),
        saifi: part.saifi,
        share: part.shareOfCustomerMinutes,
      };
    }),
    unattributable: result.unattributable.length,
    excludedForData: reliability.components.excludedForData,
    momentary: reliability.components.momentary.exposures,
    supply: {
      status: supplyStatus,
      averageHours: {
        label: "Hours of supply per day",
        value: supply.averageHours,
        unit: "hours_per_day",
        currency: null,
        status: supplyStatus,
        origin: "calculated",
        derivation: "24 − customer-weighted hours interrupted per day, averaged over the period. Every interruption counts, whatever its cause.",
        method: supplyMethod,
        inputs: [inputView("customersServed", supply.customersServed)],
        estimatedInputs: [],
        missingInputs: supply.missingInputs,
        warnings: supply.warnings.map((warning) => warning.message),
        note: null,
      },
      band: supply.band,
      minimumHours: supply.minimumHours,
      compliantOnAverage: supply.compliantOnAverage,
      daysCompliant: supply.daysCompliant,
      daysNonCompliant: supply.daysNonCompliant,
      days: supply.days.map((day) => ({ date: localDate(day.start, timeZone), hours: day.hoursOfSupply, compliant: day.compliant })),
      note: supply.band === null ? null : supplyMethod.disclaimer,
    },
    reported: await reportedComparisons(runtime, scope, [
      // The total first, then the figure on the classes the reported figure says it counts.
      {
        metric: "saidi",
        label: "SAIDI",
        candidates: (basis) => [
          reliability.saidi,
          ...(basis?.interruptionClasses ? [reliabilityOnBasis(reliability, basis.interruptionClasses).saidi] : []),
        ],
      },
      {
        metric: "saifi",
        label: "SAIFI",
        candidates: (basis) => [
          reliability.saifi,
          ...(basis?.interruptionClasses ? [reliabilityOnBasis(reliability, basis.interruptionClasses).saifi] : []),
        ],
      },
    ]),
  };
}

export function loadingBlock(
  runtime: OperationsRuntime,
  asset: { kind: "distribution_transformer" | "feeder"; id: string },
): Promise<LoadingView | null> {
  return block(runtime, "loading", asset, () => buildLoading(runtime, asset));
}

async function buildLoading(
  runtime: OperationsRuntime,
  asset: { kind: "distribution_transformer" | "feeder"; id: string },
): Promise<LoadingView | null> {
  const { result, sourcing } = await assetLoading({
    repos: runtime.repos,
    asset,
    asOf: runtime.now,
    window: runtime.period,
    context: context(runtime),
    cache: runtime.cache,
  });
  if (result.loading === null) return null;
  const method = methodView(methodologyRef(LOADING_REFERENCE));
  const caveat = asset.kind === "feeder" ? (runtime.caveats.feederLoading ?? null) : null;
  const toMetric = (label: string, loading: NonNullable<typeof result.loading> | null, derivation: string): MetricView => ({
    label,
    value: loading?.loadingFraction ?? null,
    unit: "fraction",
    currency: null,
    status: loading?.status ?? "insufficient_data",
    origin: "calculated",
    derivation,
    method,
    inputs: (loading?.readings ?? []).map((reading) => ({
      name: `${reading.metric}${reading.phase ? ` (${reading.phase})` : ""} at ${reading.observedAt}`,
      value: reading.value,
      unit: reading.metric,
      origin: "measured" as const,
      quality: reading.quality,
      estimatedShare: null,
      ref: null,
    })),
    estimatedInputs: [],
    missingInputs: loading?.missingInputs ?? ["telemetry readings in the period"],
    warnings: (loading?.warnings ?? []).map((warning) => warning.message),
    note: caveat,
  });
  const peak = result.peak;
  return {
    sourcing: sourcingView(sourcing),
    ratedKva: result.loading.ratedCapacityKva,
    asOf: toMetric("Loading now", result.loading, "Latest measured apparent power ÷ rated capacity."),
    asOfTime: runtime.now,
    peak: toMetric(
      "Peak loading",
      peak?.peak ?? null,
      `Highest of the ${peak?.instantsComputed ?? 0} readings in the period. A higher loading between readings would not be seen.`,
    ),
    peakAt: peak?.peak?.asOf ?? null,
    peakKva: peak?.peak?.apparentPowerKva ?? null,
    hoursOverRating: peak === null ? null : peak.instantsOverloaded,
    hoursObserved: peak === null ? null : peak.instantsComputed,
    overloaded: peak?.peak === null || peak === null ? null : peak.instantsOverloaded > 0,
    caveat,
  };
}

/* ---------------- Revenue gap ---------------- */

const GAP_DEFINITION =
  "An estimate of revenue not realised in the period. The commercial part values unbilled energy at the average rate actually " +
  "billed to low-voltage, non-maximum-demand customers where the loss occurs; unbilled energy is a residual that depends on a " +
  "technical-loss study. It is not an amount owed by anyone, and it does not say why the energy went unbilled.";

function gapView(runtime: OperationsRuntime, loaded: Loaded, gap: RevenueGap, sourcing: Parameters<typeof sourcingView>[0]): RevenueGapView {
  const method = methodView(methodologyRef(REVENUE_GAP_REFERENCE));
  const name = (kind: string, id: string): string =>
    (kind === "distribution_transformer"
      ? loaded.index.transformerById.get(id)?.name
      : kind === "feeder"
        ? loaded.index.feederById.get(id)?.name
        : kind === "substation"
          ? loaded.index.substationById.get(id)?.name
          : loaded.index.regionById.get(id)?.name) ?? id;
  const base = { unit: "currency" as const, currency: gap.currency, method, inputs: [], warnings: [] as string[] };
  const negative = gap.negativeParts.length > 0;
  return {
    sourcing: sourcingView(sourcing),
    status: gap.status,
    currency: gap.currency,
    commercial: {
      ...base,
      label: "Commercial gap",
      value: gap.commercial.amount,
      status: gap.commercial.status,
      origin: "derived",
      derivation:
        "Unbilled energy valued at the low-voltage, non-MD average billed rate of the transformer where it occurs, summed upward; each level's own residual at that level's low-voltage average. Medium-voltage and maximum-demand accounts are in no rate.",
      estimatedInputs: gap.estimatedInputs.map((input) => ({ name: input.name, share: input.share })),
      missingInputs: gap.missingInputs.filter((input) => !input.startsWith("revenue")),
      warnings: gap.warnings.filter((warning) => warning.code !== "COLLECTION_EXCEEDS_BILLED").map((warning) => warning.message),
      note: "Derived from unbilled energy, which is a residual; inherits the technical-loss estimate.",
    },
    collection: {
      ...base,
      label: "Collection gap",
      value: gap.collection.amount,
      status: gap.collection.status,
      origin: "calculated",
      derivation: `Revenue billed less revenue collected in the period${gap.collection.basis ? `, ${gap.collection.basis} basis` : ""}. Negative in a period of arrears recovery.`,
      estimatedInputs: [],
      missingInputs: gap.missingInputs.filter((input) => input.startsWith("revenue")),
      note: gap.collection.basis === "cash" ? "Cash basis." : null,
    },
    notRealised: {
      ...base,
      label: "Revenue not realised",
      value: gap.notRealised,
      status: gap.status,
      origin: "derived",
      derivation: "Commercial gap plus collection gap, counting only the parts that are positive. A negative part is never set against the other.",
      estimatedInputs: gap.estimatedInputs.map((input) => ({ name: input.name, share: input.share })),
      missingInputs: gap.missingInputs,
      note: "Estimate. Monthly figure for the reporting period; not annualised.",
    },
    definition: GAP_DEFINITION,
    periodNote: "For the reporting period only. Not annualised.",
    negativeNote: negative
      ? `The ${gap.negativeParts.join(" and ")} gap is negative. It is shown as it is and is not set against the other part.`
      : null,
    caveat: runtime.caveats.tariffs ?? null,
    // A residual within rounding is nothing; it is left out of the breakdown shown.
    parts: gap.commercial.parts
      .filter((part) => part.kind === "section" || part.amount !== 0)
      .map((part) => ({
      scope: { kind: part.scope.kind as "substation" | "feeder" | "distribution_transformer" | "region", id: part.scope.id, name: name(part.scope.kind, part.scope.id) },
      kind: part.kind,
      energyKwh: part.energyKwh,
        ratePerKwh: part.ratePerKwh,
        amount: part.amount,
      })),
  };
}

export function revenueGapBlock(runtime: OperationsRuntime, loaded: Loaded, scope: ScopeRef): Promise<RevenueGapView> {
  return block(runtime, "revenue-gap", scope, async () => {
    const { result, sourcing } = await scopeRevenueGap({ repos: runtime.repos, scope, period: runtime.period, context: context(runtime), cache: runtime.cache });
    return gapView(runtime, loaded, result, sourcing);
  });
}

/* ---------------- Headers and crumbs ---------------- */

function crumbsFor(loaded: Loaded, kind: Crumb["kind"], id: string): Crumb[] {
  const { index } = loaded;
  const crumbs: Crumb[] = [];
  let regionId: string | null = null;
  let substationId: string | undefined;
  let feederId: string | undefined;
  let transformerId: string | undefined;

  if (kind === "service_point") {
    const sp = index.servicePointById.get(id);
    if (sp?.supply.kind === "feeder") feederId = sp.supply.feederId;
    else if (sp) transformerId = sp.supply.transformerId;
  }
  if (kind === "distribution_transformer") transformerId = id;
  if (transformerId) feederId = index.transformerById.get(transformerId)?.feederId;
  if (kind === "feeder") feederId = id;
  if (feederId) substationId = index.feederById.get(feederId)?.origin.substationId;
  if (kind === "substation") substationId = id;
  if (substationId) regionId = index.substationById.get(substationId)?.adminRegionId ?? null;
  if (kind === "region") regionId = id;

  const region = regionId === null ? undefined : index.regionById.get(regionId);
  if (region) crumbs.push({ kind: "region", id: region.id, label: region.name });
  const substation = substationId ? index.substationById.get(substationId) : undefined;
  if (substation) crumbs.push({ kind: "substation", id: substation.id, label: substation.name });
  const feeder = feederId ? index.feederById.get(feederId) : undefined;
  if (feeder) crumbs.push({ kind: "feeder", id: feeder.id, label: feeder.name });
  const transformer = transformerId ? index.transformerById.get(transformerId) : undefined;
  if (transformer) crumbs.push({ kind: "distribution_transformer", id: transformer.id, label: transformer.name });
  if (kind === "service_point") crumbs.push({ kind: "service_point", id, label: id });
  return crumbs;
}

function header(
  runtime: OperationsRuntime,
  loaded: Loaded,
  kind: LevelHeader["kind"],
  id: string,
  title: string,
  subtitle: string,
  facts: LevelHeader["facts"],
  location: LevelHeader["location"] = null,
): LevelHeader {
  return {
    kind,
    id,
    title,
    subtitle,
    crumbs: crumbsFor(loaded, kind, id),
    facts,
    period: runtime.period,
    asOf: runtime.now,
    location,
  };
}

function activeAccountsUnder(loaded: Loaded, scope: ScopeRef): number | null {
  if (loaded.coverage.customers !== "complete") return null;
  const points = new Set((servicePointsUnder(loaded.index, scope).value ?? []).map((sp) => sp.id));
  return loaded.snapshot.customers.filter(
    (customer) => customer.accountStatus === "active" && customer.servicePointId !== undefined && points.has(customer.servicePointId),
  ).length;
}

export async function loadRegistry(runtime: OperationsRuntime): Promise<Loaded> {
  const { index, snapshot, coverage } = await loadTopology(runtime.repos.registry, runtime.now, runtime.cache);
  return { index, snapshot, coverage };
}

function count(value: number | null): string {
  return value === null ? "not known" : String(value);
}

/* ---------------- Levels ---------------- */

export async function overviewView(runtime: OperationsRuntime): Promise<OverviewView> {
  const loaded = await loadRegistry(runtime);
  const rows: ChildRow[] = [];
  for (const region of loaded.snapshot.regions) {
    const scope: ScopeRef = { kind: "region", id: region.id };
    const reliability = await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot));
    const substations = loaded.snapshot.substations.filter((ss) => ss.adminRegionId === region.id);
    rows.push({
      kind: "region",
      id: region.id,
      name: region.name,
      facts: [`${substations.length} substation(s) in registry`],
      cells: {
        customers: registryCount("Active accounts", activeAccountsUnder(loaded, scope)),
        saidi: reliability.saidi,
        saifi: reliability.saifi,
        supply: reliability.supply.averageHours,
      },
    });
  }
  return {
    asOf: runtime.now,
    period: runtime.period,
    organization: loaded.snapshot.organizations[0]?.name ?? null,
    regions: {
      title: "Regions",
      coverage: loaded.coverage.regions,
      columns: [
        { key: "customers", label: "Active accounts" },
        { key: "saidi", label: "SAIDI" },
        { key: "saifi", label: "SAIFI" },
        { key: "supply", label: "Supply h/day" },
      ],
      rows,
    },
    alarms: ALARMS,
  };
}

async function sectionRow(
  runtime: OperationsRuntime,
  loaded: Loaded,
  kind: "substation" | "feeder" | "distribution_transformer",
  id: string,
  name: string,
  facts: string[],
): Promise<ChildRow> {
  const scope: ScopeRef = { kind, id };
  const losses = await lossesBlock(runtime, scope);
  const reliability = await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot));
  const loading = kind === "substation" ? null : await loadingBlock(runtime, { kind, id });
  return {
    kind,
    id,
    name,
    facts,
    cells: {
      customers: reliability.customersServed,
      atcc: losses.atcc,
      commercial: losses.parts.commercial,
      collection: losses.collectionEfficiency,
      saidi: reliability.saidi,
      supply: reliability.supply.averageHours,
      ...(loading ? { peak: loading.peak } : {}),
    },
  };
}

const SECTION_COLUMNS = [
  { key: "customers", label: "Customers" },
  { key: "atcc", label: "ATC&C" },
  { key: "commercial", label: "Commercial loss" },
  { key: "collection", label: "Collection eff." },
  { key: "saidi", label: "SAIDI" },
  { key: "supply", label: "Supply h/day" },
];

export async function regionView(runtime: OperationsRuntime, regionId: string): Promise<NetworkLevelView | null> {
  const loaded = await loadRegistry(runtime);
  const region = loaded.index.regionById.get(regionId);
  if (!region) return null;
  const scope: ScopeRef = { kind: "region", id: regionId };
  const substations = loaded.snapshot.substations.filter((ss) => ss.adminRegionId === regionId);
  const organization = loaded.snapshot.organizations.find((org) => org.id === region.organizationId);

  const losses = await lossesBlock(runtime, scope);

  const rows: ChildRow[] = [];
  for (const ss of substations) {
    rows.push(
      await sectionRow(runtime, loaded, "substation", ss.id, ss.name, [
        `${ss.primaryVoltageKv ?? "?"}/${ss.secondaryVoltageKv ?? "?"} kV`,
        `${feedersOfSubstation(loaded.index, ss.id).length} feeders`,
      ]),
    );
  }

  return {
    header: header(runtime, loaded, "region", regionId, region.name, organization?.name ?? "Region", [
      { label: "Substations", value: String(substations.length) },
      { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
      { label: "Registry coverage", value: loaded.coverage.substations },
    ]),
    losses,
    lossesNote: null,
    reliability: await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)),
    loading: null,
    children: [{ title: "Substations", coverage: loaded.coverage.substations, columns: SECTION_COLUMNS, rows }],
    alarms: ALARMS,
  };
}

export async function substationView(runtime: OperationsRuntime, substationId: string): Promise<NetworkLevelView | null> {
  const loaded = await loadRegistry(runtime);
  const substation = loaded.index.substationById.get(substationId);
  if (!substation) return null;
  const scope: ScopeRef = { kind: "substation", id: substationId };
  const feeders = feedersOfSubstation(loaded.index, substationId);
  const powerTransformers = loaded.snapshot.powerTransformers.filter((pt) => pt.substationId === substationId);

  const rows: ChildRow[] = [];
  for (const feeder of feeders) {
    rows.push(
      await sectionRow(runtime, loaded, "feeder", feeder.id, feeder.name, [
        feeder.serviceBand ? `Band ${feeder.serviceBand}` : "No band recorded",
        `${feeder.nominalVoltageKv} kV`,
      ]),
    );
  }

  return {
    header: header(
      runtime,
      loaded,
      "substation",
      substationId,
      substation.name,
      `${substation.kind} substation`,
      [
        { label: "Voltage", value: `${substation.primaryVoltageKv ?? "?"}/${substation.secondaryVoltageKv ?? "?"} kV` },
        {
          label: "Power transformers",
          value:
            loaded.coverage.powerTransformers === "not_available"
              ? "not in registry"
              : powerTransformers.map((pt) => `${pt.name} ${pt.ratingMva} MVA`).join(", ") || "none",
        },
        { label: "Feeders", value: String(feeders.length) },
        { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
      ],
      substation.location ?? null,
    ),
    losses: await lossesBlock(runtime, scope),
    lossesNote: null,
    reliability: await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)),
    loading: null,
    children: [
      {
        title: "Feeders",
        coverage: loaded.coverage.feeders,
        columns: [...SECTION_COLUMNS, { key: "peak", label: "Peak loading" }],
        rows,
      },
    ],
    alarms: ALARMS,
  };
}

export async function feederView(runtime: OperationsRuntime, feederId: string): Promise<NetworkLevelView | null> {
  const loaded = await loadRegistry(runtime);
  const feeder = loaded.index.feederById.get(feederId);
  if (!feeder) return null;
  const scope: ScopeRef = { kind: "feeder", id: feederId };
  const transformers = transformersOnFeeder(loaded.index, feederId);
  const direct = servicePointsDirectOnFeeder(loaded.index, feederId);

  const rows: ChildRow[] = [];
  for (const dt of transformers) {
    rows.push(
      await sectionRow(runtime, loaded, "distribution_transformer", dt.id, dt.name, [
        `${dt.ratingKva} kVA`,
        `${servicePointsOnTransformer(loaded.index, dt.id).length} connections`,
      ]),
    );
  }
  const children: ChildTable[] = [
    {
      title: "Distribution transformers",
      coverage: loaded.coverage.distributionTransformers,
      columns: [...SECTION_COLUMNS, { key: "peak", label: "Peak loading" }],
      rows,
    },
  ];
  if (direct.length > 0) {
    children.push(await servicePointTable(runtime, loaded, "Connections supplied directly at 11 kV", direct.map((sp) => sp.id)));
  }

  return {
    header: header(runtime, loaded, "feeder", feederId, feeder.name, `${feeder.nominalVoltageKv} kV feeder`, [
      { label: "NERC service band", value: feeder.serviceBand ? `Band ${feeder.serviceBand}` : "not recorded" },
      { label: "Rated current", value: feeder.ratedCurrentA === undefined ? "not recorded" : `${feeder.ratedCurrentA} A` },
      { label: "Transformers", value: String(transformers.length) },
      { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
    ]),
    losses: await lossesBlock(runtime, scope),
    lossesNote: null,
    reliability: await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)),
    loading: await loadingBlock(runtime, { kind: "feeder", id: feederId }),
    children,
    alarms: ALARMS,
  };
}

async function servicePointTable(runtime: OperationsRuntime, loaded: Loaded, title: string, servicePointIds: string[]): Promise<ChildTable> {
  const { index, snapshot } = loaded;
  const meters = servicePointIds.flatMap((id) => metersWithRole(index, "service_point", id));
  const [intervals, charges, payments] = await Promise.all([
    runtime.repos.observations.listIntervalEnergy({ meterIds: meters.map((meter) => meter.id), period: runtime.period }),
    runtime.repos.billing.listBillingRecords({ period: runtime.period }),
    runtime.repos.billing.listPayments({ period: runtime.period }),
  ]);
  const byMeter = new Map<string, typeof intervals.records>();
  for (const interval of intervals.records) byMeter.set(interval.meterId, [...(byMeter.get(interval.meterId) ?? []), interval]);
  const currency = registryCurrency(snapshot);
  const billing =
    currency === null || charges.completeness === "not_available"
      ? null
      : billingByAccount({ period: runtime.period, billingRecords: charges.records, payments: payments.records, currency });
  const energy = methodologyRef(ENERGY_REFERENCE);

  const rows = servicePointIds.map((id): ChildRow => {
    const customer = snapshot.customers.find((c) => c.servicePointId === id && c.accountStatus !== "closed");
    const meter = metersWithRole(index, "service_point", id)[0];
    const account = customer && billing ? billing.get(customer.id) : undefined;
    const metering = meter ? (customer?.paymentMode ?? "metered") : "unmetered";

    let recorded: MetricView;
    if (!meter) {
      recorded = unavailable("Energy recorded", "kWh", "No meter at this connection; consumption is not measured.");
    } else {
      const total = sumMeterEnergy(meter, byMeter.get(meter.id) ?? [], runtime.period);
      recorded = {
        label: "Energy recorded",
        value: total.importKwh,
        unit: "kWh",
        currency: null,
        status: total.importKwh === null ? "insufficient_data" : total.quality === "estimated" || total.quality === "substituted" ? "calculated_with_estimates" : "ok",
        origin: "measured",
        derivation: `Sum of ${total.usableIntervals} of ${total.expectedIntervals ?? "?"} intervals from meter ${meter.id}.`,
        method: methodView(energy),
        inputs: [],
        estimatedInputs: [],
        missingInputs: total.missingInputs,
        warnings: total.warnings.map((warning) => warning.message),
        note: null,
      };
    }

    const billed = (label: string, value: number | null, unit: "kWh" | "currency", derivation: string): MetricView => {
      if (billing === null) return unavailable(label, unit, "No billing records are available.");
      return {
        label,
        // With billing records available, an account with no charge in the period has a real zero.
        value: account ? value : 0,
        unit,
        currency: unit === "currency" ? currency : null,
        status: account && value === null ? "insufficient_data" : unit === "kWh" && account?.estimated ? "calculated_with_estimates" : "ok",
        origin: unit === "kWh" && account?.estimated ? "estimated" : "measured",
        derivation,
        method: null,
        inputs: [],
        estimatedInputs: unit === "kWh" && account?.estimated ? [{ name: label, share: 1 }] : [],
        missingInputs: [],
        warnings: [],
        note: unit === "kWh" && account?.estimated ? "Estimated bill: there is no meter reading behind it." : null,
      };
    };

    return {
      kind: "service_point",
      id,
      name: id,
      facts: [customer?.category ?? "no account", metering, customer?.accountStatus ?? ""].filter(Boolean),
      cells: {
        recorded,
        billedEnergy: billed("Energy billed", account?.energyBilledKwh ?? null, "kWh", "Sum of the energy on this account's charges in the period."),
        billedAmount: billed("Billed", account?.amountBilled ?? null, "currency", "Sum of this account's charges in the period."),
        paid: billed("Paid", account?.amountPaid ?? null, "currency", "Sum of payments received from this account in the period (cash basis)."),
      },
    };
  });

  return {
    title,
    coverage: loaded.coverage.servicePoints,
    columns: [
      { key: "recorded", label: "Recorded kWh" },
      { key: "billedEnergy", label: "Billed kWh" },
      { key: "billedAmount", label: "Billed" },
      { key: "paid", label: "Paid (cash basis)" },
    ],
    rows,
  };
}

export async function transformerView(runtime: OperationsRuntime, transformerId: string): Promise<NetworkLevelView | null> {
  const loaded = await loadRegistry(runtime);
  const dt = loaded.index.transformerById.get(transformerId);
  if (!dt) return null;
  const scope: ScopeRef = { kind: "distribution_transformer", id: transformerId };
  const points = servicePointsOnTransformer(loaded.index, transformerId);
  const metered = points.filter((sp) => metersWithRole(loaded.index, "service_point", sp.id).length > 0).length;

  return {
    header: header(
      runtime,
      loaded,
      "distribution_transformer",
      transformerId,
      dt.name,
      "Distribution transformer",
      [
        { label: "Rating", value: `${dt.ratingKva} kVA` },
        { label: "Voltage", value: `${dt.primaryVoltageKv ?? "?"}/${dt.secondaryVoltageKv ?? "?"} kV` },
        { label: "Connections", value: `${points.length} (${metered} metered, ${points.length - metered} unmetered)` },
        { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
      ],
      dt.location ?? null,
    ),
    losses: await lossesBlock(runtime, scope),
    lossesNote: null,
    reliability: await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)),
    loading: await loadingBlock(runtime, { kind: "distribution_transformer", id: transformerId }),
    children: [await servicePointTable(runtime, loaded, "Service points", points.map((sp) => sp.id))],
    alarms: ALARMS,
  };
}

export async function servicePointView(runtime: OperationsRuntime, servicePointId: string): Promise<ServicePointView | null> {
  const loaded = await loadRegistry(runtime);
  const { index, snapshot } = loaded;
  const sp = index.servicePointById.get(servicePointId);
  if (!sp) return null;
  const trail = new SourceTrail().add([sp]);
  const customer = snapshot.customers.find((c) => c.servicePointId === servicePointId && c.accountStatus !== "closed");
  const meter = metersWithRole(index, "service_point", servicePointId)[0];
  const table = await servicePointTable(runtime, loaded, "", [servicePointId]);
  const recorded = table.rows[0].cells.recorded;

  let intervals = { expected: null as number | null, usable: 0, coverage: null as number | null };
  if (meter) {
    trail.add([meter]);
    const records = await runtime.repos.observations.listIntervalEnergy({ meterIds: [meter.id], period: runtime.period });
    trail.add(records.records);
    const total = sumMeterEnergy(meter, records.records, runtime.period);
    intervals = { expected: total.expectedIntervals, usable: total.usableIntervals, coverage: total.coverage };
  }

  const [charges, payments] = await Promise.all([
    runtime.repos.billing.listBillingRecords({ period: runtime.period }),
    runtime.repos.billing.listPayments({ period: runtime.period }),
  ]);
  const ownCharges = customer ? charges.records.filter((record) => record.customerId === customer.id) : [];
  const ownPayments = customer ? payments.records.filter((payment) => payment.customerId === customer.id) : [];
  trail.add(ownCharges).add(ownPayments);
  if (customer) trail.add([customer]);

  const supply = sp.supply.kind === "feeder" ? "its feeder" : "its transformer";
  return {
    header: header(
      runtime,
      loaded,
      "service_point",
      servicePointId,
      servicePointId,
      sp.supply.kind === "feeder" ? "Service point supplied at 11 kV" : "Service point",
      [
        { label: "Account", value: customer ? `${customer.category ?? "uncategorised"}, ${customer.accountStatus}` : "none" },
        { label: "Metering", value: meter ? `${customer?.paymentMode ?? "metered"} (meter ${meter.id})` : "unmetered" },
      ],
      sp.location ?? null,
    ),
    sourcing: sourcingView(await trail.resolve(runtime.repos.sources)),
    account: customer
      ? {
          id: customer.id,
          accountNumber: customer.accountNumber ?? null,
          category: customer.category ?? null,
          paymentMode: customer.paymentMode ?? null,
          status: customer.accountStatus,
        }
      : null,
    metering: meter ? (customer?.paymentMode ?? "metered") : "unmetered",
    meter: meter ? { id: meter.id, serialNumber: meter.serialNumber, type: meter.meterType, phases: meter.phases ?? null } : null,
    recorded,
    intervals,
    charges: ownCharges
      .map((record) => ({
        id: record.id,
        billedAt: record.billedAt,
        basis: record.basis,
        basisLabel: BASIS_LABEL[record.basis],
        energyKwh: record.energyKwh,
        amount: record.amount.amountMinor / 100,
        currency: record.amount.currency,
        tariff: record.tariffCode ?? null,
        estimated: record.basis === "estimated",
      }))
      .sort((a, b) => (a.billedAt < b.billedAt ? -1 : 1)),
    payments: ownPayments
      .map((payment) => ({
        id: payment.id,
        receivedAt: payment.receivedAt,
        amount: payment.amount.amountMinor / 100,
        currency: payment.amount.currency,
        channel: payment.channel ?? null,
      }))
      .sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1)),
    collectionBasis: "cash",
    reliabilityNote: `Interruptions are recorded per transformer, not per service point. See ${supply} for reliability and hours of supply.`,
  };
}
