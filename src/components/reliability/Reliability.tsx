import Link from "next/link";
import type { BarView } from "@/services/overview/bars";
import type { BreakdownRowView, FeederReliabilityRow, ReliabilityWorkspaceView } from "@/services/reliability/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, SectionNav, Sources, WideOpen } from "@/components/system/Fold";
import { MetricCell, Panel } from "@/components/system/Metric";
import { Comparisons, ReliabilityPanel, RuleFindings, SupplyStrip } from "@/components/system/Panels";
import { HeadRow, Row, ShareBar, SubHead, Table, Td, Th } from "@/components/system/Table";
import { formatNumber, levelHref } from "@/components/system/format";

/* Reliability: which feeders fail their customers, why, and whether it is ours to fix. The ranking
   first, as bars of what sets it; then what the reports' rules change and the reported figures
   beside the calculation; the portfolio; why and where; and the days below each band. Everything is
   laid out from the read model; nothing is ranked or calculated here. */

const SECTIONS = [
  { id: "ranking", label: "Ranking" },
  { id: "ours", label: "Ours to fix?" },
  { id: "portfolio", label: "Portfolio" },
  { id: "why", label: "Why" },
  { id: "where-begins", label: "Where it begins" },
  { id: "band", label: "Service band" },
];

const hoursText = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 1)} h`);

/** Each feeder's network-attributable SAIDI as a bar, in rank order, with the figures beside it. */
function RankingBars({ feeders, bars }: { feeders: FeederReliabilityRow[]; bars: BarView[] }) {
  const barOf = new Map(bars.map((bar) => [bar.id, bar]));
  return (
    <figure className="space-y-1" data-ranking-bars>
      <figcaption className="text-caption text-ink-4">Network-attributable SAIDI, highest first: what the distribution network itself did</figcaption>
      <ol className="divide-y divide-line/60">
        {feeders.map((feeder) => {
          const bar = barOf.get(feeder.id);
          const length = bar?.parts?.[0]?.fraction ?? null;
          return (
            <li key={feeder.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2" data-ranked={feeder.id}>
              <span className="font-mono text-caption text-ink-5">{feeder.rank}.</span>
              <Link href={levelHref("feeder", feeder.id)} className="min-w-0 text-xs font-medium text-link hover:text-link-hover hover:underline">
                {feeder.name}
              </Link>
              <span className="text-xs">
                <MetricCell metric={feeder.networkSaidi} />
              </span>
              <span />
              {length === null ? (
                <p className="col-span-2 text-caption text-ink-4">Not drawn: {bar?.reason ?? "no bar is given for this feeder"}.</p>
              ) : (
                <div className="col-span-2 h-3 rounded-[3px] bg-line/50" role="img" aria-label={`${feeder.name}: network SAIDI ${hoursText(feeder.networkSaidi.value)}`}>
                  <div className="h-full rounded-[3px]" style={{ width: `${length * 100}%`, background: "var(--color-series-technical)" }} />
                </div>
              )}
              <span />
              <p className="col-span-2 flex flex-wrap gap-x-3 text-caption text-ink-4">
                <span>Upstream {hoursText(feeder.upstreamSaidiHours)}</span>
                <span>Load shedding {hoursText(feeder.loadSheddingSaidiHours)}</span>
                <span>
                  Total <MetricCell metric={feeder.totalSaidi} />
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function Breakdown({ title, rows, name }: { title: string; rows: BreakdownRowView[]; name: string }) {
  return (
    <div className="min-w-0">
      <SubHead>{title}</SubHead>
      <Table name={name}>
        <HeadRow>
          <Th>{title.replace("By ", "").replace(/^./, (c) => c.toUpperCase())}</Th>
          <Th right>SAIDI</Th>
          <Th right>SAIFI</Th>
          <Th className="w-2/5 min-w-[7rem]">Share of customer-hours</Th>
        </HeadRow>
        <tbody>
          {rows.map((row) => (
            <Row key={row.key} id={row.key}>
              <Td>
                {row.label}
                {row.note ? <span className="block text-micro leading-snug text-ink-5">{row.note}</span> : null}
              </Td>
              <Td figure>{hoursText(row.saidiHours)}</Td>
              <Td figure>{row.saifi === null ? "—" : formatNumber(row.saifi, 2)}</Td>
              <Td>
                <ShareBar share={row.share} />
              </Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function Reliability({ view }: { view: ReliabilityWorkspaceView }) {
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Reliability">
        {view.organization ?? "Organization not recorded"} · which feeders fail their customers, why, and whether it is ours to fix.
      </SectorBand>
      <SectionNav sections={SECTIONS} />
      <KeyFold />

      <Panel id="ranking" title="Feeders, ranked by network-attributable SAIDI" aside="Load shedding and upstream supply do not set the rank">
        <RankingBars feeders={view.feeders} bars={view.rankingBars} />
        <WideOpen label="Show the ranking table" name="feeder-ranking">
          <Table name="feeder-ranking" wide>
            <HeadRow>
              <Th>Feeder</Th>
              <Th right>Customers</Th>
              <Th right>Network SAIDI</Th>
              <Th right>Network SAIFI</Th>
              <Th right>Upstream SAIDI</Th>
              <Th right>Load shedding SAIDI</Th>
              <Th right>Total SAIDI</Th>
              <Th right>Supply h/day</Th>
              <Th>Service band</Th>
            </HeadRow>
            <tbody>
              {view.feeders.map((feeder) => (
                <Row key={feeder.id} id={feeder.id}>
                  <Td>
                    <span className="mr-1 font-mono text-ink-5">{feeder.rank}.</span>
                    <Link href={levelHref("feeder", feeder.id)} className="text-link hover:text-link-hover hover:underline">
                      {feeder.name}
                    </Link>
                    <span className="block text-micro text-ink-5">{feeder.substationName}</span>
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.customers} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.networkSaidi} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.networkSaifi} />
                  </Td>
                  <Td figure>{hoursText(feeder.upstreamSaidiHours)}</Td>
                  <Td figure>{hoursText(feeder.loadSheddingSaidiHours)}</Td>
                  <Td right>
                    <MetricCell metric={feeder.totalSaidi} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.supply.averageHours} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {feeder.supply.band === null
                      ? "not recorded"
                      : `Band ${feeder.supply.band} · min ${feeder.supply.minimumHours} h · ${feeder.supply.daysNonCompliant ?? "—"} of ${feeder.supply.days.length} days below`}
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </WideOpen>
        <Fold label="How the ranking is made" name="ranking-notes">
          <p>The rank is what the distribution network itself did. Load shedding and upstream supply are beside it and do not set the rank.</p>
          <p>The classes add up to the total for each feeder. Each name opens the feeder in the Operations drill-down, where source and method are shown for every figure.</p>
        </Fold>
      </Panel>

      <Panel id="ours" title="Is it ours to fix? Reported against calculated" aside="Each reported figure beside the calculation that counts the same things">
        <RuleFindings findings={view.ruleFindings} />
        <Comparisons rows={view.comparisons} note={view.comparisonNote} />
      </Panel>

      <ReliabilityPanel id="portfolio" reliability={view.portfolio} showBand={false} />

      <Panel id="why" title="Why supply was interrupted" aside="The portfolio's interruptions, by what the outage log records">
        <WideOpen label="Show by cause and by where it began" name="breakdowns">
          <div className="grid gap-3 xl:grid-cols-2">
            <Breakdown title="By cause" rows={view.byCause} name="by-cause" />
            <Breakdown title="By where it began" rows={view.byOriginPoint} name="by-origin-point" />
          </div>
        </WideOpen>
        <Fold label="How the breakdowns add up" name="breakdown-notes">
          <p>
            Each breakdown adds up to the portfolio&apos;s SAIDI and SAIFI. Where an interruption began is recorded as a fact; which side of the boundary that is on follows from the
            GridIntel reference methodology ({view.method.id} v{view.method.version}), under which only the grid and the transmission station are upstream.
          </p>
        </Fold>
      </Panel>

      <Panel id="where-begins" title="Where interruptions most often begin" aside="Load shedding left out">
        <WideOpen name="origins">
          <Table name="origins" wide>
            <HeadRow>
              <Th>Began at</Th>
              <Th>Part of the system</Th>
              <Th>Attributed to</Th>
              <Th right>Interruptions</Th>
              <Th right>SAIDI added</Th>
            </HeadRow>
            <tbody>
              {view.origins.map((origin) => (
                <Row key={`${origin.subject.id}:${origin.attribution}`} id={origin.subject.id}>
                  <Td>
                    {origin.subject.link ? (
                      <Link href={levelHref(origin.subject.link.kind, origin.subject.link.id)} className="text-link hover:text-link-hover hover:underline">
                        {origin.subject.label}
                      </Link>
                    ) : (
                      origin.subject.label
                    )}
                    <span className="block text-micro text-ink-5">{origin.subject.kindLabel}</span>
                  </Td>
                  <Td>{origin.originPoint}</Td>
                  <Td>{origin.attributionLabel}</Td>
                  <Td figure>{formatNumber(origin.interruptions)}</Td>
                  <Td figure>{hoursText(origin.saidiHours)}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </WideOpen>
        <Fold label="What is listed" name="origins-notes">
          <p>{view.originsNote}</p>
        </Fold>
      </Panel>

      <Panel id="band" title="Service-band compliance, day by day" aside="Hours of supply per day against each feeder's NERC band minimum">
        <div className="grid gap-4 xl:grid-cols-2">
          {view.feeders.map((feeder) => (
            <div key={feeder.id} className="min-w-0" data-band-feeder={feeder.id}>
              <SubHead>
                <Link href={levelHref("feeder", feeder.id)} className="normal-case tracking-normal text-link hover:text-link-hover hover:underline">
                  {feeder.name}
                </Link>
              </SubHead>
              <SupplyStrip supply={feeder.supply} />
            </div>
          ))}
        </div>
        <Fold label="How the days are counted" name="band-notes">
          <p>Every interruption counts toward hours of supply, whatever its cause. A feeder can meet its minimum on average and still fail on individual days.</p>
        </Fold>
      </Panel>

      <Sources sourcing={view.sourcing} />
    </div>
  );
}
