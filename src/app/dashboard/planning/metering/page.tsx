import { MeteringFund } from "@/components/planning/MeteringFund";
import { PresentMode } from "@/components/planning/PresentMode";
import { planning } from "@/composition/planning";

/* The Metering Fund (docs/geh/DESIGN.md, section 3). The assumptions travel in the address, so
   the page is rendered for each request. ?present=1 hides the navigation and enlarges the finding. */
export default async function MeteringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const view = await planning.meteringFund(query);
  const present = query.present === "1";
  const kept = Object.fromEntries(Object.entries(query).flatMap(([key, value]) => (key === "present" || value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]])));
  return (
    <>
      {present ? <PresentMode /> : null}
      <MeteringFund view={view} present={present} query={kept} />
    </>
  );
}
