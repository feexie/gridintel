import { Assets } from "@/components/assets/Assets";
import { PreparingData } from "@/components/system/PreparingData";
import { assets, isPreparing } from "@/composition/assets";

// Rendered on request, from the result cache: a page built ahead of time could not say "preparing data".
export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ transformers?: string }> }) {
  const listing = (await searchParams).transformers === "all" ? "all" : "top";
  if (isPreparing()) return <PreparingData />;
  return <Assets view={await assets.view(listing)} />;
}
