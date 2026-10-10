import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { buildableLevels, operations } from "@/composition/operations";
import { spatial } from "@/composition/spatial";
import { aheadOfTime, preparing } from "../../../screen";

/** Built ahead of time for every feeder when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await buildableLevels()).feeders.map((feederId) => ({ feederId })));

export default async function FeederPage({ params }: { params: Promise<{ feederId: string }> }) {
  const { feederId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.feeder(decodeURIComponent(feederId));
  if (view === null) notFound();
  const id = decodeURIComponent(feederId);
  return <NetworkLevel view={view} map={<EmbeddedMap view={await spatial.embedded({ kind: "feeder", id: id })} select={`feeder:${id}`} />} />;
}
