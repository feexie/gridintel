import { Executive } from "@/components/executive/Executive";
import { PreparingData } from "@/components/system/PreparingData";
import { executive } from "@/composition/executive";
import { preparing } from "../screen";

export default async function ExecutiveDashboardPage() {
  if (await preparing()) return <PreparingData />;
  return <Executive view={await executive.view("top")} />;
}
