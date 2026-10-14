"use client";

import { usePathname } from "next/navigation";
import { sectorOf, type Sector } from "@/constants/navigation";
import Menu from "./Menu";

/** Down the side on a desktop: the screens of the sector chosen in the row above. The Platform has one screen, so it has no sidebar and its page takes the full width. */
export default function Sidebar({ navigation }: { navigation: Sector[] }) {
  const sector = sectorOf(usePathname(), navigation);
  if (sector === undefined || sector.id === "platform") return null;
  return (
    <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-panel px-3 py-4 lg:block">
      <Menu navigation={navigation} />
    </aside>
  );
}
