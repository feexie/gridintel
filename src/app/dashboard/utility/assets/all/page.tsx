import { Assets } from "@/components/assets/Assets";
import { PreparingData } from "@/components/system/PreparingData";
import { assets } from "@/composition/assets";
import { preparing } from "../../screen";

// The same screen with every distribution transformer listed in full. A path of its own, not a query string: a page built ahead of time cannot read one.
export default async function AssetsAllPage() {
  if (await preparing()) return <PreparingData />;
  return <Assets view={await assets.view("all")} />;
}
