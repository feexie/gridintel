import { Panel } from "@/components/system/Metric";
import type { MarketplaceView } from "@/services/planning/views";
import { Synthetic } from "./DtSequencing";
import { MeteringTabs } from "./MeteringTabs";
import { STEPS } from "@/constants/planning";

/* The Metering Marketplace (docs/geh/DESIGN.md, section 6c): funders' pledges, approved meter
   applications, the daily meter charge by band, and the match. Every record is synthetic and
   marked so. It displays the view model; it calculates nothing. */

function How({ children }: { children: string }) {
  return (
    <p className="max-w-5xl text-caption leading-snug text-ink-4" data-how>
      {children}
    </p>
  );
}

const cell = "py-1.5 pr-3";

export function Marketplace({ view }: { view: MarketplaceView }) {
  return (
    <div className="space-y-4" data-marketplace>
      <MeteringTabs current="marketplace" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="flex flex-wrap items-center gap-2 text-micro font-semibold uppercase tracking-eyebrow text-brand">
          {STEPS.fund} · Marketplace · Match <Synthetic />
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{view.headline}</h1>
        <p className="mt-2 max-w-5xl text-sm font-medium text-ink-2" data-platform-line>
          {view.platformLine}
        </p>
        <div className="mt-2">
          <How>{view.headlineHow}</How>
        </div>
      </header>

      <Panel title="The match" aside="Synthetic records">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4" data-totals>
          {view.totals.map((figure) => (
            <div key={figure.key} data-shown-figure={figure.key}>
              <dt className="flex items-center gap-2 text-caption text-ink-4">
                {figure.label} <Synthetic />
              </dt>
              <dd className="text-2xl font-semibold text-ink">{figure.value}</dd>
              <dd className="text-micro leading-snug text-ink-5">{figure.basis}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Funders: pledges" aside="Synthetic pledges">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm" data-funders>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["Funder", "Kind", "Pledged", "Bands", "DisCos", "Return asked", "Tenor", "Meters matched", "Placed", "Not placed"].map((head) => (
                  <th key={head} className={`${cell} font-medium`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.funders.map((row) => (
                <tr key={row.id} className="border-b border-line/60 align-top text-ink-2" data-funder={row.id}>
                  <td className={`${cell} font-semibold text-ink`}>{row.funder}</td>
                  <td className={cell}>{row.kind}</td>
                  <td className={`${cell} font-semibold text-ink`}>{row.pledged}</td>
                  <td className={cell}>{row.bands}</td>
                  <td className={`${cell} max-w-[14rem]`}>{row.discos}</td>
                  <td className={cell}>{row.returnAsked}</td>
                  <td className={cell}>{row.tenor}</td>
                  <td className={`${cell} font-semibold text-ink`}>{row.matchedMeters}</td>
                  <td className={cell}>{row.placed}</td>
                  <td className={`${cell} ${row.hasQueued ? "font-semibold text-caution" : "text-ok"}`} data-queued={row.hasQueued ? "yes" : "no"}>
                    {row.queued}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Daily meter charge by band, into escrow" aside="Assumptions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[90rem] text-sm" data-band-charges>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["Band", "Meter", "Installed cost", "Typical bill a month", "Charge a day", "Charge a month", "Share of a typical bill", "Smallest recharge a month", "Months to repay", "Customer repays", "Top-up per meter", "Funded by"].map((head) => (
                  <th key={head} className={`${cell} font-medium`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.bands.map((row) => (
                <tr key={row.band} className="border-b border-line/60 align-top text-ink-2">
                  <td className={`${cell} font-semibold text-ink`}>{row.band}</td>
                  <td className={cell}>{row.meter}</td>
                  <td className={cell}>{row.meterCost}</td>
                  <td className={cell}>{row.typicalBill}</td>
                  <td className={`${cell} font-semibold text-ink`}>{row.perDay}</td>
                  <td className={cell}>{row.perMonth}</td>
                  <td className={`${cell} font-semibold text-ink`} data-share-of-bill>{row.shareOfBill}</td>
                  <td className={cell}>{row.minRecharge}</td>
                  <td className={`${cell} max-w-[20rem] font-semibold text-ink`}>{row.monthsToRepay}</td>
                  <td className={cell}>{row.customerRepays}</td>
                  <td className={cell}>{row.topUp}</td>
                  <td className={cell}>{row.fundedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.bandsHow}</How>
      </Panel>

      <Panel title="Matching: who funds which meters" aside="Calculated on synthetic records">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm" data-matching>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["Funder", "Band", "DisCos", "Meters", "Money placed"].map((head) => (
                  <th key={head} className={`${cell} font-medium`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.matching.map((row) => (
                <tr key={`${row.funder}-${row.band}`} className="border-b border-line/60 align-top text-ink-2">
                  <td className={`${cell} font-semibold text-ink`}>{row.funder}</td>
                  <td className={cell}>{row.band}</td>
                  <td className={cell}>{row.discos}</td>
                  <td className={`${cell} font-semibold text-ink`}>{row.meters}</td>
                  <td className={cell}>{row.money}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.matchingHow}</How>
      </Panel>

      <Panel title="Demand: approved meter applications by DisCo and band" aside="Synthetic applications">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm" data-demand>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["DisCo", ...view.demandBands, "Matched", "Waiting for a funder"].map((head) => (
                  <th key={head} className={`${cell} font-medium`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.demand.map((row) => (
                <tr key={row.disco} className="border-b border-line/60 text-ink-2" data-demand-row={row.disco}>
                  <td className={`${cell} font-semibold text-ink`}>{row.name}</td>
                  {row.approved.map((value, index) => (
                    <td key={view.demandBands[index]} className={cell}>
                      {value}
                    </td>
                  ))}
                  <td className={`${cell} font-semibold text-ink`}>{row.matched}</td>
                  <td className={cell}>{row.waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.demandHow}</How>
      </Panel>

      <Panel title="Assumptions">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {view.assumptions.map((one) => (
            <div key={one.label}>
              <dt className="text-caption text-ink-4">{one.label}</dt>
              <dd className="text-sm font-semibold text-ink">{one.value}</dd>
              <dd className="text-micro leading-snug text-ink-5">{one.basis}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Method">
        <p className="text-caption text-ink-4">
          A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer} Records from: {view.sourcing.sources.map((one) => one.name).join(", ")}.
        </p>
      </Panel>
    </div>
  );
}
