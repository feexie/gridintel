import type { MethodView, MetricView, ReportedComparisonView, SourcingView } from "../operations/views.ts";
import type { PeriodChoices, ReportPeriod } from "./period.ts";

/* ==========================================================
   SERVICES — REPORT VIEW MODEL (ADR 0019)

   What a downloadable report is given. Every report is one of these:
   the same envelope (identity, the sample label, contents, method,
   sources, regulatory references, glossary) around sections built
   from the read models the screens use. The layout prints it; the
   CSV is written from it. Nothing in it is calculated for the report
   alone.

   Every figure is a MetricView, so it keeps its status, its origin
   and its method on paper and in the CSV as it does on screen.
========================================================== */

/** A cell of a report table: a figure with its status and origin, or words. */
export type ReportCell =
  | { kind: "figure"; metric: MetricView }
  | { kind: "text"; text: string }
  /** An instant, ISO; null when the source did not record one. Written in the data's time zone on paper. */
  | { kind: "time"; iso: string | null; missing: string | null };

export interface ReportTableRow {
  id: string;
  /** The row's name: a feeder, a site, a cause. */
  label: string;
  /** A word under the name: the substation of a feeder, the side of the boundary of an origin point. */
  detail: string | null;
  cells: Record<string, ReportCell>;
}

export type ReportBlock =
  | { kind: "figures"; title: string | null; metrics: MetricView[] }
  | {
      kind: "table";
      title: string;
      /** What the table holds and how it is ordered, in one sentence. */
      caption: string | null;
      columns: { key: string; label: string }[];
      rows: ReportTableRow[];
      /** Said when there are no rows: why, never a zero. */
      empty: string | null;
      notes: string[];
      /** The methodologies the table's figures were calculated under; set by the document (document.ts). */
      methods?: MethodView[];
    }
  /**
   * Reported figures beside the calculation on their basis. A row whose report states an
   * attribution rule other than the reference one carries its finding, printed beside it.
   */
  | { kind: "comparisons"; title: string; note: string | null; rows: ReportedComparisonView[]; empty: string | null }
  /** Words that must be read with the figures: a caveat, a provisional figure, a period not covered. */
  | { kind: "statement"; tone: "note" | "caveat" | "unavailable"; title: string | null; text: string };

export interface ReportSection {
  /** Its anchor and its number in the contents. */
  id: string;
  number: number;
  title: string;
  /** What the section answers, in one sentence. */
  purpose: string;
  /** Starts on a new page when printed. */
  newPage: boolean;
  blocks: ReportBlock[];
}

/** A requirement of a regulator or a programme, and how far this report covers it. Never a claim of conformity. */
export interface RegulatoryReference {
  /** The instrument, as it is cited: "NERC Reporting Compliance Regulations 2009 (NERC-R-02-09), Schedule 4A". */
  instrument: string;
  /** The field or obligation, in the instrument's words where it has them. */
  requirement: string;
  coverage: "covered" | "partly" | "not_covered";
  /** Where the report has it, or why it does not. */
  where: string;
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

/** What a reader needs to find, reproduce and audit the report. */
export interface ReportIdentity {
  /** Stable for the same report, period, definition and data: "GI-REL-2026-09-1A2B3C4D". */
  reportId: string;
  /**
   * When the figures were computed: the wall clock in the composition root, not the data's clock.
   * A page built ahead of time (ADR 0012) has the build's time; it is not when the page was printed.
   */
  computedAt: string;
  /** The instant the data is as of: the end of the period. */
  dataAsOf: string;
  period: ReportPeriod;
  /** The version of the report's definition: which sections, which figures. */
  definitionVersion: string;
  /** SHA-256 over every record the report's services read, as a set (ADR 0019). */
  dataFingerprint: string;
  /** How the fingerprint is made, in one sentence. */
  fingerprintMethod: string;
  /** Every methodology a figure in the report was calculated under, with its version. */
  methods: MethodView[];
}

/** While the data is synthetic: printed on every page and on the cover. */
export interface SampleNotice {
  /** "SAMPLE: SYNTHETIC DATA". */
  label: string;
  /** The cover's statement: what this document is and is not. */
  statement: string;
  /** What the dataset is, in one sentence. */
  dataset: string;
}

export interface ReportHeader {
  id: string;
  /** Short code in the report ID: "REL". */
  code: string;
  sector: "utility" | "minigrid";
  title: string;
  audience: string;
  description: string;
  /** Whose records it is built from: the DisCo, the mini-grid operator. */
  organization: string | null;
}

export interface ReportDocumentView {
  header: ReportHeader;
  /** null while the data is real. */
  sample: SampleNotice | null;
  periods: PeriodChoices;
  period: ReportPeriod;
  /** Set when the data does not cover the period: the page says so and holds no figure. */
  unavailable: string | null;
  /** null when the period is not available: nothing was read, so nothing is identified. */
  identity: ReportIdentity | null;
  /** The figures on the cover: the few a reader needs first. */
  summary: MetricView[];
  /** Words the cover must carry with the figures: provisional figures, caveats. */
  summaryNotes: string[];
  sections: ReportSection[];
  sourcing: SourcingView | null;
  regulatory: { note: string; references: RegulatoryReference[] };
  glossary: GlossaryEntry[];
  /** The file name the CSV is downloaded as. */
  csvFileName: string;
}
