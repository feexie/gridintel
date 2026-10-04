import type {
  DataQuality,
  Fraction,
  IntervalEnergy,
  IsoTimestamp,
  MethodologyRef,
  Period,
  ScopeRef,
} from "@/domain";
import type { CalcStatus, EstimatedInput, InputValue, MonetaryInput, ResultStatus, Warning } from "../core/result.ts";
import type { EnergyParameters, Methodology } from "../core/methodology.ts";
import type { TopologyIndex } from "../topology/registry.ts";
import type { BoundaryRequirement } from "./boundary.ts";
import type { MeterEnergyTotal } from "./intervals.ts";
import { ENERGY_REFERENCE, methodologyRef } from "../core/methodology.ts";
import { worstQuality } from "../core/quality.ts";
import { reportedInputWarnings } from "../core/result.ts";
import { convertUnit, dimensionOf } from "../core/units.ts";
import { metersWithRole, servicePointsUnder } from "../topology/registry.ts";
import { sectionBoundary } from "./boundary.ts";
import { sumMeterEnergy } from "./intervals.ts";

/* ==========================================================
   ANALYTICS — ENERGY ACCOUNT

   For one section (DT, feeder or substation) and one period:

     Energy received        net flow at the input boundary (measured)
   + embedded adjustment    only separately measured DER/BESS energy,
                            and only if the methodology requires it
   = Energy input
   − Technical loss         supplied input, with its own origin/method
   = Energy delivered
   − Energy billed          supplied input
   = Unbilled energy
     Revenue billed → revenue collected (supplied inputs)

   Alongside the chain, two measured cross-checks are reported:
   - downstream measured: net flow out through the downstream
     boundary meters;
   - recorded consumption: import through every service-point
     meter under the scope. It exists only where EVERY connection
     under the scope has a meter that recorded intervals for the
     whole period. A connection with no meter, or with a meter that
     is read by hand or not at all, makes it unavailable: its
     consumption is not known, and nothing stands in for it. A
     register reading and a prepaid vend are other quantities and
     are never added here. `consumptionCoverage` counts the
     connections of each kind, so the screen can say why.

   Every figure keeps its status, quality and the names of any
   missing inputs, so it can be traced back to its boundary. No
   missing value is ever treated as 0.

   STATUS. The account's status describes the CHAIN above (energy
   received through to unbilled energy, and revenue):
   - "ok": every input is present and measured;
   - "calculated_with_estimates": every input is present, but at
     least one was estimated (a technical-loss study, estimated
     billing, estimated intervals). `estimatedInputs` lists them;
   - "insufficient_data": an input of the chain is missing.
   The two cross-checks are not part of the chain. Where customers
   are unmetered their consumption cannot be measured, which makes
   the cross-checks unavailable but leaves the chain intact, so they
   carry their own status in `crossChecks`.

   Loss basis: energy input net of transfers out. None of the
   section types supported here transfers energy out of the scope
   (a feeder that supplies a substation is rejected), so the
   denominator is the energy input itself.
========================================================== */

export interface MeasuredRequirement extends BoundaryRequirement {
  meters: MeterEnergyTotal[];
  netKwh: number | null;
}

export interface BoundaryMeasurement {
  side: "input" | "downstream";
  /** Positive = energy flowing downstream. */
  direction: "downstream_positive";
  requirements: MeasuredRequirement[];
  status: CalcStatus;
  netKwh: number | null;
  quality: DataQuality | null;
  /** Lowest coverage among the meters used; null if none. */
  coverage: Fraction | null;
  missingInputs: string[];
}

export interface EnergyFigure {
  value: number | null;
  unit: "kWh";
  status: CalcStatus;
  quality: DataQuality | null;
  /** How the figure was obtained. */
  derivation: string;
  missingInputs: string[];
  /** For an estimated figure: the share of its value that was estimated; null when not known. */
  estimatedShare?: number | null;
}

/**
 * How much of the consumption under a scope the recorded-consumption
 * cross-check can see: each in-service service point is in exactly one
 * of the four groups.
 */
export interface ConsumptionCoverage {
  servicePoints: number;
  /** A meter with a complete import channel for the period. */
  recorded: number;
  /** A meter that records intervals, but not completely in the period. */
  incomplete: number;
  /** A meter that holds no interval record in the period: read by hand, or not read at all. */
  withoutIntervalData: number;
  /** No meter. */
  unmetered: number;
}

