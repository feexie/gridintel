import { notFound } from "next/navigation";
import { ServicePoint } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { operations } from "@/composition/operations";
import { aheadOfTime, preparing } from "../../../screen";

/* There are thousands of service points, so none is built ahead of time. On a fixed dataset
   each is rendered on its first visit and kept as a file from then on. That first visit
   computes this one screen and nothing else: no warm-up runs and no preparing page is shown
   (ADR 0012). */
export const generateStaticParams = aheadOfTime(() => []);

export default async function ServicePointPage({ params }: { params: Promise<{ servicePointId: string }> }) {
  const { servicePointId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.servicePoint(decodeURIComponent(servicePointId));
  if (view === null) notFound();
  return <ServicePoint view={view} />;
}
