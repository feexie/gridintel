import type { IntervalEnergy, IsoTimestamp, KpiBasis, Meter, Period, ScopeRef, TelemetryPoint } from "@/domain";
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
  RuleFindingView,
  RevenueGapRow,
  RevenueGapView,
  ServicePointView,
} from "./views.ts";
import {
  ATCC_REFERENCE,
  ENERGY_REFERENCE,
  calculateCollectionEfficiency,
  LOADING_REFERENCE,
  RELIABILITY_REFERENCE,
  REVENUE_GAP_REFERENCE,
  SUPPLY_HOURS_REFERENCE,
  attributionRuleDifference,
  billingByAccount,
  compareOnBasis,
  convertUnit,
  feedersOfSubstation,
  isComputed,
  metersWithRole,
  methodologyRef,
  registerAdvance,
  registerConsumption,
  registerReadingSpan,
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

const CLASS_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  government: "Government (MDA)",
  public: "Public services",
  special: "Special",
  not_recorded: "Class not recorded",
};

const BASIS_LABEL: Record<string, string> = {
  meter_reading: "Billed from meter reading",
  prepaid_vend: "Prepaid vends",
  estimated: "Estimated bills (no meter, or meter not read)",
};

const REGISTER_WINDOW_DAYS = ENERGY_REFERENCE.parameters.registerReadingWindowDays;

const REGISTER_RULE =
  `A register advance counts when its opening reading is within ${REGISTER_WINDOW_DAYS} days of the start of the period and its closing reading within ` +
  `${REGISTER_WINDOW_DAYS} days of the end. It is taken as read and never pro-rated to the period. An advance outside that window, or resting on an estimated ` +
  "reading, is not counted.";

/** Why register advances were left out, in the words shown on screen. */
const EXCLUSION_WORDS: Record<string, string> = {
  estimated_reading: "a reading was estimated, not read from the meter",
  opening_outside_window: `no reading within ${REGISTER_WINDOW_DAYS} days of the start of the period`,
  closing_outside_window: `no reading within ${REGISTER_WINDOW_DAYS} days of the end of the period`,
  one_reading: "only one reading is held near the period",
  register_went_backwards: "the register reads lower at the closing reading than at the opening one",
  invalid_period: "the period is not valid",
};

const PURCHASED_NOTE =
  "Energy bought in the period, not energy used in it: credit is carried from one month to the next. It is not consumption and is never added to recorded consumption.";

