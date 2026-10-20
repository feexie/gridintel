import Link from "next/link";
import type { ReportItem } from "@/constants/navigation";
import { PlannedTag, SectorBand } from "../system/Brand";

/* ==========================================================
   THE REPORTS A VIEWER MAY OPEN

   A sector's Reports screen, and the list of every report
   (/dashboard/reports). The list is the viewer's: a report they may
   not open is not on it (constants/access.ts). A planned report is
   listed and says it is not built; it has no link.
========================================================== */

export interface ReportsIndexProps {
  title: string;
  eyebrow: string;
  reports: ReportItem[];
  /** The period each report opens on, by report id, e.g. "2026-09". */
  defaultPeriods: Record<string, string>;
  /** What the data covers, in words. */
  coverage: string;
  /** Set while the data is synthetic. */
  sample: string | null;
}

export function ReportsIndex({ title, eyebrow, reports, defaultPeriods, coverage, sample }: ReportsIndexProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectorBand eyebrow={eyebrow} title={title}>
        Print-ready reports built from the same services as the screens, with every figure&apos;s status, origin and method, and the figures as CSV and XLSX.
      </SectorBand>
      <div className="rounded-tile border border-line bg-panel p-3 text-xs text-ink-3">
        <p>
          The data covers <strong className="text-ink-2">{coverage}</strong>. A report can be had for any day in it and, except the daily brief, for the month; a year, or any period the data
          does not wholly cover, is not available and is never filled.
        </p>
        {sample ? (
          <p className="mt-1.5 text-caution">
            <strong>{sample}.</strong> Every report shows the format and methods GridIntel would deliver, not real results, and carries the label on every page.
          </p>
        ) : null}
      </div>
      {reports.length === 0 ? (
        <p className="text-xs text-ink-4">No report is open to you here.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reports.map((report) => (
            <li key={report.key} className="flex flex-col gap-2 rounded-panel border border-line bg-panel p-4 shadow-panel" data-report={report.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{report.label}</h2>
                {report.planned ? <PlannedTag /> : null}
              </div>
              <p className="text-caption text-ink-4">For: {report.audience}</p>
              <p className="text-xs text-ink-3">{report.description}</p>
              <div className="mt-auto pt-1">
                {report.planned ? (
                  <p className="text-caption text-ink-5">Not built yet.</p>
                ) : (
                  <Link href={`${report.href}/${defaultPeriods[report.id]}`} className="inline-flex rounded-tile bg-brand-strong px-3 py-1.5 text-xs font-medium text-on-brand hover:opacity-90">
                    Open the report
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
