import Link from "next/link";
import type { DisplayOrigin, DisplayStatus, MetricView, ReportedComparisonView, RuleFindingView } from "@/services/operations/views";
import type { PeriodChoice } from "@/services/reports/period";
import type { ReportBlock, ReportCell, ReportDocumentView, ReportSection } from "@/services/reports/views";
import { STATUS_MARK } from "../system/Metric";
import { ORIGIN_HINT, ORIGIN_LABEL, STATUS_HINT, STATUS_LABEL, formatMetric, formatSigned, formatTime } from "../system/format";
import { PrintButton } from "./PrintButton";

/* ==========================================================
   A REPORT, READY TO PRINT (ADR 0019)

   One layout for every report: a cover, the contents, the sections,
   and the appendices (method and reproduction, regulatory
   references, glossary). On screen it is a sheet of paper; printed
   or saved as PDF from the browser it is A4, each section where the
   report says to start a page.

   While the data is synthetic the label is on every printed page
   three times over, so that no page can be printed or cropped
   without it: in the page's top margin, in a band at the top of the
   page, and as a pattern of words across the whole page, over the
   figures. See `.gr-*` in globals.css.

   It formats and lays out. It calculates, ranks and filters nothing:
   every figure, word and order comes from the report service.
========================================================== */

const ORIGIN_ABBREVIATION: Record<DisplayOrigin, string> = { measured: "M", reported: "R", calculated: "C", estimated: "E", derived: "D" };

function hrefOf(view: ReportDocumentView, periodKey: string): string {
  return `/dashboard/${view.header.sector}/reports/${view.header.id}/${periodKey}`;
}

/** A figure with its status mark and its origin. `signed` writes a difference with its sign. */
function Value({ metric, signed = false }: { metric: MetricView; signed?: boolean }) {
  return (
    <span className="gr-value" title={`${metric.label} · ${STATUS_LABEL[metric.status]} · ${ORIGIN_LABEL[metric.origin]}`}>
      <span className={metric.value === null ? "gr-missing" : undefined}>
        {metric.value === null ? STATUS_LABEL[metric.status].toLowerCase() : signed ? formatSigned(metric) : formatMetric(metric)}
      </span>
      <span className={`gr-status gr-status-${metric.status}`} aria-label={STATUS_LABEL[metric.status]}>
        {STATUS_MARK[metric.status]}
      </span>
      {metric.value === null ? null : (
        <span className="gr-origin" aria-label={ORIGIN_LABEL[metric.origin]}>
          {ORIGIN_ABBREVIATION[metric.origin]}
        </span>
      )}
    </span>
  );
}

function Cell({ cell }: { cell: ReportCell | undefined }) {
  if (cell === undefined) return <span className="gr-missing">—</span>;
  if (cell.kind === "figure") return <Value metric={cell.metric} />;
  if (cell.kind === "time") return cell.iso === null ? <span className="gr-missing">{cell.missing}</span> : <span className="gr-mono">{formatTime(cell.iso)}</span>;
  return <span>{cell.text}</span>;
}

/** The sample label, as a band. Printed at the top of every page; on screen at the top of the sheet. */
function SampleBand({ view }: { view: ReportDocumentView }) {
  if (view.sample === null) return null;
  return (
    <div className="gr-band" data-sample-band>
      <strong>{view.sample.label}</strong>
      <span>{view.header.title}</span>
      <span className="gr-mono">{view.identity?.reportId ?? view.period.label}</span>
    </div>
  );
}

/** The label as a pattern of words over the whole page, so that no part of a page is without it. */
function Watermark({ label }: { label: string }) {
  return (
    <div className="gr-watermark" aria-hidden>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="gr-sample" width="330" height="170" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <text x="0" y="60" className="gr-watermark-text">
              {label}
            </text>
            <text x="165" y="145" className="gr-watermark-text">
              {label}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gr-sample)" />
      </svg>
    </div>
  );
}