/** A meter type in the words shown on screen. */
const METER_KIND: Record<Meter["meterType"], string> = {
  smart: "AMI meter",
  amr: "remotely read meter",
  conventional: "conventional meter",
  unspecified: "meter",
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

const ORIGIN_WORDS: Record<string, string> = {
  grid: "the grid",
  transmission_station: "transmission stations",
  subtransmission_line: "sub-transmission lines",
  mv_feeder: "distribution feeders",
  distribution_transformer: "distribution transformers",
  lv_network: "the low-voltage network",
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
  if (basis.upstreamOrigins !== undefined) {
    // Always in the same order, from the grid down, however the source lists them.
    const origins = Object.keys(ORIGIN_WORDS).filter((origin) => (basis.upstreamOrigins as readonly string[]).includes(origin));
    parts.push(`treating as upstream: ${origins.map((origin) => ORIGIN_WORDS[origin]).join(", ") || "nothing"}`);
  }
  if (basis.lossBasis !== undefined) parts.push(basis.lossBasis === "energy_input_gross" ? "fraction of gross energy input" : "fraction of energy input net of transfers out");
  if (basis.collection !== undefined) parts.push(`collection on ${basis.collection === "cash" ? "a cash" : "an accrual"} basis`);
  return parts.length === 0 ? null : parts.join("; ");
}

function scopeName(loaded: Loaded, scope: ScopeRef): string {
  const { index, snapshot } = loaded;
  return (
    (scope.kind === "distribution_transformer"
      ? index.transformerById.get(scope.id)?.name
      : scope.kind === "feeder"
        ? index.feederById.get(scope.id)?.name
        : scope.kind === "substation"
          ? index.substationById.get(scope.id)?.name
          : scope.kind === "region"
            ? index.regionById.get(scope.id)?.name
            : snapshot.organizations.find((organization) => organization.id === scope.id)?.name) ?? scope.id
  );
}

const originList = (origins: readonly string[]): string => origins.map((origin) => ORIGIN_WORDS[origin]).join(" and ");

/**
 * What a reported attribution rule changes, as a finding (ADR 0007, second amendment): the same
 * figure on the reference rule less the figure on the reported rule. The difference is
 * calculated by analytics; this only puts it into view-model form and words.
 */
function ruleFinding(
  loaded: Loaded,
  scope: ScopeRef,
  figure: string,
  document: string | null,
  onReportedRule: CalculatedKpi,
  onReferenceRule: CalculatedKpi,
): RuleFindingView | null {
  const found = attributionRuleDifference(onReportedRule, onReferenceRule);
  if (found === null) return null;
  const hours = found.unit === "minutes" || found.unit === "hours";
  const reported = kpiMetric(`${figure} on the report's rule`, found.onReportedRule);
  const reference = kpiMetric(`${figure} on the reference rule`, found.onReferenceRule);
  const parts = [
    found.upstreamOnlyOnReportedRule.length > 0 ? `treats ${originList(found.upstreamOnlyOnReportedRule)} as upstream` : "",
    found.upstreamOnlyOnReferenceRule.length > 0 ? `does not treat ${originList(found.upstreamOnlyOnReferenceRule)} as upstream` : "",
  ].filter(Boolean);
  return {
    figure,
    statedFor: { kind: scope.kind as RuleFindingView["statedFor"]["kind"], id: scope.id, name: scopeName(loaded, scope) },
    statement: `Rule ${parts.join(" and ")}`,
    difference: {
      label: `${figure} under the reference rule, less ${figure} under the report's rule`,
      value: found.difference === null ? null : hours ? convertUnit(found.difference, found.unit, "hours") : found.difference,
      unit: hours ? "hours" : "interruptions_per_customer",
      currency: null,
      status:
        found.difference === null
          ? "insufficient_data"
          : reported.status === "calculated_with_estimates" || reference.status === "calculated_with_estimates"
            ? "calculated_with_estimates"
            : "ok",
      origin: "calculated",
      derivation:
        "The figure on the GridIntel reference rule less the same figure on the rule the report states. The interruptions, the classes " +
        "counted and the customers served are the same in both; only the rule that puts an interruption in a class differs.",
      method: methodView(methodologyRef(RELIABILITY_REFERENCE)),
      inputs: [
        { name: reference.label, value: reference.value, unit: reference.unit, origin: "calculated", quality: found.onReferenceRule.quality ?? "missing", estimatedShare: null, ref: found.onReferenceRule.methodology.id },
        { name: reported.label, value: reported.value, unit: reported.unit, origin: "calculated", quality: found.onReportedRule.quality ?? "missing", estimatedShare: null, ref: found.onReportedRule.methodology.id },
      ],
      estimatedInputs: [],
      missingInputs: [...new Set([...found.onReferenceRule.missingInputs, ...found.onReportedRule.missingInputs])],
      warnings: [],
      note: null,
    },
    onReportedRule: reported,
    onReferenceRule: reference,
    document,
  };
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
    candidates: (basis: KpiBasis | null) => CalculatedKpi[] | Promise<CalculatedKpi[]>;
    /** The same figure on the reference attribution rule, for a reliability figure; null when there is none on the reported basis. */
    onReferenceRule?: (basis: KpiBasis | null) => CalculatedKpi | null;
  }[],
): Promise<ReportedComparisonView[]> {
  const loaded = await loadRegistry(runtime);
  const reported = await runtime.repos.reported.listReportedKpis({ metrics: pairs.map((pair) => pair.metric), scopes: [scope] });
  const rows: ReportedComparisonView[] = [];
  for (const pair of pairs) {
    for (const kpi of reported.records.filter((record) => record.metric === pair.metric)) {
      const comparison = compareOnBasis(kpi, await pair.candidates(kpi.basis));
      const reference = pair.onReferenceRule?.(kpi.basis) ?? null;
      rows.push(
        ((): ReportedComparisonView => {
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
          // A finding only where the comparison was in fact made on the reported rule.
          ruleFinding:
            reference === null || !comparison.sameBasis
              ? null
              : ruleFinding(loaded, scope, pair.label, kpi.document?.title ?? null, comparison.calculated, reference),
          document: kpi.document?.title ?? null,
        };
        })(),
      );
    }
  }
  return rows;
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
  const coverage = account.consumptionCoverage;
  // Boundary meters below the section (feeder heads, totalizers) that gave no total.
  const boundaryMissing = account.boundary.downstream.requirements.filter((req) => req.role !== "service_point" && req.netKwh === null).length;
  const sourceMetric = (label: string, figure: typeof account.recordedBySource.intervals, connections: number, none: string): MetricView =>
    connections === 0 && figure.status !== "not_computable"
      ? unavailable(label, "kWh", none)
      : { ...figureMetric(label, figure, "measured", energy), note: `Covers ${connections} of ${coverage.servicePoints} connection(s). It is not the consumption of the whole scope.` };
  const vends = billing.byBasis.prepaid_vend;
  const energyPurchased: MetricView =
    billing.accountsInScope === null
      ? unavailable("Energy purchased (prepaid vends)", "kWh", "No billing records are available.")
      : {
          label: "Energy purchased (prepaid vends)",
          value: vends.energyKwh,
          unit: "kWh",
          currency: null,
          status: vends.energyKwh === null ? "insufficient_data" : "ok",
          origin: "measured",
          derivation: `Sum of the energy on ${vends.records} prepaid vend(s) raised in the period.`,
          method: null,
          inputs: [],
          estimatedInputs: [],
          missingInputs: vends.energyKwh === null ? ["energy on every prepaid vend"] : [],
          warnings: [],
          note: PURCHASED_NOTE,
        };

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
              `The total needs a measured figure from every connection. Of ${coverage.servicePoints} connection(s): ` +
                [
                  `${coverage.byIntervals} with interval data for the whole period`,
                  `${coverage.byRegister} with a register advance that counts`,
                  coverage.registerExcluded > 0 ? `${coverage.registerExcluded} with a register advance that does not count` : "",
                  coverage.notRead > 0 ? `${coverage.notRead} with a meter that is not read (no interval data and no register reading is held)` : "",
                  coverage.unmetered > 0 ? `${coverage.unmetered} with no meter` : "",
                  coverage.intervalsIncomplete > 0 ? `${coverage.intervalsIncomplete} with intervals missing in the period` : "",
                ]
                  .filter(Boolean)
                  .join("; ") +
                ".",
              boundaryMissing > 0 ? `${boundaryMissing} boundary meter input(s) below this section are incomplete in the period.` : "",
              "What is not measured is not known, and is not taken as zero.",
            ]
              .filter(Boolean)
              .join(" "),
      coverage: {
        servicePoints: coverage.servicePoints,
        byIntervals: coverage.byIntervals,
        intervalsIncomplete: coverage.intervalsIncomplete,
        byRegister: coverage.byRegister,
        registerExcluded: coverage.registerExcluded,
        notRead: coverage.notRead,
        unmetered: coverage.unmetered,
      },
      sources: [
        {
          key: "intervals",
          label: "Interval meters (AMI)",
          connections: coverage.byIntervals,
          energy: sourceMetric("Recorded by interval meters", account.recordedBySource.intervals, coverage.byIntervals, "No connection under this scope has interval data for the whole period."),
        },
        {
          key: "register",
          label: "Register advance (meters read by hand)",
          connections: coverage.byRegister,
          energy: sourceMetric("Recorded by register advance", account.recordedBySource.register, coverage.byRegister, "No connection under this scope has a register advance that counts."),
        },
      ],
      registerRule: REGISTER_RULE,
      registerExclusions: Object.keys(EXCLUSION_WORDS)
        .filter((reason) => (coverage.registerExclusions[reason as keyof typeof coverage.registerExclusions] ?? 0) > 0)
        .map((reason) => ({ reason: EXCLUSION_WORDS[reason], connections: coverage.registerExclusions[reason as keyof typeof coverage.registerExclusions] as number })),
      energyPurchased,
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
    byCustomerClass: Object.keys(billing.byCategory)
      .map((category) => {
        const totals = billing.byCategory[category];
        const money = (value: number) => ({ value, unit: "currency" as const, currency: billing.revenueBilled.currency, scale: 1, origin: "observed" as const, quality: "measured" as const });
        return {
          category,
          label: CLASS_LABEL[category] ?? category,
          accounts: totals.accounts,
          revenueBilled: totals.revenueBilled,
          revenueCollected: totals.revenueCollected,
          collection: kpiMetric(
            "Collection efficiency",
            calculateCollectionEfficiency({
              scope,
              period: runtime.period,
              revenueBilled: money(totals.revenueBilled),
              revenueCollected: money(totals.revenueCollected),
              collectionBasis: billing.collectionBasis,
              context: context(runtime),
            }),
          ),
        };
      })
      .sort((a, b) => b.revenueBilled - a.revenueBilled || (a.category < b.category ? -1 : 1)),
    accounts: { inScope: billing.accountsInScope, billed: billing.accountsBilled },
    reported: await reportedComparisons(runtime, scope, [
      { metric: "atcc", label: "ATC&C", candidates: () => [atcc.atcc] },
      { metric: "collection_efficiency", label: "Collection efficiency", candidates: () => [atcc.collectionEfficiency] },
    ]),
  };
}

