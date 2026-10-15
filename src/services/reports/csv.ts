import type { MetricView } from "../operations/views.ts";
import type { ReportCell, ReportDocumentView } from "./views.ts";

/* ==========================================================
   SERVICES — A REPORT'S FIGURES AS CSV

   Every figure in the report, one row each, with its status, origin,
   unit and method, and the report's identity on every row, so that a
   row copied out of the file still says where it came from. While
   the data is synthetic, every row carries the sample label.

   Values are written as the services hold them: unrounded, a ratio
   as a fraction, hours as hours. A missing value is an empty cell
   with its status; it is never written as 0.
========================================================== */

const HEADER = ["sample_label", "report_id", "period", "section", "table", "row", "column", "value", "unit", "currency", "status", "origin", "method_id", "method_version", "note"];

type Context = { sample: string; reportId: string; period: string };

function escape(value: string): string {
  // A cell a spreadsheet would read as a formula is written as text.
  const safe = /^[=+@\t\r]/.test(value) || (/^-/.test(value) && Number.isNaN(Number(value))) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function line(fields: string[]): string {
  return fields.map(escape).join(",");
}

function metricRow(ctx: Context, section: string, table: string, row: string, column: string, metric: MetricView): string {
  const note = [...new Set([metric.note, ...metric.warnings])].filter((one): one is string => one !== null && one !== "").join(" ");
  return line([
    ctx.sample,
    ctx.reportId,
    ctx.period,
    section,
    table,
    row,
    column,
    metric.value === null ? "" : String(metric.value),
    metric.unit,
    metric.currency ?? "",
    metric.status,
    metric.origin,
    metric.method?.id ?? "",
    metric.method?.version ?? "",
    note,
  ]);
}

function textRow(ctx: Context, section: string, table: string, row: string, column: string, value: string, unit = "text"): string {
  return line([ctx.sample, ctx.reportId, ctx.period, section, table, row, column, value, unit, "", "", "", "", "", ""]);
}

function cellRow(ctx: Context, section: string, table: string, row: string, column: string, cell: ReportCell): string {
  if (cell.kind === "figure") return metricRow(ctx, section, table, row, column, cell.metric);
  if (cell.kind === "time") return textRow(ctx, section, table, row, column, cell.iso ?? cell.missing ?? "", "time");
  return textRow(ctx, section, table, row, column, cell.text);
}

export function reportCsv(document: ReportDocumentView): string {
  const ctx: Context = { sample: document.sample?.label ?? "", reportId: document.identity?.reportId ?? "", period: document.period.key };
  const rows: string[] = [line(HEADER)];
  const about = (row: string, value: string) => rows.push(textRow(ctx, "Report", "Identity", row, "", value));
  about("Title", document.header.title);
  about("For", document.header.audience);
  about("Organization", document.header.organization ?? "");
  about("Period", `${document.period.label} [${document.period.start}, ${document.period.end})`);
  if (document.sample !== null) {
    about("Sample", document.sample.statement);
    about("Dataset", document.sample.dataset);
  }
  if (document.unavailable !== null) {
    rows.push(line([ctx.sample, ctx.reportId, ctx.period, "Report", "Identity", "Period", "availability", "", "", "", "not_available", "", "", "", document.unavailable]));
    return rows.join("\r\n") + "\r\n";
  }
  const identity = document.identity;
  if (identity !== null) {
    about("Generated at", identity.generatedAt);
    about("Data as of", identity.dataAsOf);
    about("Definition version", identity.definitionVersion);
    about("Data fingerprint (SHA-256)", identity.dataFingerprint);
    about("Fingerprint method", identity.fingerprintMethod);
    for (const method of identity.methods) about("Methodology", `${method.id} ${method.version}: ${method.name}`);
  }
  for (const metric of document.summary) rows.push(metricRow(ctx, "Summary", "", metric.label, "", metric));
  for (const note of document.summaryNotes) rows.push(textRow(ctx, "Summary", "", "Note", "", note));

  for (const section of document.sections) {
    const name = `${section.number}. ${section.title}`;
    for (const block of section.blocks) {
      if (block.kind === "figures") for (const metric of block.metrics) rows.push(metricRow(ctx, name, block.title ?? "", metric.label, "", metric));
      if (block.kind === "statement") rows.push(textRow(ctx, name, block.title ?? "", block.tone, "", block.text));
      if (block.kind === "table") {
        if (block.rows.length === 0 && block.empty !== null) rows.push(textRow(ctx, name, block.title, "None", "", block.empty));
        for (const row of block.rows) {
          const label = row.detail === null ? row.label : `${row.label} (${row.detail})`;
          for (const column of block.columns) {
            const cell = row.cells[column.key];
            if (cell !== undefined) rows.push(cellRow(ctx, name, block.title, label, column.label, cell));
          }
        }
        for (const note of block.notes) rows.push(textRow(ctx, name, block.title, "Note", "", note));
      }
      if (block.kind === "comparisons") {
        if (block.rows.length === 0 && block.empty !== null) rows.push(textRow(ctx, name, block.title, "None", "", block.empty));
        for (const row of block.rows) {
          const label = row.statedFor ? `${row.label}, ${row.statedFor}` : row.label;
          rows.push(metricRow(ctx, name, block.title, label, "Reported", row.reported));
          rows.push(metricRow(ctx, name, block.title, label, "Calculated", row.calculated));
          rows.push(textRow(ctx, name, block.title, label, "Reported basis", row.reportedBasis ?? "Not stated"));
          rows.push(textRow(ctx, name, block.title, label, "Calculated basis", row.calculatedBasis ?? "Not stated"));
          rows.push(textRow(ctx, name, block.title, label, "Comparable", row.comparable ? "yes" : `no: ${row.reasons.join(" ")}`));
          if (row.comparable && row.variance !== null) rows.push(textRow(ctx, name, block.title, label, "Variance (calculated − reported)", String(row.variance), row.varianceUnit));
          if (row.document !== null) rows.push(textRow(ctx, name, block.title, label, "Document", row.document));
          if (row.ruleFinding !== null) {
            const finding = row.ruleFinding;
            rows.push(textRow(ctx, name, block.title, label, "Attribution-rule finding", finding.statement));
            rows.push(metricRow(ctx, name, block.title, label, finding.onReportedRule.label, finding.onReportedRule));
            rows.push(metricRow(ctx, name, block.title, label, finding.onReferenceRule.label, finding.onReferenceRule));
            rows.push(metricRow(ctx, name, block.title, label, finding.difference.label, finding.difference));
          }
        }
        if (block.note !== null) rows.push(textRow(ctx, name, block.title, "Note", "", block.note));
      }
    }
  }
  for (const source of document.sourcing?.sources ?? []) about("Source", `${source.name} (${source.kind})${source.attribution ? `; ${source.attribution}` : ""}`);
  return rows.join("\r\n") + "\r\n";
}
