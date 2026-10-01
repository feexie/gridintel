import { Overview } from "@/components/operations/Level";
import { operations } from "@/composition/operations";

export default async function OperationsCenterPage() {
  return <Overview view={await operations.overview()} />;
}
