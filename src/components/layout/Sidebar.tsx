import Link from "next/link";
import { navigationGroups } from "@/constants/navigation";
import NavItem from "./NavItem";

export default function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-line bg-app px-3 py-5 lg:flex lg:flex-col">
      {/* The name of the product is not the heading of the page: each page has one h1 of its own. */}
      <Link href="/dashboard" className="mb-6 block px-3">
        <span className="block text-micro font-semibold uppercase tracking-eyebrow text-link/80">GridIntel</span>
        <span className="mt-0.5 block text-sm font-semibold text-ink">Energy Intelligence Platform</span>
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {navigationGroups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <p className="mb-1 px-3 text-micro font-semibold uppercase tracking-title text-ink-5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
