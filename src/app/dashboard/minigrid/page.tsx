import { MinigridOverview } from "@/components/overview/SectorOverview";
import { PreparingData } from "@/components/system/PreparingData";
import { overview } from "@/composition/overview";
import { MINIGRID_HOME } from "@/constants/navigation";
import { preparing } from "../utility/screen";

/* The Mini-grid Overview: what needs attention across the sites, with links in. */
export default async function MinigridOverviewPage() {
  if (await preparing()) return <PreparingData />;
  return <MinigridOverview view={await overview.minigrid()} home={MINIGRID_HOME} />;
}
