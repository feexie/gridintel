import Link from "next/link";
import { PrintButton } from "@/components/reports/PrintButton";
import type { MeteringPlanReportView, PlanReportBlock, PlanReportSection } from "@/services/planning/report";
import type { ShownFigure } from "@/services/planning/views";

/* ==========================================================
   THE METERING PLAN REPORT, READY TO PRINT

   The report system's layout (ADR 0019; `.gr-*` in globals.css): a
   cover, the contents, the sections and the sources, a sheet of paper
   on screen and A4 when printed or saved as PDF from the browser. It
   formats and lays out; every figure, word and order comes from the
   report service, with the origin of each figure beside it.
========================================================== */

const ORIGIN_WORDS: Record<ShownFigure["origin"], string> = {
  reported: "Reported",
  calculated: "Calculated",
  assumption: "Assumption",
  placeholder: "Placeholder",
  test_scenario: "Test scenario",
  synthetic: "Synthetic",
};

function Figures({ figures }: { figures: ShownFigure[] }) {
  return (
    <dl className="gr-figures">
      {figures.map((figure) => (
        <div key={`${figure.key}-${figure.label}`} className="gr-figure" data-report-figure={figure.key}>
          <dt>{figure.label}</dt>
          <dd>
            <span className="gr-value gr-value-words">{figure.value}</span>
          </dd>
          <dd className="gr-figure-meta" data-origin={figure.origin}>
            {ORIGIN_WORDS[figure.origin]}
          </dd>
          <dd className="gr-figure-note">{figure.basis}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ block }: { block: PlanReportBlock }) {
  switch (block.kind) {
    case "figures":
      return (
        <div className="gr-block">
          {block.title ? <h3>{block.title}</h3> : null}
          <Figures figures={block.figures} />
        </div>
      );
    case "statement":
      return (
        <p className={`gr-statement ${block.tone === "caveat" ? "gr-statement-caveat" : "gr-statement-note"}`} data-report-statement={block.tone}>
          {block.tone === "finding" ? <strong>{block.text}</strong> : block.text}
        </p>
      );
    case "table":
      return (
        <div className="gr-block">
          <h3>{block.title}</h3>
          {block.caption ? <p className="gr-small">{block.caption}</p> : null}
          <div className="gr-table-frame">
            <table className="gr-table gr-compact gr-words-table">
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
                    <th scope="row">{row.label}</th>
                    {block.columns.map((column) => (
                      <td key={column.key} className="gr-text">
                        {row.cells[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.notes.map((note) => (
            <p key={note} className="gr-small">
              {note}
            </p>
          ))}
        </div>
      );
  }
}

function Section({ section }: { section: PlanReportSection }) {
  return (
    <section id={section.id} className="gr-section gr-new-page" data-report-section={section.id}>
      {section.step ? <p className="gr-eyebrow">{section.step}</p> : null}
      <h2>
        <span className="gr-number">{section.number}</span> {section.title}
      </h2>
      <p className="gr-purpose">{section.purpose}</p>
      {section.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </section>
  );
}

export function MeteringPlanReport({ view, backHref }: { view: MeteringPlanReportView; backHref: string }) {
  return (
    <div className="gr-report" data-metering-report>
      <div className="gr-toolbar">
        <div className="gr-toolbar-row">
          <Link href={backHref} className="gr-link">
            ← Metering planner
          </Link>
          <div className="gr-actions">
            <PrintButton />
          </div>
        </div>
      </div>
      <article className="gr-sheet">
        <div className="gr-band" data-data-band>
          <strong>{view.dataLabel}</strong>
          <span>{view.title}</span>
          <span>{view.scope}</span>
        </div>
        <header className="gr-cover">
          <p className="gr-eyebrow">{view.eyebrow}</p>
          <h1>{view.title}</h1>
          <p className="gr-lede">{view.positioning}</p>
          <p className="gr-statement gr-statement-caveat" data-data-statement>
            {view.dataStatement}
          </p>
          <h2 className="gr-cover-head">In brief</h2>
          <Figures figures={view.brief} />
          <nav className="gr-contents" aria-label="Contents">
            <h2 className="gr-cover-head">Contents</h2>
            <ol>
              {view.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <span className="gr-number">{section.number}</span> {section.step ? `${section.step}: ` : ""}
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        {view.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {/* The close of the last section, Assumptions and sources: the sources, the methods and the origin labels. */}
        <section id="sources" className="gr-section" data-report-section="sources">
          <h3>Sources, methods and the origin labels</h3>
          <div className="gr-block">
            <h3>Sources</h3>
            <ol className="gr-list" data-report-citations>
              {view.citations.map((citation) => (
                <li key={citation.id}>
                  <strong>{citation.title}</strong>
                  {citation.published ? `, ${citation.published}` : ""}. {citation.standing === "primary" ? "Primary source" : "Secondary source"}
                  {citation.locator ? `. ${citation.locator}` : ""}.{citation.url ? <span className="gr-detail gr-break"> {citation.url}</span> : null}
                </li>
              ))}
            </ol>
          </div>
          <div className="gr-block">
            <h3>Methods</h3>
            <ul className="gr-list">
              {view.methods.map((method) => (
                <li key={method.id}>
                  <span className="gr-mono">
                    {method.id} {method.version}
                  </span>
                  . {method.disclaimer}
                </li>
              ))}
            </ul>
          </div>
          <div className="gr-block">
            <h3>The origin labels</h3>
            <dl className="gr-glossary">
              {view.originKey.map((one) => (
                <div key={one.origin}>
                  <dt>{one.label}</dt>
                  <dd>{one.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <footer className="gr-end">
          <strong>{view.dataLabel}. </strong>
          End of the {view.title} report.
        </footer>
      </article>
    </div>
  );
}
