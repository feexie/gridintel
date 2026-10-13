"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/constants/navigation";

export default function NavItem({ item, onNavigate }: { item: NavigationItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      data-planned={item.planned ? "" : undefined}
      className={[
        "gi-tap flex items-center justify-between gap-2 rounded-tile px-3 py-1.5 text-sm transition-colors",
        isActive ? "bg-brand-soft font-semibold text-ink" : item.planned ? "text-ink-4 hover:bg-well/40 hover:text-ink-2" : "font-medium text-ink-3 hover:bg-well/40 hover:text-ink",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className={`h-4 w-0.5 rounded-full ${isActive ? "bg-brand" : "bg-transparent"}`} />
        {item.label}
      </span>
      {/* Said in a word, not by the paler text alone. */}
      {item.planned ? <span className="rounded-full border border-dashed border-line-bold px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-4">Planned</span> : null}
    </Link>
  );
}