/** The report ID in the top margin of every printed page. */
function PageMargins({ view }: { view: ReportDocumentView }) {
  const id = view.identity?.reportId ?? `${view.header.code} ${view.period.key}`;
  // An ID is letters, digits and dashes; anything else is left out rather than written into a style rule.
  const safe = id.replace(/[^A-Za-z0-9 -]/g, "");
  return <style>{`@page { @top-right { content: "${safe}"; } }`}</style>;
}

function Figures({ metrics }: { metrics: MetricView[] }) {
  return (
    <dl className="gr-figures">
      {metrics.map((metric) => (
        <div key={metric.label} className="gr-figure">
          <dt>{metric.label}</dt>
          <dd>
            <Value metric={metric} />
          </dd>
          <dd className="gr-figure-meta">
            {STATUS_LABEL[metric.status]} · {ORIGIN_LABEL[metric.origin]}
            {metric.method ? ` · ${metric.method.id} ${metric.method.version}` : ""}
          </dd>
          {metric.note ? <dd className="gr-figure-note">{metric.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function Finding({ finding }: { finding: RuleFindingView }) {
  return (
    <div className="gr-finding">
      <p className="gr-finding-title">Attribution-rule finding · {finding.statedFor.name}</p>
      <p>{finding.statement}</p>
      <dl>
        <div>
          <dt>{finding.onReportedRule.label}</dt>
          <dd>
            <Value metric={finding.onReportedRule} />
          </dd>
        </div>
        <div>
          <dt>{finding.onReferenceRule.label}</dt>
          <dd>
            <Value metric={finding.onReferenceRule} />
          </dd>
        </div>
        <div>
          <dt>What the rule changes</dt>
          <dd>
            <Value metric={finding.difference} signed />
          </dd>
        </div>
      </dl>
      {finding.document ? <p className="gr-small">From: {finding.document}</p> : null}
    </div>
  );
}

function Comparison({ row }: { row: ReportedComparisonView }) {
  return (
    <div className="gr-comparison">
      <div className="gr-comparison-main">
        <p className="gr-comparison-title">
          {row.label}
          {row.statedFor ? <span className="gr-detail"> · {row.statedFor}</span> : null}
        </p>
        <table className="gr-table gr-compact">
          <tbody>
            <tr>
              <th scope="row">Reported</th>
              <td>
                <Value metric={row.reported} />
              </td>
              <td className="gr-basis">{row.reportedBasis ?? "Basis not stated"}</td>
            </tr>
            <tr>
              <th scope="row">Calculated</th>
              <td>
                <Value metric={row.calculated} />
              </td>
              <td className="gr-basis">{row.calculatedBasis ?? "Basis not stated"}</td>
            </tr>
          </tbody>
        </table>
        <p className="gr-small">
          {row.comparable && row.variance !== null
            ? `Same basis. Calculated less reported: ${row.variance > 0 ? "+" : ""}${row.variance.toFixed(2)} ${row.varianceUnit === "currency" ? (row.reported.currency ?? "") : row.varianceUnit.replaceAll("_", " ")}.`
            : `Not compared: ${row.reasons.join(" ") || "the bases differ."}`}
          {row.caveats.length > 0 ? ` ${row.caveats.join(" ")}` : ""}
        </p>
        {row.document ? <p className="gr-small">From: {row.document}</p> : null}
      </div>
      {row.ruleFinding ? <Finding finding={row.ruleFinding} /> : null}
    </div>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "figures":
      return (
        <div className="gr-block">
          {block.title ? <h3>{block.title}</h3> : null}
          <Figures metrics={block.metrics} />
        </div>
      );
    case "statement":
      return (
        <div className={`gr-statement gr-statement-${block.tone}`}>
          {block.title ? <strong>{block.title}. </strong> : null}
          {block.text}
        </div>
      );
    case "comparisons":
      return (
        <div className="gr-block">
          <h3>{block.title}</h3>
          {block.note ? <p className="gr-small">{block.note}</p> : null}
          {block.rows.length === 0 ? <p className="gr-statement gr-statement-note">{block.empty}</p> : block.rows.map((row, i) => <Comparison key={`${row.label}-${row.statedFor ?? ""}-${i}`} row={row} />)}
        </div>
      );
    case "table":
      return (
        <div className="gr-block">
          <h3>{block.title}</h3>
          {block.caption ? <p className="gr-small">{block.caption}</p> : null}
          {block.rows.length === 0 ? (
            <p className="gr-statement gr-statement-note">{block.empty}</p>
          ) : (
            <div className="gr-table-frame">
              <table className="gr-table">
                <thead>
                  <tr>
                    <th scope="col" />
                    {block.columns.map((column) => (
                      <th key={column.key} scope="col">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        {row.label}
                        {row.detail ? <span className="gr-detail">{row.detail}</span> : null}
                      </th>
                      {block.columns.map((column) => (
                        <td key={column.key}>
                          <Cell cell={row.cells[column.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {block.methods && block.methods.length > 0 ? <p className="gr-small">Method: {block.methods.map((method) => `${method.name} (${method.id} ${method.version})`).join("; ")}.</p> : null}
          {block.notes.map((note) => (
            <p key={note} className="gr-small">
              {note}
            </p>
          ))}
        </div>
      );
  }
}

function Section({ section }: { section: ReportSection }) {
  return (
    <section id={section.id} className={`gr-section${section.newPage ? " gr-new-page" : ""}`}>
      <h2>
        <span className="gr-number">{section.number}</span> {section.title}
      </h2>
      <p className="gr-purpose">{section.purpose}</p>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </section>
  );
}

function PeriodLinks({ view, choices, label }: { view: ReportDocumentView; choices: PeriodChoice[]; label: string }) {
  return (
    <div className="gr-periods-group">
      <span className="gr-periods-label">{label}</span>
      <div className="gr-periods-list">
        {choices.map((choice) => (
          <Link
            key={choice.period.key}
            href={hrefOf(view, choice.period.key)}
            aria-current={choice.period.key === view.period.key ? "page" : undefined}
            className={choice.available ? undefined : "gr-period-unavailable"}
            title={choice.available ? choice.period.label : `${choice.period.label}: not available for this period`}
            prefetch={false}
          >
            {choice.period.kind === "day" ? choice.period.key.slice(8).replace(/^0/, "") : choice.period.label}
            {choice.available ? null : <span className="gr-period-note"> not available</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** What is on screen and not on paper: back to the list, the period, the CSV and the print button. */
function Toolbar({ view }: { view: ReportDocumentView }) {
  const csv = `${hrefOf(view, view.period.key)}/data.csv`;
  return (
    <div className="gr-toolbar">
      <div className="gr-toolbar-row">
        <Link href={`/dashboard/${view.header.sector}/reports`} className="gr-link">
          ← Reports
        </Link>
        <div className="gr-actions">
          {view.unavailable === null ? (
            <a href={csv} download={view.csvFileName} className="gr-button gr-button-quiet">
              Download figures (CSV)
            </a>
          ) : null}
          <PrintButton />
        </div>
      </div>
      <nav className="gr-periods" aria-label="Period">
        <p className="gr-small">The data covers {view.periods.coverage}. A period it does not wholly cover is not available, and is never filled.</p>
        <PeriodLinks view={view} choices={view.periods.months} label="Month" />
        <PeriodLinks view={view} choices={view.periods.years} label="Year" />
        <PeriodLinks view={view} choices={view.periods.days} label="Day" />
      </nav>
    </div>
  );
}

const STATUSES: DisplayStatus[] = ["ok", "calculated_with_estimates", "insufficient_data", "not_computable", "not_available"];
const ORIGINS: DisplayOrigin[] = ["measured", "reported", "calculated", "estimated", "derived"];

export function ReportDocument({ view }: { view: ReportDocumentView }) {
  const identity = view.identity;
  const appendixStart = view.sections.length + 1;
  return (
    <div className="gr-report">
      <Toolbar view={view} />
      <PageMargins view={view} />
      <article className={`gr-sheet${view.sample ? " gr-sample" : ""}`} aria-label={view.header.title}>
        {view.sample ? <Watermark label={view.sample.label} /> : null}
        <SampleBand view={view} />

        {/* The cover */}
        <header className="gr-cover">
          <p className="gr-eyebrow">GridIntel · {view.header.sector === "utility" ? "Utility Intelligence" : "Mini-grid Intelligence"}</p>
          <h1>{view.header.title}</h1>
          <p className="gr-lede">{view.header.description}</p>
          {view.sample ? (
            <div className="gr-sample-box" data-sample-box>
              <p className="gr-sample-label">{view.sample.label}</p>
              <p>{view.sample.statement}</p>
              <p className="gr-small">{view.sample.dataset}</p>
            </div>
          ) : null}
          <dl className="gr-identity">
            <div>
              <dt>For</dt>
              <dd>{view.header.audience}</dd>
            </div>
            <div>
              <dt>Records of</dt>
              <dd>{view.header.organization ?? "—"}</dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{view.period.label}</dd>
            </div>
            {identity ? (
              <>
                <div>
                  <dt>Report ID</dt>
                  <dd className="gr-mono">{identity.reportId}</dd>
                </div>
                <div className="gr-identity-wide">
                  <dt>Figures computed</dt>
                  <dd>
                    {formatTime(identity.computedAt)}, from data as of {formatTime(identity.dataAsOf)}
                  </dd>
                </div>
                <div>
                  <dt>Definition</dt>
                  <dd>Version {identity.definitionVersion}</dd>
                </div>
                <div className="gr-identity-wide">
                  <dt>Data fingerprint (SHA-256)</dt>
                  <dd className="gr-mono gr-break">{identity.dataFingerprint}</dd>
                </div>
              </>
            ) : null}
          </dl>

          {view.unavailable ? (
            <div className="gr-statement gr-statement-unavailable" role="status">
              <strong>Not available for this period. </strong>
              {view.unavailable.replace(/^Not available for this period\. /, "")}
            </div>
          ) : (
            <>
              <h2 className="gr-cover-head">In brief</h2>
              <Figures metrics={view.summary} />
              {view.summaryNotes.map((note) => (
                <p key={note} className="gr-statement gr-statement-caveat">
                  {note}
                </p>
              ))}
              <h2 className="gr-cover-head">Contents</h2>
              <ol className="gr-contents">
                {view.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      {section.number}. {section.title}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="#method">{appendixStart}. Method, sources and how to reproduce this report</a>
                </li>
                <li>
                  <a href="#regulatory">{appendixStart + 1}. Regulatory references</a>
                </li>
                <li>
                  <a href="#glossary">{appendixStart + 2}. Glossary and key</a>
                </li>
              </ol>
            </>
          )}
        </header>

        {view.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {identity ? (
          <section id="method" className="gr-section gr-new-page">
            <h2>
              <span className="gr-number">{appendixStart}</span> Method, sources and how to reproduce this report
            </h2>
            <p className="gr-purpose">Where every figure came from, and how a reader can check that this document is the one the records give.</p>
            <div className="gr-block">
              <h3>Methodologies</h3>
              <div className="gr-table-frame">
                <table className="gr-table gr-compact">
                  <thead>
                    <tr>
                      <th scope="col">Methodology</th>
                      <th scope="col">Version</th>
                      <th scope="col">What it says of itself</th>
                    </tr>
                  </thead>
                  <tbody>
                    {identity.methods.map((method) => (
                      <tr key={`${method.id}@${method.version}`}>
                        <th scope="row">
                          {method.name}
                          <span className="gr-detail gr-mono">{method.id}</span>
                        </th>
                        <td className="gr-mono">{method.version}</td>
                        <td className="gr-text">{method.disclaimer || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="gr-block">
              <h3>Sources</h3>
              <ul className="gr-list">
                {(view.sourcing?.sources ?? []).map((source) => (
                  <li key={source.id}>
                    {source.name} <span className="gr-detail">({source.kind}{source.dated ? `, ${source.dated}` : ""})</span>
                    {source.attribution ? <span className="gr-detail"> {source.attribution}</span> : null}
                  </li>
                ))}
              </ul>
              {view.sourcing?.synthetic ? <p className="gr-statement gr-statement-caveat">Every source above is synthetic: designed demonstration data, not records of a real organization.</p> : null}
            </div>
            <div className="gr-block">
              <h3>How to reproduce it</h3>
              <ol className="gr-list">
                <li>Build the report with definition version {identity.definitionVersion}, for {identity.period.label}, from the {view.header.organization ?? "same"} records.</li>
                <li>
                  The data fingerprint must be <span className="gr-mono gr-break">{identity.dataFingerprint}</span>. {identity.fingerprintMethod}
                </li>
                <li>With the same definition, methodologies and fingerprint the report ID is the same: {identity.reportId}. A different ID means something above differs.</li>
                <li>The figures with their status, origin, unit and method are in the CSV of the same report ID: {view.csvFileName}.</li>
              </ol>
            </div>
          </section>
        ) : null}

        <section id="regulatory" className={`gr-section${identity ? "" : " gr-new-page"}`}>
          <h2>
            <span className="gr-number">{appendixStart + (identity ? 1 : 0)}</span> Regulatory references
          </h2>
          <p className="gr-statement gr-statement-caveat">{view.regulatory.note}</p>
          <div className="gr-table-frame">
            <table className="gr-table gr-compact gr-regulatory">
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col">Requirement</th>
                  <th scope="col">This report</th>
                </tr>
              </thead>
              <tbody>
                {view.regulatory.references.map((reference) => (
                  <tr key={`${reference.instrument}-${reference.requirement}`}>
                    <td className="gr-text">{reference.instrument}</td>
                    <td className="gr-text">{reference.requirement}</td>
                    <td className="gr-text">
                      <strong className={`gr-coverage gr-coverage-${reference.coverage}`}>
                        {reference.coverage === "covered" ? "Carried" : reference.coverage === "partly" ? "Partly" : "Not carried"}
                      </strong>{" "}
                      {reference.where}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="glossary" className="gr-section">
          <h2>
            <span className="gr-number">{appendixStart + (identity ? 2 : 1)}</span> Glossary and key
          </h2>
          <dl className="gr-glossary">
            {view.glossary.map((entry) => (
              <div key={entry.term}>
                <dt>{entry.term}</dt>
                <dd>{entry.meaning}</dd>
              </div>
            ))}
          </dl>
          <h3>The marks beside a figure</h3>
          <dl className="gr-glossary">
            {STATUSES.map((status) => (
              <div key={status}>
                <dt>
                  <span className={`gr-status gr-status-${status}`}>{STATUS_MARK[status]}</span> {STATUS_LABEL[status]}
                </dt>
                <dd>{STATUS_HINT[status]}</dd>
              </div>
            ))}
            {ORIGINS.map((origin) => (
              <div key={origin}>
                <dt>
                  <span className="gr-origin">{ORIGIN_ABBREVIATION[origin]}</span> {ORIGIN_LABEL[origin]}
                </dt>
                <dd>{ORIGIN_HINT[origin]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="gr-end">
          {view.sample ? <strong>{view.sample.label}. </strong> : null}
          End of report{identity ? ` ${identity.reportId}` : ""}.
        </footer>
      </article>
    </div>
  );
}
