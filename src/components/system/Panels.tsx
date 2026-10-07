import Link from "next/link";
import type {
  AlarmRowView,
  AlarmSubjectView,
  AlarmsView,
  ChildTable,
  ConditionRowView,
  LoadingView,
  LossesView,
  PowerTransformerView,
  ReliabilityView,
  ReportedComparisonView,
  RuleFindingView,
  RevenueGapRow,
  RevenueGapView,
  SupplyView,
} from "@/services/operations/views";
import type { ValuationView } from "@/services/revenue/views";
import { MetricCell, MetricTile, OriginTag, Panel, StatusBadge } from "./Metric";
import { HeadRow, Row, SubHead, Table, Td, Th } from "./Table";
import { formatMetric, formatMoney, formatNumber, formatPercent, formatRate, formatSigned, formatTime, levelHref } from "./format";

/* Chart colours are design tokens (globals.css): categorical slots validated for the panel surface. */
const SERIES = { technical: "var(--color-series-technical)", commercial: "var(--color-series-commercial)", collection: "var(--color-series-collection)" };
const NEUTRAL = "var(--color-series-rest)";
const SERIOUS = "var(--color-series-serious)";

/* ---------------- Losses ---------------- */

export function DecompositionBar({ losses }: { losses: LossesView }) {
  const parts = [
    { key: "technical", label: "Technical", metric: losses.parts.technical, color: SERIES.technical },
    { key: "commercial", label: "Commercial", metric: losses.parts.commercial, color: SERIES.commercial },
    { key: "collection", label: "Collection", metric: losses.parts.collection, color: SERIES.collection },
  ] as const;
  if (parts.some((part) => part.metric.value === null) || losses.atcc.value === null) {
    return (
      <p className="border border-dashed border-line-strong px-3 py-2 text-xs text-ink-4">
        ATC&amp;C cannot be decomposed for this section: {losses.atcc.missingInputs.join("; ") || "a part is not available"}.
      </p>
    );
  }
  return (
    <figure className="space-y-2">
      <figcaption className="text-caption text-ink-4">
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
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-3">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: part.color }} />
            {part.label} <span className="font-mono tabular-nums text-ink">{formatPercent(part.metric.value)}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: NEUTRAL }} />
          Billed and paid <span className="font-mono tabular-nums text-ink">{formatPercent(1 - losses.atcc.value)}</span>
        </li>
      </ul>
    </figure>
  );
}

function formatVariance(row: ReportedComparisonView): string {
  if (row.variance === null) return "—";
  const unit = row.varianceUnit === "percentage_points" ? " pp" : row.varianceUnit === "hours" ? " h" : "";
  const text = formatNumber(row.variance, 1);
  return `${row.variance > 0 && /[1-9]/.test(text) ? "+" : ""}${text}${unit}`;
}

/**
 * What a reported attribution rule changes, each as a finding with its size. Shown as findings,
 * above the comparison they belong to, and never as a note beside it.
 */
