import Link from "next/link";
import type { ReactNode } from "react";
import type { AssetClassTable, AssetRowView, AssetsWorkspaceView } from "@/services/assets/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, SectionNav, Sources } from "@/components/system/Fold";
import { MetricCell, MetricTile, OriginTag, Panel } from "@/components/system/Metric";
import { SEVERITY_STYLE } from "@/components/system/Panels";
import { HeadRow, Note, Row, Table, Td, Th } from "@/components/system/Table";
import { WORKSPACE_HREF, formatNumber, fullListHref, levelHref } from "@/components/system/format";

const SOURCE_ALARM_WORDS = { agrees: "a source alarm agrees", none_raised: "no source alarm was raised", cannot_tell: "whether a source alarm was raised cannot be told" };

function AssetName({ asset }: { asset: AssetRowView }) {
  return (
    <>
      {asset.link ? (
        <Link href={levelHref(asset.link.kind, asset.link.id)} className="text-link hover:text-link-hover hover:underline">
          {asset.name}
        </Link>
      ) : (
        asset.name
      )}
      <span className="ml-1.5 font-mono text-micro text-ink-5">{asset.id}</span>
      <span className="block text-micro text-ink-5">{asset.place}</span>
    </>
  );
}

function OverRating({ asset }: { asset: AssetRowView }) {
  if (asset.readingsOverRating === null) return <>—</>;
  return (
    <>
      <span className={asset.readingsOverRating > 0 ? "text-alert" : undefined}>{formatNumber(asset.readingsOverRating)}</span>
      <span className="text-ink-5"> of {asset.readingsObserved === null ? "—" : formatNumber(asset.readingsObserved)}</span>
    </>
  );
}

/** Interruptions that began at the asset. A dash, never a zero, when the outage log is not complete. */
function Began({ asset }: { asset: AssetRowView }) {
  if (asset.interruptionsBegan === null) return <>—</>;
  return (
    <>
      {formatNumber(asset.interruptionsBegan)}
      {asset.saidiAddedHours === null ? null : <span className="text-ink-5"> · {formatNumber(asset.saidiAddedHours, 2)} h SAIDI</span>}
    </>
  );
}

