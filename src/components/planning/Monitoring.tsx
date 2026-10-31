import Link from "next/link";
import { Panel } from "@/components/system/Metric";
import type { MonitoringView } from "@/services/planning/views";
import { Synthetic } from "./DtSequencing";
import { MeteringTabs } from "./MeteringTabs";

/* Monitoring the metering programme (docs/geh/DESIGN.md, section 6): plan against actual per DisCo
   per quarter. The actuals are synthetic and marked so. It displays the view model; it calculates
   nothing. */

function How({ children }: { children: string }) {
  return <p className="max-w-4xl text-caption leading-snug text-ink-4" data-how>{children}</p>;
}

function PlanActual({ plan, actual }: { plan: string; actual: string }) {
  return (
    <>
      <td className="py-1.5 pr-1 text-ink-4">{plan}</td>
      <td className="py-1.5 pr-3 font-semibold text-ink">{actual}</td>
    </>
  );
}

export function Monitoring({ view, present = false }: { view: MonitoringView; present?: boolean }) {
  const groups = ["Supply a day", "Consumption a month", "Charge into escrow", "Investors repaid to date"];
  return (
    <div className="space-y-4" data-monitoring>
      <MeteringTabs current="monitoring" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="flex flex-wrap items-center gap-2 text-micro font-semibold uppercase tracking-eyebrow text-brand">
          Monitor · Plan against actual · {view.quarter} <Synthetic />
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{view.headline}</h1>
        <p className="mt-2 max-w-4xl text-sm font-medium text-ink-2" data-tranche-line>
          {view.trancheLine}
        </p>
        <div className="mt-2">
          <How>{view.headlineHow}</How>
        </div>
      </header>

      <nav aria-label="Quarter" className="flex flex-wrap gap-1 rounded-tile border border-line bg-panel p-1 print:hidden" data-quarters>
        {view.quarters.map((one) => (
          <Link key={one.id} href={present ? `${one.href}&present=1` : one.href} aria-current={one.current ? "page" : undefined} className={`rounded-tile px-3 py-1.5 text-sm ${one.current ? "bg-brand-soft font-semibold text-ink" : "text-ink-3 hover:text-ink"}`}>
            {one.label}
            {one.reported ? null : <span className="ml-1.5 text-micro uppercase tracking-wide text-ink-5">Not reported</span>}
          </Link>
        ))}
      </nav>

      {view.rows === null ? (
        <Panel title="Plan against actual">
          <p className="text-sm text-ink-2" data-not-reported>
            {view.notReported}
          </p>
        </Panel>
      ) : (
        <>
          <Panel title="Tranches" aside="Synthetic records">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {view.totals.map((figure) => (
                <div key={figure.key} data-shown-figure={figure.key}>
                  <dt className="flex items-center gap-2 text-caption text-ink-4">
                    {figure.label} <Synthetic />
                  </dt>
                  <dd className="text-2xl font-semibold text-ink">{figure.value}</dd>
                  <dd className="text-micro leading-snug text-ink-5">{figure.basis}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Plan against actual, by DisCo" aside="Plan calculated; actual synthetic">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[80rem] text-sm" data-monitoring-table>
                <thead>
                  <tr className="text-left text-caption text-ink-5">
                    <th className="py-1 pr-3 font-medium" />
                    <th className="py-1 pr-3 font-medium" colSpan={6}>
                      Meters
                    </th>
                    {groups.map((group) => (
                      <th key={group} className="py-1 pr-3 font-medium" colSpan={2}>
                        {group}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                    {["DisCo", "Planned", "Installed", "Verified", "Against plan", "Tranche released", "Tranche held", ...groups.flatMap(() => ["Plan", "Actual"])].map((head, index) => (
                      <th key={`${head}-${index}`} className="py-1.5 pr-3 font-medium">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.disco} className="border-b border-line/60 text-ink-2" data-monitoring-row={row.disco}>
                      <td className="py-1.5 pr-3 font-semibold text-ink">{row.name}</td>
                      <td className="py-1.5 pr-3">{row.plannedMeters}</td>
                      <td className="py-1.5 pr-3">{row.installed}</td>
                      <td className="py-1.5 pr-3 font-semibold text-ink">{row.verified}</td>
                      <td className={`py-1.5 pr-3 font-semibold ${row.behind ? "text-caution" : "text-ok"}`}>{row.againstPlan}</td>
                      <td className="py-1.5 pr-3">{row.trancheReleased}</td>
                      <td className="py-1.5 pr-3">{row.trancheHeld}</td>
                      <PlanActual plan={row.supplyPlan} actual={row.supplyActual} />
                      <PlanActual plan={row.consumptionPlan} actual={row.consumptionActual} />
                      <PlanActual plan={row.escrowPlan} actual={row.escrowActual} />
                      <PlanActual plan={row.repaidPlan} actual={row.repaidActual} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <How>{view.how}</How>
          </Panel>
        </>
      )}

      <Panel title="Method">
        <p className="text-caption text-ink-4">
          A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer} Actuals from: {view.sourcing.sources.map((one) => one.name).join(", ")}.
        </p>
      </Panel>
    </div>
  );
}
