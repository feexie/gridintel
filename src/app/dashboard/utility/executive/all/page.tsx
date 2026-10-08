import { Executive } from "@/components/executive/Executive";
import { PreparingData } from "@/components/system/PreparingData";
import { executive } from "@/composition/executive";
import { preparing } from "../../screen";

// The same screen with every feeder listed in full. A path of its own, not a query string: a page built ahead of time cannot read one.
export default async function ExecutiveDashboardAllPage() {
  if (await preparing()) return <PreparingData />;
  return <Executive view={await executive.view("all")} />;
}