function ClassTable({ table, caveatMark }: { table: AssetClassTable; caveatMark: string | null }) {
  const cut = table.limit !== null && table.total > table.limit;
  return (
    <div data-asset-class={table.assetClass} data-listing={table.complete ? "all" : "top"}>
      {cut ? (
        <p className="mb-1 text-caption leading-snug text-ink-3">
          {table.complete ? `All ${table.total}, highest peak loading first.` : `The ${table.limit} with the highest peak loading, of ${table.total}.`}{" "}
          <Link href={table.complete ? WORKSPACE_HREF.assets : fullListHref(WORKSPACE_HREF.assets)} className="text-link hover:underline">
            {table.complete ? `Show the ${table.limit} most loaded` : `Show all ${table.total}`}
          </Link>
        </p>
      ) : null}
      {table.coverage === "complete" ? null : (
        <Note tone="caution">
          {table.coverage === "partial" ? "The registry does not hold every asset of this class: one not listed here may still exist." : "The registry holds no asset of this class."}
        </Note>
      )}
      <Table name={`assets-${table.assetClass}`} wide>
        <HeadRow>
          <Th>Asset</Th>
          <Th right>Rating</Th>
          <Th right>Peak loading{caveatMark ? ` ${caveatMark}` : ""}</Th>
          <Th right>Readings above rating</Th>
          <Th right>Loading now</Th>
          <Th right>Standing alarms</Th>
          <Th right>Derived conditions</Th>
          <Th right>Interruptions began here</Th>
        </HeadRow>
        <tbody>
          {table.rows.map((asset) => (
            <Row key={asset.id} id={asset.id} hover>
              <Td>
                <AssetName asset={asset} />
              </Td>
              <Td figure>{asset.ratedKva === null ? "—" : `${formatNumber(asset.ratedKva)} kVA`}</Td>
              <Td right>
                <MetricCell metric={asset.peak} />
              </Td>
              <Td figure>
                <OverRating asset={asset} />
              </Td>
              <Td right>
                <MetricCell metric={asset.now} />
              </Td>
              <Td figure>{formatNumber(asset.alarms.length)}</Td>
              <Td figure>{formatNumber(asset.conditions.length)}</Td>
              <Td figure>
                <Began asset={asset} />
              </Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

const SECTIONS = [
  { id: "attention", label: "Something on them" },
  { id: "by-class", label: "Loading by class" },
  { id: "not-held", label: "What is not held" },
];

/** A labelled fact on a card. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line/60 py-1">
      <dt className="text-caption text-ink-5">{label}</dt>
      <dd className="text-right text-xs text-ink-2">{children}</dd>
    </div>
  );
}

/** One asset with something on it, in the finding style: each of the three facts in its own place, with its own origin. */
function AttentionCard({ asset, place, alarmRecord }: { asset: AssetRowView; place: number; alarmRecord: AssetsWorkspaceView["alarmRecord"] }) {
  const kinds = [asset.alarms.length > 0 ? "Source alarm" : null, asset.conditions.length > 0 ? "Derived condition" : null, (asset.interruptionsBegan ?? 0) > 0 ? "Interruptions began here" : null].filter(Boolean);
  return (
    <li className="rounded-tile border border-line border-l-[3px] border-l-line-bold bg-well/30 px-3 py-2.5" data-row={asset.id}>
      <p className="text-micro font-semibold uppercase tracking-wide text-ink-3">
        <span className="font-mono">{place}.</span> {kinds.join(" · ")}
      </p>
      <p className="mt-1 text-sm leading-snug text-ink">
        <AssetName asset={asset} />
      </p>
      <div className="mt-1.5 space-y-1">
        <div>
          <p className="flex items-center gap-1.5 text-caption text-ink-5">
            Standing source alarms <OriginTag origin="measured" />
          </p>
          {asset.alarms.length === 0 ? (
            <p className="text-xs text-ink-5">{alarmRecord === "complete" ? "None" : "—"}</p>
          ) : (
            asset.alarms.map((alarm) => (
              <p key={alarm.id} className="text-xs text-ink-2" data-asset-alarm={alarm.id}>
                <span className={`mr-1.5 rounded-[3px] border px-1 py-px text-micro uppercase tracking-wide ${SEVERITY_STYLE[alarm.severity]}`}>{alarm.severity}</span>
                {alarm.message} <span className="font-mono text-micro text-ink-5">{alarm.code}</span>
                {alarm.onMonitor ? <span className="ml-1 text-micro text-ink-5">on its monitor</span> : null}
              </p>
            ))
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-caption text-ink-5">
            Conditions derived by GridIntel <OriginTag origin="calculated" />
          </p>
          {asset.conditions.length === 0 ? (
            <p className="text-xs text-ink-5">None</p>
          ) : (
            asset.conditions.map((condition) => (
              <p key={condition.key} className="text-xs text-ink-2" data-asset-condition={condition.key}>
                Rule: {condition.ruleName}
                {condition.onMonitor ? ", on its monitor" : ""}
                <span className="block text-micro text-ink-5">
                  {condition.activeNow === null ? "state at the as-of time not known" : condition.activeNow ? "holds at the as-of time" : "does not hold at the as-of time"}
                  {" · "}
                  {SOURCE_ALARM_WORDS[condition.sourceAlarm]}
                </span>
              </p>
            ))
          )}
        </div>
      </div>
      <dl className="mt-1.5">
        <Fact label="Peak loading">
          <MetricCell metric={asset.peak} />
        </Fact>
        <Fact label="Readings above rating">
          <span className="font-mono">
            <OverRating asset={asset} />
          </span>
        </Fact>
        <Fact label="Interruptions began here">
          <span className="font-mono">
            <Began asset={asset} />
          </span>
        </Fact>
      </dl>
    </li>
  );
}

export function Assets({ view }: { view: AssetsWorkspaceView }) {
  const feederCaveat = view.classes.find((table) => table.assetClass === "feeder")?.rows.find((asset) => asset.loadingCaveat)?.loadingCaveat ?? null;
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Assets">
        {view.organization ?? "Organization not recorded"} · which assets require attention.
      </SectorBand>
      <SectionNav sections={SECTIONS} />
      <KeyFold />

      <Panel
        id="attention"
        title="Assets with something on them"
        aside={`${formatNumber(view.attention.length)} of ${formatNumber(view.assetsChecked)} in-service assets · an ordering of facts, not a score`}
      >
        {view.alarmRecord === "complete" ? null : <Note tone="caution">The source&apos;s alarm record is not complete: an asset with no alarm shown may still have one.</Note>}
        {view.outageLog === "complete" ? null : <Note tone="caution">The outage log is not complete: interruptions that began at an asset may be missing, so none is shown as zero.</Note>}
        <ol className="grid gap-2 lg:grid-cols-2" data-list="attention">
          {view.attention.map((asset, i) => (
            <AttentionCard key={`${asset.assetClass}:${asset.id}`} asset={asset} place={i + 1} alarmRecord={view.alarmRecord} />
          ))}
        </ol>
        {view.alarmsElsewhere > 0 ? (
          <Note>
            {formatNumber(view.alarmsElsewhere)} standing alarm(s) name a substation as a whole or something not in the registry, not one of these assets; they are on the{" "}
            <Link href="/dashboard/utility/events" className="text-link hover:underline">
              Events / Alarms
            </Link>{" "}
            screen.
          </Note>
        ) : null}
        <Fold label="How the list is made" name="attention-rule">
          <p>{view.attentionRule}</p>
          <p>
            Source alarms are observed and conditions are calculated; they are kept apart and never merged. Interruptions are those attributed to the distribution network, with what
            they added to the portfolio&apos;s SAIDI.
          </p>
        </Fold>
      </Panel>

      <div id="by-class" className="scroll-mt-4 space-y-4">
        {view.classes.map((table) => (
          <Panel key={table.assetClass} title={`${table.title}, by peak loading`} aside={`${formatNumber(table.total)} in service in the registry`}>
            <ClassTable table={table} caveatMark={table.assetClass === "feeder" && feederCaveat ? "†" : null} />
            {table.assetClass === "feeder" && feederCaveat ? <Note tone="caution">† {feederCaveat}</Note> : null}
          </Panel>
        ))}
        <Fold label="How loading is read" name="loading-method">
          <p>
            Loading: {view.loadingMethod.name} <span className="break-all font-mono">({view.loadingMethod.id} v{view.loadingMethod.version})</span>. Peak loading is the highest of the
            hourly readings in the period; a higher loading between readings would not be seen. Each name opens the asset in the Operations drill-down, where source and method are
            shown for every figure.
          </p>
        </Fold>
      </div>

      <Panel id="not-held" title="Monitoring and what is not held" aside="What the list above cannot see">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <MetricTile metric={view.monitoring.devices}>
            <span className="text-caption text-ink-4">{formatNumber(view.monitoring.checked)} checked for check-ins</span>
          </MetricTile>
          {view.notHeld.map((item) => (
            <div key={item.name} className="min-w-0 rounded-tile border border-line bg-well/40 px-3 py-2" data-not-held={item.name}>
              <p className="text-caption uppercase tracking-wide text-ink-4">{item.name}</p>
              <p className="mt-1 font-mono text-lg text-ink">—</p>
              <p className="mt-1 text-caption leading-snug text-ink-4">{item.note}</p>
            </div>
          ))}
        </div>
        {view.monitoring.note ? <Note tone="caution">{view.monitoring.note}</Note> : null}
      </Panel>

      <Sources sourcing={view.sourcing} />
    </div>
  );
}