const NO_COVERAGE: ConsumptionCoverage = { servicePoints: 0, recorded: 0, incomplete: 0, withoutIntervalData: 0, unmetered: 0 };

/** DER/BESS energy that the caller asks to be added to energy received. */
export interface EmbeddedAdjustment {
  label: string;
  /** Energy in an energy unit; positive adds to energy input. */
  energy: InputValue;
  /** True only if this energy is metered separately from the accounting boundary. */
  measuredSeparately: boolean;
}

export interface EnergyAccountInputs {
  technicalLoss?: InputValue;
  energyBilled?: InputValue;
  revenueBilled?: MonetaryInput;
  revenueCollected?: MonetaryInput;
  embeddedAdjustments?: readonly EmbeddedAdjustment[];
}

export interface EnergyAccount {
  kind: "energy_account";
  scope: ScopeRef;
  period: Period;
  methodology: MethodologyRef;
  lossBasis: "energy_input_net_of_transfers_out";
  /** Status of the accounting chain; see the note on status above. */
  status: ResultStatus;
  /** The chain inputs that were estimated rather than measured. */
  estimatedInputs: EstimatedInput[];
  /** Status of the measured cross-checks (downstream measured, recorded consumption). */
  crossChecks: { status: CalcStatus; missingInputs: string[] };
  boundary: { input: BoundaryMeasurement; downstream: BoundaryMeasurement };
  received: EnergyFigure;
  embeddedApplied: EnergyFigure;
  embeddedIgnored: { label: string; reason: string }[];
  energyInput: EnergyFigure;
  downstreamMeasured: EnergyFigure;
  /** Energy input − downstream measured: section losses plus unmetered or unrecorded use. */
  sectionResidual: EnergyFigure;
  technicalLoss: EnergyFigure;
  delivered: EnergyFigure;
  recordedConsumption: EnergyFigure;
  /** Which connections the recorded consumption could and could not be measured at. */
  consumptionCoverage: ConsumptionCoverage;
  energyBilled: EnergyFigure;
  unbilled: EnergyFigure;
  /** Energy input − energy billed; available even when the technical/commercial split is not. */
  totalLoss: EnergyFigure;
  revenueBilled: MonetaryInput | null;
  revenueCollected: MonetaryInput | null;
  missingInputs: string[];
  quality: DataQuality | null;
  warnings: Warning[];
  computedAt: IsoTimestamp;
}

/* ==========================================================
   FIGURE HELPERS
========================================================== */

function missingFigure(name: string, derivation: string): EnergyFigure {
  return {
    value: null,
    unit: "kWh",
    status: "insufficient_data",
    quality: null,
    derivation,
    missingInputs: [name],
  };
}

function inputFigure(
  name: string,
  input: InputValue | undefined,
  warnings: Warning[],
): EnergyFigure {
  const derivation = `supplied input "${name}"`;
  if (input === undefined || input.value === null) return missingFigure(name, derivation);
  if (dimensionOf(input.unit) !== "energy") {
    warnings.push({
      code: "UNIT_MISMATCH",
      message: `"${name}" is in ${input.unit}, which is not an energy unit.`,
      ref: name,
    });
    return { ...missingFigure(name, derivation), status: "not_computable", missingInputs: [] };
  }
  return {
    value: convertUnit(input.value, input.unit, "kWh"),
    unit: "kWh",
    status: "ok",
    quality: input.quality,
    derivation: `${derivation} (${input.origin})`,
    missingInputs: [],
    ...(input.quality === "estimated" || input.quality === "substituted"
      ? { estimatedShare: input.estimatedShare ?? null }
      : {}),
  };
}

function combine(
  a: EnergyFigure,
  b: EnergyFigure,
  operation: "add" | "subtract",
  derivation: string,
): EnergyFigure {
  if (a.status === "ok" && b.status === "ok") {
    const value =
      operation === "add" ? (a.value as number) + (b.value as number) : (a.value as number) - (b.value as number);
    return {
      value,
      unit: "kWh",
      status: "ok",
      quality: worstQuality([a.quality, b.quality].filter((q): q is DataQuality => q !== null)),
      derivation,
      missingInputs: [],
    };
  }
  return {
    value: null,
    unit: "kWh",
    status: a.status === "not_computable" || b.status === "not_computable" ? "not_computable" : "insufficient_data",
    quality: null,
    derivation,
    missingInputs: [...a.missingInputs, ...b.missingInputs],
  };
}

