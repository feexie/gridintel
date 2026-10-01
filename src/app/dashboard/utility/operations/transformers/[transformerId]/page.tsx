import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function TransformerPage({ params }: { params: Promise<{ transformerId: string }> }) {
  const { transformerId } = await params;
  const view = await operations.transformer(decodeURIComponent(transformerId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
