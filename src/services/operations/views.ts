/* ==========================================================
   SERVICES — OPERATIONS VIEW MODELS

   What the Operations screens receive. Plain, serialisable data:
   no domain records, no analytics results, no functions. The UI
   formats and lays these out; it calculates nothing.

   Every number is a MetricView, so it always arrives with its
   status, its origin and the trail back to source and method.
========================================================== */

/** Where a number comes from, in the words shown on screen. */
export type DisplayOrigin = "measured" | "reported" | "calculated" | "estimated" | "derived";

export type DisplayStatus =
  | "ok"
  | "calculated_with_estimates"
  | "insufficient_data"
  | "not_computable"
  /** The platform has no source for this kind of figure at all. */
  | "not_available";

export type MetricUnit =
  | "fraction"
  | "kWh"
  | "kVA"
  | "currency"
  | "hours"
  | "hours_per_day"
  | "interruptions_per_customer"
  | "count";

export interface InputView {
  name: string;
  value: number | null;
  unit: string;
  origin: DisplayOrigin;
  quality: string;
  /** Share of the input that was estimated; null when not estimated or not known. */
  estimatedShare: number | null;
  ref: string | null;
}

export interface MethodView {
  id: string;
  version: string;
  name: string;
  disclaimer: string;
}

export interface MetricView {
  label: string;
  value: number | null;
  unit: MetricUnit;
  /** ISO 4217 code when the unit is "currency". */
  currency: string | null;
  status: DisplayStatus;
  origin: DisplayOrigin;
  /** One line on how the value was obtained. */
  derivation: string | null;
  method: MethodView | null;
  inputs: InputView[];
  estimatedInputs: { name: string; share: number | null }[];
  missingInputs: string[];
  warnings: string[];
  /** A caveat that must be shown next to the value. */
  note: string | null;
}

export interface SourcingView {
  synthetic: boolean;
  /** `licence` and `attribution` are set for data obtained from a publisher; the attribution must be shown wherever the data is. */
  sources: { id: string; name: string; kind: string; licence?: string; attribution?: string; dated?: string }[];
}

export type LevelKind = "region" | "substation" | "feeder" | "distribution_transformer" | "service_point";

export interface Crumb {
  kind: LevelKind;
  id: string;
  label: string;
}

/* ---------------- Losses ---------------- */

/**
 * A finding: a reported figure states an attribution rule other than the reference one, and this
 * is what that rule changes. It is a figure of its own, with its size, and is never shown as a
 * side note to the comparison.
 */
export interface RuleFindingView {
  /** The figure the finding is about, e.g. "SAIDI". */
  figure: string;
  /** The scope whose reported figure states the rule. */
  statedFor: { kind: LevelKind; id: string; name: string };
  /** What the reported rule does, e.g. "Rule treats sub-transmission lines as upstream". */
  statement: string;
  /** The figure on the reference rule less the same figure on the reported rule. Signed; zero when the rule moved nothing in the period. */
  difference: MetricView;
  onReportedRule: MetricView;
  onReferenceRule: MetricView;
  document: string | null;
}

export interface ReportedComparisonView {
  label: string;
  /** Set when the comparison is for another scope than the page's: the name of the scope the report is stated for. */
  statedFor?: string | null;
  reported: MetricView;
  /** The calculated figure on the reported figure's basis, when there is one. */
  calculated: MetricView;
  /** What the reported figure counts, in words; null when the source does not say. */
  reportedBasis: string | null;
  /** What the calculated figure counts, in words. */
  calculatedBasis: string | null;
  /** True only when both state their basis and the bases are equal. */
  sameBasis: boolean;
  comparable: boolean;
  /** calculated − reported, in the reported unit (percentage points for ratios); null unless on the same basis. */
  variance: number | null;
  varianceUnit: string;
  /** Why the figures are not comparable. Empty when they are. */
  reasons: string[];
  /** Things to bear in mind that do not stop the comparison. */
  caveats: string[];
  /**
   * Set when the reported figure states an attribution rule other than the reference one, and
   * the calculation beside it was made on that rule: what the rule changes, as a finding.
   */
  ruleFinding: RuleFindingView | null;
  document: string | null;
}