function measuredFigure(measurement: BoundaryMeasurement, derivation: string): EnergyFigure {
  return {
    value: measurement.netKwh,
    unit: "kWh",
    status: measurement.status,
    quality: measurement.quality,
    derivation,
    missingInputs: measurement.missingInputs,
  };
}

/* ==========================================================
   BOUNDARY MEASUREMENT
========================================================== */

/** Interval records grouped by meter, so each meter is summed from its own records only. */
type IntervalsByMeter = ReadonlyMap<string, IntervalEnergy[]>;

function groupByMeter(intervals: readonly IntervalEnergy[]): IntervalsByMeter {
  const groups = new Map<string, IntervalEnergy[]>();
  for (const interval of intervals) {
    const group = groups.get(interval.meterId);
    if (group === undefined) groups.set(interval.meterId, [interval]);
    else group.push(interval);
  }
  return groups;
}

function measureBoundary(
  index: TopologyIndex,
  side: "input" | "downstream",
  requirements: readonly BoundaryRequirement[],
  intervals: IntervalsByMeter,
  period: Period,
  warnings: Warning[],
): BoundaryMeasurement {
  const meterById = new Map(index.registry.meters.map((meter) => [meter.id, meter]));
  const measured: MeasuredRequirement[] = requirements.map((req) => {
    const meters = req.meterIds.map((id) => sumMeterEnergy(meterById.get(id)!, intervals.get(id) ?? [], period));
    for (const total of meters) warnings.push(...total.warnings);
    const complete = meters.length > 0 && meters.every((total) => total.netKwh !== null);
    return {
      ...req,
      meters,
      netKwh: complete ? meters.reduce((sum, total) => sum + (total.netKwh as number), 0) : null,
    };
  });

  const missingInputs = measured.flatMap((req) =>
    req.meterIds.length === 0
      ? [`${req.role} meter for ${req.assetKind} ${req.assetId}`]
      : req.meters.flatMap((total) => total.missingInputs),
  );
  const totals = measured.flatMap((req) => req.meters);
  const complete = missingInputs.length === 0 && measured.every((req) => req.netKwh !== null);
  const coverages = totals.map((total) => total.coverage).filter((c): c is number => c !== null);

  return {
    side,
    direction: "downstream_positive",
    requirements: measured,
    status: complete ? "ok" : "insufficient_data",
    netKwh: complete ? measured.reduce((sum, req) => sum + (req.netKwh as number), 0) : null,
    quality: worstQuality(totals.map((total) => total.quality).filter((q): q is DataQuality => q !== null)),
    coverage: coverages.length > 0 ? Math.min(...coverages) : null,
    missingInputs,
  };
}

function recordedConsumptionFigure(
  index: TopologyIndex,
  scope: ScopeRef,
  intervals: IntervalsByMeter,
  period: Period,
): { figure: EnergyFigure; coverage: ConsumptionCoverage } {
  const derivation = "sum of import through service-point meters under the scope";
  const points = servicePointsUnder(index, scope).value ?? [];
  const coverage: ConsumptionCoverage = { ...NO_COVERAGE, servicePoints: points.length };
  const missingInputs: string[] = [];
  const qualities: DataQuality[] = [];
  let total = 0;
  for (const sp of points) {
    const meters = metersWithRole(index, "service_point", sp.id);
    if (meters.length === 0) {
      missingInputs.push(`service_point meter for service_point ${sp.id}`);
      coverage.unmetered += 1;
      continue;
    }
    let noData = false;
    let incomplete = false;
    for (const meter of meters) {
      const sum = sumMeterEnergy(meter, intervals.get(meter.id) ?? [], period);
      if (sum.importKwh === null) {
        // A meter that holds no interval record is named as such, never assumed to report.
        if (sum.recordsInPeriod === 0) {
          noData = true;
          missingInputs.push(...sum.missingInputs);
        } else {
          incomplete = true;
          missingInputs.push(`complete import channel for meter ${meter.id}`);
        }
        continue;
      }
      total += sum.importKwh;
      if (sum.quality !== null) qualities.push(sum.quality);
    }
    if (noData) coverage.withoutIntervalData += 1;
    else if (incomplete) coverage.incomplete += 1;
    else coverage.recorded += 1;
  }
  if (missingInputs.length > 0) {
    return { figure: { value: null, unit: "kWh", status: "insufficient_data", quality: null, derivation, missingInputs }, coverage };
  }
  return { figure: { value: total, unit: "kWh", status: "ok", quality: worstQuality(qualities), derivation, missingInputs }, coverage };
}

