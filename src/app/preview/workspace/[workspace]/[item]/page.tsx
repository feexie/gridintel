import { notFound } from "next/navigation";
import { Executive } from "@/components/executive/Executive";
import { MinigridPortfolio } from "@/components/minigrid/Portfolio";
import { Marketplace } from "@/components/planning/Marketplace";
import { Monitoring } from "@/components/planning/Monitoring";
import { PlannerPlanned } from "@/components/planning/PlannerPlanned";
import { PreparingData } from "@/components/system/PreparingData";
import { RailItemPage } from "@/components/workspace/WorkspacePages";
import { executive } from "@/composition/executive";
import { frontDoor } from "@/composition/initiatives";
import { minigrid } from "@/composition/minigrid";
import { planning } from "@/composition/planning";
import { plannerOf } from "@/constants/planning";
import type { ViewId } from "@/constants/workspaces";
import { frontDoorParams, frontDoorPreparing } from "../../../front";

export const generateStaticParams = frontDoorParams(() => frontDoor.railItems());

/* The one view each workspace type shows inside its frame in NAV-A, from the existing screen's
   component and view model: nothing is re-implemented and no figure is calculated again. */
async function filledView(id: ViewId | null) {
  if (id === "utility.executive") return <Executive view={await executive.view("top")} />;
  if (id === "minigrid.sites") return <MinigridPortfolio view={await minigrid.portfolioView()} />;
  if (id === "finance.marketplace") return <Marketplace view={await planning.marketplace()} />;
  if (id === "oversight.monitoring") return <Monitoring view={await planning.monitoring({})} />;
  if (id === "plan.charging-hubs") {
    const planner = plannerOf("e-mobility");
    return planner === undefined ? null : <PlannerPlanned planner={planner} />;
  }
  return null;
}

/* A rail item of a workspace: the views that live in it, and, for one item per type, the screen. */
export default async function RailItemRoute({ params }: { params: Promise<{ workspace: string; item: string }> }) {
  if (await frontDoorPreparing()) return <PreparingData />;
  const { workspace, item } = await params;
  const page = frontDoor.railItem(workspace, item);
  if (page === null) notFound();
  return <RailItemPage page={page} filled={await filledView(page.filled)} />;
}