export interface LossesView {
  sourcing: SourcingView;
  /** The electrical sections the account covers. More than one, or another than the page's own, when summed. */
  sections: { kind: LevelKind; id: string }[];
  /** Shown when the figures belong to another scope than the page's (e.g. a region showing its substation). */
  scopeNote: string | null;
  status: DisplayStatus;
  /** The accounting chain, top to bottom. */
  chain: MetricView[];
  /** The measured cross-checks, and why they may be unavailable. */
  crossChecks: {
    status: DisplayStatus;
    metrics: MetricView[];
    missingCount: number;
    note: string | null;
    /** Connections under the scope by what is held for their meter. The six kinds add up to `servicePoints`. */
    coverage: {
      servicePoints: number;
      /** Recorded by a meter with interval data for the whole period. */
      byIntervals: number;
      intervalsIncomplete: number;
      /** Recorded by a register advance whose two readings are within the reading window of the period's ends. */
      byRegister: number;
      /** Register readings are held, but the advance does not count. */
      registerExcluded: number;
      /** A meter from which nothing is read. */
      notRead: number;
      unmetered: number;
    };
    /**
     * Recorded consumption by the source that measured it, each for the connections it covers
     * and never added to anything else on screen. "not_available" when no connection under the
     * scope is measured that way.
     */
    sources: { key: "intervals" | "register"; label: string; connections: number; energy: MetricView }[];
    /** The rule by which a register advance counts, in words. */
    registerRule: string;
    /** Register advances that do not count, by reason. Empty when there is none. */
    registerExclusions: { reason: string; connections: number }[];
    /**
     * Energy bought on prepaid vends in the period. Shown beside the cross-checks and labelled as
     * purchased: it is not consumption and is never added to recorded consumption.
     */
    energyPurchased: MetricView;
  };
  atcc: MetricView;
  parts: { technical: MetricView; commercial: MetricView; collection: MetricView };
  billingEfficiency: MetricView;
  collectionEfficiency: MetricView;
  revenueBilled: MetricView;
  revenueCollected: MetricView;
  collectionBasis: "cash";
  billingByBasis: { basis: string; label: string; records: number; energyKwh: number | null; amount: number }[];
  /**
   * Billing and collection by customer class, largest billing first. `notCollected` is billed
   * less collected (cash basis; negative when a class paid off more than it was billed) and
   * `shareOfNotCollected` the class's share of what the classes with a shortfall left
   * uncollected between them; null for a class with no shortfall.
   */
  byCustomerClass: {
    category: string;
    label: string;
    accounts: number;
    revenueBilled: number;
    revenueCollected: number;
    notCollected: number;
    shareOfNotCollected: number | null;
    collection: MetricView;
  }[];
  accounts: { inScope: number | null; billed: number };
  reported: ReportedComparisonView[];
}

/* ---------------- Revenue gap ---------------- */

export interface RevenueGapPartView {
  scope: { kind: LevelKind; id: string; name: string };
  /** "section": a lowest-level section valued whole; "residual": the loss between a section's boundary and those below it. */
  kind: "section" | "residual";
  energyKwh: number | null;
  ratePerKwh: number | null;
  amount: number | null;
}

/** The revenue gap of one section below the page's scope. */
export interface RevenueGapRow {
  kind: LevelKind;
  id: string;
  name: string;
  commercial: MetricView;
  collection: MetricView;
  notRealised: MetricView;
}

export interface RevenueGapView {
  sourcing: SourcingView;
  status: DisplayStatus;
  currency: string | null;
  commercial: MetricView;
  collection: MetricView;
  /** The sum of the parts that are positive. */
  notRealised: MetricView;
  /** What the figure is and is not; must be shown with it. */
  definition: string;
  /** "For the reporting period; not annualised." */
  periodNote: string;
  /** Set when a part is negative: it is shown as negative and not netted. */
  negativeNote: string | null;
  /** A caveat about the data that must be shown with the figure. */
  caveat: string | null;
  /** Set when accounts were left out of the rate because their demand class is not recorded. */
  unknownDemandClassNote: string | null;
  parts: RevenueGapPartView[];
}

/* ---------------- Reliability ---------------- */

export interface AttributionRow {
  key: "network" | "upstream_supply" | "load_management" | "other";
  label: string;
  description: string;
  saidiHours: number | null;
  saifi: number | null;
  /** Share of total customer-minutes. */
  share: number | null;
}

export interface SupplyDayView {
  date: string;
  hours: number;
  compliant: boolean | null;
}

export interface SupplyView {
  status: DisplayStatus;
  averageHours: MetricView;
  band: string | null;
  minimumHours: number | null;
  compliantOnAverage: boolean | null;
  daysCompliant: number | null;
  daysNonCompliant: number | null;
  days: SupplyDayView[];
  note: string | null;
}

