import { notFound } from "next/navigation";
import { NetworkLevel } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function TransformerPage({
  params,
  searchParams,
}: {
  params: Promise<{ transformerId: string }>;
  searchParams: Promise<{ rows?: string }>;
}) {
  const { transformerId } = await params;
  const view = await operations.transformer(decodeURIComponent(transformerId));
  if (view === null) notFound();
  // A transformer can serve hundreds of connections; the full list is one click away.
  return <NetworkLevel view={view} showAllRows={(await searchParams).rows === "all"} />;
}
