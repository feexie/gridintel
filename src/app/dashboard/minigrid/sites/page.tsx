import { MinigridPortfolio } from "@/components/minigrid/Portfolio";
import { ReferenceSites } from "@/components/minigrid/Reference";
import { PreparingData } from "@/components/system/PreparingData";
import { EmbeddedMap } from "@/components/system/map/EmbeddedMap";
import { minigrid } from "@/composition/minigrid";
import { reference } from "@/composition/reference";
import { spatial } from "@/composition/spatial";
import { preparing } from "../../utility/screen";

/* The Sites workspace: the sites side by side, then the reference sites (published data from
   other operators, never part of the portfolio). Built with the application on the fixed
   demonstration dataset; rendered on each request for any other (ADR 0012). */
export default async function MinigridSitesPage() {
  if (await preparing()) return <PreparingData />;
  return (
    <div className="space-y-4">
      <MinigridPortfolio view={await minigrid.portfolioView()} />
      <ReferenceSites view={await reference.sitesView()} />
      <EmbeddedMap view={await spatial.sites()} title="The sites on the map" sector="minigrid" />
    </div>
  );
}
