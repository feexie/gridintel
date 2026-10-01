import Link from "next/link";
import type { ExecutiveView, LookItem } from "@/services/executive/views";
import { Legend, MetricCell, OriginTag, Panel, StatusBadge } from "@/components/operations/Metric";
import { LossesPanel, NotAvailable, ReliabilityPanel } from "@/components/operations/Panels";
import { LEVEL_NAME, OPERATIONS_HOME, formatMetric, formatNumber, formatPeriod, formatTime, levelHref } from "@/components/operations/format";

function WhereToLook({ items, method }: { items: LookItem[]; method: string }) {
  return (
    <Panel title="Where to look first" aside="Ranked facts from fixed rules. No AI.">
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">No rule selected anything in this period.</p>
      ) : (
        <ol className="divide-y divide-slate-800/70">
          {items.map((item) => (
            <li key={`${item.rank}:${item.subject.id}`} className="grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-3 py-1.5 text-xs">
              <span className="font-mono text-slate-500">{item.rank}.</span>
              <div>
                <p className="text-slate-100">
                  {item.title}:{" "}
                  <Link href={levelHref(item.subject.kind, item.subject.id)} className="text-cyan-300 hover:text-cyan-200 hover:underline">
                    {item.subject.name}
                  </Link>
                  <span className="ml-1.5 text-[10px] text-slate-500">
                    {LEVEL_NAME[item.subject.kind]} {item.subject.id}
                  </span>
                </p>
                <p className="text-[10px] text-slate-500">Rule: {item.rule}.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-right">
                <span className="font-mono text-sm text-slate-50">{formatMetric(item.metric)}</span>
                {item.detail ? (
                  <span className="font-mono text-slate-300">
                    · {formatNumber(item.detail.value)} {item.detail.label}
                  </span>
                ) : null}
                <OriginTag origin={item.metric.origin} />
                <StatusBadge status={item.metric.status} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[10px] leading-snug text-slate-500">{method} Each item opens the Operations drill-down, where its source and method are shown.</p>
    </Panel>
  );
}

export function Executive({ view }: { view: ExecutiveView }) {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Utility Intelligence</p>
            <h1 className="text-xl font-semibold text-white">Executive</h1>
            <p className="text-xs text-slate-400">{view.organization ?? "Organization not recorded"} · what is happening across the portfolio, and where to look first.</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
            <dt>Reporting period</dt>
            <dd className="font-mono text-slate-200">{formatPeriod(view.period)}</dd>
            <dt>Data as of</dt>
            <dd className="font-mono text-slate-200">{formatTime(view.asOf)}</dd>
          </dl>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-800 py-1.5 text-xs">
          {view.facts.map((fact) => (
            <div key={fact.label} className="flex gap-1.5">
              <dt className="text-slate-500">{fact.label}</dt>
              <dd className="text-slate-100">{fact.value}</dd>
            </div>
          ))}
          <div className="flex gap-1.5">
            <dt className="text-slate-500">Detail</dt>
            <dd>
              <Link href={OPERATIONS_HOME} className="text-cyan-300 hover:underline">
                Operations drill-down
              </Link>
            </dd>
          </div>
        </dl>
        <Legend />
      </header>

      <WhereToLook items={view.whereToLook} method={view.whereToLookMethod} />

      {view.losses ? (
        <LossesPanel losses={view.losses} />
      ) : (
        <Panel title="Energy account and ATC&C">
          <p className="text-xs text-slate-400">{view.lossesNote}</p>
        </Panel>
      )}

      <ReliabilityPanel reliability={view.reliability} showBand={false} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Service-band compliance by feeder" aside="Hours of supply per day against the NERC band minimum">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Feeder</th>
                <th className="py-1 pr-2 font-normal">Band</th>
                <th className="py-1 pr-2 text-right font-normal">Average</th>
                <th className="py-1 pr-2 text-right font-normal">Days below minimum</th>
                <th className="py-1 font-normal">On average</th>
              </tr>
            </thead>
            <tbody>
              {view.bandCompliance.map((row) => (
                <tr key={row.feederId} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2">
                    <Link href={levelHref("feeder", row.feederId)} className="text-cyan-300 hover:underline">
                      {row.feederName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-slate-200">{row.band ? `${row.band} (min ${row.minimumHours} h)` : "not recorded"}</td>
                  <td className="py-1 pr-2 text-right">
                    <MetricCell metric={row.averageHours} />
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-slate-100">
                    {row.daysFailed === null ? "—" : `${row.daysFailed} of ${row.daysObserved}`}
                  </td>
                  <td className="whitespace-nowrap py-1 text-slate-200">{row.compliantOnAverage === null ? "—" : row.compliantOnAverage ? "● Meets minimum" : "▼ Below minimum"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] leading-snug text-slate-500">
            A feeder can meet its minimum on average and still fail on individual days. The day-by-day test is a GridIntel reference calculation, not a regulatory determination.
          </p>
        </Panel>

        <Panel title="Transformer peak loading" aside="Highest observed in the period, against rating">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Transformer</th>
                <th className="py-1 pr-2 text-right font-normal">Rating</th>
                <th className="py-1 pr-2 text-right font-normal">Peak</th>
                <th className="py-1 pr-2 text-right font-normal">Hours over rating</th>
                <th className="py-1 font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              {view.transformerLoading.map((row) => (
                <tr key={row.transformerId} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2">
                    <Link href={levelHref("distribution_transformer", row.transformerId)} className="text-cyan-300 hover:underline">
                      {row.transformerName}
                    </Link>
                    <span className="ml-1.5 text-[10px] text-slate-500">{row.feederName}</span>
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono text-slate-200">{row.ratedKva === null ? "—" : `${formatNumber(row.ratedKva)} kVA`}</td>
                  <td className="py-1 pr-2 text-right">
                    <MetricCell metric={row.peak} />
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono text-slate-100">
                    {row.hoursOverRating === null ? "—" : `${row.hoursOverRating} of ${row.hoursObserved ?? "—"}`}
                  </td>
                  <td className="whitespace-nowrap py-1 text-slate-200">{row.overloaded === null ? "—" : row.overloaded ? "▲ Over rating" : "Within rating"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] leading-snug text-slate-500">Peak is the highest of the hourly readings; a higher loading between readings would not be seen.</p>
        </Panel>
      </div>

      <NotAvailable view={view.alarms} />
    </div>
  );
}
