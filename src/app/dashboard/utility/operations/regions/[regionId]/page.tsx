import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { isPreparing, operations } from "@/composition/operations";

export default async function RegionPage({ params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  if (isPreparing()) return <PreparingData />;
  const view = await operations.region(decodeURIComponent(regionId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