export interface ReliabilityView {
  sourcing: SourcingView;
  /** Shown when the figures belong to another scope than the page's. */
  scopeNote?: string | null;
  saidi: MetricView;
  saifi: MetricView;
  caidi: MetricView;
  asai: MetricView;
  customersServed: MetricView;
  attribution: AttributionRow[];
  /**
   * Set when the indices include interruptions still open at the end of the period, each counted
   * to the period's end: the words that must be shown with the figures. The figures are
   * calculated, not estimated, and are not final until the restorations are recorded.
   */
  provisional: string | null;
  /** Exposures recorded above the scope or on an unresolved name: not in any index. */
  unattributable: number;
  excludedForData: number;
  momentary: number;
  supply: SupplyView;
  reported: ReportedComparisonView[];
  /**
   * Attribution-rule findings: those of the scope's own reported figures, and on a substation
   * those of the feeders below it, each naming the scope it is stated for.
   */
  ruleFindings: RuleFindingView[];
}

/* ---------------- Loading ---------------- */

export interface LoadingView {
  sourcing: SourcingView;
  ratedKva: number | null;
  asOf: MetricView;
  asOfTime: string;
  peak: MetricView;
  peakAt: string | null;
  peakKva: number | null;
  /** Hours in the period with loading above 100% of rating; null when not calculated. */
  hoursOverRating: number | null;
  hoursObserved: number | null;
  overloaded: boolean | null;
  /** Must be shown with the figures when present. */
  caveat: string | null;
}

/** A power transformer of a substation, with its loading where it has telemetry. */
export interface PowerTransformerView {
  id: string;
  name: string;
  ratedKva: number;
  busSection: string | null;
  /** The feeders it carries, by name. */
  feeders: { id: string; name: string }[];
  /** null when the transformer has no telemetry to calculate a loading from. */
  loading: LoadingView | null;
}

/* ---------------- Tables of children ---------------- */

export interface ChildRow {
  kind: LevelKind;
  id: string;
  name: string;
  /** Short facts, e.g. rating, band, metering. */
  facts: string[];
  cells: Record<string, MetricView>;
}

export interface ChildTable {
  title: string;
  /** How complete the list is; anything but "complete" must be shown. */
  coverage: "complete" | "partial" | "not_available";
  columns: { key: string; label: string }[];
  rows: ChildRow[];
}

/* ---------------- Levels ---------------- */

export interface LevelHeader {
  kind: LevelKind;
  id: string;
  title: string;
  subtitle: string;
  crumbs: Crumb[];
  facts: { label: string; value: string }[];
  period: { start: string; end: string };
  asOf: string;
  location: { latitude: number; longitude: number } | null;
}

/* ---------------- Alarms and derived conditions ---------------- */

/** The asset an alarm or a condition is about, and the screen that shows it. */
export interface AlarmSubjectView {
  id: string;
  /** The asset's name, or the name as the source wrote it when it is not matched to the registry. */
  label: string;
  /** The kind of registry record the subject is; null when it is not matched to the registry. */
  assetKind: "substation" | "power_transformer" | "feeder" | "distribution_transformer" | "service_point" | "meter" | "edge_device" | null;
  /** "Substation", "Power transformer", "Monitor on …". */
  kindLabel: string;
  /** The drill-down level to open; null when the subject is not in the registry. */
  link: { kind: LevelKind; id: string } | null;
}

/** An alarm as a source system recorded it. */
export interface AlarmRowView {
  id: string;
  code: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  subject: AlarmSubjectView;
  /** Its state at the as-of time. "time_not_recorded": the source did not say when it was raised, so its state cannot be told. */
  state: "active" | "cleared" | "time_not_recorded";
  raisedAt: string | null;
  clearedAt: string | null;
  acknowledgedAt: string | null;
  /** What the alarm is about, in words; null when the source's code is not mapped to a kind. */
  kindName: string | null;
  /** The derived conditions that agree with this alarm. Empty for most: GridIntel derives under two rules only. */
  agreedBy: { key: string; ruleName: string }[];
}

/**
 * Whether a source system raised an alarm of the kind that matches a derived condition, on the
 * same subject, while the condition held. A relation between the two lists; neither is changed.
 */
export interface SourceAlarmRelationView {
  /** "none_raised" is said only when the source's alarm record is complete. */
  status: "agrees" | "none_raised" | "cannot_tell";
  /** The matching kind of alarm, in words: "communications failure", "overload". */
  kindName: string;
  /** The alarms that agree; or, when it cannot be told, the alarms that leave it open. */
  alarms: { id: string; code: string; raisedAt: string | null }[];
  /** Why it cannot be told; null otherwise. */
  reason: string | null;
}

