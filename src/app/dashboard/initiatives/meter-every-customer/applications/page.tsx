import { ViewPlanned } from "@/components/workspace/DashboardPages";
import { viewOf } from "@/constants/views";

/* A planned view (NAV-B step 6): what it will answer, and no figure. */
export default function PlannedPage() {
  const view = viewOf("initiative.applications");
  return <ViewPlanned label={view.label} question={view.question} />;
}
