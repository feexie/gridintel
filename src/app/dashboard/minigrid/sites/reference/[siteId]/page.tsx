import { notFound } from "next/navigation";
import { ReferenceSite } from "@/components/minigrid/Reference";
import { PreparingData } from "@/components/system/PreparingData";
import { reference } from "@/composition/reference";
import { aheadOfTime, preparing } from "../../../../utility/screen";

/* A reference site: a real mini-grid whose records its owner published (Phase MG-REAL). Public
   reference data, shown read-only in every deployment, never in an organization's totals. */

/** Built ahead of time for every reference site when the dataset is fixed; rendered on request otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await reference.siteIds()).map((siteId) => ({ siteId })));

export default async function ReferenceSitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await reference.siteView(decodeURIComponent(siteId));
  if (view === null) notFound();
  return <ReferenceSite view={view} />;
}