export function RuleFindings({ findings, scopeId }: { findings: RuleFindingView[]; scopeId?: string }) {
  if (findings.length === 0) return null;
  return (
    <div className="border border-caution-line/50 bg-caution-surface/30 px-3 py-2" data-rule-findings>
      <h3 className="text-caption font-semibold uppercase tracking-wide text-caution">
        ▲ Finding: the report&apos;s attribution rule <span className="font-normal normal-case tracking-normal text-caution-ink/80">differs from the GridIntel reference rule</span>
      </h3>
      <ul className="mt-1 space-y-1">
        {findings.map((found) => {
          const moved = found.difference.value !== null && found.difference.value !== 0;
          return (
            <li key={`${found.statedFor.id}:${found.figure}`} className="text-xs leading-snug text-ink" data-rule-finding={`${found.statedFor.id}:${found.figure}`}>
              {found.statedFor.id === scopeId ? null : (
                <>
                  <Link href={levelHref(found.statedFor.kind, found.statedFor.id)} className="text-link hover:underline">
                    {found.statedFor.name}
                  </Link>
                  {". "}
                </>
              )}
              {found.statement}:{" "}
              {moved ? (
                <>
                  <span className="font-mono text-sm font-semibold tabular-nums text-caution-ink">{formatSigned(found.difference)}</span> {found.figure} under the reference rule
                </>
              ) : found.difference.value === null ? (
                <span className="text-ink-3">the size of the difference is not available for {found.figure}</span>
              ) : (
                <span className="text-ink-3">no difference to {found.figure} in this period, because no interruption began there</span>
              )}
              <span className="ml-1.5 inline-flex items-center gap-1.5 align-baseline">
                <OriginTag origin={found.difference.origin} />
                <StatusBadge status={found.difference.status} />
              </span>
              <span className="block text-caption text-ink-4">
                {found.figure} on the report&apos;s rule <MetricCell metric={found.onReportedRule} />, on the reference rule <MetricCell metric={found.onReferenceRule} />. Same
                interruptions, same classes counted; only the rule differs.
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Reported figures beside the calculated figure on the same basis, or the reason there is none. */
export function Comparisons({ rows }: { rows: ReportedComparisonView[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">Reported versus calculated</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-ink-5">
            <th className="py-1 pr-2 font-normal">Figure</th>
            <th className="py-1 pr-2 text-right font-normal">Reported</th>
            <th className="py-1 pr-2 text-right font-normal">Calculated, same basis</th>
            <th className="py-1 pr-2 text-right font-normal">Difference</th>
            <th className="py-1 font-normal">Basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.statedFor ?? ""}:${row.label}`} className="border-b border-line/60 align-top">
              <td className="py-1 pr-2 text-ink-2">
                {row.label}
                {row.statedFor ? <span className="block text-micro leading-snug text-caution-ink/90">Stated for {row.statedFor}; compared at that scope.</span> : null}
              </td>
              <td className="py-1 pr-2 text-right">
                <MetricCell metric={row.reported} />
              </td>
              <td className="py-1 pr-2 text-right">
                {row.sameBasis ? <MetricCell metric={row.calculated} /> : <span className="text-ink-5">none on this basis</span>}
              </td>
              <td className="py-1 pr-2 text-right font-mono text-ink">{row.sameBasis ? formatVariance(row) : "—"}</td>
              <td className="py-1 text-caption leading-snug">
                {row.comparable ? (
                  <span className="text-ok">● Same basis</span>
                ) : (
                  <span className="text-alert">∅ Not comparable</span>
                )}
                <span className="block text-ink-3">Reported counts: {row.reportedBasis ?? "basis not stated"}.</span>
                {row.reasons.map((reason) => (
                  <span key={reason} className="block text-alert-ink/90">
                    {reason}
                  </span>
                ))}
                {row.ruleFinding ? (
                  <span className="block text-caution-ink/90" data-on-reported-rule>
                    Calculated on the report&apos;s own attribution rule, which is not the reference rule. What the rule changes is the finding above.
                  </span>
                ) : null}
                {row.caveats.map((caveat) => (
                  <span key={caveat} className="block text-ink-5">
                    Note: {caveat}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-micro text-ink-5">
        Source of reported figures: {rows[0].document ?? "not stated"}. A reported figure is compared only with the calculated figure that counts the same things. Reported
        figures are shown as published and never replace calculated ones.
      </p>
    </div>
  );
}

export function LossesPanel({ losses }: { losses: LossesView }) {
  return (
    <Panel title="Energy account and ATC&C" aside={<StatusBadge status={losses.status} />}>
      {losses.scopeNote ? <p className="border-l-2 border-caution-line/60 pl-2 text-xs text-caution-ink/90">{losses.scopeNote}</p> : null}
      <div className="grid gap-2 md:grid-cols-4">
        <MetricTile metric={losses.atcc} sourcing={losses.sourcing} emphasis />
        <MetricTile metric={losses.parts.technical} sourcing={losses.sourcing} />
        <MetricTile metric={losses.parts.commercial} sourcing={losses.sourcing} />
        <MetricTile metric={losses.parts.collection} sourcing={losses.sourcing} />
      </div>
      <DecompositionBar losses={losses} />

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">Accounting chain</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {losses.chain.map((metric) => (
                <tr key={metric.label} className="border-b border-line/60">
                  <td className="py-1 pr-2 text-ink-2">
                    {metric.label}
                    {metric.note ? <span className="block text-micro leading-snug text-ink-5">{metric.note}</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right font-mono tabular-nums text-ink">{formatMetric(metric)}</td>
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
          <h3 className="mb-1 mt-3 flex items-center gap-2 text-caption uppercase tracking-wide text-ink-4">
            Measured cross-checks <StatusBadge status={losses.crossChecks.status} />
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {losses.crossChecks.metrics.map((metric) => (
                <tr key={metric.label} className="border-b border-line/60">
                  <td className="py-1 pr-2 text-ink-2">{metric.label}</td>
                  <td className="py-1 text-right">
                    <MetricCell metric={metric} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {losses.crossChecks.note ? <p className="mt-1 text-caption leading-snug text-ink-4">{losses.crossChecks.note}</p> : null}
          <h3 className="mb-1 mt-3 text-caption uppercase tracking-wide text-ink-4">Recorded consumption, by how it was measured</h3>
          <table className="w-full border-collapse text-xs" data-table="recorded-by-source">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-ink-5">
                <th className="py-1 pr-2 font-normal">Source</th>
                <th className="py-1 pr-2 text-right font-normal">Connections covered</th>
                <th className="py-1 text-right font-normal">Energy recorded</th>
              </tr>
            </thead>
            <tbody>
              {losses.crossChecks.sources.map((source) => (
                <tr key={source.key} className="border-b border-line/60" data-source={source.key}>
                  <td className="py-1 pr-2 text-ink-2">{source.label}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums text-ink">
                    {formatNumber(source.connections)} <span className="text-ink-5">of {formatNumber(losses.crossChecks.coverage.servicePoints)}</span>
                  </td>
                  <td className="py-1 text-right">
                    <MetricCell metric={source.energy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-caption leading-snug text-ink-4">
            Each figure is for the connections its source covers, and neither is the consumption of the whole scope. {losses.crossChecks.registerRule}
          </p>
          {losses.crossChecks.registerExclusions.length > 0 ? (
            <ul className="mt-1 text-caption leading-snug text-caution-ink/90" data-register-exclusions>
              {losses.crossChecks.registerExclusions.map((exclusion) => (
                <li key={exclusion.reason}>
                  <span className="font-mono">{formatNumber(exclusion.connections)}</span> register advance(s) not counted: {exclusion.reason}.
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="mb-1 mt-3 text-caption uppercase tracking-wide text-ink-4">Purchased, not consumed</h3>
          <table className="w-full border-collapse text-xs" data-table="energy-purchased">
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-1 pr-2 text-ink-2">{losses.crossChecks.energyPurchased.label}</td>
                <td className="py-1 text-right">
                  <MetricCell metric={losses.crossChecks.energyPurchased} />
                </td>
              </tr>
            </tbody>
          </table>
          {losses.crossChecks.energyPurchased.note ? (
            <p className="mt-1 text-caption leading-snug text-ink-4">{losses.crossChecks.energyPurchased.note}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricTile metric={losses.billingEfficiency} sourcing={losses.sourcing} />
            <MetricTile metric={losses.collectionEfficiency} sourcing={losses.sourcing}>
              <span className="border border-line-strong px-1.5 py-px text-micro uppercase tracking-wide text-ink-3">Cash basis</span>
            </MetricTile>
            <MetricTile metric={losses.revenueBilled} sourcing={losses.sourcing} />
            <MetricTile metric={losses.revenueCollected} sourcing={losses.sourcing}>
              <span className="border border-line-strong px-1.5 py-px text-micro uppercase tracking-wide text-ink-3">Cash basis</span>
            </MetricTile>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-ink-5">
                <th className="py-1 pr-2 font-normal">How billed</th>
                <th className="py-1 pr-2 text-right font-normal">Charges</th>
                <th className="py-1 pr-2 text-right font-normal">Energy</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {losses.billingByBasis.map((row) => (
                <tr key={row.basis} className="border-b border-line/60">
                  <td className="py-1 pr-2 text-ink-2">
                    {row.label} {row.basis === "estimated" ? <OriginTag origin="estimated" /> : null}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{formatNumber(row.records)}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.energyKwh === null ? "—" : `${formatNumber(row.energyKwh)} kWh`}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatMoney(row.amount, losses.revenueBilled.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-micro text-ink-5">
            {losses.accounts.billed} of {losses.accounts.inScope ?? "an unknown number of"} accounts were charged in the period.
          </p>
          {losses.byCustomerClass.length > 0 ? (
            <table className="w-full border-collapse text-xs" data-table="customer-class">
              <thead>
                <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-ink-5">
                  <th className="py-1 pr-2 font-normal">Customer class</th>
                  <th className="py-1 pr-2 text-right font-normal">Accounts</th>
                  <th className="py-1 pr-2 text-right font-normal">Billed</th>
                  <th className="py-1 pr-2 text-right font-normal">Collected</th>
                  <th className="py-1 text-right font-normal">Collection eff.</th>
                </tr>
              </thead>
              <tbody>
                {losses.byCustomerClass.map((row) => (
                  <tr key={row.category} className="border-b border-line/60">
                    <td className="py-1 pr-2 text-ink-2">{row.label}</td>
                    <td className="py-1 pr-2 text-right font-mono">{formatNumber(row.accounts)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{formatMoney(row.revenueBilled, losses.revenueBilled.currency)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{formatMoney(row.revenueCollected, losses.revenueBilled.currency)}</td>
                    <td className="py-1 text-right">
                      <MetricCell metric={row.collection} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
      <Comparisons rows={losses.reported} />
    </Panel>
  );
}

/* ---------------- Revenue gap ---------------- */

/**
 * The revenue gap of a scope: two separate parts, how the commercial part is valued, and the sections below.
 * Given a valuation listing, the valuation table shows what the listing holds (its sections, then the
 * residuals) and offers the other listing; without one it shows every part.
 */
export function RevenueGapPanel({ gap, below, valuation }: { gap: RevenueGapView; below: { title: string; rows: RevenueGapRow[] } | null; valuation?: ValuationView }) {
  const parts = valuation ? [...valuation.sections, ...valuation.residuals] : gap.parts;
  return (
    <Panel title="Revenue gap" aside={<span>Estimate of revenue not realised · monthly, not annualised</span>}>
      <p className="border-l-2 border-caution-line/60 pl-2 text-xs leading-snug text-caution-ink/90">
        {gap.definition} {gap.periodNote}
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <MetricTile metric={gap.notRealised} sourcing={gap.sourcing} emphasis />
        <MetricTile metric={gap.commercial} sourcing={gap.sourcing} />
        <MetricTile metric={gap.collection} sourcing={gap.sourcing}>
          <span className="border border-line-strong px-1.5 py-px text-micro uppercase tracking-wide text-ink-3">Cash basis</span>
        </MetricTile>
      </div>
      <p className="text-caption leading-snug text-ink-3">
        The commercial gap and the collection gap are shown separately and are never set against each other.
        {gap.negativeNote ? <span className="text-caution-ink"> {gap.negativeNote}</span> : null}
      </p>
      {gap.caveat ? <p className="text-caption leading-snug text-caution-ink/90">† {gap.caveat} The rates below are therefore assumptions too.</p> : null}
      {gap.unknownDemandClassNote ? <p className="text-caption leading-snug text-caution-ink/90">! {gap.unknownDemandClassNote}</p> : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {below && below.rows.length > 0 ? (
          <div>
            <SubHead>{below.title}</SubHead>
            <Table name="gap-below">
              <HeadRow>
                <Th>Section</Th>
                <Th right>Commercial gap</Th>
                <Th right>Collection gap</Th>
                <Th right>Not realised</Th>
              </HeadRow>
              <tbody>
                {below.rows.map((row) => (
                  <Row key={row.id} id={row.id}>
                    <Td>
                      <Link href={levelHref(row.kind, row.id)} className="text-link hover:underline">
                        {row.name}
                      </Link>
                    </Td>
                    <Td right>
                      <MetricCell metric={row.commercial} />
                    </Td>
                    <Td right>
                      <MetricCell metric={row.collection} />
                    </Td>
                    <Td right>
                      <MetricCell metric={row.notRealised} />
                    </Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}
        <div data-valuation={valuation ? (valuation.complete ? "all" : "top") : "every-part"}>
          <SubHead>How the commercial gap is valued</SubHead>
          {valuation && valuation.sectionsTotal > valuation.limit ? (
            <p className="mb-1 text-caption leading-snug text-ink-3">
              {valuation.complete
                ? `All ${valuation.sectionsTotal} sections, largest amount first, then the residuals above them.`
                : `The ${valuation.limit} largest of ${valuation.sectionsTotal} sections by amount, then the residuals above them. The rows shown do not add up to the commercial gap.`}{" "}
              <Link href={valuation.complete ? "?" : "?valuation=all"} className="text-link hover:underline">
                {valuation.complete ? `Show the ${valuation.limit} largest` : `Show all ${valuation.sectionsTotal}`}
              </Link>
            </p>
          ) : null}
          <Table name="gap-valuation">
            <HeadRow>
              <Th>Where the loss occurs</Th>
              <Th right>Unbilled energy</Th>
              <Th right>LV non-MD rate{gap.caveat ? " †" : ""}</Th>
              <Th right>Amount</Th>
            </HeadRow>
            <tbody>
              {parts.map((part) => (
                <Row key={`${part.kind}:${part.scope.id}`} id={`${part.kind}:${part.scope.id}`}>
                  <Td>
                    {part.scope.name}
                    <span className="ml-1.5 text-micro text-ink-5">{part.kind === "residual" ? "residual above the sections below" : part.scope.id}</span>
                  </Td>
                  <Td figure>{part.energyKwh === null ? "—" : `${formatNumber(part.energyKwh)} kWh`}</Td>
                  <Td figure>{part.ratePerKwh === null ? "—" : `${formatRate(part.ratePerKwh, gap.currency)}/kWh`}</Td>
                  <Td figure>{part.amount === null ? "—" : formatMoney(part.amount, gap.currency)}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
          <p className="mt-1 text-micro leading-snug text-ink-5">
            Each loss is valued at the average rate billed to low-voltage, non-maximum-demand customers where it occurs. Customers supplied at 11 kV are in no rate.
          </p>
        </div>
      </div>
    </Panel>
  );
}


/* ---------------- Reliability ---------------- */

export function SupplyStrip({ supply }: { supply: SupplyView }) {
  if (supply.days.length === 0) return null;
  const failing = supply.days.filter((day) => day.compliant === false);
  return (
    <figure className="space-y-1">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-caption text-ink-4">
        <span>Hours of supply per day{supply.minimumHours === null ? "" : `, against the Band ${supply.band} minimum of ${supply.minimumHours} h`}</span>
        <span className="font-mono text-ink-5">0–24 h</span>
      </figcaption>
      <div className="relative h-20 border-b border-line-strong">
        {supply.minimumHours === null ? null : (
          <div
            className="absolute inset-x-0 border-t border-dashed border-ink-3/70"
            style={{ bottom: `${(supply.minimumHours / 24) * 100}%` }}
            title={`Band minimum: ${supply.minimumHours} h`}
          >
            <span className="absolute -top-3.5 right-0 bg-panel px-1 text-micro text-ink-3">min {supply.minimumHours} h</span>
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
      <div className="flex gap-[2px] text-center text-nano leading-none text-ink-3" aria-hidden>
        {supply.days.map((day) => (
          <span key={day.date} className="flex-1">
            {day.compliant === false ? "▼" : ""}
          </span>
        ))}
      </div>
      <div className="flex justify-between font-mono text-micro text-ink-5">
        <span>{supply.days[0].date}</span>
        <span>{supply.days[supply.days.length - 1].date}</span>
      </div>
      {supply.minimumHours === null ? null : (
        <p className="text-caption leading-snug text-ink-3">
          <span className="font-mono text-ink">{supply.daysCompliant}</span> days met the minimum,{" "}
          <span className="font-mono text-ink">{supply.daysNonCompliant}</span> did not (▼)
          {failing.length > 0 ? `: ${failing.map((day) => day.date.slice(5)).join(", ")}` : ""}.{" "}
          {supply.compliantOnAverage ? "The average over the period meets the minimum." : "The average over the period is below the minimum."}
        </p>
      )}
      {supply.note ? <p className="text-micro text-ink-5">{supply.note} The day-by-day test is not a regulatory determination.</p> : null}
    </figure>
  );
}

export function ReliabilityPanel({ reliability, showBand, scopeId }: { reliability: ReliabilityView; showBand: boolean; scopeId?: string }) {
  return (
    <Panel title="Reliability and hours of supply" aside={<span>Customers served: <MetricCell metric={reliability.customersServed} /></span>}>
      {reliability.scopeNote ? <p className="border-l-2 border-caution-line/60 pl-2 text-xs text-caution-ink/90">{reliability.scopeNote}</p> : null}
      <div className="grid gap-2 md:grid-cols-5">
        <MetricTile metric={reliability.saidi} sourcing={reliability.sourcing} emphasis />
        <MetricTile metric={reliability.saifi} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.caidi} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.asai} sourcing={reliability.sourcing} />
        <MetricTile metric={reliability.supply.averageHours} sourcing={reliability.sourcing}>
          {showBand && reliability.supply.band ? (
            <span className="border border-line-strong px-1.5 py-px text-micro uppercase tracking-wide text-ink-3">
              Band {reliability.supply.band} · min {reliability.supply.minimumHours} h
            </span>
          ) : null}
        </MetricTile>
      </div>

      <RuleFindings findings={reliability.ruleFindings} scopeId={scopeId} />

      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">Attribution of interruptions</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-ink-5">
                <th className="py-1 pr-2 font-normal">Attributed to</th>
                <th className="py-1 pr-2 text-right font-normal">SAIDI</th>
                <th className="py-1 pr-2 text-right font-normal">SAIFI</th>
                <th className="w-2/5 py-1 font-normal">Share of customer-hours</th>
              </tr>
            </thead>
            <tbody>
              {reliability.attribution.map((row) => (
                <tr key={row.key} className="border-b border-line/60 align-top">
                  <td className="py-1 pr-2 text-ink-2">
                    {row.label}
                    <span className="block text-micro leading-snug text-ink-5">{row.description}</span>
                  </td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.saidiHours === null ? "—" : `${formatNumber(row.saidiHours, 1)} h`}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{row.saifi === null ? "—" : formatNumber(row.saifi, 2)}</td>
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-line">
                        <div className="h-full rounded-r-[2px]" style={{ width: `${(row.share ?? 0) * 100}%`, background: SERIES.technical }} />
                      </div>
                      <span className="w-12 text-right font-mono tabular-nums text-ink-3">{formatPercent(row.share)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-caption leading-snug text-ink-4">
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
      {loading.caveat ? <p className="border-l-2 border-caution-line/60 pl-2 text-xs text-caution-ink/90">{loading.caveat}</p> : null}
      <div className="grid gap-2 md:grid-cols-3">
        <MetricTile metric={{ ...loading.peak, note: null }} sourcing={loading.sourcing} emphasis>
          {loading.overloaded === null ? null : (
            <span className={`border px-1.5 py-px text-micro uppercase tracking-wide ${loading.overloaded ? "border-alert-line/60 text-alert" : "border-line-strong text-ink-3"}`}>
              {loading.overloaded ? "▲ Over rating" : "Within rating"}
            </span>
          )}
        </MetricTile>
        <div className="border border-line bg-well/40 px-3 py-2">
          <p className="text-caption uppercase tracking-wide text-ink-4">Hours over rating</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-ink">
            {loading.hoursOverRating === null ? "—" : formatNumber(loading.hoursOverRating)}
            <span className="text-xs text-ink-5"> of {loading.hoursObserved ?? "—"} hourly readings</span>
          </p>
          <p className="mt-1 text-caption leading-snug text-ink-4">
            Readings above 100% of rating in the period.
            {loading.peakAt ? ` Peak ${loading.peakKva === null ? "" : `${formatNumber(loading.peakKva, 1)} kVA `}at ${formatTime(loading.peakAt)}.` : ""}
          </p>
        </div>
        <MetricTile metric={{ ...loading.asOf, label: `Loading at ${formatTime(loading.asOfTime)}`, note: null }} sourcing={loading.sourcing} />
      </div>
    </Panel>
  );
}

/** A substation's power transformers: what each carries, and how heavily it was loaded. */
export function PowerTransformersPanel({ transformers }: { transformers: PowerTransformerView[] }) {
  if (transformers.length === 0) return null;
  return (
    <Panel title={`Power transformers (${transformers.length})`} aside="Loading from the substation's telemetry, against rating">
      <table className="w-full border-collapse text-xs" data-table="power-transformers">
        <thead>
          <tr className="border-b border-line-strong text-left text-micro uppercase tracking-wide text-ink-5">
            <th className="py-1 pr-2 font-normal">Transformer</th>
            <th className="py-1 pr-2 text-right font-normal">Rating</th>
            <th className="py-1 pr-2 font-normal">Carries</th>
            <th className="py-1 pr-2 text-right font-normal">Peak loading</th>
            <th className="py-1 pr-2 text-right font-normal">Hours over rating</th>
            <th className="py-1 text-right font-normal">Loading at the as-of time</th>
          </tr>
        </thead>
        <tbody>
          {transformers.map((pt) => (
            <tr key={pt.id} className="border-b border-line/60 align-top" data-power-transformer={pt.id}>
              <td className="py-1 pr-2 text-ink-2">
                {pt.name}
                <span className="ml-1.5 text-micro text-ink-5">
                  {pt.id}
                  {pt.busSection ? ` · bus section ${pt.busSection}` : ""}
                </span>
              </td>
              <td className="whitespace-nowrap py-1 pr-2 text-right font-mono tabular-nums text-ink-2">{formatNumber(pt.ratedKva / 1000, 1)} MVA</td>
              <td className="py-1 pr-2">
                {pt.feeders.length === 0 ? (
                  <span className="text-ink-5">no feeder recorded</span>
                ) : (
                  pt.feeders.map((feeder, i) => (
                    <span key={feeder.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={levelHref("feeder", feeder.id)} className="text-link hover:underline">
                        {feeder.name}
                      </Link>
                    </span>
                  ))
                )}
              </td>
              <td className="py-1 pr-2 text-right">{pt.loading ? <MetricCell metric={pt.loading.peak} /> : <span className="text-ink-5">no telemetry</span>}</td>
              <td className="whitespace-nowrap py-1 pr-2 text-right font-mono tabular-nums text-ink">
                {pt.loading === null || pt.loading.hoursOverRating === null ? "—" : `${pt.loading.hoursOverRating} of ${pt.loading.hoursObserved ?? "—"}`}
              </td>
              <td className="py-1 text-right">{pt.loading ? <MetricCell metric={pt.loading.asOf} /> : <span className="text-ink-5">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-micro leading-snug text-ink-5">
        Peak is the highest of the hourly readings in the period; a higher loading between readings would not be seen. A transformer is loaded by the feeders on its own bus
        section only.
      </p>
    </Panel>
  );
}

/* ---------------- Children and not-available ---------------- */

const FOOTNOTE_MARKS = ["†", "‡", "§", "¶", "‖", "#"];

/** Long lists show this many rows until the reader asks for all of them. */
export const ROW_LIMIT = 40;

export function ChildrenTable({ table, showAll = true, allHref }: { table: ChildTable; showAll?: boolean; allHref?: string }) {
  const rows = showAll ? table.rows : table.rows.slice(0, ROW_LIMIT);
  // Every caveat on a figure in the table is printed under it, with a marker on the figure,
  // so that no caveat depends on hovering.
  const notes: string[] = [];
  for (const row of rows) {
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
      aside={table.coverage === "complete" ? "Registry: complete list" : <span className="text-caution">Registry: {table.coverage.replace("_", " ")} — this is not the full list</span>}
    >
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr className="border-b border-line-strong text-left text-micro uppercase tracking-wide text-ink-5">
              <th className="py-1 pr-3 font-normal">Name</th>
              {table.columns.map((column) => (
                <th key={column.key} className="py-1 pl-3 text-right font-normal">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/60 hover:bg-line/30">
                <td className="py-1 pr-3">
                  <Link href={levelHref(row.kind, row.id)} className="text-link hover:text-link-hover hover:underline">
                    {row.name}
                  </Link>
                  <span className="ml-2 text-micro text-ink-5">{[row.name === row.id ? "" : row.id, ...row.facts].filter(Boolean).join(" · ")}</span>
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
      {rows.length < table.rows.length ? (
        <p className="text-xs text-ink-3">
          Showing the first {rows.length} of {table.rows.length}.{" "}
          {allHref ? (
            <Link href={allHref} className="text-link hover:underline">
              Show all {table.rows.length}
            </Link>
          ) : null}
        </p>
      ) : null}
      {notes.length > 0 ? (
        <ul className="space-y-0.5 text-caption leading-snug text-caution-ink/90">
          {notes.map((note) => (
            <li key={note}>
              <span className="font-mono">{markFor(note)}</span> {note}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-micro text-ink-5">
        ● measured or fully calculated · ≈ estimated inputs · ! insufficient data · – not available. The tag after each figure is its origin (MEAS, REPO, CALC, ESTI, DERI). Open a row for
        source and method.
      </p>
    </Panel>
  );
}

/* ---------------- Alarms and derived conditions ---------------- */

const SEVERITY_STYLE: Record<AlarmRowView["severity"], string> = {
  critical: "border-alert-line/70 text-alert",
  high: "border-alert-line/40 text-alert",
  medium: "border-caution-line/50 text-caution",
  low: "border-line-bold text-ink-3",
  info: "border-line-strong text-ink-4",
};

function SubjectLink({ subject }: { subject: AlarmSubjectView }) {
  return (
    <>
      {subject.link ? (
        <Link href={levelHref(subject.link.kind, subject.link.id)} className="text-link hover:underline">
          {subject.label}
        </Link>
      ) : (
        <span className="text-ink-2">{subject.label}</span>
      )}
      <span className="ml-1.5 text-micro text-ink-5">
        {subject.kindLabel} {subject.id === subject.label ? "" : subject.id}
      </span>
    </>
  );
}

function AlarmRow({ alarm }: { alarm: AlarmRowView }) {
  return (
    <li className="py-1.5 text-xs" data-alarm={alarm.id} data-alarm-state={alarm.state}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`border px-1.5 py-px text-micro font-medium uppercase tracking-wide ${SEVERITY_STYLE[alarm.severity]}`}>{alarm.severity}</span>
        <SubjectLink subject={alarm.subject} />
      </p>
      <p className="mt-0.5 text-ink-2">
        {alarm.message} <span className="font-mono text-micro text-ink-5">{alarm.code}</span>
        <span className="ml-1.5 text-micro text-ink-5">{alarm.kindName ? `Kind: ${alarm.kindName}` : "Kind not mapped from the source's code"}</span>
      </p>
      <p className="mt-0.5 text-caption text-ink-4">
        {alarm.raisedAt ? `Raised ${formatTime(alarm.raisedAt)}` : "Raise time not recorded by the source; whether it is active cannot be told"}
        {alarm.clearedAt ? ` · cleared ${formatTime(alarm.clearedAt)}` : alarm.state === "active" ? " · not cleared" : ""}
        {alarm.state === "time_not_recorded" ? "" : alarm.acknowledgedAt ? ` · acknowledged ${formatTime(alarm.acknowledgedAt)}` : " · not acknowledged"}
      </p>
      {alarm.agreedBy.map((condition) => (
        <p key={condition.key} className="mt-0.5 border-l-2 border-ok-line/60 pl-2 text-caption text-ink-3" data-agrees-with={condition.key}>
          A GridIntel derived condition agrees: <span className="text-ink-2">{condition.ruleName}</span>, in the other list.
        </p>
      ))}
    </li>
  );
}

/** Whether a source system raised the matching kind of alarm for a condition. The alarm itself stays in the other list. */
function SourceAlarmLine({ relation }: { relation: ConditionRowView["sourceAlarm"] }) {
  const tone = relation.status === "agrees" ? "border-ok-line/60" : relation.status === "none_raised" ? "border-line-bold" : "border-caution-line/60";
  return (
    <p className={`mt-0.5 border-l-2 pl-2 text-caption text-ink-3 ${tone}`} data-source-alarm={relation.status}>
      {relation.status === "agrees" ? (
        <>
          A source alarm agrees ({relation.kindName}):{" "}
          {relation.alarms.map((alarm, i) => (
            <span key={alarm.id}>
              {i > 0 ? "; " : ""}
              <span className="font-mono text-micro text-ink-2">{alarm.code}</span>
              {alarm.raisedAt ? `, raised ${formatTime(alarm.raisedAt)}` : ""}
            </span>
          ))}
          , in the other list.
        </>
      ) : relation.status === "none_raised" ? (
        <>
          No source alarm: none of the kind &ldquo;{relation.kindName}&rdquo; stood on this subject while the condition held, and the source&apos;s alarm record is complete.
        </>
      ) : (
        <>
          Whether a source alarm of the kind &ldquo;{relation.kindName}&rdquo; was raised cannot be told: {relation.reason}
          {relation.alarms.length > 0 ? ` (${relation.alarms.map((alarm) => alarm.code).join(", ")})` : ""}.
        </>
      )}
    </p>
  );
}

function ConditionRow({ condition }: { condition: ConditionRowView }) {
  const loading = condition.rule === "loading_above_rating";
  return (
    <li className="py-1.5 text-xs" data-condition={condition.key} data-condition-active={String(condition.activeNow)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="border border-line-bold px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-2">Rule: {condition.ruleName}</span>
        <SubjectLink subject={condition.subject} />
      </p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-ink-2">
        {loading ? "Peak" : "Last check-in"}
        {condition.figure.value === null ? <span className="text-ink-4">none held</span> : <MetricCell metric={condition.figure} />}
        {loading ? null : <span className="text-ink-4">ago</span>}
        {condition.occurrences === null ? null : (
          <span className="text-ink-4">
            · above rating at <span className="font-mono text-ink">{formatNumber(condition.occurrences)}</span> hourly reading(s)
          </span>
        )}
      </p>
      <p className="mt-0.5 text-caption text-ink-4">
        {loading
          ? `First ${condition.firstAt ? formatTime(condition.firstAt) : "—"} · last ${condition.lastAt ? formatTime(condition.lastAt) : "—"}`
          : condition.lastAt
            ? `Last heard from ${formatTime(condition.lastAt)}`
            : "No check-in from this device is held"}
        {" · "}
        {condition.activeNow === null ? "state at the as-of time not known" : condition.activeNow ? "holds at the as-of time" : "does not hold at the as-of time"}
      </p>
      <SourceAlarmLine relation={condition.sourceAlarm} />
    </li>
  );
}

/**
 * Alarms recorded by source systems beside conditions derived by GridIntel. Two lists with two
 * headings and two origins; nothing is merged, and a derived condition is never called an alarm.
 * Where a source alarm and a condition agree, each row says so and stays in its own list.
 */
export function AlarmsPanel({ alarms }: { alarms: AlarmsView }) {
  const { recorded, derived } = alarms;
  const none = recorded.active.length + recorded.undated.length + recorded.clearedTotal === 0;
  return (
    <Panel title="Alarms and derived conditions" aside={`As of ${formatTime(alarms.asOf)} · two separate lists, never merged`}>
      <div className="grid gap-3 xl:grid-cols-2">
        <div data-alarms="recorded">
          <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
            Alarms recorded by source systems <OriginTag origin="measured" />
            {recorded.completeness === "not_available" ? <StatusBadge status="not_available" /> : null}
          </h3>
          <p className="mt-0.5 text-caption leading-snug text-ink-4">As the utility&apos;s own systems raised them. GridIntel reports them; it does not decide whether they are true.</p>
          {recorded.note ? <p className="mt-1 border-l-2 border-caution-line/60 pl-2 text-xs text-caution-ink/90">{recorded.note}</p> : null}
          {recorded.completeness === "not_available" ? null : (
            <>
              <h4 className="mt-2 text-micro uppercase tracking-wide text-ink-5">Active ({recorded.active.length})</h4>
              {recorded.active.length === 0 ? (
                <p className="py-1 text-xs text-ink-4">
                  {none && recorded.completeness === "complete" ? "No alarm was recorded for this scope in the period." : "No alarm is active at the as-of time."}
                </p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {recorded.active.map((alarm) => (
                    <AlarmRow key={alarm.id} alarm={alarm} />
                  ))}
                </ul>
              )}
              {recorded.undated.length > 0 ? (
                <>
                  <h4 className="mt-2 text-micro uppercase tracking-wide text-ink-5">Time not recorded ({recorded.undated.length})</h4>
                  <ul className="divide-y divide-line/70">
                    {recorded.undated.map((alarm) => (
                      <AlarmRow key={alarm.id} alarm={alarm} />
                    ))}
                  </ul>
                </>
              ) : null}
              {recorded.clearedTotal > 0 ? (
                <>
                  <h4 className="mt-2 text-micro uppercase tracking-wide text-ink-5">
                    Raised in the period and cleared ({recorded.clearedTotal})
                    {recorded.cleared.length < recorded.clearedTotal ? `, the ${recorded.cleared.length} most recent` : ""}
                  </h4>
                  <ul className="divide-y divide-line/70">
                    {recorded.cleared.map((alarm) => (
                      <AlarmRow key={alarm.id} alarm={alarm} />
                    ))}
                  </ul>
                </>
              ) : null}
              {recorded.unplaced > 0 ? (
                <p className="mt-1 text-caption text-caution-ink/90">
                  {recorded.unplaced} alarm(s) name something not matched to the registry. They belong to no section and are listed at organization level only.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div data-alarms="derived">
          <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
            Conditions derived by GridIntel <OriginTag origin="calculated" />
          </h3>
          <p className="mt-0.5 text-caption leading-snug text-ink-4">
            Worked out from telemetry under the rules below. They are not alarms. Each says whether a source system raised an alarm of the matching kind.
          </p>
          {derived.note ? <p className="mt-1 border-l-2 border-caution-line/60 pl-2 text-xs text-caution-ink/90">{derived.note}</p> : null}
          <h4 className="mt-2 text-micro uppercase tracking-wide text-ink-5">
            Found ({derived.conditions.length})
            {derived.conditions.length === 0
              ? ""
              : `: a source alarm agrees with ${derived.agreement.agrees}, none was raised for ${derived.agreement.noneRaised}${derived.agreement.cannotTell > 0 ? `, cannot be told for ${derived.agreement.cannotTell}` : ""}`}
          </h4>
          {derived.conditions.length === 0 ? (
            <p className="py-1 text-xs text-ink-4">
              No rule was met: {formatNumber(derived.assetsChecked)} asset(s) checked for loading and {formatNumber(derived.devicesChecked)} monitoring device(s) for check-ins.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {derived.conditions.map((condition) => (
                <ConditionRow key={condition.key} condition={condition} />
              ))}
            </ul>
          )}
          <dl className="mt-2 space-y-0.5 text-micro leading-snug text-ink-5">
            {derived.rules.map((rule) => (
              <div key={rule.id}>
                <dt className="inline font-semibold text-ink-4">Rule: {rule.name}. </dt>
                <dd className="inline">
                  {rule.statement} Matching kind of source alarm: {rule.alarmKindName}.
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-micro text-ink-5">
            {derived.method.name} <span className="font-mono">({derived.method.id} v{derived.method.version})</span>. {derived.method.disclaimer}
          </p>
        </div>
      </div>
      <p className="text-micro text-ink-5">Data sources: {alarms.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </Panel>
  );
}
