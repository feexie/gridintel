import Link from "next/link";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";
import { PLANNERS, PLANNING_GROUPS, plannerHref } from "@/constants/planning";

/* Planning's Overview: the planners in two groups, by who is planning. Metering is built; every
   other planner is marked planned and leads to a page that holds no figure. */
export function PlanningOverview() {
  return (
    <div className="space-y-4" data-planning-overview>
      <SectorBand eyebrow="Planning" title="Overview">
        Metering is the first planner built. The others are planned and show no figures yet.
      </SectorBand>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLANNING_GROUPS.map((group) => (
          <Panel key={group.id} title={group.label}>
            <ul className="space-y-2" data-planning-group={group.id}>
              {PLANNERS.filter((planner) => planner.group === group.id).map((planner) => (
                <li key={planner.id} className={`rounded-tile border px-3 py-2 ${planner.planned ? "border-dashed border-line-strong" : "border-line bg-brand-soft"}`} data-planner={planner.id}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <Link href={plannerHref(planner.id)} className={planner.planned ? "text-ink-3 hover:text-ink hover:underline" : "text-ink hover:underline"}>
                      {planner.label}
                    </Link>
                    {planner.planned ? <PlannedTag /> : <span className="text-micro font-semibold uppercase tracking-wide text-brand">Built</span>}
                  </p>
                  <p className="mt-0.5 text-caption leading-snug text-ink-4">{planner.purpose}</p>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
