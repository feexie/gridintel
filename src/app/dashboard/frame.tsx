import type { ReactNode } from "react";
import { DemoWorkspace } from "@/components/workspace/DemoWorkspace";
import { RailFrame } from "@/components/workspace/RailFrame";
import { getAccount } from "@/composition/runtime";
import { workspace } from "@/composition/workspace";

/* The frame of every /dashboard page (NAV-B step 6). On the public demonstration: the five demo
   workspaces, one shown at a time in the browser. On a tenant deployment: the signed-in person's
   organization alone, its rail cut to their grant; no cookie or query is read for it. */
export async function DashboardFrame({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const [frames, account] = await Promise.all([workspace.frames(), getAccount()]);
  if (workspace.isDemo()) {
    return (
      <DemoWorkspace frames={frames} bar={bar}>
        {children}
      </DemoWorkspace>
    );
  }
  if (frames.length === 0) {
    return (
      <div className="flex h-dvh flex-col bg-app text-ink">
        {bar}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">{children}</main>
      </div>
    );
  }
  return (
    <RailFrame frame={frames[0]} account={account} bar={bar}>
      {children}
    </RailFrame>
  );
}
