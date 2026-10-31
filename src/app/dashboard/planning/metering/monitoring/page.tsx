import { Monitoring } from "@/components/planning/Monitoring";
import { planning } from "@/composition/planning";

/* Monitoring the metering programme (docs/geh/DESIGN.md, section 6). The quarter travels in the
   address. */
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Monitoring view={await planning.monitoring(await searchParams)} />;
}
