import Link from "next/link";
import { Panel } from "@/components/system/Metric";
import type { FigureOrigin, InvestmentView, InvestorView, MeteringFundView, ShownFigure, StructureView } from "@/services/planning/views";
import { BalanceChart, CashFlowChart, StackedBars } from "./FundCharts";
import { MeteringTabs } from "./MeteringTabs";

/* The Metering Fund screen (docs/geh/DESIGN.md, section 3). One finding at the top with its figure
   and how it is calculated; then the gap, the shocks, the charts, the bands, the years, the rules,
   and every assumption, each with its basis, in a form that recalculates. It displays the view
   model; it calculates nothing. */

const ORIGIN_WORD: Record<FigureOrigin, string> = {
  reported: "Reported",
  calculated: "Calculated",
  assumption: "Assumption",
  placeholder: "Placeholder",
  test_scenario: "Test scenario",
  synthetic: "Synthetic",
};

function Origin({ origin }: { origin: FigureOrigin }) {
  const tone = origin === "placeholder" ? "border-caution-line text-caution" : origin === "reported" ? "border-ok-line text-ok" : "border-line-bold text-ink-4";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-micro font-semibold uppercase tracking-wide ${tone}`}>{ORIGIN_WORD[origin]}</span>;
}

function How({ children }: { children: string }) {
  return <p className="max-w-3xl text-caption leading-snug text-ink-4" data-how>{children}</p>;
}

function Figures({ figures }: { figures: ShownFigure[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {figures.map((figure) => (
        <div key={figure.key} data-shown-figure={figure.key}>
          <dt className="flex items-center gap-2 text-caption text-ink-4">
            {figure.label} <Origin origin={figure.origin} />
          </dt>
          <dd className="text-base font-semibold text-ink">{figure.value}</dd>
          <dd className="text-micro leading-snug text-ink-5">{figure.basis}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MeteringFund({ view, present, query }: { view: MeteringFundView; present: boolean; query: Record<string, string> }) {
  const big = present ? "text-7xl sm:text-8xl" : "text-5xl sm:text-6xl";
  const presentHref = `?${new URLSearchParams({ ...query, present: present ? "0" : "1" })}`;
  return (
    <div className={`space-y-4 ${present ? "mx-auto max-w-6xl" : ""}`} data-metering-fund data-case={view.caseId}>
      {present ? null : <MeteringTabs current="fund" />}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3" data-positioning>
        <span className="font-semibold uppercase tracking-eyebrow text-brand">Plan → Fund → Monitor</span>
        <span className="max-w-4xl">{view.positioning}</span>
      </p>

      {/* The case, and the DisCo in the Nigeria case. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden" data-case-switch>
        <nav aria-label="Case" className="flex gap-1 rounded-tile border border-line bg-panel p-1">
          {view.cases.map((one) => (
            <Link key={one.id} href={one.href} aria-current={one.current ? "page" : undefined} className={`rounded-tile px-3 py-1.5 text-sm ${one.current ? "bg-brand-soft font-semibold text-ink" : "text-ink-3 hover:text-ink"}`}>
              {one.label}
            </Link>
          ))}
        </nav>
        {view.caseId === "nigeria" ? (
          <form method="get" className="flex items-center gap-2 text-sm" data-disco-form>
            <input type="hidden" name="case" value="nigeria" />
            <label htmlFor="disco" className="text-ink-4">
              DisCo
            </label>
            <select id="disco" name="disco" defaultValue={view.discos.find((one) => one.current)?.id} className="rounded-tile border border-line-strong bg-panel px-2 py-1 text-ink">
              {view.discos.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-tile border border-line-strong px-2 py-1 text-ink-2 hover:text-ink">
              Show
            </button>
          </form>
        ) : null}
        <Link href={presentHref} className="text-caption text-link hover:underline" data-present-link>
          {present ? "Leave presentation mode" : "Presentation mode"}
        </Link>
      </div>

      {/* The finding. */}
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">Planning · Metering Fund · {view.scope}</p>
        <h1 className={`mt-1 font-semibold tracking-tight text-ink ${present ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>{view.headline.sentence}</h1>
        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className={`${big} font-semibold leading-none tracking-tight ${view.headline.tone === "warning" ? "text-caution" : "text-ink"}`} data-figure="charge">
              {view.headline.figure}
            </p>
            <p className="mt-2 text-sm font-medium text-ink-2">{view.headline.figureLabel}</p>
          </div>
          <div className="max-w-xl space-y-1 text-sm text-ink-2">
            <p data-repayment>{view.repaymentLine}</p>
            <p data-cash-positive>{view.cashPositiveLine}</p>
          </div>
        </div>
        <div className="mt-3">
          <How>{view.headline.how}</How>
        </div>
      </header>

      {/* Brief 15's two impact measures. */}
      <section className="rounded-panel border border-line bg-panel px-4 py-4 sm:px-6" data-impact>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">Impact · Modelled</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div data-impact-figure="metered">
            <p className="text-sm font-medium text-ink-2">{view.impact.metered.label}</p>
            <p className="text-4xl font-semibold tracking-tight text-ink">{view.impact.metered.value}</p>
          </div>
          <div data-impact-figure="bills">
            <p className="text-sm font-medium text-ink-2">{view.impact.bills.label}</p>
            <p className="text-4xl font-semibold tracking-tight text-ink">{view.impact.bills.value}</p>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm" data-impact-years>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                <th className="py-1.5 pr-3 font-medium" />
                {view.impact.byYear.map((year) => (
                  <th key={year.year} className="py-1.5 pr-3 font-medium">
                    {year.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink-2">
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-3 text-caption text-ink-4">Metered at year end</td>
                {view.impact.byYear.map((year) => (
                  <td key={year.year} className="py-1.5 pr-3">
                    {year.meteredShare}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-caption text-ink-4">Estimated bills removed</td>
                {view.impact.byYear.map((year) => (
                  <td key={year.year} className="py-1.5 pr-3 font-semibold text-ink">
                    {year.billsRemoved}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <How>{view.impact.how}</How>
        </div>
      </section>

      {view.atCap ? (
        <section className="rounded-panel border border-caution-line/60 bg-caution-surface px-4 py-3" data-at-cap>
          <p className="text-sm font-semibold text-caution-ink">{view.atCap.sentence}</p>
          <p className="mt-1 text-caption leading-snug text-caution-ink/80">{view.atCap.how}</p>
        </section>
      ) : null}

      {view.structure ? <Structure structure={view.structure} /> : null}

      <Panel title="Initial investment against break-even" aside="Modelled">
        <div className="grid gap-6 xl:grid-cols-2" data-investment>
          <Investment investment={view.investment.fundAlone} />
          {view.investment.structure ? <Investment investment={view.investment.structure} /> : null}
        </div>
        <How>{view.investment.how}</How>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="The metering gap">
          <p className="text-lg font-semibold text-ink" data-gap-sentence>
            {view.gap.sentence}
          </p>
          <Figures figures={view.gap.figures} />
          <How>{view.gap.how}</How>
        </Panel>
        <Panel title="Cost of one meter, installed" aside="At the start">
          <p className="text-3xl font-semibold text-ink" data-figure="cost-per-meter">
            {view.costPerMeter.figure}
          </p>
          <Figures figures={view.costPerMeter.parts} />
          <How>{view.costPerMeter.how}</How>
        </Panel>
      </div>

      <Panel title="Fund balance">
        <BalanceChart {...view.charts.balance} />
        <How>{view.charts.balance.how}</How>
      </Panel>

      <Panel title="Shocks" aside="Each against the launch charge">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm" data-stress>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                <th className="py-1.5 pr-3 font-medium">Case</th>
                <th className="py-1.5 pr-3 font-medium">Is the fund solvent?</th>
                <th className="py-1.5 pr-3 font-medium">Charge needed</th>
                <th className="py-1.5 font-medium">Under the cap?</th>
              </tr>
            </thead>
            <tbody>
              {view.stress.map((row) => (
                <tr key={row.key} className="border-b border-line/60 align-top" data-stress-row={row.key}>
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-ink">{row.label}</p>
                    <p className="text-caption text-ink-4">{row.shock}</p>
                  </td>
                  <td className={`py-2 pr-3 font-semibold ${row.solvent ? "text-ok" : "text-alert"}`}>{row.solvent ? "Yes" : `No: short ${row.owedAtEnd}`}</td>
                  <td className="py-2 pr-3 text-ink-2">{row.chargeNeeded}</td>
                  <td className={`py-2 font-semibold ${row.underCap ? "text-ok" : "text-alert"}`}>{row.underCap ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.stressHow}</How>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Meters">
          <StackedBars id="meters" title={view.charts.meters.title} unit={view.charts.meters.unit} years={view.charts.meters.years} series={[view.charts.meters.fund, view.charts.meters.public]} />
        </Panel>
        <Panel title="Funding">
          <StackedBars id="sources" title={view.charts.sources.title} unit={view.charts.sources.unit} years={view.charts.sources.years} series={view.charts.sources.series} />
        </Panel>
      </div>

      <Panel title="The charge in each band" aside="Same charge for every customer">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm" data-bands>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                <th className="py-1.5 pr-3 font-medium">Band</th>
                <th className="py-1.5 pr-3 font-medium">Tariff (₦/kWh)</th>
                <th className="py-1.5 pr-3 font-medium">Consumption a month</th>
                <th className="py-1.5 pr-3 font-medium">Bill a month</th>
                <th className="py-1.5 pr-3 font-medium">Customers</th>
                <th className="py-1.5 pr-3 font-medium">Fund alone: charge as share of bill</th>
                <th className="py-1.5 font-medium">GridIntel structure: charge a month</th>
              </tr>
            </thead>
            <tbody>
              {view.bands.map((band) => (
                <tr key={band.band} className="border-b border-line/60" data-band={band.band}>
                  <td className="py-2 pr-3 font-semibold text-ink">
                    Band {band.band}
                    {band.typical ? <span className="ml-2 text-micro font-semibold uppercase tracking-wide text-brand">Typical</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-ink-2">
                    <span className="flex items-center gap-2">
                      {band.tariff} <Origin origin={band.tariffOrigin} />
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-ink-2">
                    <span className="flex items-center gap-2">
                      {band.consumption} <Origin origin="assumption" />
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-ink-2">{band.bill}</td>
                  <td className="py-2 pr-3 text-ink-2">
                    <span className="flex items-center gap-2">
                      {band.customerShare} <Origin origin="placeholder" />
                    </span>
                  </td>
                  <td className={`py-2 pr-3 font-semibold ${band.underCap === null ? "text-ink-4" : band.underCap ? "text-ok" : "text-alert"}`}>{band.chargeShareOfBill}</td>
                  <td className="py-2 font-semibold text-ink" data-structure-charge>
                    {view.structure?.bandCharges.find((one) => one.band === band.band)?.charge ?? "Not available"}
                  </td>
                </tr>
              ))}
              {view.structure ? (
                <tr className="border-b border-line/60" data-band="lifeline">
                  <td className="py-2 pr-3 font-semibold text-ink">Lifeline (R1)</td>
                  <td className="py-2 pr-3 text-ink-4" colSpan={4}>
                    Up to 50 kWh a month (NERC order). Exempt; public money covers them.
                  </td>
                  <td className="py-2 pr-3 text-ink-4">Exempt</td>
                  <td className="py-2 font-semibold text-ink">₦0</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <How>{view.bandsNote}</How>
        <details className="text-micro text-ink-5">
          <summary className="cursor-pointer">Where each tariff comes from</summary>
          <ul className="mt-1 space-y-0.5">
            {view.bands.map((band) => (
              <li key={band.band}>
                Band {band.band}: {band.tariffBasis}
              </li>
            ))}
          </ul>
        </details>
      </Panel>

      <Panel title="Year by year">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm" data-years>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["Year", "Metered at year end", "Fund meters", "PMI meters", "CAPEX", "Capital drawn", "Recoveries", "Net cash", "Owed to investors", "Estimated bills", "Estimated bills removed"].map((head) => (
                  <th key={head} className="py-1.5 pr-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.years.map((year) => (
                <tr key={year.year} className="border-b border-line/60 text-ink-2">
                  <td className="py-1.5 pr-3 font-semibold text-ink">{year.year}</td>
                  <td className="py-1.5 pr-3">{year.meteredShare}</td>
                  <td className="py-1.5 pr-3">{year.fundMeters}</td>
                  <td className="py-1.5 pr-3">{year.publicMeters}</td>
                  <td className="py-1.5 pr-3">{year.capex}</td>
                  <td className="py-1.5 pr-3">{year.capitalDrawn}</td>
                  <td className="py-1.5 pr-3">{year.recoveries}</td>
                  <td className="py-1.5 pr-3">{year.netCash}</td>
                  <td className="py-1.5 pr-3">{year.owed}</td>
                  <td className="py-1.5 pr-3">{year.estimatedBills}</td>
                  <td className="py-1.5 pr-3">{year.estimatedBillsRemoved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.yearsNote}</How>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Who pays">
          <p className="text-sm leading-snug text-ink-2" data-fairness-rule>
            {view.fairnessRule}
          </p>
          <p className="text-sm leading-snug text-ink-2" data-pmi-rule>
            {view.pmiRule}
          </p>
          <p className="text-sm leading-snug text-ink-2" data-mini-grids>
            {view.miniGrids}
          </p>
        </Panel>
        <Panel title="Where this model comes from">
          <p className="text-sm leading-snug text-ink-2" data-model-origin>
            {view.modelOrigin}
          </p>
          <p className="text-caption text-ink-4">
            A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer}
          </p>
        </Panel>
        <Panel title="Starting point">
          <Figures figures={view.startingPoint} />
        </Panel>
      </div>

      <Panel title="Other published figures" aside="Shown beside, not used">
        <Figures figures={view.references} />
      </Panel>

      {/* Every assumption, with its basis; the form recalculates through the page address. */}
      <Panel title="Assumptions" aside={<Link href={view.resetHref} className="text-link hover:underline">Reset to defaults</Link>}>
        <form method="get" className="space-y-4 print:hidden" data-assumptions>
          <input type="hidden" name="case" value={view.caseId} />
          {view.caseId === "nigeria" ? <input type="hidden" name="disco" value={view.discos.find((one) => one.current)?.id ?? "national"} /> : null}
          {present ? <input type="hidden" name="present" value="1" /> : null}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Mitigations</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {view.mitigations.map((mitigation) => (
                <label key={mitigation.key} className="flex items-start gap-2 rounded-tile border border-line px-3 py-2 text-sm">
                  <input type="checkbox" name={mitigation.key} value="1" defaultChecked={mitigation.on} className="mt-1" />
                  <span>
                    <span className="font-semibold text-ink">{mitigation.label}</span>
                    <span className="block text-caption text-ink-4">{mitigation.effect}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
            {view.assumptions.map((assumption) => (
              <label key={assumption.key} className="block text-sm" data-assumption={assumption.key}>
                <span className="flex items-center gap-2 text-ink-2">
                  {assumption.label} <Origin origin={assumption.origin} />
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    name={assumption.key}
                    defaultValue={assumption.value}
                    min={assumption.min}
                    max={assumption.max}
                    step={assumption.step}
                    className={`w-36 rounded-tile border bg-panel px-2 py-1 text-ink ${assumption.changed ? "border-brand" : "border-line-strong"}`}
                  />
                  <span className="text-caption text-ink-4">{assumption.unitLabel}</span>
                </span>
                <span className="mt-0.5 block text-micro leading-snug text-ink-5">{assumption.basis}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="rounded-tile bg-brand-strong px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90">
            Recalculate
          </button>
        </form>
      </Panel>

      <Panel title="Sources">
        <ol className="space-y-1.5 text-caption text-ink-3" data-citations>
          {view.citations.map((citation) => (
            <li key={citation.id}>
              <span className="font-medium text-ink-2">{citation.title}</span>
              {citation.published ? `, ${citation.published}` : ""}. {citation.standing === "primary" ? "Primary source" : "Secondary source"}
              {citation.locator ? `. ${citation.locator}` : ""}.{" "}
              {citation.url ? (
                <a href={citation.url} className="break-all text-link hover:underline" rel="noreferrer">
                  {citation.url}
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function InvestorColumn({ investor }: { investor: InvestorView }) {
  const rows: [string, string][] = [
    ["Repaid in full", investor.repaid ? "Yes" : "No"],
    ["Loss before the buffers", investor.loss],
    ["Taken by the first-loss layer", investor.absorbedByFirstLoss],
    ["Taken by the reserve account", investor.absorbedByReserve],
    ["Investors lose", investor.investorLoss],
    ["Investors' return (IRR), modelled", investor.irr],
    ["Payback, modelled", investor.payback],
  ];
  return (
    <div data-investor={investor.label}>
      <p className={`text-sm font-semibold ${investor.repaid ? "text-ok" : "text-alert"}`}>{investor.label}</p>
      <dl className="mt-1 space-y-0.5 text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-3 border-b border-line/50 py-0.5">
            <dt className="text-ink-4">{term}</dt>
            <dd className="text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* The GridIntel structure beside the fund alone (docs/geh/DESIGN.md, sections 3.7 to 3.9). */
function Structure({ structure }: { structure: StructureView }) {
  return (
    <section className="space-y-4" data-structure>
      <div className="grid gap-4 lg:grid-cols-2" data-headline-pair>
        <div className="rounded-panel border border-alert-line/60 bg-alert-surface px-4 py-4">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-alert">The customer alone</p>
          <p className="mt-1 text-xl font-semibold text-alert-ink" data-fund-alone>
            {structure.fundAlone}
          </p>
        </div>
        <div className={`rounded-panel border px-4 py-4 ${structure.tone === "ok" ? "border-ok-line/60 bg-panel" : "border-caution-line/60 bg-caution-surface"}`}>
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">The right split</p>
          <p className={`mt-1 text-xl font-semibold ${structure.tone === "ok" ? "text-ink" : "text-caution-ink"}`} data-structure-sentence>
            {structure.structure}
          </p>
          <p className="mt-2 text-caption text-ink-4">Survives {structure.survived} shocks.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="GridIntel structure" aside="Each part an assumption you can change below">
          <Figures figures={structure.figures} />
          <How>{structure.how}</How>
        </Panel>
        <Panel title="Investors, base case and all three shocks" aside="Modelled">
          <div className="grid gap-4 sm:grid-cols-2">
            <InvestorColumn investor={structure.investor.base} />
            <InvestorColumn investor={structure.investor.stressed} />
          </div>
          <ul className="space-y-1 text-caption text-ink-3" data-structure-shocks>
            {structure.shocks.map((shock) => (
              <li key={shock.key}>
                <span className={`font-semibold ${shock.survives ? "text-ok" : "text-alert"}`}>{shock.label}:</span> {shock.outcome}
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-ink" data-inflation-line>
            {structure.inflationLine}
          </p>
        </Panel>
        <Panel title="Customer receipt" aside="Illustrative">
          <div className="mx-auto max-w-xs rounded-tile border border-dashed border-line-bold bg-app px-4 py-3 font-mono text-sm text-ink-2" data-receipt>
            <p className="text-center text-caption uppercase tracking-wide text-ink-4">Token purchase · {structure.receipt.band}</p>
            <p className="mt-2 flex justify-between">
              <span>Meter charge paid:</span>
              <span className="font-semibold text-ink">{structure.receipt.charge}</span>
            </p>
            <p className="flex justify-between">
              <span>Months left:</span>
              <span className="font-semibold text-ink">{structure.receipt.monthsLeft}</span>
            </p>
          </div>
          <p className="text-caption leading-snug text-ink-4">{structure.receipt.note}</p>
        </Panel>
      </div>

      <Panel title="How investors are protected">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-protection>
          {structure.protection.map((item) => (
            <li key={item.title} className={`rounded-tile border px-3 py-2 ${item.requirement ? "border-dashed border-caution-line" : "border-line"}`}>
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 text-caption leading-snug text-ink-3">{item.text}</p>
              {item.requirement ? <p className="mt-1 text-micro font-semibold uppercase tracking-wide text-caution">Requirement, not yet in place</p> : null}
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

function Investment({ investment }: { investment: InvestmentView }) {
  return (
    <div className="space-y-3" data-investment-case={investment.label}>
      <p className="text-base font-semibold text-ink">{investment.label}</p>
      <Figures figures={investment.figures} />
      <CashFlowChart
        title={`${investment.label}: investors' cash back less cash in, month by month`}
        values={investment.cumulative}
        peakMonth={investment.peakMonth}
        breakEvenMonth={investment.breakEvenMonth}
        paybackMonth={investment.paybackMonth}
      />
    </div>
  );
}
