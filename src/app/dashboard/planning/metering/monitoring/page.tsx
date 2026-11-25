import { Monitoring } from "@/components/planning/Monitoring";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";
import { hrefOf } from "@/constants/views";

/* Monitoring the metering programme (docs/geh/DESIGN.md, section 6). The quarter travels in the
   address. ?present=1 hides the navigation. */
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState(hrefOf("oversight.monitoring"), query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <Monitoring view={await planning.monitoring(query)} present={present} />
    </PresentFrame>
  );
}