/* ==========================================================
   EMBEDDED (DER/BESS) ADJUSTMENTS
========================================================== */

function embeddedAdjustmentFigure(
  adjustments: readonly EmbeddedAdjustment[],
  parameters: EnergyParameters,
  ignored: { label: string; reason: string }[],
  warnings: Warning[],
): EnergyFigure {
  const applied: EmbeddedAdjustment[] = [];
  for (const adjustment of adjustments) {
    if (parameters.embeddedAdjustment === "none") {
      ignored.push({ label: adjustment.label, reason: "methodology does not permit embedded adjustments" });
      warnings.push({
        code: "DER_ADJUSTMENT_NOT_PERMITTED",
        message:
          `Embedded adjustment "${adjustment.label}" was ignored: the methodology uses boundary-meter ` +
          "readings as measured, which already include embedded DER/BESS energy.",
        ref: adjustment.label,
      });
    } else if (!adjustment.measuredSeparately) {
      ignored.push({ label: adjustment.label, reason: "not measured separately from the boundary" });
      warnings.push({
        code: "DER_ALREADY_IN_BOUNDARY",
        message:
          `Embedded adjustment "${adjustment.label}" was ignored: it is not measured separately, so it is ` +
          "already represented in the boundary-meter readings.",
        ref: adjustment.label,
      });
    } else {
      applied.push(adjustment);
    }
  }

  let figure: EnergyFigure = {
    value: 0,
    unit: "kWh",
    status: "ok",
    quality: null,
    derivation: "no embedded adjustments applied",
    missingInputs: [],
  };
  for (const adjustment of applied) {
    figure = combine(
      figure,
      inputFigure(`embedded adjustment "${adjustment.label}"`, adjustment.energy, warnings),
      "add",
      "sum of separately measured embedded adjustments required by the methodology",
    );
  }
  return figure;
}

/* ==========================================================
   ENERGY ACCOUNT
========================================================== */

