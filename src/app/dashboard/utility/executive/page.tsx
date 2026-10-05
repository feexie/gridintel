import { Executive } from "@/components/executive/Executive";
import { SyntheticBanner } from "@/components/operations/Level";
import { PreparingData } from "@/components/shared/PreparingData";
import { executive, getDataNotice, isPreparing } from "@/composition/executive";

export default async function ExecutiveDashboardPage({ searchParams }: { searchParams: Promise<{ feeders?: string }> }) {
  const listing = (await searchParams).feeders === "all" ? "all" : "top";
  return (
    <>
      <SyntheticBanner notice={getDataNotice()} />
      {isPreparing() ? <PreparingData /> : <Executive view={await executive.view(listing)} />}
    </>
  );
}
