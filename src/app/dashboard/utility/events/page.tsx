import { Events } from "@/components/events/Events";
import { PreparingData } from "@/components/system/PreparingData";
import { events } from "@/composition/events";
import { preparing } from "../screen";

export default async function EventsPage() {
  if (await preparing()) return <PreparingData />;
  return <Events view={await events.view()} />;
}
