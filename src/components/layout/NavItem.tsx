"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/constants/navigation";

export default function NavItem({ item }: { item: NavigationItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={[
        "block border-l-2 px-3 py-1.5 text-sm font-medium transition-colors",
        isActive ? "border-link bg-well/60 text-ink" : "border-transparent text-ink-3 hover:border-line-bold hover:text-ink",
      ].join(" ")}
    >
      {item.label}
    </Link>
  );
}
