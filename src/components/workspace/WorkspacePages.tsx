import Link from "next/link";
import type { ReactNode } from "react";
import { InitiativeCard, InitiativeGrid } from "@/components/front/Initiatives";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import type { RailItemPageView, ViewLinkView, WorkspaceHomeView, WorkspaceInitiativeView } from "@/services/initiatives/views";

/* The pages inside a workspace's frame (ADR 0021): Home with the initiatives this workspace takes
   part in; an initiative as this workspace sees it; a rail item with the views that will live in
   it. In Phase NAV-A each view links to where the screen is today; one rail item per workspace
   type also shows its screen inside the frame. */

function ViewList({ views }: { views: ViewLinkView[] }) {
  return (
    <ul className="divide-y divide-line rounded-panel border border-line bg-panel shadow-panel" data-views>
      {views.map((view) => (
        <li key={view.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3" data-view={view.id}>
          <div className="min-w-0">
            <p className="font-medium text-ink">{view.label}</p>
            <p className="text-sm leading-snug text-ink-3">{view.question}</p>
          </div>
          <div className="flex items-center gap-2">
            {view.planned ? <PlannedTag /> : null}
            {view.href ? (
              <a href={view.href} className="text-sm font-medium text-link hover:text-link-hover hover:underline">
                Open where it is today →
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceHome({ home }: { home: WorkspaceHomeView }) {
  return (
    <div className="space-y-4" data-workspace-home>
      <SectorBand eyebrow={`${home.workspace.typeLabel} workspace`} title="Home">
        The initiatives this workspace takes part in. Open one to see your part of it.
      </SectorBand>
      <InitiativeGrid cards={home.cards} />
    </div>
  );
}

export function WorkspaceInitiative({ view }: { view: WorkspaceInitiativeView }) {
  return (
    <div className="space-y-4" data-workspace-initiative={view.card.id}>
      <SectorBand eyebrow={`Home · ${view.roleLabel}`} title={view.card.title}>
        {view.card.summary}
      </SectorBand>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <InitiativeCard card={view.card} onItsPage />
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">Your part of it</h2>
          <ViewList views={view.views} />
        </section>
      </div>
    </div>
  );
}

export function RailItemPage({ page, filled }: { page: RailItemPageView; filled: ReactNode }) {
  return (
    <div className="space-y-4" data-rail-page={page.item}>
      <SectorBand eyebrow={`${page.workspace.typeLabel} workspace`} title={page.label}>
        {page.question}
      </SectorBand>
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">What lives here</h2>
        <ViewList views={page.views} />
      </section>
      {filled ? (
        <section className="space-y-2" data-filled={page.filled ?? ""}>
          <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">Shown here in the prototype: {page.views.find((view) => view.id === page.filled)?.label}</h2>
          <div className="rounded-panel border border-dashed border-line-bold p-2 sm:p-3">{filled}</div>
        </section>
      ) : null}
      <p className="text-caption text-ink-4">
        Every screen keeps its current address until the screens move.{" "}
        <Link href={page.workspace.href} className="font-medium text-link hover:underline">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
