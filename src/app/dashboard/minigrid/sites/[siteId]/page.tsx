import { notFound } from "next/navigation";
import { MinigridSite } from "@/components/minigrid/Site";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { minigrid } from "@/composition/minigrid";
import { spatial } from "@/composition/spatial";
import { aheadOfTime, preparing } from "../../../utility/screen";

/** Built ahead of time for every site when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await minigrid.siteIds()).map((siteId) => ({ siteId })));

export default async function MinigridSitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (await preparing()) return <PreparingData />;
  const id = decodeURIComponent(siteId);
  const view = await minigrid.siteView(id);
  if (view === null) notFound();
  return <MinigridSite view={view} map={<EmbeddedMap view={await spatial.sites()} title="Where the site is" select={`minigrid_site:${id}`} />} />;
}
