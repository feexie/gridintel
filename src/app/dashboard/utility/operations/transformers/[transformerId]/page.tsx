import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { buildableLevels, operations } from "@/composition/operations";
import { spatial } from "@/composition/spatial";
import { aheadOfTime, preparing } from "../../../screen";

/** Built ahead of time for every distribution transformer when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await buildableLevels()).transformers.map((transformerId) => ({ transformerId })));

// A transformer can serve hundreds of connections; the full list is one click away, at ./all.
export default async function TransformerPage({ params }: { params: Promise<{ transformerId: string }> }) {
  const { transformerId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.transformer(decodeURIComponent(transformerId));
  if (view === null) notFound();
  const id = decodeURIComponent(transformerId);
  return <NetworkLevel view={view} showAllRows={false} map={<EmbeddedMap view={await spatial.embedded({ kind: "distribution_transformer", id })} select={`distribution_transformer:${id}`} />} />;
}
