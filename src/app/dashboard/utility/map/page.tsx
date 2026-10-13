import { MapWorkspace } from "@/components/map/MapWorkspace";
import { PreparingData } from "@/components/system/PreparingData";
import { spatial } from "@/composition/spatial";
import { preparing } from "../screen";

/* The Utility GIS Map: the shared map with the Utility sector's layers. On the fixed
   demonstration dataset, for its one public viewer, it is built with the application. A screen
   for a logged-in viewer must be rendered per request (ADR 0014); `preparing` already waits for
   the request whenever the dataset is not fixed. */
export default async function UtilityMapPage() {
  if (await preparing()) return <PreparingData />;
  const { map, incidents, open } = await spatial.sector("utility");
  return <MapWorkspace sector="Utility Intelligence" lead="Where the network is, what is wrong on it now and where the losses are." map={map} incidents={incidents} open={open} />;
}
