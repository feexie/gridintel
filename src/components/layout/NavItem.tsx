"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/constants/navigation";

type NavItemProps = {
  item: NavigationItem;
};

export default function NavItem({ item }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={[
        "group flex items-start gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
        isActive
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-50"
          : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
    >
      <span
        className={[
          "mt-1 h-2.5 w-2.5 rounded-full transition-colors",
          isActive ? "bg-cyan-300" : "bg-slate-600 group-hover:bg-slate-400",
        ].join(" ")}
      />

      <span className="space-y-1">
        <span className="block font-medium">{item.label}</span>
        {item.description ? (
          <span className="block text-xs leading-5 text-slate-400">
            {item.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
