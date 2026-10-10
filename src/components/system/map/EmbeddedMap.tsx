import Link from "next/link";
import type { MapView } from "@/services/spatial/views";
import { Panel } from "@/components/system/Metric";
import { NetworkMap } from "./NetworkMap";

/** The shared map inside another screen: the same component, smaller, on the part of the network that screen is about. */
export function EmbeddedMap({ view, title = "On the map", select }: { view: MapView; title?: string; select?: string }) {
  return (
    <Panel
      title={title}
      aside={
        <Link href="/dashboard/map" className="text-link hover:text-link-hover hover:underline">
          Open the Map workspace ▸
        </Link>
      }
    >
      <NetworkMap view={view} compact select={select} />
    </Panel>
  );
}
