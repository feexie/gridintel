import Link from "next/link";
import type { LevelHeader, NetworkLevelView, OverviewView, ServicePointView } from "@/services/operations/views";
import { Legend, MetricTile, OriginTag, Panel } from "./Metric";
import { ChildrenTable, LoadingPanel, LossesPanel, NotAvailable, ReliabilityPanel } from "./Panels";
import { LEVEL_NAME, OPERATIONS_HOME, formatMoney, formatNumber, formatPercent, formatPeriod, formatTime, levelHref } from "./format";

export function SyntheticBanner({ notice }: { notice: { label: string; summary: string } | null }) {
  if (!notice) return null;
  return (
    <div role="note" className="sticky -top-6 z-40 -mx-6 -mt-6 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-400/50 bg-amber-950/90 px-6 py-1.5 text-xs text-amber-100 backdrop-blur lg:-mx-8 lg:px-8">
      <span className="border border-amber-300 px-1.5 py-px text-[11px] font-bold tracking-[0.18em] text-amber-200">{notice.label}</span>
      <span>{notice.summary}</span>
    </div>
  );
}

function LevelHead({ header }: { header: LevelHeader }) {
  return (
    <header className="space-y-2">
      <nav aria-label="Drill-down path" className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
        <Link href={OPERATIONS_HOME} className="hover:text-cyan-200">
          Operations
        </Link>
        {header.crumbs.map((crumb, i) => (
          <span key={`${crumb.kind}:${crumb.id}`} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            {i === header.crumbs.length - 1 ? (
              <span className="text-slate-100">{crumb.label}</span>
            ) : (
              <Link href={levelHref(crumb.kind, crumb.id)} className="hover:text-cyan-200">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            {LEVEL_NAME[header.kind]} · {header.id}
          </p>
          <h1 className="text-xl font-semibold text-white">{header.title}</h1>
          <p className="text-xs text-slate-400">{header.subtitle}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
          <dt>Reporting period</dt>
          <dd className="font-mono text-slate-200">{formatPeriod(header.period)}</dd>
          <dt>Data as of</dt>
          <dd className="font-mono text-slate-200">{formatTime(header.asOf)}</dd>
          {header.location ? (
            <>
              <dt>Location</dt>
              <dd className="font-mono text-slate-200">
                {formatNumber(header.location.latitude, 4)}, {formatNumber(header.location.longitude, 4)}
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-800 py-1.5 text-xs">
        {header.facts.map((fact) => (
          <div key={fact.label} className="flex gap-1.5">
            <dt className="text-slate-500">{fact.label}</dt>
            <dd className="text-slate-100">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <Legend />
    </header>
  );
}

export function NetworkLevel({ view }: { view: NetworkLevelView }) {
  return (
    <div className="space-y-4">
      <LevelHead header={view.header} />
      {view.losses ? (
        <LossesPanel losses={view.losses} />
      ) : (
        <Panel title="Energy account and ATC&C">
          <p className="text-xs text-slate-400">{view.lossesNote}</p>
        </Panel>
      )}
      <ReliabilityPanel reliability={view.reliability} showBand={view.header.kind === "feeder"} />
      {view.loading ? <LoadingPanel loading={view.loading} /> : null}
      {view.children.map((table) => (
        <ChildrenTable key={table.title} table={table} />
      ))}
      <NotAvailable view={view.alarms} />
    </div>
  );
}

export function Overview({ view }: { view: OverviewView }) {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Utility Intelligence</p>
            <h1 className="text-xl font-semibold text-white">Operations Center</h1>
            <p className="text-xs text-slate-400">{view.organization ?? "Organization not recorded"} · drill from region to service point.</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
            <dt>Reporting period</dt>
            <dd className="font-mono text-slate-200">{formatPeriod(view.period)}</dd>
            <dt>Data as of</dt>
            <dd className="font-mono text-slate-200">{formatTime(view.asOf)}</dd>
          </dl>
        </div>
        <Legend />
      </header>
      <ChildrenTable table={view.regions} />
      <NotAvailable view={view.alarms} />
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
            <dt className="text-slate-500">Account</dt>
            <dd className="text-slate-100">{view.account ? `${view.account.id} (${view.account.accountNumber ?? "no account number"})` : "No account at this service point"}</dd>
            <dt className="text-slate-500">Category</dt>
            <dd className="text-slate-100">{view.account?.category ?? "—"}</dd>
            <dt className="text-slate-500">Account status</dt>
            <dd className="text-slate-100">{view.account?.status ?? "—"}</dd>
            <dt className="text-slate-500">Metering</dt>
            <dd className="text-slate-100">{view.metering}</dd>
            <dt className="text-slate-500">Meter</dt>
            <dd className="text-slate-100">
              {view.meter ? `${view.meter.id} · serial ${view.meter.serialNumber} · ${view.meter.type}${view.meter.phases ? ` · ${view.meter.phases}-phase` : ""}` : "None. Consumption at this connection is not measured."}
            </dd>
            <dt className="text-slate-500">Customer name</dt>
            <dd className="text-slate-400">Not shown. Personal data is not used in analytics views.</dd>
          </dl>
          <p className="text-[11px] leading-snug text-slate-400">{view.reliabilityNote}</p>
        </Panel>
        <Panel title="Energy recorded">
          <MetricTile metric={view.recorded} sourcing={view.sourcing} emphasis />
          {view.meter ? (
            <p className="text-[11px] text-slate-400">
              Intervals usable: <span className="font-mono text-slate-100">{view.intervals.usable}</span> of{" "}
              <span className="font-mono text-slate-100">{view.intervals.expected ?? "—"}</span> ({formatPercent(view.intervals.coverage)} coverage). A gap makes the total unavailable; nothing is filled in.
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel title={`Charges in the period (${view.charges.length})`}>
        {view.charges.length === 0 ? (
          <p className="text-xs text-slate-400">No charge was raised on this account in the period.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Raised</th>
                <th className="py-1 pr-2 font-normal">How billed</th>
                <th className="py-1 pr-2 font-normal">Tariff</th>
                <th className="py-1 pr-2 text-right font-normal">Energy</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.charges.map((charge) => (
                <tr key={charge.id} className="border-b border-slate-800/60" title={charge.id}>
                  <td className="py-1 pr-2 font-mono text-slate-300">{formatTime(charge.billedAt)}</td>
                  <td className="py-1 pr-2 text-slate-200">
                    {charge.basisLabel} <OriginTag origin={charge.estimated ? "estimated" : "measured"} />
                  </td>
                  <td className="py-1 pr-2 text-slate-400">{charge.tariff ?? "—"}</td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">{charge.energyKwh === null ? "—" : `${formatNumber(charge.energyKwh, 1)} kWh`}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatMoney(charge.amount, charge.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={`Payments received in the period (${view.payments.length})`} aside="Cash basis">
        {view.payments.length === 0 ? (
          <p className="text-xs text-slate-400">No payment was received from this account in the period.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2 font-normal">Received</th>
                <th className="py-1 pr-2 font-normal">Channel</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-800/60" title={payment.id}>
                  <td className="py-1 pr-2 font-mono text-slate-300">{formatTime(payment.receivedAt)}</td>
                  <td className="py-1 pr-2 text-slate-200">{payment.channel ?? "—"}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatMoney(payment.amount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-slate-500">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ")}</p>
      </Panel>
    </div>
  );
}
