import { notFound } from "next/navigation";
import { PlannerPlanned } from "@/components/planning/PlannerPlanned";
import { PLANNERS, plannerOf } from "@/constants/planning";

/* A planner that is not built: one page each, with its purpose and no figure. Metering has its own
   pages; any other address is not found. */
export function generateStaticParams() {
  return PLANNERS.filter((planner) => planner.planned).map((planner) => ({ planner: planner.id }));
}

export default async function PlannerPage({ params }: { params: Promise<{ planner: string }> }) {
  const planner = plannerOf((await params).planner);
  if (planner === undefined || !planner.planned) notFound();
  return <PlannerPlanned planner={planner} />;
}
