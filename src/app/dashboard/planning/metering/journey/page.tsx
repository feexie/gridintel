import { Journey } from "@/components/planning/Journey";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* One meter's journey (docs/geh/DESIGN.md, section 6d): one synthetic household from application
   to the funder repaid. ?present=1 hides the navigation. */
export default async function JourneyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState("/dashboard/planning/metering/journey", query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <Journey view={await planning.journey()} present={present} />
    </PresentFrame>
  );
}
