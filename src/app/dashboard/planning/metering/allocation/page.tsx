import { Allocation } from "@/components/planning/Allocation";
import { planning } from "@/composition/planning";

/* DisCo allocation (docs/geh/DESIGN.md, section 4). The weights and the tranche travel in the
   address, so the page is rendered for each request. */
export default async function AllocationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Allocation view={await planning.allocation(await searchParams)} />;
}