export function computeEnergyAccount(params: {
  index: TopologyIndex;
  scope: ScopeRef;
  period: Period;
  intervals: readonly IntervalEnergy[];
  inputs?: EnergyAccountInputs;
  methodology?: Methodology<EnergyParameters>;
  computedAt: IsoTimestamp;
}): EnergyAccount {
  const { index, scope, period, computedAt } = params;
  const intervals = groupByMeter(params.intervals);
  const inputs = params.inputs ?? {};
  const methodology = params.methodology ?? ENERGY_REFERENCE;
  const warnings: Warning[] = [];

  const boundary = sectionBoundary(index, scope);
  warnings.push(...boundary.warnings);

  const input = measureBoundary(index, "input", boundary.input, intervals, period, warnings);
  const downstream = measureBoundary(index, "downstream", boundary.downstream, intervals, period, warnings);
  if (boundary.status !== "not_computable" && boundary.downstream.length === 0) {
    warnings.push({
      code: "NO_DOWNSTREAM_ELEMENTS",
      message: "The section has no in-service downstream elements in the registry, so downstream measured is 0.",
      ref: scope.id,
    });
  }

  let received = measuredFigure(input, "net flow through the input boundary meters");
  if (boundary.status === "not_computable") {
    received = { ...received, value: null, status: "not_computable" };
  }

  const embeddedIgnored: { label: string; reason: string }[] = [];
  const embeddedApplied = embeddedAdjustmentFigure(
    inputs.embeddedAdjustments ?? [],
    methodology.parameters,
    embeddedIgnored,
    warnings,
  );

  const energyInput = combine(received, embeddedApplied, "add", "energy received + embedded adjustment");
  const downstreamMeasured =
    boundary.status === "not_computable"
      ? { ...measuredFigure(downstream, ""), value: null, status: "not_computable" as const }
      : measuredFigure(downstream, "net flow through the downstream boundary meters");
  const sectionResidual = combine(energyInput, downstreamMeasured, "subtract", "energy input − downstream measured");

  const technicalLoss = inputFigure("technical loss", inputs.technicalLoss, warnings);
  const delivered = combine(energyInput, technicalLoss, "subtract", "energy input − technical loss");
  const energyBilled = inputFigure("energy billed", inputs.energyBilled, warnings);
  const unbilled = combine(delivered, energyBilled, "subtract", "energy delivered − energy billed");
  const totalLoss = combine(energyInput, energyBilled, "subtract", "energy input − energy billed");
  const { figure: recordedConsumption, coverage: consumptionCoverage } =
    boundary.status === "not_computable"
      ? { figure: { ...missingFigure("scope", ""), status: "not_computable" as const, missingInputs: [] }, coverage: NO_COVERAGE }
      : recordedConsumptionFigure(index, scope, intervals, period);

  if (unbilled.status === "ok" && (unbilled.value as number) < 0) {
    warnings.push({
      code: "BILLED_EXCEEDS_DELIVERED",
      message: "Energy billed exceeds energy delivered; check billing period alignment and the technical-loss input.",
    });
  }

  const suppliedInputs: Record<string, InputValue> = {};
  if (inputs.technicalLoss) suppliedInputs.technicalLoss = inputs.technicalLoss;
  if (inputs.energyBilled) suppliedInputs.energyBilled = inputs.energyBilled;
  if (inputs.revenueBilled) suppliedInputs.revenueBilled = inputs.revenueBilled;
  if (inputs.revenueCollected) suppliedInputs.revenueCollected = inputs.revenueCollected;
  warnings.push(...reportedInputWarnings(suppliedInputs));

  const revenueBilled = inputs.revenueBilled ?? null;
  const revenueCollected = inputs.revenueCollected ?? null;
  const chain = [received, embeddedApplied, energyInput, technicalLoss, delivered, energyBilled, unbilled, totalLoss];
  const missingInputs = [
    ...new Set([
      ...chain.flatMap((figure) => figure.missingInputs),
      ...(revenueBilled?.value == null ? ["revenue billed"] : []),
      ...(revenueCollected?.value == null ? ["revenue collected"] : []),
    ]),
  ];

  const estimatedInputs: EstimatedInput[] = [
    { name: "energy received", figure: received },
    { name: "embedded adjustment", figure: embeddedApplied },
    { name: "technical loss", figure: technicalLoss },
    { name: "energy billed", figure: energyBilled },
  ]
    .filter(({ figure }) => figure.status === "ok" && (figure.quality === "estimated" || figure.quality === "substituted"))
    .map(({ name, figure }) => ({ name, quality: figure.quality as "estimated" | "substituted", share: figure.estimatedShare ?? null }));

  let status: ResultStatus;
  if (chain.some((figure) => figure.status === "not_computable")) status = "not_computable";
  else if (missingInputs.length > 0) status = "insufficient_data";
  else if (estimatedInputs.length > 0) status = "calculated_with_estimates";
  else status = "ok";

  const crossMissing = [...new Set([...downstreamMeasured.missingInputs, ...recordedConsumption.missingInputs])];
  const crossChecks = {
    status: ([downstreamMeasured, recordedConsumption].some((figure) => figure.status === "not_computable")
      ? "not_computable"
      : crossMissing.length > 0
        ? "insufficient_data"
        : "ok") as CalcStatus,
    missingInputs: crossMissing,
  };

  const figureQualities = [...chain, downstreamMeasured, recordedConsumption]
    .map((figure) => figure.quality)
    .filter((q): q is DataQuality => q !== null);
  if (revenueBilled) figureQualities.push(revenueBilled.quality);
  if (revenueCollected) figureQualities.push(revenueCollected.quality);

  return {
    kind: "energy_account",
    scope,
    period,
    methodology: methodologyRef(methodology),
    lossBasis: "energy_input_net_of_transfers_out",
    status,
    estimatedInputs,
    crossChecks,
    boundary: { input, downstream },
    received,
    embeddedApplied,
    embeddedIgnored,
    energyInput,
    downstreamMeasured,
    sectionResidual,
    technicalLoss,
    delivered,
    recordedConsumption,
    consumptionCoverage,
    energyBilled,
    unbilled,
    totalLoss,
    revenueBilled,
    revenueCollected,
    missingInputs,
    quality: worstQuality(figureQualities),
    warnings: dedupeWarnings(warnings),
    computedAt,
  };
}

