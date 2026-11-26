import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { frontDoor } from "@/composition/initiatives";
import { frontDoorOnly, frontDoorParams } from "../../front";

export const generateStaticParams = frontDoorParams(() => frontDoor.workspaceIds().map((workspace) => ({ workspace })));

/* A demo workspace's frame: header, switcher, the slimmed rail. Only demo workspaces exist in
   NAV-A, and only they are entered without signing in (ADR 0021). */
export default async function WorkspaceLayout({ params, children }: { params: Promise<{ workspace: string }>; children: ReactNode }) {
  await frontDoorOnly();
  const frame = frontDoor.frame((await params).workspace);
  if (frame === null) notFound();
  return <WorkspaceFrame frame={frame}>{children}</WorkspaceFrame>;
}
