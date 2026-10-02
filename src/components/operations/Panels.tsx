import Link from "next/link";
import type {
  ChildTable,
  LoadingView,
  LossesView,
  NotAvailableView,
  ReliabilityView,
  ReportedComparisonView,
  SupplyView,
} from "@/services/operations/views";
import { MetricCell, MetricTile, OriginTag, Panel, StatusBadge } from "./Metric";
import { formatMetric, formatMoney, formatNumber, formatPercent, formatTime, levelHref } from "./format";

/* Chart colours: categorical slots validated for this dark surface (blue, orange, aqua). */
const SERIES = { technical: "#3987e5", commercial: "#d95926", collection: "#199e70" };
const NEUTRAL = "#1e293b";
const SERIOUS = "#ec835a";

/* ---------------- Losses ---------------- */

function DecompositionBar({ losses }: { losses: LossesView }) {
  const parts = [
    { key: "technical", label: "Technical", metric: losses.parts.technical, color: SERIES.technical },
    { key: "commercial", label: "Commercial", metric: losses.parts.commercial, color: SERIES.commercial },
    { key: "collection", label: "Collection", metric: losses.parts.collection, color: SERIES.collection },
  ] as const;
  if (parts.some((part) => part.metric.value === null) || losses.atcc.value === null) {
    return (
      <p className="border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400">
        ATC&amp;C cannot be decomposed for this section: {losses.atcc.missingInputs.join("; ") || "a part is not available"}.
      </p>
    );
  }
  return (
    <figure className="space-y-2">
      <figcaption className="text-[11px] text-slate-400">
        Share of energy input lost, by cause. The parts sum to ATC&amp;C; the remainder is energy billed and paid for.
      </figcaption>
      <div className="flex h-4 w-full gap-[2px]" role="img" aria-label={`ATC&C ${formatPercent(losses.atcc.value)} of energy input`}>
        {parts.map((part) => (
          <div
            key={part.key}
            title={`${part.label} loss: ${formatPercent(part.metric.value)} of energy input`}
            style={{ width: `${(part.metric.value as number) * 100}%`, background: part.color }}
            className="h-full min-w-[2px] first:rounded-l-sm"
          />
        ))}
        <div
          title={`Billed and paid for: ${formatPercent(1 - losses.atcc.value)} of energy input`}
          style={{ background: NEUTRAL }}
          className="h-full flex-1 rounded-r-sm"
        />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: part.color }} />
            {part.label} <span className="font-mono tabular-nums text-slate-100">{formatPercent(part.metric.value)}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: NEUTRAL }} />
          Billed and paid <span className="font-mono tabular-nums text-slate-100">{formatPercent(1 - losses.atcc.value)}</span>
        </li>
      </ul>
    </figure>
  );
}

function formatVariance(row: ReportedComparisonView): string {
  if (row.variance === null) return "—";
  const unit = row.varianceUnit === "percentage_points" ? " pp" : row.varianceUnit === "hours" ? " h" : "";
  return `${row.variance > 0 ? "+" : ""}${formatNumber(row.variance, 1)}${unit}`;
}

