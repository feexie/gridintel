import { Assets } from "@/components/assets/Assets";
import { PreparingData } from "@/components/system/PreparingData";
import { assets } from "@/composition/assets";
import { preparing } from "../screen";

export default async function AssetsPage() {
  if (await preparing()) return <PreparingData />;
  return <Assets view={await assets.view("top")} />;
}
