import { Panel } from "@/components/system/Metric";
import type { AllocationView } from "@/services/planning/views";
import { MeteringTabs } from "./MeteringTabs";

/* DisCo allocation (docs/geh/DESIGN.md, section 4): where the first million meters and the first
   private capital go, DisCo by DisCo, on NERC's published figures. It displays the view model; it
   calculates nothing. */

function How({ children }: { children: string }) {
  return <p className="max-w-4xl text-caption leading-snug text-ink-4" data-how>{children}</p>;
}

export function Allocation({ view }: { view: AllocationView }) {
  const heads = ["DisCo", "Customers", "Metered", "Unmetered", "Share of gap", "Metering rate", "Installed Q1", "Installed Q2", "To 100% at this pace", "Collection efficiency", "ATC&C (target)", "Need", "Repayment risk"];
  return (
    <div className="space-y-4" data-allocation>
      <MeteringTabs current="allocation" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">Plan · DisCo allocation · Nigeria, 11 DisCos, NERC figures at 30 June 2026</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{view.headline}</h1>
        <div className="mt-2">
          <How>{view.headlineHow}</How>
        </div>
      </header>

      <section className="rounded-panel border border-brand/40 bg-brand-soft px-4 py-3" data-first-million>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">Where should the first million meters go?</p>
        <p className="mt-1 text-lg font-semibold text-ink">{view.firstMillion}</p>
        <p className="mt-1 text-sm text-ink-2" data-rule>
          {view.rule}
        </p>
      </section>

      <Panel title="The 11 DisCos" aside="Reported by NERC; scores calculated">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm" data-discos>
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
                <tr key={row.id} className="border-b border-line/60 align-top text-ink-2" data-disco={row.id}>
                  <td className="py-1.5 pr-3 font-semibold text-ink">{row.name}</td>
                  <td className="py-1.5 pr-3">{row.customers}</td>
                  <td className="py-1.5 pr-3">{row.metered}</td>
                  <td className="py-1.5 pr-3">{row.unmetered}</td>
                  <td className="py-1.5 pr-3">{row.gapShare}</td>
                  <td className="py-1.5 pr-3">{row.meteringRate}</td>
                  <td className="py-1.5 pr-3">{row.installsQ1}</td>
                  <td className="py-1.5 pr-3">{row.installsQ2}</td>
                  <td className="py-1.5 pr-3">{row.monthsTo100}</td>
                  <td className="py-1.5 pr-3">{row.collection}</td>
                  <td className="py-1.5 pr-3">{row.atcc}</td>
                  <td className="py-1.5 pr-3 font-semibold text-ink">
                    {row.need}
                    {row.needMissing.length > 0 ? <span className="block text-micro font-normal text-ink-5">Without: {row.needMissing.join(", ")}</span> : null}
                  </td>
                  <td className="py-1.5 pr-3 font-semibold text-ink">
                    {row.risk}
                    {row.riskMissing.length > 0 ? <span className="block text-micro font-normal text-ink-5">Without: {row.riskMissing.join(", ")}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.scoresHow}</How>
      </Panel>

      <Panel title="The first million: recommended against pro-rata">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm" data-split>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["DisCo", "Today's pro-rata split", "Public meters (to need)", "Private capital (to low risk)", "Recommended", "Change"].map((head) => (
                  <th key={head} className="py-1.5 pr-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 text-ink-2" data-split-row={row.id}>
                  <td className="py-1.5 pr-3 font-semibold text-ink">{row.name}</td>
                  <td className="py-1.5 pr-3">{row.proRata}</td>
                  <td className="py-1.5 pr-3">{row.publicMeters}</td>
                  <td className="py-1.5 pr-3">{row.privateMeters}</td>
                  <td className="py-1.5 pr-3 font-semibold text-ink">{row.recommended}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${row.change.startsWith("+") ? "text-ok" : "text-ink-3"}`}>{row.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.splitHow}</How>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Pilot card" aside="A proposal">
          <p className="text-lg font-semibold text-ink" data-pilot>
            {view.pilot.sentence}
          </p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {view.pilot.figures.map((figure) => (
              <div key={figure.key}>
                <dt className="text-caption text-ink-4">{figure.label}</dt>
                <dd className="text-base font-semibold text-ink">{figure.value}</dd>
                <dd className="text-micro text-ink-5">{figure.basis}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-ink-4">{view.pilot.note}</p>
        </Panel>

        <Panel title="Weights and the tranche" aside="Change and recalculate">
          <form method="get" className="space-y-3 print:hidden" data-allocation-form>
            <label className="block text-sm">
              <span className="text-ink-2">Pilot DisCo</span>
              <select name="pilotDisco" defaultValue={view.discos.find((one) => one.current)?.id} className="mt-1 block rounded-tile border border-line-strong bg-panel px-2 py-1 text-ink">
                {view.discos.map((disco) => (
                  <option key={disco.id} value={disco.id}>
                    {disco.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              {view.inputs.map((input) => (
                <label key={input.key} className="block text-sm" data-allocation-input={input.key}>
                  <span className="text-ink-2">{input.label}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <input type="number" name={input.key} defaultValue={input.value} min={input.min} max={input.max} step={input.step} className={`w-32 rounded-tile border bg-panel px-2 py-1 text-ink ${input.value !== input.defaultValue ? "border-brand" : "border-line-strong"}`} />
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
        </Panel>
      </div>

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
        <p className="text-caption text-ink-4">
          A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer}
        </p>
      </Panel>
    </div>
  );
}