/** Reported figures beside the calculated figure on the same basis, or the reason there is none. */
export function Comparisons({ rows }: { rows: ReportedComparisonView[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Reported versus calculated</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-500">
            <th className="py-1 pr-2 font-normal">Figure</th>
            <th className="py-1 pr-2 text-right font-normal">Reported</th>
            <th className="py-1 pr-2 text-right font-normal">Calculated, same basis</th>
            <th className="py-1 pr-2 text-right font-normal">Difference</th>
            <th className="py-1 font-normal">Basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.statedFor ?? ""}:${row.label}`} className="border-b border-slate-800/60 align-top">
              <td className="py-1 pr-2 text-slate-200">
                {row.label}
                {row.statedFor ? <span className="block text-[10px] leading-snug text-amber-100/90">Stated for {row.statedFor}; compared at that scope.</span> : null}
              </td>
              <td className="py-1 pr-2 text-right">
                <MetricCell metric={row.reported} />
              </td>
              <td className="py-1 pr-2 text-right">
                {row.sameBasis ? <MetricCell metric={row.calculated} /> : <span className="text-slate-500">none on this basis</span>}
              </td>
              <td className="py-1 pr-2 text-right font-mono text-slate-100">{row.sameBasis ? formatVariance(row) : "—"}</td>
              <td className="py-1 text-[11px] leading-snug">
                {row.comparable ? (
                  <span className="text-emerald-300">● Same basis</span>
                ) : (
                  <span className="text-rose-200">∅ Not comparable</span>
                )}
                <span className="block text-slate-300">Reported counts: {row.reportedBasis ?? "basis not stated"}.</span>
                {row.reasons.map((reason) => (
                  <span key={reason} className="block text-rose-100/90">
                    {reason}
                  </span>
                ))}
                {row.caveats.map((caveat) => (
                  <span key={caveat} className="block text-slate-500">
                    Note: {caveat}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-slate-500">
        Source of reported figures: {rows[0].document ?? "not stated"}. A reported figure is compared only with the calculated figure that counts the same things. Reported
        figures are shown as published and never replace calculated ones.
      </p>
    </div>
  );
}

export function LossesPanel({ losses }: { losses: LossesView }) {
  return (
    <Panel title="Energy account and ATC&C" aside={<StatusBadge status={losses.status} />}>
      {losses.scopeNote ? <p className="border-l-2 border-amber-400/60 pl-2 text-xs text-amber-100/90">{losses.scopeNote}</p> : null}
      <div className="grid gap-2 md:grid-cols-4">
        <MetricTile metric={losses.atcc} sourcing={losses.sourcing} emphasis />
        <MetricTile metric={losses.parts.technical} sourcing={losses.sourcing} />
        <MetricTile metric={losses.parts.commercial} sourcing={losses.sourcing} />
        <MetricTile metric={losses.parts.collection} sourcing={losses.sourcing} />
      </div>
      <DecompositionBar losses={losses} />

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Accounting chain</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {losses.chain.map((metric) => (
                <tr key={metric.label} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2 text-slate-200">
                    {metric.label}
                    {metric.note ? <span className="block text-[10px] leading-snug text-slate-500">{metric.note}</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono tabular-nums text-slate-50">{formatMetric(metric)}</td>
                  <td className="py-1 pr-1 text-right">
                    <OriginTag origin={metric.origin} />
                  </td>
                  <td className="whitespace-nowrap py-1 text-right">
                    <StatusBadge status={metric.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mb-1 mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
            Measured cross-checks <StatusBadge status={losses.crossChecks.status} />
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {losses.crossChecks.metrics.map((metric) => (
                <tr key={metric.label} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2 text-slate-200">{metric.label}</td>
                  <td className="py-1 text-right">
                    <MetricCell metric={metric} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {losses.crossChecks.note ? <p className="mt-1 text-[11px] leading-snug text-slate-400">{losses.crossChecks.note}</p> : null}
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricTile metric={losses.billingEfficiency} sourcing={losses.sourcing} />
            <MetricTile metric={losses.collectionEfficiency} sourcing={losses.sourcing}>
              <span className="border border-slate-700 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-300">Cash basis</span>
            </MetricTile>
            <MetricTile metric={losses.revenueBilled} sourcing={losses.sourcing} />
            <MetricTile metric={losses.revenueCollected} sourcing={losses.sourcing}>
              <span className="border border-slate-700 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-300">Cash basis</span>
            </MetricTile>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">How billed</th>
                <th className="py-1 pr-2 text-right font-normal">Charges</th>
                <th className="py-1 pr-2 text-right font-normal">Energy</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {losses.billingByBasis.map((row) => (
                <tr key={row.basis} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2 text-slate-200">
                    {row.label} {row.basis === "estimated" ? <OriginTag origin="estimated" /> : null}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{formatNumber(row.records)}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.energyKwh === null ? "—" : `${formatNumber(row.energyKwh)} kWh`}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatMoney(row.amount, losses.revenueBilled.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500">
            {losses.accounts.billed} of {losses.accounts.inScope ?? "an unknown number of"} accounts were charged in the period.
          </p>
        </div>
      </div>
      <Comparisons rows={losses.reported} />
    </Panel>
  );
}

/* ---------------- Reliability ---------------- */

function SupplyStrip({ supply }: { supply: SupplyView }) {
  if (supply.days.length === 0) return null;
  const failing = supply.days.filter((day) => day.compliant === false);
  return (
    <figure className="space-y-1">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-slate-400">
        <span>Hours of supply per day{supply.minimumHours === null ? "" : `, against the Band ${supply.band} minimum of ${supply.minimumHours} h`}</span>
        <span className="font-mono text-slate-500">0–24 h</span>
      </figcaption>
      <div className="relative h-20 border-b border-slate-700">
        {supply.minimumHours === null ? null : (
          <div
            className="absolute inset-x-0 border-t border-dashed border-slate-300/70"
            style={{ bottom: `${(supply.minimumHours / 24) * 100}%` }}
            title={`Band minimum: ${supply.minimumHours} h`}
          >
            <span className="absolute -top-3.5 right-0 bg-[#0b1220] px-1 text-[10px] text-slate-300">min {supply.minimumHours} h</span>
          </div>
        )}
        <div className="flex h-full items-end gap-[2px]">
          {supply.days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${formatNumber(day.hours, 1)} h of supply${day.compliant === false ? " (below band minimum)" : ""}`}
              className="flex-1 rounded-t-[2px]"
              style={{ height: `${(day.hours / 24) * 100}%`, background: day.compliant === false ? SERIOUS : SERIES.technical }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-[2px] text-center text-[9px] leading-none text-slate-300" aria-hidden>
        {supply.days.map((day) => (
          <span key={day.date} className="flex-1">
            {day.compliant === false ? "▼" : ""}
          </span>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>{supply.days[0].date}</span>
        <span>{supply.days[supply.days.length - 1].date}</span>
      </div>
      {supply.minimumHours === null ? null : (
        <p className="text-[11px] leading-snug text-slate-300">
          <span className="font-mono text-slate-50">{supply.daysCompliant}</span> days met the minimum,{" "}
          <span className="font-mono text-slate-50">{supply.daysNonCompliant}</span> did not (▼)
          {failing.length > 0 ? `: ${failing.map((day) => day.date.slice(5)).join(", ")}` : ""}.{" "}
          {supply.compliantOnAverage ? "The average over the period meets the minimum." : "The average over the period is below the minimum."}
        </p>
      )}
      {supply.note ? <p className="text-[10px] text-slate-500">{supply.note} The day-by-day test is not a regulatory determination.</p> : null}
    </figure>
  );
}

export function ReliabilityPanel({ reliability, showBand }: { reliability: ReliabilityView; showBand: boolean }) {
  return (
    <Panel title="Reliability and hours of supply" aside={<span>Customers served: <MetricCell metric={reliability.customersServed} /></span>}>
      {reliability.scopeNote ? <p className="border-l-2 border-amber-400/60 pl-2 text-xs text-amber-100/90">{reliability.scopeNote}</p> : null}
      <div className="grid gap-2 md:grid-cols-5">
        <MetricTile metric={reliability.saidi} sourcing={reliability.sourcing} emphasis />
        <MetricTile metric={reliability.saifi} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.caidi} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.asai} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.supply.averageHours} sourcing={reliability.sourcing}>
          {showBand && reliability.supply.band ? (
            <span className="border border-slate-700 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-300">
              Band {reliability.supply.band} · min {reliability.supply.minimumHours} h
            </span>
          ) : null}
        </MetricTile>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Attribution of interruptions</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Attributed to</th>
                <th className="py-1 pr-2 text-right font-normal">SAIDI</th>
                <th className="py-1 pr-2 text-right font-normal">SAIFI</th>
                <th className="w-2/5 py-1 font-normal">Share of customer-hours</th>
              </tr>
            </thead>
            <tbody>
              {reliability.attribution.map((row) => (
                <tr key={row.key} className="border-b border-slate-800/60" title={row.description}>
                  <td className="py-1 pr-2 text-slate-200">{row.label}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.saidiHours === null ? "—" : `${formatNumber(row.saidiHours, 1)} h`}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.saifi === null ? "—" : formatNumber(row.saifi, 2)}</td>
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-slate-800">
                        <div className="h-full rounded-r-[2px]" style={{ width: `${(row.share ?? 0) * 100}%`, background: SERIES.technical }} />
                      </div>
                      <span className="w-12 text-right font-mono tabular-nums text-slate-300">{formatPercent(row.share)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            The classes sum to the totals above. Nothing is apportioned.
            {reliability.unattributable > 0 ? ` ${reliability.unattributable} exposure(s) recorded above this scope are not in any figure here.` : ""}
            {reliability.excludedForData > 0 ? ` ${reliability.excludedForData} exposure(s) with missing times or customer counts were excluded.` : ""}
            {reliability.momentary > 0 ? ` ${reliability.momentary} momentary exposure(s) are not counted.` : ""}
          </p>
          <div className="mt-3">
            <Comparisons rows={reliability.reported} />
          </div>
        </div>
        <SupplyStrip supply={reliability.supply} />
      </div>
    </Panel>
  );
}

/* ---------------- Loading ---------------- */

export function LoadingPanel({ loading }: { loading: LoadingView }) {
  return (
    <Panel title="Loading" aside={loading.ratedKva === null ? "Rating not recorded" : `Rated ${formatNumber(loading.ratedKva)} kVA`}>
      {loading.caveat ? <p className="border-l-2 border-amber-400/60 pl-2 text-xs text-amber-100/90">{loading.caveat}</p> : null}
      <div className="grid gap-2 md:grid-cols-3">
        <MetricTile metric={{ ...loading.peak, note: null }} sourcing={loading.sourcing} emphasis>
          {loading.overloaded === null ? null : (
            <span className={`border px-1.5 py-px text-[10px] uppercase tracking-wide ${loading.overloaded ? "border-rose-400/60 text-rose-200" : "border-slate-700 text-slate-300"}`}>
              {loading.overloaded ? "▲ Over rating" : "Within rating"}
            </span>
          )}
        </MetricTile>
        <div className="border border-slate-800 bg-slate-900/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Hours over rating</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-slate-50">
            {loading.hoursOverRating === null ? "—" : formatNumber(loading.hoursOverRating)}
            <span className="text-xs text-slate-500"> of {loading.hoursObserved ?? "—"} hourly readings</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Readings above 100% of rating in the period.
            {loading.peakAt ? ` Peak ${loading.peakKva === null ? "" : `${formatNumber(loading.peakKva, 1)} kVA `}at ${formatTime(loading.peakAt)}.` : ""}
          </p>
        </div>
        <MetricTile metric={{ ...loading.asOf, label: `Loading at ${formatTime(loading.asOfTime)}`, note: null }} sourcing={loading.sourcing} />
      </div>
    </Panel>
  );
}

/* ---------------- Children and not-available ---------------- */

const FOOTNOTE_MARKS = ["†", "‡", "§", "¶", "‖", "#"];

export function ChildrenTable({ table }: { table: ChildTable }) {
  // Every caveat on a figure in the table is printed under it, with a marker on the figure,
  // so that no caveat depends on hovering.
  const notes: string[] = [];
  for (const row of table.rows) {
    for (const column of table.columns) {
      const note = row.cells[column.key]?.note;
      if (note && !notes.includes(note)) notes.push(note);
    }
  }
  const markFor = (note: string | null | undefined) =>
    note ? (FOOTNOTE_MARKS[notes.indexOf(note)] ?? `[${notes.indexOf(note) + 1}]`) : undefined;

  return (
    <Panel
      title={`${table.title} (${table.rows.length})`}
      aside={table.coverage === "complete" ? "Registry: complete list" : <span className="text-amber-200">Registry: {table.coverage.replace("_", " ")} — this is not the full list</span>}
    >
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-[#0b1220]">
            <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3 font-normal">Name</th>
              {table.columns.map((column) => (
                <th key={column.key} className="py-1 pl-3 text-right font-normal">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="py-1 pr-3">
                  <Link href={levelHref(row.kind, row.id)} className="text-cyan-300 hover:text-cyan-200 hover:underline">
                    {row.name}
                  </Link>
                  <span className="ml-2 text-[10px] text-slate-500">{[row.name === row.id ? "" : row.id, ...row.facts].filter(Boolean).join(" · ")}</span>
                </td>
                {table.columns.map((column) => (
                  <td key={column.key} className="py-1 pl-3 text-right">
                    <MetricCell metric={row.cells[column.key]} mark={markFor(row.cells[column.key]?.note)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] leading-snug text-amber-100/90">
          {notes.map((note) => (
            <li key={note}>
              <span className="font-mono">{markFor(note)}</span> {note}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[10px] text-slate-500">
        ● measured or fully calculated · ≈ estimated inputs · ! insufficient data · – not available. The tag after each figure is its origin (MEAS, REPO, CALC, ESTI, DERI). Open a row for
        source and method.
      </p>
    </Panel>
  );
}

export function NotAvailable({ view }: { view: NotAvailableView }) {
  return (
    <Panel title={view.title} aside={<StatusBadge status="not_available" />}>
      <p className="text-xs leading-relaxed text-slate-400">{view.reason}</p>
    </Panel>
  );
}
