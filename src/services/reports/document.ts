import type { MethodView, MetricView } from "../operations/views.ts";
import type { ReportItem } from "../../constants/navigation.ts";
import type { ReportBody } from "./body.ts";
import type { ReportDefinition } from "./catalogue.ts";
import type { PeriodChoices, ReportPeriod } from "./period.ts";
import type { ReportDocumentView, ReportSection, SampleNotice } from "./views.ts";
import { REGULATORY_NOTE } from "./catalogue.ts";

/* ==========================================================
   SERVICES — THE REPORT DOCUMENT

   Puts the envelope round a report's body: who it is for, the
   period, the identity a reader needs to reproduce and audit it,
   the sample label while the data is synthetic, the methods used,
   the regulatory references and the glossary.

   Pure: the report ID, the time the figures were computed and the data fingerprint
   are given to it by the composition root, which made them.
========================================================== */

/** The label printed on every page while the data is synthetic. */
export const SAMPLE_LABEL = "SAMPLE: SYNTHETIC DATA";

export function sampleNotice(datasetSummary: string): SampleNotice {
  return {
    label: SAMPLE_LABEL,
    statement:
      "This report is a sample. It shows the format and the methods GridIntel would deliver; it is not a report of real results. " +
      "Every figure in it is calculated from a designed demonstration dataset, and none describes a real network, site, customer or organization.",
    dataset: datasetSummary,
  };
}

export const FINGERPRINT_METHOD =
  "SHA-256 over the sorted SHA-256 digests of every distinct result the report's services were given by the repositories, each written as JSON with its keys in order.";

/** Every metric in the body: the cover's, the figure blocks', the tables' and the comparisons'. */
function metricsOf(body: Pick<ReportBody, "summary" | "sections">): MetricView[] {
  const out: MetricView[] = [...body.summary];
  for (const section of body.sections) {
    for (const block of section.blocks) {
      if (block.kind === "figures") out.push(...block.metrics);
      if (block.kind === "table") for (const row of block.rows) for (const cell of Object.values(row.cells)) if (cell.kind === "figure") out.push(cell.metric);
      if (block.kind === "comparisons")
        for (const row of block.rows) {
          out.push(row.reported, row.calculated);
          if (row.ruleFinding !== null) out.push(row.ruleFinding.difference, row.ruleFinding.onReportedRule, row.ruleFinding.onReferenceRule);
        }
    }
  }
  return out;
}

/** Every methodology a figure in the report was calculated under, once each, in id order. */
export function methodsUsed(body: Pick<ReportBody, "summary" | "sections">): MethodView[] {
  const methods = new Map<string, MethodView>();
  for (const metric of metricsOf(body)) if (metric.method !== null) methods.set(`${metric.method.id}@${metric.method.version}`, metric.method);
  return [...methods.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.version < b.version ? -1 : 1));
}

/** The text the report ID's digest is taken of: the same definition, methods, period and data give the same ID. */
export function identitySeed(definition: ReportDefinition, period: ReportPeriod, methods: MethodView[], dataFingerprint: string): string {
  return [definition.id, definition.version, period.key, ...methods.map((method) => `${method.id}@${method.version}`), dataFingerprint].join("|");
}

/** "GI-REL-2026-09-1A2B3C4D", from the first eight characters of the digest of `identitySeed`. */
export function reportIdOf(definition: ReportDefinition, period: ReportPeriod, seedDigest: string): string {
  return `GI-${definition.code}-${period.key}-${seedDigest.slice(0, 8).toUpperCase()}`;
}

export interface DocumentInput {
  item: ReportItem;
  definition: ReportDefinition;
  period: ReportPeriod;
  periods: PeriodChoices;
  sample: SampleNotice | null;
  /** The report's figures; null when the period is not available. */
  built: { body: ReportBody; reportId: string; computedAt: string; dataAsOf: string; dataFingerprint: string; methods: MethodView[] } | null;
  /** Why the period is not available; null when it is. */
  unavailable: string | null;
}

function fileName(definition: ReportDefinition, period: ReportPeriod, sample: SampleNotice | null, extension: "csv" | "xlsx"): string {
  return `gridintel-${definition.id}-${period.key}${sample === null ? "" : "-SAMPLE-SYNTHETIC"}.${extension}`;
}

/** The periods a report offers: only the kinds it is made for. */
export function offeredPeriods(periods: PeriodChoices, definition: ReportDefinition): PeriodChoices {
  const kinds = definition.periodKinds;
  return { ...periods, days: kinds.includes("day") ? periods.days : [], months: kinds.includes("month") ? periods.months : [], years: kinds.includes("year") ? periods.years : [] };
}

export function reportDocument(input: DocumentInput): ReportDocumentView {
  const { item, definition, period, built } = input;
  // Each table names the methods its own figures were calculated under.
  const sections: ReportSection[] = (built?.body.sections ?? []).map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => (block.kind === "table" ? { ...block, methods: methodsUsed({ summary: [], sections: [{ ...section, blocks: [block] }] }) } : block)),
  }));
  return {
    header: {
      id: definition.id,
      code: definition.code,
      sector: item.sector,
      title: item.label,
      audience: item.audience,
      description: item.description,
      organization: built?.body.organization ?? null,
    },
    sample: input.sample,
    periods: offeredPeriods(input.periods, definition),
    period,
    unavailable: input.unavailable,
    identity:
      built === null
        ? null
        : {
            reportId: built.reportId,
            computedAt: built.computedAt,
            dataAsOf: built.dataAsOf,
            period,
            definitionVersion: definition.version,
            dataFingerprint: built.dataFingerprint,
            fingerprintMethod: FINGERPRINT_METHOD,
            methods: built.methods,
          },
    summary: built?.body.summary ?? [],
    summaryNotes: built?.body.summaryNotes ?? [],
    sections,
    sourcing: built?.body.sourcing ?? null,
    regulatory: { note: REGULATORY_NOTE, references: definition.regulatory },
    glossary: definition.glossary,
    onePage: definition.onePage === true,
    csvFileName: fileName(definition, period, input.sample, "csv"),
    xlsxFileName: fileName(definition, period, input.sample, "xlsx"),
  };
}
