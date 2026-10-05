import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { PreparingData } from "@/components/shared/PreparingData";
import { isPreparing, operations } from "@/composition/operations";

export default async function FeederPage({ params }: { params: Promise<{ feederId: string }> }) {
  const { feederId } = await params;
  if (isPreparing()) return <PreparingData />;
  const view = await operations.feeder(decodeURIComponent(feederId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
