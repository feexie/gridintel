import { notFound } from "next/navigation";
import { ServicePoint } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { isPreparing, operations } from "@/composition/operations";

export default async function ServicePointPage({ params }: { params: Promise<{ servicePointId: string }> }) {
  const { servicePointId } = await params;
  if (isPreparing()) return <PreparingData />;
  const view = await operations.servicePoint(decodeURIComponent(servicePointId));
  if (view === null) notFound();
  return <ServicePoint view={view} />;
}
