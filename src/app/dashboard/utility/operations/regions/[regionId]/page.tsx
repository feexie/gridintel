import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { buildableLevels, operations } from "@/composition/operations";
import { spatial } from "@/composition/spatial";
import { aheadOfTime, preparing } from "../../../screen";

/** Built ahead of time for every region when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await buildableLevels()).regions.map((regionId) => ({ regionId })));

export default async function RegionPage({ params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.region(decodeURIComponent(regionId));
  if (view === null) notFound();
  // A region is an administrative scope, not a place on the network: its map is the whole network.
  return <NetworkLevel view={view} map={<EmbeddedMap view={await spatial.embedded()} />} />;
}
