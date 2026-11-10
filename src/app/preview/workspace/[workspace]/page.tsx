import { notFound } from "next/navigation";
import { PreparingData } from "@/components/system/PreparingData";
import { WorkspaceHome } from "@/components/workspace/WorkspacePages";
import { frontDoor } from "@/composition/initiatives";
import { frontDoorPreparing } from "../../front";

/* A workspace's Home: the initiatives it takes part in. */
export default async function WorkspaceHomePage({ params }: { params: Promise<{ workspace: string }> }) {
  if (await frontDoorPreparing()) return <PreparingData />;
  const home = await frontDoor.home((await params).workspace);
  if (home === null) notFound();
  return <WorkspaceHome home={home} />;
}
