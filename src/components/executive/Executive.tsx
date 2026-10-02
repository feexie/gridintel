import Link from "next/link";
import type { AttentionSubject, ExecutiveView, FeederGapRow } from "@/services/executive/views";
import type { RevenueGapView } from "@/services/operations/views";
import { Legend, MetricCell, MetricTile, OriginTag, Panel, StatusBadge } from "@/components/operations/Metric";
import { LossesPanel, NotAvailable, ReliabilityPanel } from "@/components/operations/Panels";
import { LEVEL_NAME, OPERATIONS_HOME, formatMetric, formatMoney, formatNumber, formatPeriod, formatTime, levelHref } from "@/components/operations/format";

function Subject({ entry }: { entry: AttentionSubject }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-3 py-1.5 text-xs" data-subject={entry.subject.id}>
      <span className="font-mono text-slate-500">{entry.rank}.</span>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-slate-100">
            <Link href={levelHref(entry.subject.kind, entry.subject.id)} className="text-cyan-300 hover:text-cyan-200 hover:underline">
              {entry.subject.name}
            </Link>
            <span className="ml-1.5 text-[10px] text-slate-500">
              {LEVEL_NAME[entry.subject.kind]} {entry.subject.id}
            </span>
          </p>
          {entry.money ? (
            <p className="flex items-center gap-1.5">
              <span className="font-mono text-sm text-slate-50">{formatMetric(entry.money)}</span>
              <span className="text-[10px] text-slate-400">revenue not realised, monthly estimate</span>
              <OriginTag origin={entry.money.origin} />
              <StatusBadge status={entry.money.status} />
            </p>
          ) : null}
        </div>
        <ul className="mt-0.5 space-y-0.5">
          {entry.findings.map((finding) => (
            <li key={finding.rule} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] text-slate-300" title={`Rule: ${finding.rule}`}>
              <span>
                {finding.title}
                {finding.context ? (
                  <span className="text-slate-500">
                    {" "}
                    ({formatMetric(finding.context.metric)} {finding.context.metric.label.toLowerCase()}, {finding.context.note})
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-slate-100">{formatMetric(finding.metric)}</span>
                {finding.detail ? (
                  <span className="font-mono text-slate-400">
                    · {formatNumber(finding.detail.value)} {finding.detail.label}
                  </span>
                ) : null}
                <OriginTag origin={finding.metric.origin} />
                <StatusBadge status={finding.metric.status} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function WhereToLook({ assetRisk, ranked, method }: { assetRisk: AttentionSubject[]; ranked: AttentionSubject[]; method: string }) {
  const money = ranked.filter((entry) => entry.group === "money");
  const other = ranked.filter((entry) => entry.group === "other");
  return (
    <Panel title="Where to look first" aside="Facts from fixed rules. No AI.">
      <div data-group="asset-risk">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-rose-200">
          ▲ Asset risk <span className="font-normal normal-case tracking-normal text-slate-400">Equipment over its rating. Not ranked by money.</span>
        </h3>
        {assetRisk.length === 0 ? (
          <p className="py-1 text-xs text-slate-400">No transformer was loaded above its rating in the period.</p>
        ) : (
          <ol className="divide-y divide-slate-800/70">
            {assetRisk.map((entry) => (
              <Subject key={entry.subject.id} entry={entry} />
            ))}
          </ol>
        )}
      </div>

      <div data-group="money">
        <h3 className="flex items-center gap-2 border-t border-slate-800 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
          Revenue <span className="font-normal normal-case tracking-normal text-slate-400">Feeders, ranked by estimated revenue not realised.</span>
        </h3>
        {money.length === 0 ? (
          <p className="py-1 text-xs text-slate-400">No feeder has a money figure to rank by in this period.</p>
        ) : (
          <ol className="divide-y divide-slate-800/70">
            {money.map((entry) => (
              <Subject key={entry.subject.id} entry={entry} />
            ))}
          </ol>
        )}
      </div>

      {other.length > 0 ? (
        <div data-group="other">
          <h3 className="flex items-center gap-2 border-t border-slate-800 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
            Other findings <span className="font-normal normal-case tracking-normal text-slate-400">No money figure to rank by; in rule order.</span>
          </h3>
          <ol className="divide-y divide-slate-800/70">
            {other.map((entry) => (
              <Subject key={entry.subject.id} entry={entry} />
            ))}
          </ol>
        </div>
      ) : null}
      <p className="text-[10px] leading-snug text-slate-500">{method} Each name opens the Operations drill-down, where source and method are shown.</p>
    </Panel>
  );
}

function RevenueGapPanel({ gap, byFeeder }: { gap: RevenueGapView; byFeeder: FeederGapRow[] }) {
  return (
    <Panel title="Revenue gap" aside={<span>Estimate of revenue not realised · monthly, not annualised</span>}>
      <p className="border-l-2 border-amber-400/60 pl-2 text-xs leading-snug text-amber-100/90">
        {gap.definition} {gap.periodNote}
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <MetricTile metric={gap.notRealised} sourcing={gap.sourcing} emphasis />
        <MetricTile metric={gap.commercial} sourcing={gap.sourcing} />
        <MetricTile metric={gap.collection} sourcing={gap.sourcing}>
          <span className="border border-slate-700 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-300">Cash basis</span>
        </MetricTile>
      </div>
      <p className="text-[11px] leading-snug text-slate-300">
        The commercial gap and the collection gap are shown separately and are never set against each other.
        {gap.negativeNote ? <span className="text-amber-100"> {gap.negativeNote}</span> : null}
      </p>
      {gap.caveat ? <p className="text-[11px] leading-snug text-amber-100/90">† {gap.caveat} The rates below are therefore assumptions too.</p> : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">By feeder</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Feeder</th>
                <th className="py-1 pr-2 text-right font-normal">Commercial gap</th>
                <th className="py-1 pr-2 text-right font-normal">Collection gap</th>
                <th className="py-1 text-right font-normal">Not realised</th>
              </tr>
            </thead>
            <tbody>
              {byFeeder.map((row) => (
                <tr key={row.feederId} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2">
                    <Link href={levelHref("feeder", row.feederId)} className="text-cyan-300 hover:underline">
                      {row.feederName}
                    </Link>
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <MetricCell metric={row.commercial} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <MetricCell metric={row.collection} />
                  </td>
                  <td className="py-1 text-right">
                    <MetricCell metric={row.notRealised} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">How the commercial gap is valued</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Where the loss occurs</th>
                <th className="py-1 pr-2 text-right font-normal">Unbilled energy</th>
                <th className="py-1 pr-2 text-right font-normal">LV non-MD rate{gap.caveat ? " †" : ""}</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {gap.parts.map((part) => (
                <tr key={`${part.kind}:${part.scope.id}`} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2 text-slate-200">
                    {part.scope.name}
                    <span className="ml-1.5 text-[10px] text-slate-500">{part.kind === "residual" ? "residual above the sections below" : part.scope.id}</span>
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono">{part.energyKwh === null ? "—" : `${formatNumber(part.energyKwh)} kWh`}</td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono">{part.ratePerKwh === null ? "—" : `${formatMoney(part.ratePerKwh, gap.currency)}/kWh`}</td>
                  <td className="whitespace-nowrap py-1 text-right font-mono text-slate-50">{part.amount === null ? "—" : formatMoney(part.amount, gap.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Each loss is valued at the average rate billed to low-voltage, non-maximum-demand customers where it occurs. Customers supplied at 11 kV are in no rate.
          </p>
        </div>
      </div>
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

      <WhereToLook assetRisk={view.assetRisk} ranked={view.whereToLook} method={view.whereToLookMethod} />

      <RevenueGapPanel gap={view.revenueGap} byFeeder={view.gapByFeeder} />

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
