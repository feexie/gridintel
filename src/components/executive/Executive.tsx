import Link from "next/link";
import type { AttentionItemView } from "@/services/overview/views";
import type { ExecutiveView } from "@/services/executive/views";
import { AttentionList } from "@/components/system/Attention";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, SectionNav, WideOpen } from "@/components/system/Fold";
import { MetricCell, Panel } from "@/components/system/Metric";
import { AlarmsPanel, LossesPanel, ReliabilityPanel, RevenueGapPanel } from "@/components/system/Panels";
import { HeadRow, Row, Table, Td, Th } from "@/components/system/Table";
import { OPERATIONS_HOME, WORKSPACE_HREF, formatNumber, fullListHref, levelHref } from "@/components/system/format";

/* The Executive: what is happening across the portfolio, and where to look first. The answer
   first (the findings, in the one way a finding is shown), then one section each for revenue,
   losses and reliability with one visual each, then the tables; the rules, notes, and source and
   method one tap away. Everything is laid out from the read model; nothing is ranked or cut here. */

const SECTIONS = [
  { id: "look-first", label: "Where to look first" },
  { id: "revenue", label: "Revenue gap" },
  { id: "losses", label: "Losses" },
  { id: "reliability", label: "Reliability" },
  { id: "supply-and-loading", label: "Supply and loading" },
  { id: "alarms", label: "Alarms" },
];

function Group({ name, heading, words, items, tone }: { name: string; heading: string; words: string; items: AttentionItemView[]; tone: string }) {
  return (
    <div className="space-y-2" data-group={name}>
      <h3 className={`flex flex-wrap items-baseline gap-x-2 text-caption font-semibold uppercase tracking-wide ${tone}`}>
        {heading} <span className="font-normal normal-case tracking-normal text-ink-4">{words}</span>
      </h3>
      <AttentionList items={items} note={null} />
    </div>
  );
}

