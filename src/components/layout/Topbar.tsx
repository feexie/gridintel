"use client";

import { useEffect, useState } from "react";
import Menu from "./Menu";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

/* The frame on a screen too narrow for the sidebar: one row with the name and the menu button.
   The menu opens over the page, so it takes none of the screen until it is asked for. */
export default function Topbar() {
  const [open, setOpen] = useState(false);

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
        <Wordmark />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="gi-menu"
          onClick={() => setOpen(!open)}
          data-menu-button
          className="gi-tap inline-flex items-center gap-2 rounded-tile border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-2"
        >
          <span aria-hidden className="text-base leading-none">
            {open ? "✕" : "☰"}
          </span>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <div id="gi-menu" className="absolute inset-x-0 z-[1100] max-h-[calc(100dvh-3.25rem)] overflow-y-auto border-b border-line bg-panel px-2 pb-4 pt-2 shadow-pop" data-menu>
          <Menu onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-line px-3 pt-3">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </header>
  );
}
