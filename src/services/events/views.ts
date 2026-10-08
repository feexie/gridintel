import type { AlarmRowView, AlarmSubjectView, AlarmsView, ConditionRowView, LevelKind, MetricView, SourcingView } from "../operations/views.ts";

/* ==========================================================
   SERVICES — EVENTS / ALARMS WORKSPACE VIEW MODEL

   What the Events / Alarms screen receives. Its job: "What is wrong
   now, where, and who is affected?"

   Three kinds of thing, each in its own list and never merged:
   alarms a source system recorded (observed), conditions GridIntel
   derived (calculated), and interruptions in the outage log
   (observed).
========================================================== */

/** Where a subject sits: the names of the substation and feeder above it, outermost first. */
export interface PlaceView {
  path: { kind: LevelKind; id: string; name: string }[];
}

/**
 * Active customer accounts connected behind a subject, counted from the registry. It says who
 * is connected there, not who is without supply: an alarm does not say supply was lost.
 */
export type AccountsBehind = MetricView;

export interface StandingAlarmRow {
  alarm: AlarmRowView;
  place: PlaceView;
  accountsBehind: AccountsBehind;
}

export interface HoldingConditionRow {
  condition: ConditionRowView;
  place: PlaceView;
  accountsBehind: AccountsBehind;
}

/** One outage in the outage log whose customers, or some of them, had not got supply back at the as-of time. */
export interface OpenInterruptionRow {
  outageId: string;
  /** The status the source gives the outage; null when it gives none. */
  status: "open" | "closed" | null;
  /** Where the outage record says the interruption began, and where that is. */
  beganAt: AlarmSubjectView;
  place: PlaceView;
  /** The elements still without supply. */
  affected: AlarmSubjectView[];
  cause: string;
  planned: boolean | null;
  interruptedAt: string;
  /** When the record says the last part came back; null when it holds no restoration time. */
  restoredAt: string | null;
  /**
   * Customers of the parts still off, as the outage record gives them: counted for the
   * interruption (measured), read from the network model (calculated), or a judgement
   * (estimated). "insufficient_data" when the record gives no count for some part.
   */
  customers: MetricView;
}

/** One substation or feeder, with how much of each list is under it. Lengths of the lists its own screen shows. */
export interface PlaceRow {
  kind: "substation" | "feeder";
  id: string;
  name: string;
  /** For a feeder, its substation's name. */
  within: string | null;
  activeAlarms: number;
  undatedAlarms: number;
  clearedAlarms: number;
  conditions: number;
  conditionsHolding: number;
  /** Interruptions in progress at the as-of time with a part on this element or below it. */
  interruptionsInProgress: number;
  accounts: MetricView;
}

export interface EventsWorkspaceView {
  organization: string | null;
  period: { start: string; end: string };
  asOf: string;
  sourcing: SourcingView;
  now: {
    /** Source alarms standing at the as-of time, most severe first. */
    alarms: StandingAlarmRow[];
    /** Alarms whose raise time the source did not record: their state cannot be told. */
    undatedAlarms: number;
    /** Derived conditions that hold at the as-of time. */
    conditions: HoldingConditionRow[];
    /** Conditions found in the period that do not hold at the as-of time, or whose state at it is not known. */
    conditionsNotHolding: number;
    interruptions: {
      /** How completely the source holds the outage log. Anything but "complete" must be said. */
      completeness: "complete" | "partial" | "not_available";
      note: string | null;
      /** The source says the outage is open, or the record says supply was restored after the as-of time. */
      inProgress: OpenInterruptionRow[];
      /** No restoration time, and the source says the outage is closed or does not say: a gap in the record. */
      restorationNotRecorded: OpenInterruptionRow[];
      /** Exposures whose start the source did not record. */
      startNotRecorded: number;
    };
  };
  /** Where: every substation and feeder, in registry order. */
  places: PlaceRow[];
  /** The two full lists for the reporting period: every cleared alarm is listed. */
  alarms: AlarmsView;
}
