import { AboutBuild } from "@/components/planning/AboutBuild";
import { planning } from "@/composition/planning";

/* About this build (docs/geh/DESIGN.md, section 6a): read from the sprint changelog. */
export default async function AboutThisBuildPage() {
  return <AboutBuild view={await planning.aboutBuild()} />;
}
