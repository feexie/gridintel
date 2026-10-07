import Link from "next/link";
import type { LevelHeader, NetworkLevelView, OverviewView, ServicePointView } from "@/services/operations/views";
import { Legend, MetricTile, OriginTag, Panel } from "@/components/system/Metric";
import { AlarmsPanel, ChildrenTable, LoadingPanel, LossesPanel, PowerTransformersPanel, ReliabilityPanel, RevenueGapPanel } from "@/components/system/Panels";
import { HeadRow, Row, Table, Td, Th } from "@/components/system/Table";
import { LEVEL_NAME, OPERATIONS_HOME, formatMoney, formatNumber, formatPercent, formatTime, levelHref } from "@/components/system/format";


function LevelHead({ header }: { header: LevelHeader }) {
  return (
    <header className="space-y-2">
      <nav aria-label="Drill-down path" className="flex flex-wrap items-center gap-1 text-xs text-ink-4">
        <Link href={OPERATIONS_HOME} className="hover:text-link-hover">
          Operations
        </Link>
        {header.crumbs.map((crumb, i) => (
          <span key={`${crumb.kind}:${crumb.id}`} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            {i === header.crumbs.length - 1 ? (
              <span className="text-ink">{crumb.label}</span>
            ) : (
              <Link href={levelHref(crumb.kind, crumb.id)} className="hover:text-link-hover">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-link/80">
            {LEVEL_NAME[header.kind]} · {header.id}
          </p>
          <h1 className="text-xl font-semibold text-ink">{header.title}</h1>
          <p className="text-xs text-ink-4">{header.subtitle}</p>
        </div>
        {header.location ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-caption text-ink-4">
            <dt>Location</dt>
            <dd className="font-mono text-ink-2">
              {formatNumber(header.location.latitude, 4)}, {formatNumber(header.location.longitude, 4)}
            </dd>
          </dl>
        ) : null}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 border-y border-line py-1.5 text-xs">
        {header.facts.map((fact) => (
          <div key={fact.label} className="flex gap-1.5">
            <dt className="text-ink-5">{fact.label}</dt>
            <dd className="text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <Legend />
    </header>
  );
}

export function NetworkLevel({ view, showAllRows = false }: { view: NetworkLevelView; showAllRows?: boolean }) {
  return (
    <div className="space-y-4">
      <LevelHead header={view.header} />
      {view.losses ? (
        <LossesPanel losses={view.losses} />
      ) : (
        <Panel title="Energy account and ATC&C">
          <p className="text-xs text-ink-4">{view.lossesNote}</p>
        </Panel>
      )}
      <RevenueGapPanel gap={view.revenueGap} below={view.revenueGapBelow} />
      <ReliabilityPanel reliability={view.reliability} showBand={view.header.kind === "feeder"} scopeId={view.header.id} />
      {view.loading ? <LoadingPanel loading={view.loading} /> : null}
      {view.powerTransformers ? <PowerTransformersPanel transformers={view.powerTransformers} /> : null}
      {view.children.map((table) => (
        <ChildrenTable key={table.title} table={table} showAll={showAllRows} allHref={`${levelHref(view.header.kind, view.header.id)}?rows=all`} />
      ))}
      <AlarmsPanel alarms={view.alarms} />
    </div>
  );
}

export function Overview({ view }: { view: OverviewView }) {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-link/80">Utility Intelligence</p>
            <h1 className="text-xl font-semibold text-ink">Operations Center</h1>
            <p className="text-xs text-ink-4">{view.organization ?? "Organization not recorded"} · drill from region to service point.</p>
          </div>
        </div>
        <Legend />
      </header>
      <ChildrenTable table={view.regions} />
      <AlarmsPanel alarms={view.alarms} />
    </div>
  );
}

export function ServicePoint({ view }: { view: ServicePointView }) {
  return (
    <div className="space-y-4">
      <LevelHead header={view.header} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Connection">
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-xs">
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
          <Table name="charges">
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
        <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ")}</p>
      </Panel>
    </div>
  );
}
