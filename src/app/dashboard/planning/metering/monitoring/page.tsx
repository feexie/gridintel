import { Monitoring } from "@/components/planning/Monitoring";
import { PresentFrame, presentState } from "@/components/planning/PresentFrame";
import { planning } from "@/composition/planning";

/* Monitoring the metering programme (docs/geh/DESIGN.md, section 6). The quarter travels in the
   address. ?present=1 hides the navigation. */
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { present, toggleHref } = presentState("/dashboard/planning/metering/monitoring", query);
  return (
    <PresentFrame present={present} toggleHref={toggleHref}>
      <Monitoring view={await planning.monitoring(query)} present={present} />
    </PresentFrame>
  );
}
