import { Revenue } from "@/components/revenue/Revenue";
import { PreparingData } from "@/components/system/PreparingData";
import { isPreparing, revenue } from "@/composition/revenue";

// Rendered on request, from the result cache: a page built ahead of time could not say "preparing data".
export const dynamic = "force-dynamic";

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ valuation?: string }> }) {
  const listing = (await searchParams).valuation === "all" ? "all" : "top";
  if (isPreparing()) return <PreparingData />;
  return <Revenue view={await revenue.view(listing)} />;
}
