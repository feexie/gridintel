import { Overview } from "@/components/operations/Level";
import { PreparingData } from "@/components/system/PreparingData";
import { operations } from "@/composition/operations";
import { preparing } from "../screen";

export default async function OperationsCenterPage() {
  if (await preparing()) return <PreparingData />;
  return <Overview view={await operations.overview()} />;
}
