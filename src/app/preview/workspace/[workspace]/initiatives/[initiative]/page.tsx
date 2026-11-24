import { notFound } from "next/navigation";
import { PreparingData } from "@/components/system/PreparingData";
import { WorkspaceInitiative } from "@/components/workspace/WorkspacePages";
import { frontDoor } from "@/composition/initiatives";
import { frontDoorParams, frontDoorPreparing } from "../../../../front";

export const generateStaticParams = frontDoorParams(() => frontDoor.workspaceInitiatives());

/* An initiative as one workspace sees it: its card and the views it shows that workspace's type. */
export default async function WorkspaceInitiativePage({ params }: { params: Promise<{ workspace: string; initiative: string }> }) {
  if (await frontDoorPreparing()) return <PreparingData />;
  const { workspace, initiative } = await params;
  const view = await frontDoor.initiative(workspace, initiative);
  if (view === null) notFound();
  return <WorkspaceInitiative view={view} />;
}
