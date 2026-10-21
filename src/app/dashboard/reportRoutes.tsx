import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { ReportsIndex } from "@/components/reports/ReportsIndex";
import { PreparingData } from "@/components/system/PreparingData";
import { reportsFor } from "@/constants/access";
import { reports } from "@/composition/reports";
import { getViewer } from "@/composition/runtime";
import { aheadOfTime, preparing } from "./utility/screen";

/* ==========================================================
   THE REPORT ROUTES (ADR 0019)

   What every sector's report addresses do, written once:
     /dashboard/{sector}/reports                       the sector's reports the viewer may open
     /dashboard/{sector}/reports/{report}              opens on the default period
     /dashboard/{sector}/reports/{report}/{period}     the report, ready to print
     /dashboard/{sector}/reports/{report}/{period}/data.csv   its figures
     /dashboard/{sector}/reports/{report}/{period}/data.xlsx  its figures as a workbook
   Which of them a viewer may open is decided by the proxy, from the
   viewer's grant (constants/access.ts).
========================================================== */

type Sector = "utility" | "minigrid";
type ReportParams = { params: Promise<{ report: string; period: string }> };

export function reportsIndex(sector: Sector, title: string, eyebrow: string) {
  return async function ReportsIndexPage() {
    return <ReportsIndex title={title} eyebrow={eyebrow} reports={reportsFor((await getViewer()).screens, sector)} defaultPeriods={reports.defaultPeriods()} coverage={reports.coverageWords()} sample={reports.sampleLabel()} />;
  };
}

export async function allReportsIndex() {
  return <ReportsIndex title="All reports" eyebrow="Platform" reports={reportsFor((await getViewer()).screens)} defaultPeriods={reports.defaultPeriods()} coverage={reports.coverageWords()} sample={reports.sampleLabel()} />;
}

/** A report's address without a period opens on the default period. */
export function reportRedirect(sector: Sector) {
  return async function ReportRedirect({ params }: { params: Promise<{ report: string }> }) {
    const { report } = await params;
    if (!reports.built(sector).includes(report as never)) notFound();
    redirect(`/dashboard/${sector}/reports/${report}/${reports.defaultPeriod(report)}`);
  };
}

export function reportPage(sector: Sector) {
  return {
    generateStaticParams: aheadOfTime(() => reports.built(sector).flatMap((report) => reports.periodKeys().map((period) => ({ report, period })))),
    async generateMetadata({ params }: ReportParams): Promise<Metadata> {
      const { report, period } = await params;
      if (!reports.built(sector).includes(report as never)) return {};
      const view = await reports.document(report, period);
      if (view === null) return {};
      // The title is what "Save as PDF" names the file.
      return { title: [view.identity?.reportId ?? `${view.header.code} ${view.period.key}`, view.header.title, view.sample ? `(${view.sample.label})` : null].filter(Boolean).join(" ") };
    },
    async Page({ params }: ReportParams) {
      const { report, period } = await params;
      if (!reports.built(sector).includes(report as never)) notFound();
      if (await preparing()) return <PreparingData />;
      const view = await reports.document(report, period);
      if (view === null) notFound();
      return <ReportDocument view={view} />;
    },
  };
}

export function reportCsvRoute(sector: Sector) {
  return async function GET(_request: Request, { params }: ReportParams): Promise<Response> {
    const { report, period } = await params;
    const csv = reports.built(sector).includes(report as never) ? await reports.csv(report, period) : null;
    if (csv === null) return new Response("No such report or period.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    // The byte-order mark lets a spreadsheet read the file as UTF-8 (₦, −).
    return new Response(`﻿${csv.body}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${csv.fileName}"`,
        "cache-control": "no-store",
      },
    });
  };
}

export function reportXlsxRoute(sector: Sector) {
  return async function GET(_request: Request, { params }: ReportParams): Promise<Response> {
    const { report, period } = await params;
    const xlsx = reports.built(sector).includes(report as never) ? await reports.xlsx(report, period) : null;
    if (xlsx === null) return new Response("No such report or period.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(xlsx.body.slice().buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${xlsx.fileName}"`,
        "cache-control": "no-store",
      },
    });
  };
}
