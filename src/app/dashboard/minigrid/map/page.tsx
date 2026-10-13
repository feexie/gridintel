import { MapWorkspace } from "@/components/map/MapWorkspace";
import { PreparingData } from "@/components/system/PreparingData";
import { spatial } from "@/composition/spatial";
import { preparing } from "../../utility/screen";

/* The Mini-grid GIS Map: the shared map with the Mini-grid sector's layers (ADR 0017). */
export default async function MinigridMapPage() {
  if (await preparing()) return <PreparingData />;
  const { map, incidents, open } = await spatial.sector("minigrid");
  return <MapWorkspace sector="Mini-grid Intelligence" lead="Where the sites are, and how each one stands. Select a site for its key figures." map={map} incidents={incidents} open={open} />;
}
