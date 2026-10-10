import { Events } from "@/components/events/Events";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { spatial } from "@/composition/spatial";
import { events } from "@/composition/events";
import { preparing } from "../screen";

export default async function EventsPage() {
  if (await preparing()) return <PreparingData />;
  return <Events view={await events.view()} map={<EmbeddedMap view={await spatial.embedded()} title="Where it is" />} />;
}