/** A condition GridIntel derived from telemetry, with the rule that produced it. */
export interface ConditionRowView {
  /** `rule:subject id`, as an alarm that agrees refers to it. */
  key: string;
  rule: string;
  ruleName: string;
  subject: AlarmSubjectView;
  /** Whether it holds at the as-of time; null when that cannot be told. */
  activeNow: boolean | null;
  /** The rule's figure: peak loading, or the time since the last check-in. */
  figure: MetricView;
  /** Readings at which it held; null where the rule does not count readings. */
  occurrences: number | null;
  firstAt: string | null;
  lastAt: string | null;
  sourceAlarm: SourceAlarmRelationView;
}

/**
 * Alarms recorded by source systems, and conditions derived by GridIntel. Two lists that are
 * never merged: the first is observed, the second calculated. Where an entry in one agrees
 * with an entry in the other, each says so and both stay where they are.
 */
export interface AlarmsView {
  sourcing: SourcingView;
  asOf: string;
  recorded: {
    /** How completely the source holds alarms. "not_available": it holds none at all, and no list is implied. */
    completeness: "complete" | "partial" | "not_available";
    /** What must be said about the list: that it is partial, or not available. */
    note: string | null;
    active: AlarmRowView[];
    /** Alarms whose raise time the source did not record. */
    undated: AlarmRowView[];
    /** The most recently raised of the alarms cleared by the as-of time; `clearedTotal` says how many there are. */
    cleared: AlarmRowView[];
    clearedTotal: number;
    /** Alarms on a subject not matched to the registry; listed at organization level only. */
    unplaced: number;
  };
  derived: {
    /** Each rule, and the kind of source alarm that is about the same thing. */
    rules: { id: string; name: string; statement: string; alarmKindName: string }[];
    method: MethodView;
    conditions: ConditionRowView[];
    /** Set when a rule could not be applied, e.g. no complete heartbeat record. */
    note: string | null;
    assetsChecked: number;
    devicesChecked: number;
    /** How many conditions a source alarm agrees with, how many none was raised for, and how many cannot be told. */
    agreement: { agrees: number; noneRaised: number; cannotTell: number };
  };
}

export interface NetworkLevelView {
  header: LevelHeader;
  losses: LossesView | null;
  /** Why there is no losses block, when there is none. */
  lossesNote: string | null;
  /** The revenue gap of the level, and of the sections directly below it. */
  revenueGap: RevenueGapView;
  revenueGapBelow: { title: string; rows: RevenueGapRow[] } | null;
  reliability: ReliabilityView;
  loading: LoadingView | null;
  /** On a substation: its power transformers. null on every other level. */
  powerTransformers: PowerTransformerView[] | null;
  children: ChildTable[];
  alarms: AlarmsView;
}

export interface OverviewView {
  asOf: string;
  period: { start: string; end: string };
  organization: string | null;
  regions: ChildTable;
  alarms: AlarmsView;
}

export interface ChargeView {
  id: string;
  billedAt: string;
  basis: string;
  basisLabel: string;
  energyKwh: number | null;
  amount: number;
  currency: string;
  tariff: string | null;
  estimated: boolean;
}

export interface PaymentView {
  id: string;
  receivedAt: string;
  amount: number;
  currency: string;
  channel: string | null;
}

export interface ServicePointView {
  header: LevelHeader;
  sourcing: SourcingView;
  account: { id: string; accountNumber: string | null; category: string | null; paymentMode: string | null; status: string } | null;
  metering: "prepaid" | "postpaid" | "unmetered" | "metered";
  meter: { id: string; serialNumber: string; type: string; phases: number | null } | null;
  /**
   * Energy the meter recorded in the period: the sum of its intervals, or the advance of its
   * register between two readings. "not_available" when there is no meter, or the meter is not read.
   */
  recorded: MetricView;
  /**
   * What is held for the meter:
   * - intervals: the meter records interval energy;
   * - register_readings: the meter is read by hand, about once a month;
   * - not_read: nothing is read from the meter (an ordinary prepaid meter);
   * - no_meter: there is no meter.
   */
  recordedFrom: "intervals" | "register_readings" | "not_read" | "no_meter";
  /** Set when the meter records intervals. */
  intervals: { expected: number | null; usable: number; coverage: number | null } | null;
  /** Set when the figure is a register advance: the two readings it lies between. */
  register: { openingAt: string; openingKwh: number; closingAt: string; closingKwh: number; estimated: boolean } | null;
  /**
   * For a meter read by hand: whether its register advance counts toward the recorded
   * consumption of the levels above, and the reason when it does not. Null for any other meter.
   */
  registerCounts: { counted: boolean; note: string } | null;
  /** Energy bought on prepaid vends in the period; null for an account with no vend. Purchased, not consumed. */
  purchased: MetricView | null;
  charges: ChargeView[];
  payments: PaymentView[];
  collectionBasis: "cash";
  /** Interruptions are recorded per transformer, not per service point. */
  reliabilityNote: string;
}
