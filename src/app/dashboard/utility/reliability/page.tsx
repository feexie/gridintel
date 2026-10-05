import { Reliability } from "@/components/reliability/Reliability";
import { PreparingData } from "@/components/system/PreparingData";
import { isPreparing, reliability } from "@/composition/reliability";

// Rendered on request, from the result cache: a page built ahead of time could not say "preparing data".
export const dynamic = "force-dynamic";

export default async function ReliabilityPage() {
  if (isPreparing()) return <PreparingData />;
  return <Reliability view={await reliability.view()} />;
}
