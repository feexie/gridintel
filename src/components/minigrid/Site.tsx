import Link from "next/link";
import type { ReactNode } from "react";
import type { MetricView, SourcingView } from "@/services/operations/views";
import type { MinigridSiteView, SocDayView } from "@/services/minigrid/views";
import { Legend, MetricCell, MetricTile, Panel } from "@/components/system/Metric";
import { Comparisons } from "@/components/system/Panels";
import { HeadRow, Note, PageHead, Row, SubHead, Table, Td, Th } from "@/components/system/Table";
import { formatDay, formatMoney, formatNumber, formatPercent, formatTime } from "@/components/system/format";
import { MINIGRID_HOME } from "@/components/system/map/links";
import { CLASS_NOTE, ClassTable, ReportStanding } from "./shared";

/* One mini-grid site in full. Each panel is one question about the site; every figure is the
   read model's, with its status, origin, and source and method. Nothing is calculated here. */

const SERIES = { renewable: "var(--color-series-collection)", generator: "var(--color-series-commercial)" };

function Tiles({ metrics, sourcing, emphasise }: { metrics: MetricView[]; sourcing: SourcingView; emphasise?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricTile key={metric.label} metric={metric} sourcing={sourcing} emphasis={metric.label === emphasise} />
      ))}
    </div>
  );
}

/** The two sources of the site's energy as one bar. Each part is as wide as its share; a share that is not known draws nothing. */
function MixBar({ mix }: { mix: MinigridSiteView["energy"]["mix"] }) {
  if (mix.some((part) => part.share.value === null)) {
    return <p className="border border-dashed border-line-strong px-3 py-2 text-xs text-ink-4">The generation mix cannot be drawn: {mix.flatMap((part) => part.share.missingInputs).join("; ") || "a share is not available"}.</p>;
  }
  return (
    <figure className="space-y-2" data-mix>
      <div className="flex h-4 w-full gap-[2px]" role="img" aria-label={mix.map((part) => `${part.label} ${formatPercent(part.share.value)}`).join(", ")}>
        {mix.map((part) => (
          <div key={part.label} title={`${part.label}: ${formatPercent(part.share.value)} of energy generated`} style={{ width: `${(part.share.value as number) * 100}%`, background: SERIES[part.series] }} className="h-full" />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-3">
        {mix.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SERIES[part.series] }} />
            {part.label} <span className="font-mono tabular-nums text-ink">{formatPercent(part.share.value)}</span>
            <MetricCell metric={part.energy} />
          </li>
        ))}
      </ul>
    </figure>
  );
}

const ROLE_MARK = { source: "+", less: "−", equals: "=" };

