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
  sources: { id: string; name: string; kind: string }[];
}

export type LevelKind = "region" | "substation" | "feeder" | "distribution_transformer" | "service_point";

export interface Crumb {
  kind: LevelKind;
  id: string;
  label: string;
}

/* ---------------- Losses ---------------- */

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
    /** Connections under the scope by what their meter can report. The four kinds add up to `servicePoints`. */
    coverage: { servicePoints: number; recorded: number; incomplete: number; withoutIntervalData: number; unmetered: number };
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
  /** Billing and collection by customer class, largest billing first. */
  byCustomerClass: { category: string; label: string; accounts: number; revenueBilled: number; revenueCollected: number; collection: MetricView }[];
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
  /** Exposures recorded above the scope or on an unresolved name: not in any index. */
  unattributable: number;
  excludedForData: number;
  momentary: number;
  supply: SupplyView;
  reported: ReportedComparisonView[];
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

export interface NotAvailableView {
  title: string;
  reason: string;
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
  children: ChildTable[];
  alarms: NotAvailableView;
}

export interface OverviewView {
  asOf: string;
  period: { start: string; end: string };
  organization: string | null;
  regions: ChildTable;
  alarms: NotAvailableView;
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
  /** Energy bought on prepaid vends in the period; null for an account with no vend. Purchased, not consumed. */
  purchased: MetricView | null;
  charges: ChargeView[];
  payments: PaymentView[];
  collectionBasis: "cash";
  /** Interruptions are recorded per transformer, not per service point. */
  reliabilityNote: string;
}
