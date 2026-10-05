import { Executive } from "@/components/executive/Executive";

import { PreparingData } from "@/components/system/PreparingData";
import { executive, isPreparing } from "@/composition/executive";

export default async function ExecutiveDashboardPage({ searchParams }: { searchParams: Promise<{ feeders?: string }> }) {
  const listing = (await searchParams).feeders === "all" ? "all" : "top";
  if (isPreparing()) return <PreparingData />;
  return <Executive view={await executive.view(listing)} />;
}
