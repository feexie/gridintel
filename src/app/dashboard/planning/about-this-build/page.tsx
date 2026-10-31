import { AboutBuild } from "@/components/planning/AboutBuild";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* About this build (docs/geh/DESIGN.md, section 6a): read from the sprint changelog. ?present=1
   hides the navigation. */
export default async function AboutThisBuildPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { present, toggleHref } = presentState("/dashboard/planning/about-this-build", await searchParams);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <AboutBuild view={await planning.aboutBuild()} />
    </PresentFrame>
  );
}
