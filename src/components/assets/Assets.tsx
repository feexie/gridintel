import Link from "next/link";
import type { AssetClassTable, AssetRowView, AssetsWorkspaceView } from "@/services/assets/views";
import { Legend, MetricCell, MetricTile, Panel } from "@/components/system/Metric";
import { SEVERITY_STYLE } from "@/components/system/Panels";
import { HeadRow, Note, PageHead, Row, Table, Td, Th } from "@/components/system/Table";
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
      <Table name={`assets-${table.assetClass}`}>
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

export function Assets({ view }: { view: AssetsWorkspaceView }) {
  const feederCaveat = view.classes.find((table) => table.assetClass === "feeder")?.rows.find((asset) => asset.loadingCaveat)?.loadingCaveat ?? null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <PageHead eyebrow="Utility Intelligence" title="Assets">
          {view.organization ?? "Organization not recorded"} · which assets require attention.
        </PageHead>
        <Legend />
      </div>

      <Panel title="Assets with something on them" aside={`${formatNumber(view.attention.length)} of ${formatNumber(view.assetsChecked)} in-service assets · an ordering of facts, not a score`}>
        <Table name="attention">
          <HeadRow>
            <Th>#</Th>
            <Th>Asset</Th>
            <Th>Standing source alarms</Th>
            <Th>Conditions derived by GridIntel</Th>
            <Th right>Peak loading</Th>
            <Th right>Readings above rating</Th>
            <Th right>Interruptions began here</Th>
          </HeadRow>
          <tbody>
            {view.attention.map((asset, i) => (
              <Row key={`${asset.assetClass}:${asset.id}`} id={asset.id}>
                <Td className="font-mono text-ink-5">{i + 1}.</Td>
                <Td>
                  <AssetName asset={asset} />
                </Td>
                <Td>
                  {asset.alarms.length === 0 ? (
                    <span className="text-ink-5">{view.alarmRecord === "complete" ? "None" : "—"}</span>
                  ) : (
                    asset.alarms.map((alarm) => (
                      <span key={alarm.id} className="block" data-asset-alarm={alarm.id}>
                        <span className={`mr-1.5 border px-1 py-px text-micro uppercase tracking-wide ${SEVERITY_STYLE[alarm.severity]}`}>{alarm.severity}</span>
                        {alarm.message} <span className="font-mono text-micro text-ink-5">{alarm.code}</span>
                        {alarm.onMonitor ? <span className="ml-1 text-micro text-ink-5">on its monitor</span> : null}
                      </span>
                    ))
                  )}
                </Td>
                <Td>
                  {asset.conditions.length === 0 ? (
                    <span className="text-ink-5">None</span>
                  ) : (
                    asset.conditions.map((condition) => (
                      <span key={condition.key} className="block" data-asset-condition={condition.key}>
                        Rule: {condition.ruleName}
                        {condition.onMonitor ? ", on its monitor" : ""}
                        <span className="block text-micro text-ink-5">
                          {condition.activeNow === null ? "state at the as-of time not known" : condition.activeNow ? "holds at the as-of time" : "does not hold at the as-of time"} ·{" "}
                          {SOURCE_ALARM_WORDS[condition.sourceAlarm]}
                        </span>
                      </span>
                    ))
                  )}
                </Td>
                <Td right>
                  <MetricCell metric={asset.peak} />
                </Td>
                <Td figure>
                  <OverRating asset={asset} />
                </Td>
                <Td figure>
                  <Began asset={asset} />
                </Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <Note>{view.attentionRule}</Note>
        <Note>
          Source alarms are observed and conditions are calculated; they are in separate columns and are never merged. Interruptions are those attributed to the distribution network,
          with what they added to the portfolio&apos;s SAIDI.
          {view.alarmsElsewhere > 0 ? (
            <>
              {" "}
              {formatNumber(view.alarmsElsewhere)} standing alarm(s) name a substation as a whole or something not in the registry, not one of these assets; they are on the{" "}
              <Link href="/dashboard/utility/events" className="text-link hover:underline">
                Events / Alarms
              </Link>{" "}
              screen.
            </>
          ) : null}
        </Note>
        {view.alarmRecord === "complete" ? null : <Note tone="caution">The source&apos;s alarm record is not complete: an asset with no alarm shown may still have one.</Note>}
        {view.outageLog === "complete" ? null : <Note tone="caution">The outage log is not complete: interruptions that began at an asset may be missing, so none is shown as zero.</Note>}
      </Panel>

      {view.classes.map((table) => (
        <Panel key={table.assetClass} title={`${table.title}, by peak loading`} aside={`${formatNumber(table.total)} in service in the registry`}>
          <ClassTable table={table} caveatMark={table.assetClass === "feeder" && feederCaveat ? "†" : null} />
          {table.assetClass === "feeder" && feederCaveat ? <Note tone="caution">† {feederCaveat}</Note> : null}
        </Panel>
      ))}
      <p className="text-micro text-ink-5">
        Loading: {view.loadingMethod.name} <span className="font-mono">({view.loadingMethod.id} v{view.loadingMethod.version})</span>. Peak loading is the highest of the hourly readings in the
        period; a higher loading between readings would not be seen. Each name opens the asset in the Operations drill-down, where source and method are shown for every figure.
      </p>

      <Panel title="Monitoring and what is not held" aside="What the list above cannot see">
        <div className="grid gap-2 md:grid-cols-3">
          <MetricTile metric={view.monitoring.devices}>
            <span className="text-caption text-ink-4">{formatNumber(view.monitoring.checked)} checked for check-ins</span>
          </MetricTile>
          {view.notHeld.map((item) => (
            <div key={item.name} className="border border-line bg-well/40 px-3 py-2" data-not-held={item.name}>
              <p className="text-caption uppercase tracking-wide text-ink-4">{item.name}</p>
              <p className="mt-1 font-mono text-lg text-ink">—</p>
              <p className="mt-1 text-caption leading-snug text-ink-4">{item.note}</p>
            </div>
          ))}
        </div>
        {view.monitoring.note ? <Note tone="caution">{view.monitoring.note}</Note> : null}
      </Panel>

      <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}
