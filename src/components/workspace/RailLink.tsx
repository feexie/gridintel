"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* One item of a workspace's rail, marked as the current page when the address is in it. */
export default function RailLink({ href, exact, title, item, children }: { href: string; exact: boolean; title: string; item: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href || pathname.startsWith(`${href}/initiatives/`) : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "page" : undefined}
      data-rail-item={item}
      className={`block whitespace-nowrap rounded-tile px-3 py-1.5 text-sm ${active ? "bg-brand-strong/10 font-semibold text-ink" : "text-ink-2 hover:bg-line/60"}`}
    >
      {children}
    </Link>
  );
}
