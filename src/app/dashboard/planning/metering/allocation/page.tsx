import { Allocation } from "@/components/planning/Allocation";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* DisCo allocation (docs/geh/DESIGN.md, section 4). The weights and the tranche travel in the
   address, so the page is rendered for each request. ?present=1 hides the navigation. */
export default async function AllocationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState("/dashboard/planning/metering/allocation", query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <Allocation view={await planning.allocation(query)} present={present} />
    </PresentFrame>
  );
}
