import { Events } from "@/components/events/Events";
import { PreparingData } from "@/components/system/PreparingData";
import { events, isPreparing } from "@/composition/events";

// Rendered on request, from the result cache: a page built ahead of time could not say "preparing data".
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  if (isPreparing()) return <PreparingData />;
  return <Events view={await events.view()} />;
}
