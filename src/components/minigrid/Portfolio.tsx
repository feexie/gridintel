import Link from "next/link";
import type { MetricView } from "@/services/operations/views";
import type { AttentionTone } from "@/services/overview/views";
import type { MinigridPortfolioView, SiteCardView, SiteFindingView } from "@/services/minigrid/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, Sources } from "@/components/system/Fold";
import { MetricCell, Panel } from "@/components/system/Metric";
import { Note } from "@/components/system/Table";
import { formatMoney, formatPercent } from "@/components/system/format";
import { siteHref } from "@/components/system/map/links";
import { CLASS_NOTE, ClassTable, ReportStanding, VarianceLine } from "./shared";

/* The Mini-grid workspace: the sites side by side, and what stands out among them. Everything
   here is laid out from the read model; nothing is ranked, filtered or calculated. */

/* The same marks, words and edges as every other finding (system/Attention.tsx). */
const TONE: Record<AttentionTone, { mark: string; word: string; text: string; edge: string; ground: string }> = {
  alert: { mark: "▲", word: "Act", text: "text-alert", edge: "border-l-alert-line", ground: "bg-alert-surface/60" },
  watch: { mark: "◆", word: "Check", text: "text-caution", edge: "border-l-caution-line", ground: "bg-caution-surface/50" },
  note: { mark: "●", word: "Note", text: "text-ink-3", edge: "border-l-line-bold", ground: "bg-well/40" },
};

function Finding({ found, currency }: { found: SiteFindingView; currency: string | null }) {
  const tone = TONE[found.tone];
  return (
    <li className={`rounded-tile border border-line border-l-[3px] ${tone.edge} ${tone.ground} px-3 py-2.5`} data-finding={`${found.rule}:${found.site?.id ?? "portfolio"}`} data-tone={found.tone}>
      <p className={`flex flex-wrap items-center gap-x-1.5 text-micro font-semibold uppercase tracking-wide ${tone.text}`}>
        <span aria-hidden>{tone.mark}</span>
        <span>{tone.word}</span>
        <span className="text-ink-5">·</span>
        <span>{found.title}</span>
      </p>
      <p className="mt-1 text-sm leading-snug text-ink">{found.statement}</p>
      {found.comparisons.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {found.comparisons.map((row) => (
            <VarianceLine key={row.label} row={row} />
          ))}
        </ul>
      ) : null}
      {found.figures.length > 0 ? (
        <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {found.figures.map((figure) => (
            <div key={figure.label} className="flex flex-wrap items-baseline justify-between gap-x-2" data-figure={figure.label}>
              <dt className="text-ink-3">{figure.label}</dt>
              <dd>
                <MetricCell metric={figure} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {found.classes.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {found.classes.map((row) => (
            <li key={row.customerClass} className="text-xs leading-snug text-ink-2" data-owes={row.customerClass}>
              <span className="text-ink">{row.label}:</span> <span className="font-mono tabular-nums text-caution-ink">{formatMoney(row.notCollected, currency)}</span> not collected;
              paid <span className="font-mono tabular-nums text-ink">{formatPercent(row.collectionEfficiency)}</span> of what they were billed ({row.postpaidAccounts} postpaid
              account{row.postpaidAccounts === 1 ? "" : "s"}).
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {found.site ? (
          <Link href={siteHref(found.site.id)} className="gi-tap inline-flex items-center text-caption font-medium text-link hover:text-link-hover hover:underline">
            Open {found.site.name} →
          </Link>
        ) : null}
        <Fold label="Rule" name="finding-rule">
          <p data-rule>Rule: {found.ruleText}</p>
        </Fold>
      </div>
    </li>
  );
}

function CardRow({ label, metric, absent }: { label: string; metric: MetricView | null; absent?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-line/60 py-1" data-figure={label}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-xs">{metric === null ? <span className="text-ink-5">{absent}</span> : <MetricCell metric={metric} />}</dd>
    </div>
  );
}

function SiteCard({ site }: { site: SiteCardView }) {
  return (
    <section className="min-w-0 rounded-panel border border-line bg-panel shadow-panel" data-site={site.id}>
      <header className="border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">
          <Link href={siteHref(site.id)} className="text-link hover:text-link-hover hover:underline">
            {site.name}
          </Link>{" "}
          <span className="font-mono text-micro font-normal text-ink-5">{site.id}</span>
        </h2>
        <p className="text-caption text-ink-4">{site.plant}</p>
      </header>
      <dl className="px-3 py-1">
        <CardRow label="Renewable fraction" metric={site.renewableFraction} />
        <CardRow label="Fuel per kWh" metric={site.fuelPerKwh} absent="no generator" />
        <CardRow label="PV curtailed" metric={site.curtailedShare} absent="no PV array" />
        <CardRow label="Availability" metric={site.availability} />
        <CardRow label="Energy sold per connection" metric={site.energySoldPerConnection} />
        <CardRow label="Collection efficiency" metric={site.collectionEfficiency} />
        <CardRow label="Active connections" metric={site.connections} />
      </dl>
      <div className="px-3 pb-2 text-caption">
        <p className="text-ink-4">
          Report against the records: <ReportStanding report={site.report} />
        </p>
        {site.variances.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {site.variances.map((row) => (
              <VarianceLine key={row.label} row={row} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export function MinigridPortfolio({ view }: { view: MinigridPortfolioView }) {
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Mini-grid Intelligence" title="Sites">
        {view.operator ?? "Operator not recorded"} · which sites are underperforming and why, and whether their reports match the records.
      </SectorBand>
      <KeyFold />

      {view.completeness !== "complete" ? (
        <Note tone="caution">
          {view.completeness === "not_available" ? "No source of mini-grid sites is connected, so there is nothing to show." : "The list of sites is not complete: a site may exist that is not shown here."}
        </Note>
      ) : null}

      {view.findings.length > 0 ? (
        <Panel title="What stands out" aside="Found by fixed rules. No AI.">
          <ul className="grid gap-2 xl:grid-cols-2">
            {view.findings.map((found) => (
              <Finding key={`${found.rule}:${found.site?.id ?? "portfolio"}`} found={found} currency={view.currency} />
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4" data-sites>
        {view.sites.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
      </div>
      <Note>
        {/* One string: text that follows an expression and runs over a line break loses its leading space. */}
        {`A reported figure is set only beside the calculation on its own basis, and agrees when it is within ${formatPercent(view.agreementTolerance, 0)} of its own value. `}
        Each mark beside a figure is its status; the letters after it are its origin. A site&apos;s own screen holds every figure&apos;s source and method.
      </Note>

      {view.byClass.length > 0 ? (
        <Panel title="Collection by customer class, all sites" aside="Cash basis: received in the month against billed in the month">
          <ClassTable rows={view.byClass} currency={view.currency} name="class-portfolio" />
          {view.tariffCaveat ? <Note tone="caution">{view.tariffCaveat}</Note> : null}
          <Fold label="What the classes and “not collected” mean" name="class-notes">
            <p>{CLASS_NOTE}</p>
          </Fold>
        </Panel>
      ) : null}

      <Sources sourcing={view.sourcing} />
    </div>
  );
}
