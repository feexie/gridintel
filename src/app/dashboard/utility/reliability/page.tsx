import { Reliability } from "@/components/reliability/Reliability";
import { PreparingData } from "@/components/system/PreparingData";
import { reliability } from "@/composition/reliability";
import { preparing } from "../screen";

export default async function ReliabilityPage() {
  if (await preparing()) return <PreparingData />;
  return <Reliability view={await reliability.view()} />;
}
