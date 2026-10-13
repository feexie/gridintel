"use client";

import { usePathname } from "next/navigation";
import { sectorOf } from "@/constants/navigation";
import NavItem from "./NavItem";

/** The screens of the sector the reader is in: the same list in the sidebar and in the menu a phone opens. */
export default function Menu({ onNavigate }: { onNavigate?: () => void }) {
  const sector = sectorOf(usePathname());
  return (
    <nav aria-label="Main" data-sector-menu={sector.id}>
      <p className="mb-1 px-3 text-micro font-semibold uppercase tracking-title text-ink-5">{sector.title}</p>
      <div className="space-y-0.5">
        {sector.opening.map((item) => (
          <NavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
      {sector.workspaces.length > 0 ? (
        <div className="mt-2 space-y-0.5 border-t border-line pt-2" data-workspaces>
          {sector.workspaces.map((item) => (
            <NavItem key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
      {sector.planned ? <p className="mt-2 px-3 text-caption leading-snug text-ink-4">Not built yet. It will open with an Overview, a GIS Map and an AI Assistant, then its workspaces.</p> : null}
    </nav>
  );
}
