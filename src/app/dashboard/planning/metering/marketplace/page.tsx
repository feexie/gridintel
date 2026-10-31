import { Marketplace } from "@/components/planning/Marketplace";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* The Metering Marketplace (docs/geh/DESIGN.md, section 6c): funders' pledges matched to approved
   meter applications, all synthetic. ?present=1 hides the navigation. */
export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState("/dashboard/planning/metering/marketplace", query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <Marketplace view={await planning.marketplace()} />
    </PresentFrame>
  );
}
