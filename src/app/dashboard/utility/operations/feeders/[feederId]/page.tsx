import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function FeederPage({ params }: { params: Promise<{ feederId: string }> }) {
  const { feederId } = await params;
  const view = await operations.feeder(decodeURIComponent(feederId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
