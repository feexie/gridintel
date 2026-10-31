import Link from "next/link";
import { Panel } from "@/components/system/Metric";
import type { JourneyView } from "@/services/planning/views";
import { Synthetic } from "./DtSequencing";
import { MeteringTabs } from "./MeteringTabs";

/* One meter's journey (docs/geh/DESIGN.md, section 6d): one synthetic household from application
   to the funder repaid, as a timeline. Each step names who acts and links to the screen that shows
   it. It displays the view model; it calculates nothing. */

function How({ children }: { children: string }) {
  return (
    <p className="max-w-5xl text-caption leading-snug text-ink-4" data-how>
      {children}
    </p>
  );
}

export function Journey({ view, present = false }: { view: JourneyView; present?: boolean }) {
  return (
    <div className="space-y-4" data-journey>
      <MeteringTabs current="journey" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="flex flex-wrap items-center gap-2 text-micro font-semibold uppercase tracking-eyebrow text-brand">
          One meter&apos;s journey <Synthetic />
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{view.headline}</h1>
        <div className="mt-2">
          <How>{view.headlineHow}</How>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" data-household>
          {view.household.map((one) => (
            <div key={one.label} className="flex gap-1.5">
              <dt className="text-ink-4">{one.label}</dt>
              <dd className="font-semibold text-ink">{one.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Panel title="Step by step" aside="Synthetic household">
        <ol className="relative space-y-5 border-l-2 border-line-strong pl-6" data-steps-timeline>
          {view.steps.map((step, index) => (
            <li key={step.key} className="relative" data-step={step.key}>
              <span className="absolute -left-[2.15rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand bg-panel text-caption font-semibold text-brand" aria-hidden="true">
                {index + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold text-ink">{step.title}</h2>
                <span className="text-caption text-ink-4">{step.date}</span>
              </div>
              <p className="mt-1 flex flex-wrap gap-1.5" data-who>
                {step.who.map((who) => (
                  <span key={who} className="rounded-full border border-line px-2 py-px text-micro font-semibold uppercase tracking-wide text-ink-3">
                    {who}
                  </span>
                ))}
              </p>
              <p className="mt-1.5 max-w-4xl text-sm text-ink-2">{step.what}</p>
              {step.figures.length > 0 ? (
                <dl className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {step.figures.map((figure) => (
                    <div key={figure.label} className="flex gap-1.5">
                      <dt className="text-ink-4">{figure.label}</dt>
                      <dd className="font-semibold text-ink">{figure.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <Link href={present ? `${step.link.href}?present=1` : step.link.href} className="mt-1.5 inline-block text-caption font-semibold text-link hover:underline" data-step-link>
                {step.link.label} →
              </Link>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Repaying: balance falling, month by month" aside="Calculated; household synthetic">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm" data-schedule>
            <thead>
              <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                {["Month", "", "Into escrow", "Balance"].map((head, index) => (
                  <th key={`${head}-${index}`} className="py-1.5 pr-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.schedule.map((row) => (
                <tr key={row.month} className="border-b border-line/60 text-ink-2">
                  <td className="py-1 pr-3">{row.month}</td>
                  <td className="py-1 pr-3">{row.label}</td>
                  <td className="py-1 pr-3">{row.paid}</td>
                  <td className={`py-1 pr-3 font-semibold ${row.repaid ? "text-ok" : "text-ink"}`}>{row.repaid ? "Repaid: funder paid back" : row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <How>{view.scheduleHow}</How>
      </Panel>

      <Panel title="Method">
        <p className="text-caption text-ink-4">
          A transparent, deterministic method: {view.methodology.id} {view.methodology.version}. {view.methodology.disclaimer} Records from: {view.sourcing.sources.map((one) => one.name).join(", ")}.
        </p>
      </Panel>
    </div>
  );
}
