import type { LevelKind, MetricView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — ASSETS WORKSPACE VIEW MODEL

   What the Assets screen receives. Its job: "Which assets require
   attention?"

   "Requires attention" is not a score. An asset is listed when one
   of three recorded or calculated facts is on it, each shown in its
   own column with its own origin: a source alarm standing on it, a
   condition GridIntel derived for it, or interruptions that began
   at it.
========================================================== */

export type AssetClass = "power_transformer" | "feeder" | "distribution_transformer";

/** A source alarm standing on the asset, or on the device that monitors it, at the as-of time. */
export interface AssetAlarmView {
  id: string;
  code: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  /** True when the alarm names the asset's monitor and not the asset itself. */
  onMonitor: boolean;
  raisedAt: string | null;
}

/** A condition GridIntel derived for the asset, or for the device that monitors it, in the period. */
export interface AssetConditionView {
  key: string;
  ruleName: string;
  onMonitor: boolean;
  /** Whether it holds at the as-of time; null when that cannot be told. */
  activeNow: boolean | null;
  /** Whether a source system raised an alarm of the matching kind. */
  sourceAlarm: "agrees" | "none_raised" | "cannot_tell";
}

export interface AssetRowView {
  assetClass: AssetClass;
  id: string;
  name: string;
  /** The screen that shows the asset; a power transformer is on its substation's. */
  link: { kind: LevelKind; id: string } | null;
  /** The substation, and for a transformer the feeder, it is on. */
  place: string;
  ratedKva: number | null;
  /** Highest loading at a reading in the period. "not_available" when no telemetry is held for the asset. */
  peak: MetricView;
  /** Loading at the as-of time. */
  now: MetricView;
  /** Readings in the period above 100% of rating, and readings looked at; null when no loading could be calculated. */
  readingsOverRating: number | null;
  readingsObserved: number | null;
  /** Must be shown with the loading figures when present. */
  loadingCaveat: string | null;
  alarms: AssetAlarmView[];
  conditions: AssetConditionView[];
  /**
   * Interruptions attributed to the distribution network that began at the asset in the period,
   * and what they added to the portfolio's SAIDI. null when the outage log is not complete, so
   * that "none" is never read from a partial log.
   */
  interruptionsBegan: number | null;
  saidiAddedHours: number | null;
  /** The registry's lifecycle status, as recorded. */
  lifecycle: string;
}

export interface AssetClassTable {
  assetClass: AssetClass;
  title: string;
  /** How completely the registry holds this class. Anything but "complete" must be shown. */
  coverage: "complete" | "partial" | "not_available";
  /** Highest peak loading first; an asset with no loading figure last. */
  rows: AssetRowView[];
  /** Assets of the class in service in the registry. */
  total: number;
  /** How many the short listing shows; null when the class is always listed whole. */
  limit: number | null;
  /** True when every asset of the class is in `rows`. */
  complete: boolean;
}

export interface AssetsWorkspaceView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  sourcing: SourcingView;
  /** The rule by which an asset is listed for attention and the order of the list, in words. */
  attentionRule: string;
  /** Assets with at least one of the three facts on them, in the order the rule gives. */
  attention: AssetRowView[];
  /** In-service assets looked at, of all classes. */
  assetsChecked: number;
  /** Standing source alarms that name none of these assets, e.g. a substation as a whole. They are on the Events / Alarms screen. */
  alarmsElsewhere: number;
  /** Whether "no source alarm" can be said: the source's alarm record is complete. */
  alarmRecord: "complete" | "partial" | "not_available";
  /** Whether "no interruption began here" can be said: the outage log is complete. */
  outageLog: "complete" | "partial" | "not_available";
  classes: AssetClassTable[];
  /** Monitoring devices in the registry, and those the "monitor quiet" rule could be applied to. */
  monitoring: { devices: MetricView; checked: number; note: string | null };
  /** What the platform holds no source for, said outright. */
  notHeld: { name: string; note: string }[];
  loadingMethod: { id: string; version: string; name: string };
}
