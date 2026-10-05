import { Overview } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { isPreparing, operations } from "@/composition/operations";

export default async function OperationsCenterPage() {
  if (isPreparing()) return <PreparingData />;
  return <Overview view={await operations.overview()} />;
}
