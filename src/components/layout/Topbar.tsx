"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { sectorOf, type Sector } from "@/constants/navigation";
import Menu from "./Menu";
import SectorSwitcher from "./SectorSwitcher";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

/* The frame on a screen too narrow for the sidebar: one row with the name and the menu button,
   which names the sector the reader is in. The menu opens over the page, so it takes none of the
   screen until it is asked for: the sectors first, then the screens of this one. Both hold only
   what the viewer may open. */
export default function Topbar({ navigation, home }: { navigation: Sector[]; home: string | null }) {
  const [open, setOpen] = useState(false);
  const sector = sectorOf(usePathname(), navigation);
  const label = sector?.label ?? "Menu";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="border-b border-line bg-panel lg:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <Wordmark href={home} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="gi-menu"
          aria-label={open ? "Close the menu" : `Menu: ${label}`}
          onClick={() => setOpen(!open)}
          data-menu-button
          className="gi-tap inline-flex items-center gap-2 rounded-tile border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-2"
        >
          <span aria-hidden className="text-base leading-none">
            {open ? "✕" : "☰"}
          </span>
          {open ? "Close" : <span data-menu-sector>{label}</span>}
        </button>
      </div>
      {open ? (
        <div id="gi-menu" className="absolute inset-x-0 z-[1100] max-h-[calc(100dvh-3.25rem)] overflow-y-auto border-b border-line bg-panel px-2 pb-4 pt-2 shadow-pop" data-menu>
          <div className="mb-3 border-b border-line px-1 pb-3">
            <SectorSwitcher navigation={navigation} wrap onNavigate={() => setOpen(false)} />
          </div>
          <Menu navigation={navigation} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-line px-3 pt-3">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </header>
  );
}
