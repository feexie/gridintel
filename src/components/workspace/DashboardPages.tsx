import Link from "next/link";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import type { RailItemPageView, ViewLinkView } from "@/services/initiatives/views";

/* Pages of the signed-in layer that hold no figure (NAV-B step 6): a rail item's index, and a
   view that is planned. */

function ViewList({ views }: { views: ViewLinkView[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {views.map((view) => (
        <li key={view.id} className="rounded-panel border border-line bg-panel p-3" data-view={view.id}>
          <div className="flex items-center justify-between gap-2">
            {view.href ? (
              <Link href={view.href} className="text-sm font-medium text-link hover:text-link-hover hover:underline">
                {view.label}
              </Link>
            ) : (
              <span className="text-sm font-medium text-ink-3">{view.label}</span>
            )}
            {view.planned ? <PlannedTag /> : null}
          </div>
          <p className="mt-1 text-caption text-ink-4">{view.question}</p>
        </li>
      ))}
    </ul>
  );
}

/** A rail item's index: what it is for, and the views it holds for this workspace. No figure. */
export function RailIndex({ page }: { page: RailItemPageView }) {
  return (
    <div className="space-y-4" data-rail-page={page.item}>
      <SectorBand eyebrow={`${page.workspace.typeLabel} workspace`} title={page.label}>
        {page.question}
      </SectorBand>
      <ViewList views={page.views} />
    </div>
  );
}

/** A view that is planned: what it will answer, and no figure. */
export function ViewPlanned({ label, question }: { label: string; question: string }) {
  return (
    <div className="space-y-3" data-view-planned>
      <SectorBand eyebrow="Planned" title={label}>
        {question}
      </SectorBand>
      <p className="rounded-panel border border-dashed border-line-bold bg-panel p-3 text-sm text-ink-3">
        Planned. Not built yet. No figure is shown here.
      </p>
    </div>
  );
}
