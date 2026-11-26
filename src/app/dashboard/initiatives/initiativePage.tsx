import { notFound } from "next/navigation";
import { ForWorkspace } from "@/components/workspace/DemoWorkspace";
import { WorkspaceInitiative } from "@/components/workspace/WorkspacePages";
import { workspace } from "@/composition/workspace";

/** An initiative as each workspace given sees it; not found when none takes part in it. */
export async function InitiativeInWorkspace({ initiativeId }: { initiativeId: string }) {
  const views = await workspace.initiatives(initiativeId);
  if (views.length === 0) notFound();
  return views.map((view) => (
    <ForWorkspace key={view.workspace.id} type={view.workspace.type}>
      <WorkspaceInitiative view={view} />
    </ForWorkspace>
  ));
}
