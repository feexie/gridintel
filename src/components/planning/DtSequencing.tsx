import { Panel } from "@/components/system/Metric";
import type { DtSequencingView, PlanningInputView } from "@/services/planning/views";
import { BalanceChart } from "./FundCharts";
import { MeteringTabs } from "./MeteringTabs";

/* DT sequencing inside one DisCo (docs/geh/DESIGN.md, section 5), on the synthetic network. It
   displays the view model; it calculates nothing. */

function How({ children }: { children: string }) {
  return <p className="max-w-4xl text-caption leading-snug text-ink-4" data-how>{children}</p>;
}

export function Synthetic() {
  return <span className="inline-flex shrink-0 items-center rounded-full border border-caution-line px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-caution">Synthetic</span>;
}

export function InputsForm({ inputs, name }: { inputs: PlanningInputView[]; name: string }) {
  return (
    <form method="get" className="space-y-3 print:hidden" data-planning-form={name}>
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {inputs.map((input) => (
          <label key={input.key} className="block text-sm" data-planning-input={input.key}>
            <span className="text-ink-2">{input.label}</span>
            <span className="mt-1 flex items-center gap-2">
              <input type="number" name={input.key} defaultValue={input.value} min={input.min} max={input.max} step={input.step} className={`w-36 rounded-tile border bg-panel px-2 py-1 text-ink ${input.value !== input.defaultValue ? "border-brand" : "border-line-strong"}`} />
              <span className="text-caption text-ink-4">{input.unit}</span>
            </span>
            <span className="mt-0.5 block text-micro leading-snug text-ink-5">{input.basis}</span>
          </label>
        ))}
      </div>
      <button type="submit" className="rounded-tile bg-brand-strong px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90">
        Recalculate
      </button>
    </form>
  );
}

export function DtSequencing({ view }: { view: DtSequencingView }) {
  const heads = ["Rank", "DT", "Feeder", "Connections", "Unmetered", "Estimated billing a month", "Commercial loss a month", "ATC&C", "CAPEX", "Recovered a year", "Per ₦1 of CAPEX"];
  return (
    <div className="space-y-4" data-dt-sequencing>
      <MeteringTabs current="dt" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="flex flex-wrap items-center gap-2 text-micro font-semibold uppercase tracking-eyebrow text-brand">
          Plan · DT sequencing · {view.network} <Synthetic />
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{view.headline}</h1>
        <p className="mt-2 max-w-4xl text-sm text-ink-2" data-revolving-line>
          {view.revolvingLine}
        </p>
        <div className="mt-2">
          <How>{view.headlineHow}</How>
        </div>
      </header>

      <section className="rounded-panel border border-brand/40 bg-brand-soft px-4 py-3" data-rule>
        <p className="text-sm text-ink-2">{view.fairness}</p>
      </section>

      <Panel title="Revolving effect" aside="Synthetic network; calculated">
        <BalanceChart id="revolving" title={view.chart.title} unit={view.chart.unit} months={view.chart.months} base={view.chart.base} stressed={view.chart.stressed} />
        <How>{view.chart.how}</How>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          {view.figures.map((figure) => (
            <div key={figure.key} data-shown-figure={figure.key}>
              <dt className="flex items-center gap-2 text-caption text-ink-4">
                {figure.label} {figure.origin === "synthetic" ? <Synthetic /> : null}
              </dt>
              <dd className="text-base font-semibold text-ink">{figure.value}</dd>
              <dd className="text-micro leading-snug text-ink-5">{figure.basis}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Every DT, ranked" aside="Synthetic records; ranking calculated">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-sm" data-dts>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {heads.map((head) => (
                  <th key={head} className="py-1.5 pr-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 align-top text-ink-2" data-dt={row.id}>
                  <td className="py-1.5 pr-3 font-semibold text-ink">{row.rank}</td>
                  <td className="py-1.5 pr-3 font-semibold text-ink">{row.name}</td>
                  <td className="py-1.5 pr-3">{row.feeder}</td>
                  <td className="py-1.5 pr-3">{row.connections}</td>
                  <td className="py-1.5 pr-3">{row.unmetered}</td>
                  <td className="py-1.5 pr-3">{row.estimatedBilling}</td>
                  <td className="py-1.5 pr-3">{row.loss}</td>
                  <td className="py-1.5 pr-3">{row.atcc}</td>
                  <td className="py-1.5 pr-3">{row.capex}</td>
                  <td className="py-1.5 pr-3">{row.recovered}</td>
                  <td className="py-1.5 pr-3 font-semibold text-ink">
                    {row.perNaira}
                    {row.missing.length > 0 ? <span className="block text-micro font-normal text-ink-5">Without: {row.missing.join(", ")}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.rowsHow}</How>
      </Panel>

      <Panel title="Recovery shares and the budget" aside="Change and recalculate">
        <InputsForm inputs={view.inputs} name="dt" />
      </Panel>

      <Panel title="Method">
        <p className="text-caption text-ink-4">
          A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer} Records from: {view.sourcing.sources.map((one) => one.name).join(", ") || "none"}.
        </p>
      </Panel>
    </div>
  );
}
