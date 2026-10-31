import Link from "next/link";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";
import { PLANNING_GROUPS, PLANNING_HOME, plannerHref, type Planner } from "@/constants/planning";

/* A planner that is not built. It says so first, says what it is for, and holds no data and no
   figure. */
export function PlannerPlanned({ planner }: { planner: Planner }) {
  const group = PLANNING_GROUPS.find((one) => one.id === planner.group)?.label ?? "Planning";
  return (
    <div className="space-y-4" data-planner-planned={planner.id}>
      <SectorBand eyebrow={`Planning · ${group}`} title={planner.label} aside={<PlannedTag>Planned · not built</PlannedTag>}>
        This planner is not built yet. There is no data and no figure on this page.
      </SectorBand>
      <Panel title="What it is for">
        <p className="max-w-3xl text-sm leading-snug text-ink-2">{planner.purpose}</p>
      </Panel>
      <p className="text-sm text-ink-3">
        <Link href={plannerHref("metering")} className="font-medium text-link hover:text-link-hover hover:underline">
          Metering, the planner built →
        </Link>{" "}
        <Link href={PLANNING_HOME} className="ml-2 font-medium text-link hover:text-link-hover hover:underline">
          All planners →
        </Link>
      </p>
    </div>
  );
}
