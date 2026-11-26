import { notFound } from "next/navigation";
import { RailIndex } from "@/components/workspace/DashboardPages";
import { ForWorkspace } from "@/components/workspace/DemoWorkspace";
import { workspace } from "@/composition/workspace";

/* Finance's index (NAV-B step 6): the views it holds for this workspace, as the viewer's grant opens them. No figure. */
export default async function FinancePage() {
  const pages = await workspace.railIndexes("finance");
  if (pages.length === 0) notFound();
  return pages.map((page) => (
    <ForWorkspace key={page.workspace.id} type={page.workspace.type}>
      <RailIndex page={page} />
    </ForWorkspace>
  ));
}