const ATTRIBUTION_LABELS = [
  {
    key: "network",
    label: "Network",
    description: "Faults, planned work and weather on the distribution network, including the lines that feed its substations.",
  },
  { key: "upstream_supply", label: "Upstream supply", description: "Loss of supply that began at the transmission station or on the grid." },
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
  const view: Omit<ReliabilityView, "reported" | "ruleFindings"> = {
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
  };
  const reported = await reportedComparisons(
      runtime,
      scope,
      (["saidi", "saifi"] as const).map((metric) => ({
        metric,
        label: metric === "saidi" ? "SAIDI" : "SAIFI",
        // The total first, then the figure on the classes the reported figure says it counts. Where the
        // reported figure states its attribution rule, both are calculated under that rule.
        candidates: async (basis: KpiBasis | null) => {
          const onRule =
            basis?.upstreamOrigins === undefined
              ? reliability
              : (
                  await scopeReliability({
                    repos: runtime.repos,
                    scope,
                    period: runtime.period,
                    context: context(runtime),
                    cache: runtime.cache,
                    upstreamOrigins: basis.upstreamOrigins,
                  })
                ).result.reliability;
          return [onRule[metric], ...(basis?.interruptionClasses ? [reliabilityOnBasis(onRule, basis.interruptionClasses)[metric]] : [])];
        },
        // The same classes on the reference rule: what a reported rule changes is measured against it.
        onReferenceRule: (basis: KpiBasis | null) =>
          basis?.interruptionClasses === undefined ? null : reliabilityOnBasis(reliability, basis.interruptionClasses)[metric],
      })),
    );
  return { ...view, reported, ruleFindings: reported.flatMap((row) => (row.ruleFinding === null ? [] : [row.ruleFinding])) };
}

