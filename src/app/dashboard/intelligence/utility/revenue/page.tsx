import { Revenue } from "@/components/revenue/Revenue";
import { PreparingData } from "@/components/system/PreparingData";
import { revenue } from "@/composition/revenue";
import { preparing } from "@/app/dashboard/screen";

export default async function RevenuePage() {
  if (await preparing()) return <PreparingData />;
  return <Revenue view={await revenue.view("top")} />;
}
