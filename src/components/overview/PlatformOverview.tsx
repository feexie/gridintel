import Link from "next/link";
import type { ReactNode } from "react";
import type { PlatformOverviewView, PlatformSectorView } from "@/services/overview/views";
import { MINIGRID_HOME, UTILITY_HOME } from "@/constants/navigation";
import { AttentionList } from "@/components/system/Attention";
import { EnergySystemArt, KeyFold, PlannedTag } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";

/* The Platform Overview: what GridIntel does, said to a first-time visitor in half a minute, and
   then straight into what each sector's records show. The hero is a brand area and holds no
   figure. Every finding below it is a line of a sector's own Overview, chosen by the rule the
   read model prints. */

const SECTOR_HOME: Record<PlatformSectorView["sector"], string> = { utility: UTILITY_HOME, minigrid: MINIGRID_HOME };

const SECTOR_LINE: Record<PlatformSectorView["sector"], string> = {
  utility: "A distribution utility's network, from region to service point: losses, revenue, reliability, assets and what is wrong now.",
  minigrid: "A mini-grid operator's sites: how each performs, and whether what it reports matches its own records.",
};

/** What GridIntel does, in three short claims. Words only: nothing here is a figure. */
const PROMISES = [
  { title: "From the records", text: "Losses, reliability, loading and collection are calculated from meters, bills, payments and outage logs." },
  { title: "Reported beside calculated", text: "A figure someone reported is set beside the calculation on the same basis, and the difference is shown." },
  { title: "Traceable", text: "Every figure carries its status, its origin, its sources and its method. A gap is a gap, never a zero." },
];

const TO_JOIN = [
  { title: "DER Intelligence", text: "Solar, storage, inverters and generators as fleets: performance, aggregation and dispatch." },
  { title: "Planning", text: "Load growth, capacity, scenarios and investment priorities, from the same records." },
];

function Hero() {
  return (
    <section className="gi-hero rounded-panel px-5 py-7 sm:px-8 sm:py-10" data-hero>
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div>
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-white/75">GridIntel · Energy intelligence platform</p>
          <h1 className="mt-2 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">See where energy and money are lost, and trace every figure to its source.</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            GridIntel turns the records a utility or a mini-grid operator already holds into answers: what is failing, what it costs, and whether reported figures match the records.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={UTILITY_HOME} className="gi-tap inline-flex items-center rounded-tile bg-white px-4 py-2 text-sm font-semibold text-[#2a1c8a] hover:bg-white/90">
              Utility Intelligence →
            </Link>
            <Link href={MINIGRID_HOME} className="gi-tap inline-flex items-center rounded-tile border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white">
              Mini-grid Intelligence →
            </Link>
          </div>
        </div>
        <EnergySystemArt className="mx-auto hidden w-full max-w-md sm:block" />
      </div>
    </section>
  );
}

function Sector({ sector }: { sector: PlatformSectorView }) {
  const home = SECTOR_HOME[sector.sector];
  return (
    <section className="rounded-panel border border-line bg-panel shadow-panel" data-sector={sector.sector} aria-label={sector.title}>
      <header className="border-b border-line px-4 py-3">
        <h3 className="text-base font-semibold text-ink">{sector.title}</h3>
        <p className="mt-0.5 text-caption leading-snug text-ink-4">{SECTOR_LINE[sector.sector]}</p>
        <p className="mt-1 text-micro text-ink-5">{sector.organization ?? "Organization not recorded"}</p>
      </header>
      <div className="space-y-3 p-3">
        <AttentionList items={sector.findings} note={sector.findings.length === 0 ? "This sector's Overview lists nothing for the period." : null} />
        <Link href={home} className="gi-tap inline-flex items-center text-sm font-semibold text-link hover:text-link-hover hover:underline" data-open-sector>
          {/* A count the read model gives; the words say what it counts. */}
          Open the {sector.title} overview{sector.findingsMore > 0 ? ` · ${sector.findingsMore} more` : ""} →
        </Link>
      </div>
    </section>
  );
}

export function PlatformOverview({ view, map }: { view: PlatformOverviewView; map: ReactNode }) {
  return (
    <div className="space-y-6" data-overview="platform">
      <Hero />

      <ul className="grid gap-3 sm:grid-cols-3" data-promises>
        {PROMISES.map((promise) => (
          <li key={promise.title} className="rounded-tile border border-line bg-panel px-3 py-2.5 shadow-panel">
            <p className="text-sm font-semibold text-ink">{promise.title}</p>
            <p className="mt-0.5 text-caption leading-snug text-ink-4">{promise.text}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-3" aria-labelledby="stands-out">
        <div>
          <h2 id="stands-out" className="text-lg font-semibold tracking-tight text-ink">
            What the records show
          </h2>
          <p className="text-caption text-ink-4">
            {view.sourcing.synthetic ? "On the synthetic demonstration dataset. " : ""}Listed by fixed rules, not by AI.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {view.sectors.map((sector) => (
            <Sector key={sector.sector} sector={sector} />
          ))}
        </div>
        <details className="group text-caption text-ink-4">
          <summary className="cursor-pointer list-none hover:text-ink-2">
            <span className="group-open:hidden">How these lines were chosen ▸</span>
            <span className="hidden group-open:inline">How these lines were chosen ▾</span>
          </summary>
          <p className="mt-1 max-w-3xl leading-snug">{view.selectionRule} The two sectors are two organizations with their own records: they are shown side by side and never added together.</p>
        </details>
      </section>

      {map}

      <Panel title="Sectors to join" aside="Not built yet">
        <ul className="grid gap-2 sm:grid-cols-2" data-to-join>
          {TO_JOIN.map((sector) => (
            <li key={sector.title} className="rounded-tile border border-dashed border-line-strong px-3 py-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-3">
                {sector.title} <PlannedTag />
              </p>
              <p className="mt-0.5 text-caption leading-snug text-ink-4">{sector.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-4">Each will have the same structure as the sectors above: Overview, GIS Map, AI Assistant, then its workspaces.</p>
      </Panel>

      <KeyFold />
      <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}
