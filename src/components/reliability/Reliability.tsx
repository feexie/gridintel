import Link from "next/link";
import type { BreakdownRowView, ReliabilityWorkspaceView } from "@/services/reliability/views";
import { Legend, MetricCell, Panel } from "@/components/system/Metric";
import { Comparisons, ReliabilityPanel, RuleFindings, SupplyStrip } from "@/components/system/Panels";
import { HeadRow, Note, PageHead, Row, ShareBar, SubHead, Table, Td, Th } from "@/components/system/Table";
import { formatNumber, levelHref } from "@/components/system/format";

const hoursText = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 1)} h`);

function Breakdown({ title, rows, name }: { title: string; rows: BreakdownRowView[]; name: string }) {
  return (
    <div>
      <SubHead>{title}</SubHead>
      <Table name={name}>
        <HeadRow>
          <Th>{title.replace("By ", "").replace(/^./, (c) => c.toUpperCase())}</Th>
          <Th right>SAIDI</Th>
          <Th right>SAIFI</Th>
          <Th className="w-2/5">Share of customer-hours</Th>
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
      <div className="space-y-2">
        <PageHead eyebrow="Utility Intelligence" title="Reliability">
          {view.organization ?? "Organization not recorded"} · which feeders fail their customers, why, and whether it is ours to fix.
        </PageHead>
        <Legend />
      </div>

      <Panel title="Feeders, ranked by network-attributable SAIDI" aside="What the distribution network itself did. Load shedding and upstream supply are beside it and do not set the rank.">
        <Table name="feeder-ranking">
          <HeadRow>
            <Th>#</Th>
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
                <Td className="font-mono text-ink-5">{feeder.rank}.</Td>
                <Td>
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
        <Note>
          The classes add up to the total for each feeder. Each name opens the feeder in the Operations drill-down, where source and method are shown for every figure.
        </Note>
      </Panel>

      <Panel title="Is it ours to fix? Reported against calculated" aside="Each reported figure beside the calculation that counts the same things">
        <RuleFindings findings={view.ruleFindings} />
        <Comparisons rows={view.comparisons} />
      </Panel>

      <ReliabilityPanel reliability={view.portfolio} showBand={false} />

      <Panel title="Why supply was interrupted" aside="The portfolio's interruptions, by what the outage log records">
        <div className="grid gap-3 xl:grid-cols-2">
          <Breakdown title="By cause" rows={view.byCause} name="by-cause" />
          <Breakdown title="By where it began" rows={view.byOriginPoint} name="by-origin-point" />
        </div>
        <Note>
          Each breakdown adds up to the portfolio&apos;s SAIDI and SAIFI. Where an interruption began is recorded as a fact; which side of the boundary that is on follows from the
          GridIntel reference methodology ({view.method.id} v{view.method.version}), under which only the grid and the transmission station are upstream.
        </Note>
      </Panel>

      <Panel title="Where interruptions most often begin" aside="Load shedding left out">
        <Table name="origins">
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
        <Note>{view.originsNote}</Note>
      </Panel>

      <Panel title="Service-band compliance, day by day" aside="Hours of supply per day against each feeder's NERC band minimum">
        <div className="grid gap-4 xl:grid-cols-2">
          {view.feeders.map((feeder) => (
            <div key={feeder.id} data-band-feeder={feeder.id}>
              <SubHead>
                <Link href={levelHref("feeder", feeder.id)} className="normal-case tracking-normal text-link hover:text-link-hover hover:underline">
                  {feeder.name}
                </Link>
              </SubHead>
              <SupplyStrip supply={feeder.supply} />
            </div>
          ))}
        </div>
        <Note>Every interruption counts toward hours of supply, whatever its cause. A feeder can meet its minimum on average and still fail on individual days.</Note>
      </Panel>

      <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}
