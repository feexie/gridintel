import Link from "next/link";
import type { ReactNode } from "react";
import type { LevelHeader, NetworkLevelView, OverviewView, ServicePointView } from "@/services/operations/views";
import { AttentionList } from "@/components/system/Attention";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { SectionNav, Sources } from "@/components/system/Fold";
import { MetricTile, OriginTag, Panel } from "@/components/system/Metric";
import { AlarmsPanel, ChildrenTable, LoadingPanel, LossesPanel, PowerTransformersPanel, ReliabilityPanel, RevenueGapPanel } from "@/components/system/Panels";
import { HeadRow, Row, Table, Td, Th } from "@/components/system/Table";
import { LEVEL_NAME, OPERATIONS_HOME, formatMoney, formatNumber, formatPercent, formatTime, fullListHref, levelHref } from "@/components/system/format";


function LevelHead({ header }: { header: LevelHeader }) {
  return (
    <header className="space-y-3">
      <nav aria-label="Drill-down path" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex w-max items-center gap-1 text-xs text-ink-4 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={OPERATIONS_HOME} className="gi-tap inline-flex items-center hover:text-link-hover">
              Operations
            </Link>
          </li>
          {header.crumbs.map((crumb, i) => (
            <li key={`${crumb.kind}:${crumb.id}`} className="flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden>›</span>
              {i === header.crumbs.length - 1 ? (
                <span className="text-ink" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={levelHref(crumb.kind, crumb.id)} className="gi-tap inline-flex items-center hover:text-link-hover">
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <SectorBand eyebrow={`${LEVEL_NAME[header.kind]} · ${header.id}`} title={header.title}>
        {header.subtitle}
      </SectorBand>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs" data-facts>
        {header.facts.map((fact) => (
          <div key={fact.label} className="flex gap-1.5">
            <dt className="text-ink-5">{fact.label}</dt>
            <dd className="text-ink">{fact.value}</dd>
          </div>
        ))}
        {header.location ? (
          <div className="flex gap-1.5">
            <dt className="text-ink-5">Location</dt>
            <dd className="font-mono text-ink-2">
              {formatNumber(header.location.latitude, 4)}, {formatNumber(header.location.longitude, 4)}
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}

const childAnchor = (i: number) => `below-${i + 1}`;

/** `map` is the shared map, focused on this level; the page supplies it. */
export function NetworkLevel({ view, showAllRows = false, map }: { view: NetworkLevelView; showAllRows?: boolean; map?: ReactNode }) {
  const sections = [
    { id: "attention", label: "Needs attention" },
    ...(map ? [{ id: "map", label: "Map" }] : []),
    { id: "losses", label: "Losses" },
    { id: "revenue", label: "Revenue gap" },
    { id: "reliability", label: "Reliability" },
    ...(view.loading ? [{ id: "loading", label: "Loading" }] : []),
    ...(view.powerTransformers ? [{ id: "power-transformers", label: "Power transformers" }] : []),
    ...view.children.map((table, i) => ({ id: childAnchor(i), label: table.title })),
    { id: "alarms", label: "Alarms" },
  ];
  return (
    <div className="space-y-4">
      <LevelHead header={view.header} />
      <SectionNav sections={sections} />
      <KeyFold />
      <Panel id="attention" title="What needs attention here" aside="Listed by fixed rules, in a fixed order. No AI.">
        <AttentionList items={view.findings} note={view.findings.length === 0 ? "None of the rules lists anything at this level for this period." : null} />
      </Panel>
      {map ? (
        <div id="map" className="scroll-mt-4">
          {map}
        </div>
      ) : null}
      {view.losses ? (
        <LossesPanel id="losses" losses={view.losses} />
      ) : (
        <Panel id="losses" title="Energy account and ATC&C">
          <p className="text-xs text-ink-4">{view.lossesNote}</p>
        </Panel>
      )}
      <RevenueGapPanel id="revenue" gap={view.revenueGap} below={view.revenueGapBelow} />
      <ReliabilityPanel id="reliability" reliability={view.reliability} showBand={view.header.kind === "feeder"} scopeId={view.header.id} />
      {view.loading ? <LoadingPanel id="loading" loading={view.loading} /> : null}
      {view.powerTransformers ? <PowerTransformersPanel id="power-transformers" transformers={view.powerTransformers} /> : null}
      {view.children.map((table, i) => (
        <ChildrenTable key={table.title} id={childAnchor(i)} table={table} showAll={showAllRows} allHref={fullListHref(levelHref(view.header.kind, view.header.id))} />
      ))}
      <AlarmsPanel id="alarms" alarms={view.alarms} />
    </div>
  );
}

export function Overview({ view }: { view: OverviewView }) {
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Operations Center">
        {view.organization ?? "Organization not recorded"} · drill from region to service point.
      </SectorBand>
      <KeyFold />
      <ChildrenTable table={view.regions} />
      <AlarmsPanel alarms={view.alarms} />
    </div>
  );
}

export function ServicePoint({ view, map }: { view: ServicePointView; map?: ReactNode }) {
  return (
    <div className="space-y-4">
      <LevelHead header={view.header} />
      <KeyFold />
      {map}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Connection">
          <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-ink-5">Account</dt>
            <dd className="text-ink">{view.account ? `${view.account.id} (${view.account.accountNumber ?? "no account number"})` : "No account at this service point"}</dd>
            <dt className="text-ink-5">Category</dt>
            <dd className="text-ink">{view.account?.category ?? "—"}</dd>
            <dt className="text-ink-5">Account status</dt>
            <dd className="text-ink">{view.account?.status ?? "—"}</dd>
            <dt className="text-ink-5">Metering</dt>
            <dd className="text-ink">{view.metering}</dd>
            <dt className="text-ink-5">Meter</dt>
            <dd className="text-ink">
              {view.meter ? `${view.meter.id} · serial ${view.meter.serialNumber} · ${view.meter.type}${view.meter.phases ? ` · ${view.meter.phases}-phase` : ""}` : "None. Consumption at this connection is not measured."}
            </dd>
            <dt className="text-ink-5">Customer name</dt>
            <dd className="text-ink-4">Not shown. Personal data is not used in analytics views.</dd>
          </dl>
          <p className="text-caption leading-snug text-ink-4">{view.reliabilityNote}</p>
        </Panel>
        <Panel title="Energy recorded">
          <MetricTile metric={view.recorded} sourcing={view.sourcing} emphasis />
          {view.intervals ? (
            <p className="text-caption text-ink-4">
              Intervals usable: <span className="font-mono text-ink">{view.intervals.usable}</span> of{" "}
              <span className="font-mono text-ink">{view.intervals.expected ?? "—"}</span> ({formatPercent(view.intervals.coverage)} coverage). A gap makes the total unavailable; nothing is filled in.
            </p>
          ) : null}
          {view.register ? (
            <p className="text-caption text-ink-4" data-register-readings>
              Register read <span className="font-mono text-ink">{formatNumber(view.register.openingKwh, 1)} kWh</span> at{" "}
              <span className="font-mono text-ink">{formatTime(view.register.openingAt)}</span> and{" "}
              <span className="font-mono text-ink">{formatNumber(view.register.closingKwh, 1)} kWh</span> at{" "}
              <span className="font-mono text-ink">{formatTime(view.register.closingAt)}</span>
              {view.register.estimated ? " (estimated: the meter was not read)" : ""}. The figure is the difference, for the time between the two readings.
            </p>
          ) : null}
          {view.registerCounts ? (
            <p className={`text-caption leading-snug ${view.registerCounts.counted ? "text-ink-3" : "text-caution-ink/90"}`} data-register-counts={view.registerCounts.counted ? "yes" : "no"}>
              {view.registerCounts.note}
            </p>
          ) : null}
          {view.purchased ? <MetricTile metric={view.purchased} sourcing={view.sourcing} /> : null}
        </Panel>
      </div>

      <Panel title={`Charges in the period (${view.charges.length})`}>
        {view.charges.length === 0 ? (
          <p className="text-xs text-ink-4">No charge was raised on this account in the period.</p>
        ) : (
          <Table name="charges" wide>
            <HeadRow>
                <Th>Raised</Th>
                <Th>How billed</Th>
                <Th>Tariff</Th>
                <Th right>Energy</Th>
                <Th right>Amount</Th>
            </HeadRow>
            <tbody>
              {view.charges.map((charge) => (
                <Row key={charge.id} id={charge.id}>
                  <Td className="font-mono text-ink-3">{formatTime(charge.billedAt)}</Td>
                  <Td>
                    {charge.basisLabel} <OriginTag origin={charge.estimated ? "estimated" : "measured"} />
                  </Td>
                  <Td className="text-ink-4">{charge.tariff ?? "—"}</Td>
                  <Td figure>{charge.energyKwh === null ? "—" : `${formatNumber(charge.energyKwh, 1)} kWh`}</Td>
                  <Td figure>{formatMoney(charge.amount, charge.currency)}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Payments received in the period (${view.payments.length})`} aside="Cash basis">
        {view.payments.length === 0 ? (
          <p className="text-xs text-ink-4">No payment was received from this account in the period.</p>
        ) : (
          <Table name="payments">
            <HeadRow>
                <Th>Received</Th>
                <Th>Channel</Th>
                <Th right>Amount</Th>
            </HeadRow>
            <tbody>
              {view.payments.map((payment) => (
                <Row key={payment.id} id={payment.id}>
                  <Td className="font-mono text-ink-3">{formatTime(payment.receivedAt)}</Td>
                  <Td>{payment.channel ?? "—"}</Td>
                  <Td figure>{formatMoney(payment.amount, payment.currency)}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Sources sourcing={view.sourcing} />
    </div>
  );
}
