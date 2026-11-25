import { UtilityOverview } from "@/components/overview/SectorOverview";
import { PreparingData } from "@/components/system/PreparingData";
import { overview } from "@/composition/overview";
import { preparing } from "./screen";

/* The Utility Overview: what needs attention on the network, with links in. */
export default async function UtilityOverviewPage() {
  if (await preparing()) return <PreparingData />;
  return <UtilityOverview view={await overview.utility()} />;
}
