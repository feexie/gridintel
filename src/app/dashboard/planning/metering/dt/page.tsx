import { DtSequencing } from "@/components/planning/DtSequencing";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* DT sequencing inside one DisCo (docs/geh/DESIGN.md, section 5), on the synthetic network. The
   recovery shares and the budget travel in the address, so the page is rendered for each request.
   ?present=1 hides the navigation. */
export default async function DtSequencingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState("/dashboard/planning/metering/dt", query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <DtSequencing view={await planning.dtSequencing(query)} present={present} />
    </PresentFrame>
  );
}
