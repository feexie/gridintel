import { PlatformOverview } from "@/components/overview/PlatformOverview";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { overview } from "@/composition/overview";
import { spatial } from "@/composition/spatial";
import { preparing } from "./utility/screen";

/* The Platform Overview: where a visitor lands. Built with the application on the fixed
   demonstration dataset; rendered on each request for any other (ADR 0012). */
export default async function DashboardPage() {
  if (await preparing()) return <PreparingData />;
  return <PlatformOverview view={await overview.platform()} map={<EmbeddedMap view={await spatial.platform()} title="Every sector on one map" sector={null} />} />;
}