/** A substation's reliability with the attribution-rule findings of its feeders after its own. */
async function withFindingsBelow(runtime: OperationsRuntime, reliability: ReliabilityView, feederIds: readonly string[], timeZone: string | undefined): Promise<ReliabilityView> {
  const below: RuleFindingView[] = [];
  for (const id of feederIds) below.push(...(await reliabilityBlock(runtime, { kind: "feeder", id }, timeZone)).ruleFindings);
  return below.length === 0 ? reliability : { ...reliability, ruleFindings: [...reliability.ruleFindings, ...below] };
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
    unknownDemandClassNote:
      gap.unknownDemandClassExcluded > 0
        ? `${gap.unknownDemandClassExcluded} account(s) with unknown demand class excluded from the rate. They are not assumed to be non-MD.`
        : null,
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

/** The revenue gap of each of the given sections, as rows under a level's own gap. */
export async function revenueGapRows(
  runtime: OperationsRuntime,
  loaded: Loaded,
  sections: readonly { kind: "substation" | "feeder" | "distribution_transformer"; id: string; name: string }[],
): Promise<RevenueGapRow[]> {
  const rows: RevenueGapRow[] = [];
  for (const section of sections) {
    const gap = await revenueGapBlock(runtime, loaded, { kind: section.kind, id: section.id });
    rows.push({ kind: section.kind, id: section.id, name: section.name, commercial: gap.commercial, collection: gap.collection, notRealised: gap.notRealised });
  }
  return rows;
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
    revenueGap: await revenueGapBlock(runtime, loaded, scope),
    revenueGapBelow: {
      title: "By substation",
      rows: await revenueGapRows(runtime, loaded, substations.map((ss) => ({ kind: "substation", id: ss.id, name: ss.name }))),
    },
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
              : powerTransformers
                  .map((pt) => {
                    const fed = feeders.filter((feeder) => feeder.origin.powerTransformerId === pt.id).map((feeder) => feeder.name);
                    const section = pt.busSection === undefined ? "" : `, bus section ${pt.busSection}`;
                    // Which feeders a transformer carries is said only where the substation has more than one.
                    return `${pt.name} ${pt.ratingMva} MVA${section}${powerTransformers.length > 1 && fed.length > 0 ? ` (${fed.join(", ")})` : ""}`;
                  })
                  .join("; ") || "none",
        },
        { label: "Feeders", value: String(feeders.length) },
        { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
      ],
      substation.location ?? null,
    ),
    losses: await lossesBlock(runtime, scope),
    lossesNote: null,
    revenueGap: await revenueGapBlock(runtime, loaded, scope),
    revenueGapBelow: {
      title: "By feeder",
      rows: await revenueGapRows(runtime, loaded, feeders.map((feeder) => ({ kind: "feeder", id: feeder.id, name: feeder.name }))),
    },
    reliability: await withFindingsBelow(runtime, await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)), feeders.map((feeder) => feeder.id), timeZoneOf(loaded.snapshot)),
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
  const source = loaded.snapshot.powerTransformers.find((pt) => pt.id === feeder.origin.powerTransformerId);

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
      { label: "Fed from", value: source ? `${source.name}${source.busSection === undefined ? "" : `, bus section ${source.busSection}`}` : "not recorded" },
      { label: "Rated current", value: feeder.ratedCurrentA === undefined ? "not recorded" : `${feeder.ratedCurrentA} A` },
      { label: "Transformers", value: String(transformers.length) },
      { label: "Active accounts", value: count(activeAccountsUnder(loaded, scope)) },
    ]),
    losses: await lossesBlock(runtime, scope),
    lossesNote: null,
    revenueGap: await revenueGapBlock(runtime, loaded, scope),
    revenueGapBelow: {
      title: "By transformer",
      rows: await revenueGapRows(runtime, loaded, transformers.map((dt) => ({ kind: "distribution_transformer", id: dt.id, name: dt.name }))),
    },
    reliability: await reliabilityBlock(runtime, scope, timeZoneOf(loaded.snapshot)),
    loading: await loadingBlock(runtime, { kind: "feeder", id: feederId }),
    children,
    alarms: ALARMS,
  };
}

