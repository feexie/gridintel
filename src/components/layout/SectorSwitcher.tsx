"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectorOf, type Sector } from "@/constants/navigation";

/* The row of sectors the viewer may open. Choosing one opens its Overview (or the first of its
   screens the viewer may open) and puts its screens in the menu. A sector that is not built is
   marked so in a word, not by paler text alone. */
export default function SectorSwitcher({ navigation, onNavigate, wrap = false }: { navigation: Sector[]; onNavigate?: () => void; wrap?: boolean }) {
  const current = sectorOf(usePathname(), navigation);
  return (
    <nav aria-label="Sectors" data-sectors>
      <ul className={`flex gap-1 ${wrap ? "flex-wrap" : "rounded-panel border border-line bg-app p-1"}`}>
        {navigation.map((sector) => {
          const isCurrent = sector.id === current?.id;
          return (
            <li key={sector.id}>
              <Link
                href={sector.home}
                onClick={onNavigate}
                aria-current={isCurrent ? "true" : undefined}
                data-planned={sector.planned ? "" : undefined}
                className={[
                  "gi-tap flex items-center gap-1.5 rounded-tile px-3 py-1.5 text-sm transition-colors",
                  wrap ? "border border-line" : "",
                  isCurrent ? "bg-brand-soft font-semibold text-ink" : sector.planned ? "text-ink-4 hover:bg-well/40 hover:text-ink-2" : "font-medium text-ink-3 hover:bg-well/40 hover:text-ink",
                ].join(" ")}
              >
                {sector.label}
                {sector.planned ? <span className="rounded-full border border-dashed border-line-bold px-1.5 py-px text-nano font-medium uppercase tracking-wide text-ink-4">Planned</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
