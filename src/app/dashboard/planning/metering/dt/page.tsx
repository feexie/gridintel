import { DtSequencing } from "@/components/planning/DtSequencing";
import { planning } from "@/composition/planning";

/* DT sequencing inside one DisCo (docs/geh/DESIGN.md, section 5), on the synthetic network. The
   recovery shares and the budget travel in the address, so the page is rendered for each request. */
export default async function DtSequencingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DtSequencing view={await planning.dtSequencing(await searchParams)} />;
}
