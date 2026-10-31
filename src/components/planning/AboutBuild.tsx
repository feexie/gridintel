import { Panel } from "@/components/system/Metric";
import type { AboutBuildView } from "@/services/planning/views";
import Link from "next/link";
import { METERING_REPORT_HREF, POSITIONING_LINE, STEP_SCOPES } from "@/constants/planning";
import { MeteringTabs } from "./MeteringTabs";

/* About this build (docs/geh/DESIGN.md, section 6a): what existed before the sprint and what was
   built during it, from the sprint changelog. It displays the view model. */
export function AboutBuild({ view }: { view: AboutBuildView }) {
  return (
    <div className="space-y-4" data-about-build>
      <MeteringTabs current="about" />
      <header className="gi-band rounded-panel border border-line px-4 py-5 sm:px-6" data-headline>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">About this build · Global Energy Hackathon, Brief 15</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          The Metering planner was built in the sprint: {view.rows.length} commits after the tag {view.baseline.tag}.
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Sprint: {view.sprint.window}. Branch <code className="font-mono">{view.sprint.branch}</code>.{" "}
          <a href={view.sprint.compareUrl} className="break-all text-link hover:underline" rel="noreferrer" data-compare-link>
            {view.sprint.compareUrl}
          </a>
        </p>
      </header>

      <Panel title="What the Metering planner covers" aside={POSITIONING_LINE}>
        <ul className="space-y-1 text-sm text-ink-2" data-steps>
          {STEP_SCOPES.map((one) => (
            <li key={one.step}>
              <span className="font-semibold uppercase tracking-wide text-brand">{one.step}</span>: {one.covers}
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-2" data-about-report>
          <Link href={METERING_REPORT_HREF} className="font-semibold text-link hover:underline">
            The Metering Plan report
          </Link>
          : the gap, Access, Affordability, Availability, the shocks, and the assumptions and sources, from the same services as the screens, ready to print or save as PDF.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Before the sprint" aside={`${view.baseline.tag}, ${view.baseline.commit}`}>
          <p className="text-caption text-ink-4">Tagged {view.baseline.time}, before the sprint began.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2" data-baseline>
            {view.baseline.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Panel>
        <div className="xl:col-span-2">
          <Panel title="Built during the sprint" aside="From the sprint changelog">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm" data-sprint-rows>
                <thead>
                  <tr className="border-b border-line-strong text-left text-caption text-ink-5">
                    <th className="py-1.5 pr-3 font-medium">Time (WAT)</th>
                    <th className="py-1.5 pr-3 font-medium">Commit</th>
                    <th className="py-1.5 pr-3 font-medium">What was built</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.commit} className="border-b border-line/60 align-top text-ink-2">
                      <td className="whitespace-nowrap py-1.5 pr-3">{row.time}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        <a href={row.commitUrl} className="text-link hover:underline" rel="noreferrer">
                          {row.commit}
                        </a>
                      </td>
                      <td className="py-1.5 pr-3">{row.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {view.unread > 0 ? <p className="text-caption text-caution">{view.unread} row(s) of the changelog could not be read.</p> : null}
            <p className="max-w-4xl text-caption leading-snug text-ink-4" data-how>
              {view.how}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