export function Executive({ view }: { view: ExecutiveView }) {
  const look = view.whereToLook;
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Executive">
        {view.organization ?? "Organization not recorded"} · what is happening across the portfolio, and where to look first.
      </SectorBand>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs" data-facts>
        {view.facts.map((fact) => (
          <div key={fact.label} className="flex gap-1.5">
            <dt className="text-ink-5">{fact.label}</dt>
            <dd className="text-ink">{fact.value}</dd>
          </div>
        ))}
        <div className="flex gap-1.5">
          <dt className="text-ink-5">Detail</dt>
          <dd>
            <Link href={OPERATIONS_HOME} className="text-link hover:underline">
              Operations drill-down
            </Link>
          </dd>
        </div>
      </dl>
      <SectionNav sections={SECTIONS} />
      <KeyFold />

      <Panel id="look-first" title="Where to look first" aside="Facts from fixed rules. No AI.">
        <Group name="asset-risk" heading="▲ Asset risk" words="Equipment over its rating. Not ranked by money." items={view.lookFirst.assetRisk} tone="text-alert" />
        {view.lookFirst.assetRisk.length === 0 ? <p className="text-xs text-ink-4">No transformer was loaded above its rating in the period.</p> : null}
        <Group
          name="money"
          heading="Revenue"
          words={`${look.complete ? "Feeders" : `Top ${look.moneyLimit} of ${look.moneyTotal} feeders`}, ranked by estimated revenue not realised.`}
          items={view.lookFirst.money}
          tone="text-ink-2"
        />
        {view.lookFirst.money.length === 0 ? <p className="text-xs text-ink-4">No feeder has a money figure to rank by in this period.</p> : null}
        {look.complete ? null : (
          <p className="text-xs">
            <Link href={fullListHref(WORKSPACE_HREF.executive)} className="gi-tap inline-flex items-center text-link hover:underline">
              Show all {look.moneyTotal} feeders
            </Link>
          </p>
        )}
        {view.lookFirst.other.length > 0 ? (
          <Group name="other" heading="Other findings" words="No money figure to rank by; in rule order." items={view.lookFirst.other} tone="text-ink-2" />
        ) : null}
        <Fold label="How this list is made" name="look-first-method">
          <p>{view.whereToLookMethod}</p>
          <p>Each name opens the Operations drill-down, where source and method are shown.</p>
        </Fold>
      </Panel>

      <RevenueGapPanel id="revenue" gap={view.revenueGap} below={{ title: "By feeder", rows: view.gapByFeeder }} bars={view.gapBars} />

      {view.losses ? (
        <LossesPanel id="losses" losses={view.losses} />
      ) : (
        <Panel id="losses" title="Energy account and ATC&C">
          <p className="text-xs text-ink-4">{view.lossesNote}</p>
        </Panel>
      )}

      <ReliabilityPanel id="reliability" reliability={view.reliability} showBand={false} />

      <div id="supply-and-loading" className="grid scroll-mt-4 gap-4 xl:grid-cols-2">
        <Panel title="Service-band compliance by feeder" aside="Hours of supply per day against the NERC band minimum">
          <WideOpen name="band-compliance">
            <Table name="band-compliance" wide>
              <HeadRow>
                <Th>Feeder</Th>
                <Th>Band</Th>
                <Th right>Average</Th>
                <Th right>Days below minimum</Th>
                <Th>On average</Th>
              </HeadRow>
              <tbody>
                {view.bandCompliance.map((row) => (
                  <Row key={row.feederId} id={row.feederId}>
                    <Td>
                      <Link href={levelHref("feeder", row.feederId)} className="text-link hover:underline">
                        {row.feederName}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{row.band ? `${row.band} (min ${row.minimumHours} h)` : "not recorded"}</Td>
                    <Td right>
                      <MetricCell metric={row.averageHours} />
                    </Td>
                    <Td figure>{row.daysFailed === null ? "—" : `${row.daysFailed} of ${row.daysObserved}`}</Td>
                    <Td className="whitespace-nowrap">{row.compliantOnAverage === null ? "—" : row.compliantOnAverage ? "● Meets minimum" : "▼ Below minimum"}</Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          </WideOpen>
          <Fold label="How compliance is tested" name="band-notes">
            <p>
              A feeder can meet its minimum on average and still fail on individual days. The day-by-day test is a GridIntel reference calculation, not a regulatory
              determination.
            </p>
          </Fold>
        </Panel>

        <Panel title="Transformer peak loading" aside="Highest observed in the period, against rating">
          <WideOpen name="transformer-loading">
            <Table name="transformer-loading" wide>
              <HeadRow>
                <Th>Transformer</Th>
                <Th right>Rating</Th>
                <Th right>Peak</Th>
                <Th right>Hours over rating</Th>
                <Th>State</Th>
              </HeadRow>
              <tbody>
                {view.transformerLoading.map((row) => (
                  <Row key={row.transformerId} id={row.transformerId}>
                    <Td>
                      <Link href={levelHref("distribution_transformer", row.transformerId)} className="text-link hover:underline">
                        {row.transformerName}
                      </Link>
                      <span className="block text-micro text-ink-5">{row.feederName}</span>
                    </Td>
                    <Td figure>{row.ratedKva === null ? "—" : `${formatNumber(row.ratedKva)} kVA`}</Td>
                    <Td right>
                      <MetricCell metric={row.peak} />
                    </Td>
                    <Td figure>{row.hoursOverRating === null ? "—" : `${row.hoursOverRating} of ${row.hoursObserved ?? "—"}`}</Td>
                    <Td className="whitespace-nowrap">{row.overloaded === null ? "—" : row.overloaded ? "▲ Over rating" : "Within rating"}</Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          </WideOpen>
          <Fold label="How loading is read" name="loading-notes">
            <p>Peak is the highest of the hourly readings; a higher loading between readings would not be seen.</p>
          </Fold>
        </Panel>
      </div>

      <AlarmsPanel id="alarms" alarms={view.alarms} />
    </div>
  );
}
