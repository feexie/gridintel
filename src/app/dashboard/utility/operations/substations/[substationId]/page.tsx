import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { buildableLevels, operations } from "@/composition/operations";
import { spatial } from "@/composition/spatial";
import { aheadOfTime, preparing } from "../../../screen";

/** Built ahead of time for every substation when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await buildableLevels()).substations.map((substationId) => ({ substationId })));

export default async function SubstationPage({ params }: { params: Promise<{ substationId: string }> }) {
  const { substationId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.substation(decodeURIComponent(substationId));
  if (view === null) notFound();
  const id = decodeURIComponent(substationId);
  return <NetworkLevel view={view} map={<EmbeddedMap view={await spatial.embedded({ kind: "substation", id: id })} select={`substation:${id}`} />} />;
}