/** What a customer meter recorded in the period, from whatever that kind of meter can report. */
interface Recorded {
  metric: MetricView;
  from: ServicePointView["recordedFrom"];
  intervals: ServicePointView["intervals"];
  register: ServicePointView["register"];
  registerCounts: ServicePointView["registerCounts"];
}

/**
 * Energy recorded at one connection (ADR 0009):
 * - a meter that records intervals: their sum, with a gap making it unavailable;
 * - a meter read by hand: the advance of its register between two readings, said to be that;
 * - a meter from which nothing is read: not available. A vend is never put in its place.
 */
function recordedAt(
  runtime: OperationsRuntime,
  meter: Meter | undefined,
  intervals: readonly IntervalEnergy[],
  registerReadings: readonly TelemetryPoint[],
  prepaid: boolean,
): Recorded {
  const label = "Energy recorded";
  if (!meter) {
    return { metric: unavailable(label, "kWh", "No meter at this connection; consumption is not measured."), from: "no_meter", intervals: null, register: null, registerCounts: null };
  }
  const total = sumMeterEnergy(meter, intervals, runtime.period);
  if (total.recordsInPeriod > 0 || meter.meterType !== "conventional") {
    return {
      metric: {
        label,
        value: total.importKwh,
        unit: "kWh",
        currency: null,
        status: total.importKwh === null ? "insufficient_data" : total.quality === "estimated" || total.quality === "substituted" ? "calculated_with_estimates" : "ok",
        origin: "measured",
        derivation: `Sum of ${total.usableIntervals} of ${total.expectedIntervals ?? "?"} intervals from meter ${meter.id}.`,
        method: methodView(methodologyRef(ENERGY_REFERENCE)),
        inputs: [],
        estimatedInputs: [],
        missingInputs: total.missingInputs,
        warnings: total.warnings.map((warning) => warning.message),
        note: null,
      },
      from: "intervals",
      intervals: { expected: total.expectedIntervals, usable: total.usableIntervals, coverage: total.coverage },
      register: null,
      registerCounts: null,
    };
  }

  const advance = registerAdvance(meter, registerReadings, runtime.period);
  if (advance.readings === 0) {
    return {
      metric: unavailable(
        label,
        "kWh",
        prepaid
          ? "This meter is not read: it records no intervals and no register reading is held. What the account bought is shown as energy purchased, which is not consumption."
          : "This meter is not read: it records no intervals and no register reading is held for the period.",
      ),
      from: "not_read",
      intervals: null,
      register: null,
      registerCounts: null,
    };
  }
  // Whether the advance counts toward the recorded consumption of the levels above (ADR 0010).
  const counted = registerConsumption(meter, registerReadings, runtime.period, REGISTER_WINDOW_DAYS);
  const estimated = advance.quality === "estimated" || advance.quality === "substituted";
  const span = advance.opening && advance.closing ? `${advance.opening.kwh} kWh at ${advance.opening.at} and ${advance.closing.kwh} kWh at ${advance.closing.at}` : null;
  return {
    metric: {
      label,
      value: advance.advanceKwh,
      unit: "kWh",
      currency: null,
      status: advance.status !== "ok" ? advance.status : estimated ? "calculated_with_estimates" : "ok",
      origin: estimated ? "estimated" : "measured",
      derivation: `Advance of the register of meter ${meter.id} between two readings${span ? `: ${span}` : ""}. It covers the time between the readings, not the whole period.`,
      method: null,
      inputs: [],
      estimatedInputs: estimated ? [{ name: "closing register reading", share: null }] : [],
      missingInputs: advance.missingInputs,
      warnings: advance.warnings.map((warning) => warning.message),
      note: estimated
        ? "One register reading for the month, not interval data. The meter was not read this month: the closing reading is an estimate."
        : "One register reading for the month, not interval data.",
    },
    from: "register_readings",
    intervals: null,
    register:
      advance.opening && advance.closing
        ? { openingAt: advance.opening.at, openingKwh: advance.opening.kwh, closingAt: advance.closing.at, closingKwh: advance.closing.kwh, estimated }
        : null,
    registerCounts: counted.counted
      ? {
          counted: true,
          note: `Counts toward recorded consumption at the levels above: both readings are within ${REGISTER_WINDOW_DAYS} days of the period's ends. It is counted as read, not pro-rated.`,
        }
      : { counted: false, note: `Not counted toward recorded consumption at the levels above: ${EXCLUSION_WORDS[counted.exclusion ?? ""] ?? counted.reason}.` },
  };
}

