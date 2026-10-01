import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function SubstationPage({ params }: { params: Promise<{ substationId: string }> }) {
  const { substationId } = await params;
  const view = await operations.substation(decodeURIComponent(substationId));
  if (view === null) notFound();
  return <NetworkLevel view={view} />;
}