function dedupeWarnings(warnings: readonly Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}|${warning.ref ?? ""}|${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ==========================================================
   AGGREGATION ACROSS SECTIONS

   An administrative scope (a region, an organization) is not an
   electrical boundary, so it has no boundary meters of its own. Its
   energy account is the SUM of the accounts of the electrical
   sections that make it up (see cut.ts for how they are chosen).

   A figure of the total exists only when every section has it. One
   section with a missing figure makes the total missing; the other
   sections are never summed into a partial figure that would look
   like the whole. The estimated share of a total is the
   energy-weighted share of its parts, when every part states one.
========================================================== */

function sumFigures(figures: readonly EnergyFigure[], derivation: string): EnergyFigure {
  if (figures.length === 0) return missingFigure("at least one section", derivation);
  if (figures.some((figure) => figure.status === "not_computable")) {
    return { value: null, unit: "kWh", status: "not_computable", quality: null, derivation, missingInputs: [] };
  }
  if (figures.some((figure) => figure.status !== "ok")) {
    return {
      value: null,
      unit: "kWh",
      status: "insufficient_data",
      quality: null,
      derivation,
      missingInputs: [...new Set(figures.flatMap((figure) => figure.missingInputs))],
    };
  }
  const value = figures.reduce((total, figure) => total + (figure.value as number), 0);
  const quality = worstQuality(figures.map((figure) => figure.quality).filter((q): q is DataQuality => q !== null));
  const estimated = quality === "estimated" || quality === "substituted";
  let estimatedShare: number | null | undefined;
  if (estimated) {
    const shares = figures.map((figure) =>
      figure.quality === "estimated" || figure.quality === "substituted" ? (figure.estimatedShare ?? null) : 0,
    );
    estimatedShare =
      shares.some((share) => share === null) || value === 0
        ? null
        : figures.reduce((total, figure, i) => total + (shares[i] as number) * (figure.value as number), 0) / value;
  }
  return { value, unit: "kWh", status: "ok", quality, derivation, missingInputs: [], ...(estimated ? { estimatedShare } : {}) };
}

function sumBoundaries(side: "input" | "downstream", parts: readonly BoundaryMeasurement[]): BoundaryMeasurement {
  const complete = parts.length > 0 && parts.every((part) => part.status === "ok");
  const coverages = parts.map((part) => part.coverage).filter((c): c is number => c !== null);
  return {
    side,
    direction: "downstream_positive",
    requirements: parts.flatMap((part) => part.requirements),
    status: complete ? "ok" : "insufficient_data",
    netKwh: complete ? parts.reduce((total, part) => total + (part.netKwh as number), 0) : null,
    quality: worstQuality(parts.map((part) => part.quality).filter((q): q is DataQuality => q !== null)),
    coverage: coverages.length > 0 ? Math.min(...coverages) : null,
    missingInputs: [...new Set(parts.flatMap((part) => part.missingInputs))],
  };
}

export function aggregateEnergyAccounts(params: {
  scope: ScopeRef;
  period: Period;
  /** The accounts of the sections that make up the scope, each for the same period. */
  accounts: readonly EnergyAccount[];
  /** Revenue for the whole scope, from its own billing totals. */
  revenueBilled?: MonetaryInput;
  revenueCollected?: MonetaryInput;
  /** Warnings from choosing the sections. */
  warnings?: readonly Warning[];
  methodology?: Methodology<EnergyParameters>;
  computedAt: IsoTimestamp;
}): EnergyAccount {
  const { scope, period, accounts, computedAt } = params;
  const methodology = params.methodology ?? ENERGY_REFERENCE;
  const n = accounts.length;
  const sum = (pick: (account: EnergyAccount) => EnergyFigure, name: string) =>
    sumFigures(accounts.map(pick), `sum of ${name} over ${n} section(s)`);

  const received = sum((a) => a.received, "energy received");
  const embeddedApplied = sum((a) => a.embeddedApplied, "embedded adjustments");
  const energyInput = sum((a) => a.energyInput, "energy input");
  const downstreamMeasured = sum((a) => a.downstreamMeasured, "downstream measured");
  const sectionResidual = sum((a) => a.sectionResidual, "section residuals");
  const technicalLoss = sum((a) => a.technicalLoss, "technical loss");
  const delivered = sum((a) => a.delivered, "energy delivered");
  const recordedConsumption = sum((a) => a.recordedConsumption, "recorded consumption");
  const energyBilled = sum((a) => a.energyBilled, "energy billed");
  const unbilled = sum((a) => a.unbilled, "unbilled energy");
  const totalLoss = sum((a) => a.totalLoss, "total loss");

  const revenueBilled = params.revenueBilled ?? null;
  const revenueCollected = params.revenueCollected ?? null;
  const chain = [received, embeddedApplied, energyInput, technicalLoss, delivered, energyBilled, unbilled, totalLoss];
  const missingInputs = [
    ...new Set([
      ...chain.flatMap((figure) => figure.missingInputs),
      ...(revenueBilled?.value == null ? ["revenue billed"] : []),
      ...(revenueCollected?.value == null ? ["revenue collected"] : []),
    ]),
  ];
  const estimatedInputs: EstimatedInput[] = [
    { name: "energy received", figure: received },
    { name: "embedded adjustment", figure: embeddedApplied },
    { name: "technical loss", figure: technicalLoss },
    { name: "energy billed", figure: energyBilled },
  ]
    .filter(({ figure }) => figure.status === "ok" && (figure.quality === "estimated" || figure.quality === "substituted"))
    .map(({ name, figure }) => ({ name, quality: figure.quality as "estimated" | "substituted", share: figure.estimatedShare ?? null }));

  let status: ResultStatus;
  if (chain.some((figure) => figure.status === "not_computable")) status = "not_computable";
  else if (missingInputs.length > 0) status = "insufficient_data";
  else if (estimatedInputs.length > 0) status = "calculated_with_estimates";
  else status = "ok";

  const crossMissing = [...new Set([...downstreamMeasured.missingInputs, ...recordedConsumption.missingInputs])];
  const figureQualities = [...chain, downstreamMeasured, recordedConsumption]
    .map((figure) => figure.quality)
    .filter((q): q is DataQuality => q !== null);
  if (revenueBilled) figureQualities.push(revenueBilled.quality);
  if (revenueCollected) figureQualities.push(revenueCollected.quality);

  return {
    kind: "energy_account",
    scope,
    period,
    methodology: methodologyRef(methodology),
    lossBasis: "energy_input_net_of_transfers_out",
    status,
    estimatedInputs,
    crossChecks: {
      status: [downstreamMeasured, recordedConsumption].some((figure) => figure.status === "not_computable")
        ? "not_computable"
        : crossMissing.length > 0
          ? "insufficient_data"
          : "ok",
      missingInputs: crossMissing,
    },
    boundary: {
      input: sumBoundaries("input", accounts.map((a) => a.boundary.input)),
      downstream: sumBoundaries("downstream", accounts.map((a) => a.boundary.downstream)),
    },
    received,
    embeddedApplied,
    embeddedIgnored: accounts.flatMap((a) => a.embeddedIgnored),
    energyInput,
    downstreamMeasured,
    sectionResidual,
    technicalLoss,
    delivered,
    recordedConsumption,
    // Each connection is in exactly one section, so the sections' counts add up.
    consumptionCoverage: accounts.reduce<ConsumptionCoverage>(
      (total, a) => ({
        servicePoints: total.servicePoints + a.consumptionCoverage.servicePoints,
        recorded: total.recorded + a.consumptionCoverage.recorded,
        incomplete: total.incomplete + a.consumptionCoverage.incomplete,
        withoutIntervalData: total.withoutIntervalData + a.consumptionCoverage.withoutIntervalData,
        unmetered: total.unmetered + a.consumptionCoverage.unmetered,
      }),
      NO_COVERAGE,
    ),
    energyBilled,
    unbilled,
    totalLoss,
    revenueBilled,
    revenueCollected,
    missingInputs,
    quality: worstQuality(figureQualities),
    warnings: dedupeWarnings([...(params.warnings ?? []), ...accounts.flatMap((a) => a.warnings)]),
    computedAt,
  };
}