/**
 * Register readings of the meters that are read by hand, by meter, from the reading window before the
 * period to the reading window after it. Meters that record intervals are not asked for.
 */
async function registerReadingsOf(runtime: OperationsRuntime, meters: readonly Meter[]): Promise<Map<string, TelemetryPoint[]>> {
  const byHand = meters.filter((meter) => meter.meterType === "conventional");
  const byMeter = new Map<string, TelemetryPoint[]>();
  const span = registerReadingSpan(runtime.period, REGISTER_WINDOW_DAYS);
  if (byHand.length === 0 || span === null) return byMeter;
  const readings = await runtime.repos.observations.listTelemetry({
    sources: byHand.map((meter) => ({ kind: "meter" as const, id: meter.id })),
    from: span.from,
    asOf: span.to,
  });
  for (const point of readings.records) {
    const list = byMeter.get(point.source.id);
    if (list === undefined) byMeter.set(point.source.id, [point]);
    else list.push(point);
  }
  return byMeter;
}

async function servicePointTable(runtime: OperationsRuntime, loaded: Loaded, title: string, servicePointIds: string[]): Promise<ChildTable> {
  const { index, snapshot } = loaded;
  const meters = servicePointIds.flatMap((id) => metersWithRole(index, "service_point", id));
  const [intervals, registers, charges, payments] = await Promise.all([
    runtime.repos.observations.listIntervalEnergy({ meterIds: meters.map((meter) => meter.id), period: runtime.period }),
    registerReadingsOf(runtime, meters),
    runtime.repos.billing.listBillingRecords({ period: runtime.period }),
    runtime.repos.billing.listPayments({ period: runtime.period }),
  ]);
  const byMeter = new Map<string, IntervalEnergy[]>();
  for (const interval of intervals.records) {
    const list = byMeter.get(interval.meterId);
    if (list === undefined) byMeter.set(interval.meterId, [interval]);
    else list.push(interval);
  }
  const currency = registryCurrency(snapshot);
  const billing =
    currency === null || charges.completeness === "not_available"
      ? null
      : billingByAccount({ period: runtime.period, billingRecords: charges.records, payments: payments.records, currency });
  const wanted = new Set(servicePointIds);
  const customerAt = new Map<string, (typeof snapshot.customers)[number]>();
  for (const candidate of snapshot.customers) {
    const at = candidate.servicePointId;
    if (at !== undefined && wanted.has(at) && candidate.accountStatus !== "closed" && !customerAt.has(at)) customerAt.set(at, candidate);
  }

  const rows = servicePointIds.map((id): ChildRow => {
    const customer = customerAt.get(id);
    const meter = metersWithRole(index, "service_point", id)[0];
    const account = customer && billing ? billing.get(customer.id) : undefined;
    const metering = meter ? (customer?.paymentMode ?? "metered") : "unmetered";

    const recorded = recordedAt(
      runtime,
      meter,
      meter ? (byMeter.get(meter.id) ?? []) : [],
      meter ? (registers.get(meter.id) ?? []) : [],
      customer?.paymentMode === "prepaid",
    ).metric;

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
    revenueGap: await revenueGapBlock(runtime, loaded, scope),
    revenueGapBelow: null,
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
  let intervalRecords: IntervalEnergy[] = [];
  let registerReadings: TelemetryPoint[] = [];
  if (meter) {
    trail.add([meter]);
    intervalRecords = (await runtime.repos.observations.listIntervalEnergy({ meterIds: [meter.id], period: runtime.period })).records;
    registerReadings = (await registerReadingsOf(runtime, [meter])).get(meter.id) ?? [];
    trail.add(intervalRecords).add(registerReadings);
  }
  const recorded = recordedAt(runtime, meter, intervalRecords, registerReadings, customer?.paymentMode === "prepaid");

  const [charges, payments] = await Promise.all([
    runtime.repos.billing.listBillingRecords({ period: runtime.period }),
    runtime.repos.billing.listPayments({ period: runtime.period }),
  ]);
  const ownCharges = customer ? charges.records.filter((record) => record.customerId === customer.id) : [];
  const ownPayments = customer ? payments.records.filter((payment) => payment.customerId === customer.id) : [];
  trail.add(ownCharges).add(ownPayments);
  if (customer) trail.add([customer]);

  // What the account bought on prepaid vends: shown as purchased, beside what was recorded and never in its place.
  const currency = registryCurrency(snapshot);
  const own = customer && currency !== null
    ? billingByAccount({ period: runtime.period, billingRecords: ownCharges, payments: ownPayments, currency }).get(customer.id)
    : undefined;
  const purchased: MetricView | null =
    own === undefined || own.vends === 0
      ? null
      : {
          label: "Energy purchased",
          value: own.energyVendedKwh,
          unit: "kWh",
          currency: null,
          status: own.energyVendedKwh === null ? "insufficient_data" : "ok",
          origin: "measured",
          derivation: `Sum of the energy on ${own.vends} prepaid vend(s) in the period.`,
          method: null,
          inputs: [],
          estimatedInputs: [],
          missingInputs: own.energyVendedKwh === null ? ["energy on every prepaid vend"] : [],
          warnings: [],
          note: PURCHASED_NOTE,
        };

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
        { label: "Metering", value: meter ? `${customer?.paymentMode ?? "metered"} (${METER_KIND[meter.meterType]} ${meter.id})` : "unmetered" },
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
    recorded: recorded.metric,
    recordedFrom: recorded.from,
    intervals: recorded.intervals,
    register: recorded.register,
    registerCounts: recorded.registerCounts,
    purchased,
    charges: ownCharges
      .map((record) => ({
        id: record.id,
        billedAt: record.billedAt,
        basis: record.basis,
        // An estimated bill says why there was no reading: no meter, or a meter the round did not reach.
        basisLabel: record.basis !== "estimated" ? BASIS_LABEL[record.basis] : meter ? "Estimated bills (meter not read)" : "Estimated bills (no meter)",
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
