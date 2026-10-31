import Link from "next/link";
import type { ReactNode } from "react";
import type { MinigridOverviewView, SectorOverviewView, UtilityOverviewView } from "@/services/overview/views";
import { AttentionList, workspaceHref } from "@/components/system/Attention";
import { KeyFold, PlannedTag, SectorBand } from "@/components/system/Brand";
import { MetricTile, Panel } from "@/components/system/Metric";
import { LossSplit, SiteMix } from "@/components/system/Visuals";

/* A sector's Overview: "what needs attention here?" in a few lines, with links in. Every sector
   has the same screen: the lines, a small visual of how the sector stands, and the ways in (its
   GIS Map, its workspaces, its assistant). Everything is laid out from the read model; nothing
   is found, ranked or calculated here. */

function WaysIn({ view, home }: { view: SectorOverviewView; home: string }) {
  return (
    <Panel title="Go to">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-ways-in>
        {view.waysIn?.map === false ? null : (
          <li>
            <Link href={`${home}/map`} className="gi-tap block rounded-tile border border-line px-3 py-2 hover:border-brand">
              <span className="text-sm font-semibold text-link">GIS Map</span>
              <span className="mt-0.5 block text-caption leading-snug text-ink-4">This sector on the map, with what is wrong on it now.</span>
            </Link>
          </li>
        )}
        {view.workspaces.map((link) => (
          <li key={link.workspace}>
            <Link href={workspaceHref(link.workspace)} className="gi-tap block rounded-tile border border-line px-3 py-2 hover:border-brand">
              <span className="text-sm font-semibold text-link">{link.label}</span>
              <span className="mt-0.5 block text-caption leading-snug text-ink-4">{link.question}</span>
            </Link>
          </li>
        ))}
        {view.waysIn?.assistant === false ? null : (
          <li>
            <Link href={`${home}/ai`} className="gi-tap block rounded-tile border border-dashed border-line-strong px-3 py-2 hover:border-brand">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-3">
                AI Assistant <PlannedTag />
              </span>
              <span className="mt-0.5 block text-caption leading-snug text-ink-4">Not built yet. What it will answer, and how.</span>
            </Link>
          </li>
        )}
      </ul>
    </Panel>
  );
}

function Frame({ view, home, lead, visual }: { view: SectorOverviewView; home: string; lead: string; visual: ReactNode }) {
  return (
    <div className="space-y-4" data-overview={view.sector}>
      <SectorBand eyebrow={view.title} title="Overview">
        {view.organization ?? "Organization not recorded"} · {lead}
      </SectorBand>

      {view.headline.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-headline>
          {view.headline.map((metric) => (
            <MetricTile key={metric.label} metric={metric} sourcing={view.sourcing} emphasis />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="What needs attention" aside="Listed by fixed rules, in a fixed order. No AI.">
          <AttentionList items={view.attention} note={view.attentionNote} />
        </Panel>
        <div className="space-y-4">{visual}</div>
      </div>

      <WaysIn view={view} home={home} />
      <KeyFold />
      <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}

export function UtilityOverview({ view, home }: { view: UtilityOverviewView; home: string }) {
  return (
    <Frame
      view={view}
      home={home}
      lead="what needs attention on the network, and where to go for it."
      visual={
        <Panel title="Where energy and money are lost" aside="From the Executive workspace">
          {view.lossSplit ? <LossSplit split={view.lossSplit} /> : <p className="text-xs text-ink-4">{view.lossSplitNote ?? "The losses could not be accounted for this period."}</p>}
        </Panel>
      }
    />
  );
}

export function MinigridOverview({ view, home }: { view: MinigridOverviewView; home: string }) {
  return (
    <Frame
      view={view}
      home={home}
      lead="what needs attention across the sites, and whether their reports match the records."
      visual={
        <Panel title="Generation mix by site" aside="From the Sites workspace">
          {view.sites.length > 0 ? <SiteMix sites={view.sites} /> : <p className="text-xs text-ink-4">No site is held, so there is nothing to draw.</p>}
        </Panel>
      }
    />
  );
}
