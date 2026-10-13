import Link from "next/link";
import type { MapView } from "@/services/spatial/views";
import { Panel } from "@/components/system/Metric";
import { NetworkMap } from "./NetworkMap";

const SECTOR_MAP = {
  utility: { href: "/dashboard/utility/map", label: "Open the Utility GIS Map" },
  minigrid: { href: "/dashboard/minigrid/map", label: "Open the Mini-grid GIS Map" },
};

/** The shared map inside another screen: the same component, smaller, on the part of the network that screen is about. */
export function EmbeddedMap({
  view,
  title = "On the map",
  select,
  sector = "utility",
}: {
  view: MapView;
  title?: string;
  select?: string;
  /** Whose GIS Map the link leads to; null for a map that belongs to no one sector. */
  sector?: keyof typeof SECTOR_MAP | null;
}) {
  return (
    <Panel
      title={title}
      aside={
        sector === null ? (
          "Select a mark for its figures and a link into its sector"
        ) : (
          <Link href={SECTOR_MAP[sector].href} className="text-link hover:text-link-hover hover:underline">
            {SECTOR_MAP[sector].label} ▸
          </Link>
        )
      }
    >
      <NetworkMap view={view} compact select={select} />
    </Panel>
  );
}