/** State of charge day by day: a bar from each day's lowest reading to its highest, with a tick at its mean. */
function SocChart({ days }: { days: SocDayView[] }) {
  if (days.length === 0) return null;
  return (
    <figure data-soc-chart>
      <figcaption className="mb-1 text-caption text-ink-4">State of charge by day: each bar runs from the day&apos;s lowest reading to its highest; the tick is its mean. Scale 0 to 100%.</figcaption>
      <div className="flex h-24 items-stretch gap-[2px] border-b border-l border-line-strong" role="img" aria-label="State of charge by day, lowest to highest">
        {days.map((day) => (
          <div key={day.day} className="relative flex-1 bg-line/30" title={day.lowest === null || day.highest === null || day.mean === null ? `${formatDay(day.day)}: no reading` : `${formatDay(day.day)}: ${formatNumber(day.lowest)}% to ${formatNumber(day.highest)}%, mean ${formatNumber(day.mean)}%`}>
            {day.lowest === null || day.highest === null || day.mean === null ? null : (
              <>
                <div className="absolute inset-x-0 rounded-[1px]" style={{ bottom: `${day.lowest}%`, height: `${day.highest - day.lowest}%`, background: "var(--color-series-technical)" }} />
                <div className="absolute inset-x-0 h-px bg-ink" style={{ bottom: `${day.mean}%` }} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-micro text-ink-5">
        <span>{formatDay(days[0].day)}</span>
        <span>{formatDay(days[days.length - 1].day)}</span>
      </div>
    </figure>
  );
}

export function MinigridSite({ view, map }: { view: MinigridSiteView; map?: ReactNode }) {
  const { energy, pv, storage, generator, availability, commercial, sourcing } = view;
  const notRecorded = energy.deliveredCoverage.connections - energy.deliveredCoverage.recorded;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-caption">
          <Link href={MINIGRID_HOME} className="text-link hover:text-link-hover hover:underline">
            ◂ Sites
          </Link>
        </p>
        <PageHead eyebrow="Mini-grid Intelligence · site" title={view.name}>
          <span className="font-mono">{view.id}</span> · {view.operator ?? "Operator not recorded"}
          {view.commissioned ? ` · commissioned ${formatDay(`${view.commissioned}T12:00:00Z`)}` : ""} · supplied by no substation: it generates its own energy.
        </PageHead>
        <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-caption text-ink-3" data-assets>
          {view.assets.map((asset) => (
            <li key={asset.id}>
              {asset.label}: <span className="font-mono text-ink-2">{asset.nameplate}</span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-4">
          Its report against the records: <ReportStanding report={view.report} />.{" "}
          <a href="#report" className="text-link hover:text-link-hover hover:underline">
            See the comparison ▾
          </a>
        </p>
        <Legend />
      </div>

      <Panel title="Generation mix and energy flow" aside="From the site's own generation to its customers' meters">
        <MixBar mix={energy.mix} />
        <Tiles metrics={[energy.renewableFraction, energy.siteLoss, energy.distributionLoss]} sourcing={sourcing} emphasise="Renewable fraction" />
        <SubHead>Energy flow for the month</SubHead>
        <div className="overflow-x-auto">
          <Table name="energy-flow">
            <tbody>
              {energy.flow.map((row) => (
                <Row key={row.metric.label} id={row.metric.label}>
                  <Td className={`w-6 font-mono ${row.role === "equals" ? "text-ink" : "text-ink-4"}`}>{ROLE_MARK[row.role]}</Td>
                  <Td className={row.role === "equals" ? "font-semibold text-ink" : ""}>
                    {row.metric.label}
                    {row.metric.note ? <span className="block text-micro font-normal leading-snug text-ink-5">{row.metric.note}</span> : null}
                  </Td>
                  <Td right>
                    <MetricCell metric={row.metric} />
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>
        {notRecorded > 0 ? (
          <Note tone="caution">
            {energy.deliveredCoverage.recorded} of {energy.deliveredCoverage.connections} connections have a meter that recorded the whole month. The other {notRecorded} are not known and are not
            taken as zero, so energy delivered and the losses that rest on it are not available.
          </Note>
        ) : null}
        <Note>Curtailed energy is not in this chain: metered generation is already net of it. It is shown under PV performance, as an estimate.</Note>
      </Panel>

      {pv === null ? null : (
        <Panel title="PV performance and curtailment" aside="Irradiance measured on site is the input">
          <Tiles metrics={[pv.performanceRatio, pv.performanceRatioBeforeCurtailment, pv.curtailedShare, ...pv.figures]} sourcing={sourcing} emphasise="Performance ratio" />
          <Note>A low performance ratio with a normal one before curtailment is an array held back by low demand, not an array at fault.</Note>
        </Panel>
      )}

      {storage === null ? null : (
        <Panel title="Battery: state of charge and cycles" aside={storage.nameplate}>
          <SocChart days={storage.byDay} />
          <Tiles metrics={storage.figures} sourcing={sourcing} />
          <Note>State of charge is as the battery&apos;s management system reports it. Only nameplate capacity is known, so the change in stored energy, and with it the storage loss, is an estimate.</Note>
        </Panel>
      )}

      <Panel title="Generator: hours and fuel" aside={generator?.nameplate ?? "No generator"}>
        {generator === null ? (
          <p className="text-xs text-ink-3" data-no-generator>
            This site has no generator. Everything it generated was solar.
          </p>
        ) : (
          <Tiles metrics={generator.figures} sourcing={sourcing} emphasise="Fuel per kWh" />
        )}
      </Panel>

      <Panel title="Availability and interruptions" aside="Customer-weighted, from the site's interruption log">
        <Tiles metrics={[...availability.figures, availability.withoutPlanned]} sourcing={sourcing} emphasise="Availability" />
        {availability.provisional ? <Note tone="caution">Provisional: an interruption still open at the end of the month is counted to the month&apos;s end.</Note> : null}
        {availability.excludedExposures > 0 ? <Note tone="caution">{availability.excludedExposures} interruption record(s) were left out for want of a time or a customer count.</Note> : null}
        {availability.hoursLostByCause === null ? null : (
          <p className="text-caption text-ink-3" data-hours-lost>
            Hours without supply for the average connection, by cause:{" "}
            {availability.hoursLostByCause.length === 0 ? "none" : availability.hoursLostByCause.map((row) => `${row.cause} ${formatNumber(row.hours, 1)} h`).join(" · ")}
          </p>
        )}
        <SubHead>Interruptions in the month</SubHead>
        {availability.interruptions.length === 0 ? (
          <p className="text-xs text-ink-4">None recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table name="interruptions">
              <HeadRow>
                <Th>From</Th>
                <Th right>Hours</Th>
                <Th>Cause</Th>
                <Th right>Connections</Th>
                <Th>As the source notes it</Th>
              </HeadRow>
              <tbody>
                {availability.interruptions.map((row) => (
                  <Row key={row.id} id={row.id}>
                    <Td className="whitespace-nowrap">{row.from === null ? "not recorded" : formatTime(row.from)}</Td>
                    <Td figure>{row.hours === null ? "—" : formatNumber(row.hours, 1)}</Td>
                    <Td>
                      {row.cause}
                      {row.planned ? <span className="ml-1 text-micro text-ink-5">planned</span> : null}
                    </Td>
                    <Td figure>{row.customersAffected === null ? "—" : formatNumber(row.customersAffected)}</Td>
                    <Td className="text-caption">{row.note ?? ""}</Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel title="Revenue and collection" aside="Cash basis: received in the month against billed in the month">
        <Tiles metrics={[commercial.collectionEfficiency, ...commercial.figures]} sourcing={sourcing} emphasise="Collection efficiency" />
        <SubHead>Collection by customer class</SubHead>
        <ClassTable rows={commercial.byClass} currency={commercial.currency} name="class-site" />
        <Note>{CLASS_NOTE}</Note>
        <SubHead>By tariff tier, as the operator names its tiers</SubHead>
        <div className="overflow-x-auto">
          <Table name="tiers">
            <HeadRow>
              <Th>Tier</Th>
              <Th right>Active / all accounts</Th>
              <Th right>Energy sold</Th>
              <Th right>Billed</Th>
              <Th right>Collected</Th>
            </HeadRow>
            <tbody>
              {commercial.byTier.map((tier) => (
                <Row key={tier.tier} id={tier.tier}>
                  <Td>{tier.tier === "not_recorded" ? "Tier not recorded" : tier.tier}</Td>
                  <Td figure>
                    {formatNumber(tier.activeAccounts)} / {formatNumber(tier.accounts)}
                  </Td>
                  <Td figure>{tier.energySoldKwh === null ? "not stated" : `${formatNumber(tier.energySoldKwh)} kWh`}</Td>
                  <Td figure>{formatMoney(tier.revenueBilled, commercial.currency)}</Td>
                  <Td figure>{formatMoney(tier.revenueCollected, commercial.currency)}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>
        {commercial.tariffCaveat ? <Note tone="caution">{commercial.tariffCaveat}</Note> : null}
      </Panel>

      <div id="report" className="scroll-mt-4">
        <Panel title="The site report against the calculation" aside={view.report.document ?? "No report held"}>
          <p className="text-caption text-ink-3">
            Of the {view.report.claims} figures the report states: <ReportStanding report={view.report} />.
          </p>
          {view.comparisons.length === 0 ? <p className="text-xs text-ink-4">No reported figure is held for this site and month.</p> : (
            <div className="overflow-x-auto">
              <Comparisons rows={view.comparisons} note={view.comparisonNote} />
            </div>
          )}
        </Panel>
      </div>

      {map}

      <p className="text-micro text-ink-5">Data sources: {sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}
