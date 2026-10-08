import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { buildableLevels, operations } from "@/composition/operations";
import { aheadOfTime, preparing } from "../../../../screen";

/** Built ahead of time for every distribution transformer when the dataset is fixed; none otherwise. */
export const generateStaticParams = aheadOfTime(async () => (await buildableLevels()).transformers.map((transformerId) => ({ transformerId })));

// The same screen with every connection listed. A path of its own, not a query string: a page built ahead of time cannot read one.
export default async function TransformerAllPage({ params }: { params: Promise<{ transformerId: string }> }) {
  const { transformerId } = await params;
  if (await preparing()) return <PreparingData />;
  const view = await operations.transformer(decodeURIComponent(transformerId));
  if (view === null) notFound();
  return <NetworkLevel view={view} showAllRows />;
}
