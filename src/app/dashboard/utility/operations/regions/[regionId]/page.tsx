import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function RegionPage({ params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  const view = await operations.region(decodeURIComponent(regionId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
