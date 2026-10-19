"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { formatPeriod, formatTime } from "./format";

/* The one place a screen says what data it is looking at: the SYNTHETIC DATA label when the
   data is synthetic, the reporting period, and the time the data is as of. It sits above every
   dashboard screen, so no screen repeats it and none can be without it.

   On a phone the label, the period and the as-of time are always in view; the sentence that says
   what the dataset is opens with one tap. Nothing is left out at any width.

   On a report's page the bar names the report's own period (a day or a month) and the instant its
   data is as of, looked up by the period in the address; never the platform's month. */

/** A report's address: /dashboard/{sector}/reports/{report}/{period}. */
const REPORT_ADDRESS = /^\/dashboard\/[^/]+\/reports\/[^/]+\/([^/]+)$/;

export interface DataContext {
  /** What must be said about the data; null for real data. */
  notice: { label: string; summary: string } | null;
  period: { start: string; end: string };
  asOf: string;
  /** By period key, what a report's page says: its period in words, and its as-of instant or null when not available. */
  reportPeriods: Record<string, { label: string; asOf: string | null }>;
}

export function DataBar({ context }: { context: DataContext }) {
  const { notice } = context;
  const [open, setOpen] = useState(false);
  const key = REPORT_ADDRESS.exec(usePathname() ?? "")?.[1];
  const report = key === undefined ? undefined : context.reportPeriods[key];
  return (
    <div
      role="note"
      aria-label="About the data on this screen"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-1.5 text-xs sm:px-6 lg:px-8 ${notice ? "border-caution-line/50 bg-caution-surface text-caution-ink" : "border-line bg-panel text-ink-3"}`}
    >
      {notice ? (
        <>
          <span className="rounded-[3px] border border-caution-line px-1.5 py-px text-caption font-bold tracking-label text-caution">{notice.label}</span>
          <button type="button" aria-expanded={open} aria-controls="gi-data-summary" onClick={() => setOpen(!open)} className="text-caption underline decoration-dotted underline-offset-2 sm:hidden" data-about-data>
            {open ? "Hide" : "What is this?"}
          </button>
          <span id="gi-data-summary" className={open ? "w-full sm:w-auto" : "max-sm:hidden"}>
            {notice.summary}
          </span>
        </>
      ) : null}
      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-caption sm:ml-auto" data-context>
        {report === undefined ? (
          <>
            <div className="flex gap-1.5">
              <dt className="opacity-80">Reporting period</dt>
              <dd className="font-mono">{formatPeriod(context.period)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="opacity-80">Data as of</dt>
              <dd className="font-mono">{formatTime(context.asOf)}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1.5" data-report-period>
              <dt className="opacity-80">Report period</dt>
              <dd className="font-mono">{report.label}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="opacity-80">Data as of</dt>
              <dd className="font-mono">{report.asOf === null ? "Not available for this period" : formatTime(report.asOf)}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
