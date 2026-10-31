import type { Metadata } from "next";
import { MeteringPlanReport } from "@/components/planning/MeteringPlanReport";
import { planning } from "@/composition/planning";

/* The Metering Plan report: the planner's figures on paper, built from the screens' services for
   the assumptions in the address. Printed, or saved as PDF from the browser's print dialog. */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // The title is what "Save as PDF" names the file.
  return { title: (await planning.meteringPlanReport(await searchParams)).fileTitle };
}

export default async function MeteringPlanReportPage({ searchParams }: Props) {
  const query = await searchParams;
  const view = await planning.meteringPlanReport(query);
  const kept = new URLSearchParams(Object.entries(query).flatMap(([key, value]) => (value === undefined || key === "present" ? [] : [[key, Array.isArray(value) ? value[0] : value] as [string, string]]))).toString();
  return <MeteringPlanReport view={view} backHref={`/dashboard/planning/metering${kept ? `?${kept}` : ""}`} />;
}
