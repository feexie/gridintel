import { MapWorkspace } from "@/components/map/MapWorkspace";
import { PreparingData } from "@/components/system/PreparingData";
import { spatial } from "@/composition/spatial";
import { preparing } from "../utility/screen";

/* The Map workspace. On the fixed demonstration dataset, for its one public viewer, it is built
   with the application. A screen for a logged-in viewer must be rendered per request (ADR 0014);
   `preparing` already waits for the request whenever the dataset is not fixed. */
export default async function MapPage() {
  if (await preparing()) return <PreparingData />;
  const { map, incidents } = await spatial.workspace();
  return <MapWorkspace map={map} incidents={incidents} />;
}
