import Link from "next/link";
import { ForWorkspace } from "@/components/workspace/DemoWorkspace";
import { WorkspaceHome } from "@/components/workspace/WorkspacePages";
import { opensScreen } from "@/constants/access";
import { hrefOf } from "@/constants/views";
import { getViewer } from "@/composition/runtime";
import { workspace } from "@/composition/workspace";

/* Home (NAV-B step 6): the initiatives as this workspace sees them, with a clear way to the former
   Platform overview, now under Intelligence (Founder, 25 November 2026), so a visitor from a GEH
   link finds it in one click. */
export default async function HomePage() {
  const [homes, viewer] = await Promise.all([workspace.homes(), getViewer()]);
  const overview = opensScreen(viewer.screens, "platform.overview");
  return (
    <div className="space-y-4">
      {homes.map((home) => (
        <ForWorkspace key={home.workspace.id} type={home.workspace.type}>
          <WorkspaceHome home={home} />
        </ForWorkspace>
      ))}
      {overview ? (
        <p className="rounded-panel border border-line bg-panel p-3 text-sm text-ink-3" data-platform-overview-link>
          Looking for every sector on one map?{" "}
          <Link href={hrefOf("platform.overview")} className="font-semibold text-link hover:underline">
            Platform overview (now under Intelligence)
          </Link>
        </p>
      ) : null}
    </div>
  );
}
