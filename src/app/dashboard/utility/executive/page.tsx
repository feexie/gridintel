import { Executive } from "@/components/executive/Executive";
import { SyntheticBanner } from "@/components/operations/Level";
import { executive, getDataNotice } from "@/composition/executive";

export default async function ExecutiveDashboardPage({ searchParams }: { searchParams: Promise<{ feeders?: string }> }) {
  return (
    <>
      <SyntheticBanner notice={getDataNotice()} />
      <Executive view={await executive.view((await searchParams).feeders === "all" ? "all" : "top")} />
    </>
  );
}
