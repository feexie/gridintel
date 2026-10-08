import { Revenue } from "@/components/revenue/Revenue";
import { PreparingData } from "@/components/system/PreparingData";
import { revenue } from "@/composition/revenue";
import { preparing } from "../../screen";

// The same screen with every section of the valuation listed in full. A path of its own, not a query string: a page built ahead of time cannot read one.
export default async function RevenueAllPage() {
  if (await preparing()) return <PreparingData />;
  return <Revenue view={await revenue.view("all")} />;
}
